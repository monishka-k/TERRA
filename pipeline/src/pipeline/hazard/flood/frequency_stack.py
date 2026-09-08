"""Multi-temporal Sentinel-1 water mask stacking and inundation frequency mapping.

Processes a time series of Sentinel-1 RTC scenes, applies permanent water removal,
aligns masks to a master reference grid, and computes per-pixel empirical inundation frequency.
"""

from typing import Any, Tuple
from pathlib import Path
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling
from pyproj import Transformer

from .aoi import get_barpeta_bbox_wgs84
from .water_mask import stream_and_clip_raster, linear_to_db, detect_water, DEFAULT_VV_WATER_THRESHOLD_DB
from .permanent_water import generate_permanent_water_mask, filter_permanent_water
from .stac import extract_scene_metadata

NODATA_VALUE_UINT8 = 255


def create_master_grid(
    bbox_wgs84: list[float] | None = None,
    target_crs: str = "EPSG:32645",
    resolution_m: float = 10.0,
) -> Tuple[rasterio.Affine, tuple[int, int], tuple[float, float, float, float]]:
    """Define a standard reference raster grid covering the AOI at the specified resolution.

    Args:
        bbox_wgs84: [min_lon, min_lat, max_lon, max_lat] in EPSG:4326.
        target_crs: Master CRS (default EPSG:32645, UTM Zone 45N).
        resolution_m: Spatial resolution in meters (default 10.0m).

    Returns:
        Tuple of (master_transform, (height, width), (minx, miny, maxx, maxy)).
    """
    if bbox_wgs84 is None:
        bbox_wgs84 = get_barpeta_bbox_wgs84()

    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    transformer = Transformer.from_crs("EPSG:4326", target_crs, always_xy=True)
    minx, miny = transformer.transform(min_lon, min_lat)
    maxx, maxy = transformer.transform(max_lon, max_lat)

    width = int(np.ceil((maxx - minx) / resolution_m))
    height = int(np.ceil((maxy - miny) / resolution_m))
    
    # Standard top-left origin transform with negative y-resolution
    master_transform = rasterio.Affine(resolution_m, 0.0, minx, 0.0, -resolution_m, maxy)
    return master_transform, (height, width), (minx, miny, maxx, maxy)


def process_scene_inundation(
    scene_item: Any,
    master_shape: tuple[int, int],
    master_transform: rasterio.Affine,
    master_crs: str,
    permanent_water_mask: np.ndarray,
    bbox_wgs84: list[float] | None = None,
    threshold_db: float = DEFAULT_VV_WATER_THRESHOLD_DB,
    decimation: int = 1,
) -> Tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    """Process a single Sentinel-1 scene: fetch VV, detect water, remove permanent water, reproject to master grid.

    Returns:
        Tuple of (flood_mask_master, valid_mask_master, scene_meta):
            - flood_mask_master: bool array on master grid (True where temporary flood detected).
            - valid_mask_master: bool array on master grid (True where satellite observed).
            - scene_meta: metadata dictionary.
    """
    if bbox_wgs84 is None:
        bbox_wgs84 = get_barpeta_bbox_wgs84()

    meta = extract_scene_metadata(scene_item)
    raw_vv, scene_transform, scene_crs, nodata_val = stream_and_clip_raster(
        meta["vv_href"],
        bbox_wgs84=bbox_wgs84,
        decimation=decimation,
    )

    vv_db, valid_mask = linear_to_db(raw_vv, nodata_val=nodata_val)
    raw_water_mask = detect_water(vv_db, valid_mask, threshold_db=threshold_db)

    # Reproject raw water mask to master grid
    aligned_water_mask = np.full(master_shape, NODATA_VALUE_UINT8, dtype=np.uint8)
    reproject(
        source=raw_water_mask,
        destination=aligned_water_mask,
        src_transform=scene_transform,
        src_crs=scene_crs,
        dst_transform=master_transform,
        dst_crs=master_crs,
        src_nodata=NODATA_VALUE_UINT8,
        dst_nodata=NODATA_VALUE_UINT8,
        resampling=Resampling.nearest,
    )

    # Remove permanent water
    filtered_mask = filter_permanent_water(aligned_water_mask, permanent_water_mask)

    valid_obs = (filtered_mask != NODATA_VALUE_UINT8)
    flood_obs = (filtered_mask == 1)

    return flood_obs, valid_obs, meta


def accumulate_inundation_stack(
    scenes: list[Any],
    master_shape: tuple[int, int],
    master_transform: rasterio.Affine,
    master_crs: str,
    permanent_water_mask: np.ndarray,
    bbox_wgs84: list[float] | None = None,
    threshold_db: float = DEFAULT_VV_WATER_THRESHOLD_DB,
    verbose: bool = True,
    decimation: int = 1,
) -> Tuple[np.ndarray, np.ndarray, list[dict[str, Any]]]:
    """Process multiple Sentinel-1 scenes and accumulate valid observation and flood detection counts.

    Returns:
        Tuple of (water_counts, valid_counts, processed_metadata_list):
            - water_counts: 2D uint16 array of flood detection count per pixel.
            - valid_counts: 2D uint16 array of valid observation count per pixel.
            - processed_metadata_list: list of metadata dicts for processed scenes.
    """
    water_counts = np.zeros(master_shape, dtype=np.uint16)
    valid_counts = np.zeros(master_shape, dtype=np.uint16)
    processed_scenes = []

    for i, scene in enumerate(scenes):
        scene_id = scene.id
        scene_date = scene.datetime.strftime("%Y-%m-%d") if scene.datetime else "Unknown"
        if verbose:
            print(f"  [{i+1}/{len(scenes)}] Processing {scene_id[:35]}... ({scene_date})")

        flood_obs, valid_obs, meta = process_scene_inundation(
            scene,
            master_shape=master_shape,
            master_transform=master_transform,
            master_crs=master_crs,
            permanent_water_mask=permanent_water_mask,
            bbox_wgs84=bbox_wgs84,
            threshold_db=threshold_db,
            decimation=decimation,
        )

        valid_count_scene = np.sum(valid_obs)
        flood_count_scene = np.sum(flood_obs)
        if verbose:
            print(f"       Valid pixels: {valid_count_scene:,} | Flood pixels: {flood_count_scene:,}")

        water_counts += flood_obs.astype(np.uint16)
        valid_counts += valid_obs.astype(np.uint16)
        processed_scenes.append(meta)

    return water_counts, valid_counts, processed_scenes


def calculate_inundation_frequency(
    water_counts: np.ndarray,
    valid_counts: np.ndarray,
    min_observations: int = 1,
) -> Tuple[np.ndarray, np.ndarray]:
    """Calculate empirical inundation frequency F(x, y) = sum(W) / sum(V).

    Args:
        water_counts: 2D array of flood detection counts.
        valid_counts: 2D array of valid observation counts.
        min_observations: Minimum valid observations required to compute frequency.

    Returns:
        Tuple of (frequency_surface, confidence_mask):
            - frequency_surface: 2D float32 array in [0.0, 1.0], NaN where invalid or insufficient data.
            - confidence_mask: 2D bool array indicating where observations >= min_observations.
    """
    frequency = np.full(water_counts.shape, np.nan, dtype=np.float32)
    confidence_mask = valid_counts >= min_observations

    with np.errstate(divide="ignore", invalid="ignore"):
        frequency[confidence_mask] = (
            water_counts[confidence_mask].astype(np.float32) / valid_counts[confidence_mask].astype(np.float32)
        )

    return frequency, confidence_mask
