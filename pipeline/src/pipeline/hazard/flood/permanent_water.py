"""JRC Global Surface Water ingestion and permanent water filtering.

Streams the EC JRC Global Surface Water (GSW v1.5) occurrence layer from public
cloud storage, reprojects/resamples it onto the Sentinel-1 reference grid, and masks
out permanent/persistent water bodies from SAR inundation masks.
"""

from typing import Tuple
from pathlib import Path
import math
import numpy as np
import rasterio
from rasterio.windows import from_bounds, transform as window_transform
from rasterio.warp import reproject, Resampling
from pyproj import Transformer

from .aoi import get_barpeta_bbox_wgs84

# Default Google Cloud Storage bucket URL for JRC GSW v1.5 (1984–2024)
JRC_BASE_URL = "https://storage.googleapis.com/water-world/download2024/VER1-5"
DEFAULT_PERMANENT_OCCURRENCE_THRESHOLD_PCT = 80.0


def get_jrc_tile_id(lon: float, lat: float) -> str:
    """Compute the top-left 10x10 degree tile identifier for JRC GSW (e.g. '90E_30N').

    Args:
        lon: Longitude in degrees (-180 to 180).
        lat: Latitude in degrees (-90 to 90).

    Returns:
        Tile string in format '{LON_INT}{E/W}_{LAT_INT}{N/S}'.
    """
    # Top-left corner latitude is rounded up to next 10 deg multiple
    top_lat = math.ceil(lat / 10.0) * 10
    # Top-left corner longitude is rounded down to previous 10 deg multiple
    left_lon = math.floor(lon / 10.0) * 10

    lat_str = f"{abs(top_lat)}{'S' if top_lat < 0 else 'N'}"
    lon_str = f"{abs(left_lon)}{'W' if left_lon < 0 else 'E'}"
    return f"{lon_str}_{lat_str}"


def get_jrc_occurrence_url(lon: float, lat: float) -> str:
    """Build the direct public Cloud-Optimized GeoTIFF URL for the JRC occurrence tile."""
    tile_id = get_jrc_tile_id(lon, lat)
    return f"{JRC_BASE_URL}/occurrence/occurrence_{tile_id}_v1_5_2024.tif"


def stream_jrc_occurrence(
    bbox_wgs84: list[float] | None = None,
) -> Tuple[np.ndarray, rasterio.Affine, rasterio.crs.CRS, float]:
    """Stream and window-clip the 30m WGS84 JRC water occurrence raster for an AOI.

    Args:
        bbox_wgs84: Bounding box [min_lon, min_lat, max_lon, max_lat] in EPSG:4326.
                    Defaults to Barpeta bounding box.

    Returns:
        Tuple of (occurrence_data, win_transform, crs, nodata).
        occurrence_data has values in [0, 100] representing historical detection %.
    """
    if bbox_wgs84 is None:
        bbox_wgs84 = get_barpeta_bbox_wgs84()

    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    # Use center coordinate to determine the covering tile
    center_lon = (min_lon + max_lon) / 2.0
    center_lat = (min_lat + max_lat) / 2.0
    tile_url = get_jrc_occurrence_url(center_lon, center_lat)

    with rasterio.open(tile_url) as src:
        window = from_bounds(min_lon, min_lat, max_lon, max_lat, transform=src.transform)
        data = src.read(1, window=window, boundless=True, fill_value=src.nodata or 255)
        win_trans = window_transform(window, src.transform)
        crs = src.crs
        nodata = src.nodata or 255

    return data, win_trans, crs, nodata


def generate_permanent_water_mask(
    reference_shape: tuple[int, int],
    reference_transform: rasterio.Affine,
    reference_crs: rasterio.crs.CRS | str,
    bbox_wgs84: list[float] | None = None,
    occurrence_threshold_pct: float = DEFAULT_PERMANENT_OCCURRENCE_THRESHOLD_PCT,
) -> Tuple[np.ndarray, np.ndarray]:
    """Reproject JRC occurrence data to the SAR reference grid and create permanent water mask.

    Args:
        reference_shape: (height, width) of target SAR grid.
        reference_transform: Affine transform of target SAR grid.
        reference_crs: CRS of target SAR grid (e.g. 'EPSG:32645').
        bbox_wgs84: Bounding box in EPSG:4326.
        occurrence_threshold_pct: Minimum water occurrence % to classify as permanent water.

    Returns:
        Tuple of (permanent_mask, reprojected_occurrence_pct):
            - permanent_mask: 2D bool array where True indicates permanent water.
            - reprojected_occurrence_pct: 2D uint8 array with occurrence percentage (0–100).
    """
    jrc_raw, jrc_trans, jrc_crs, jrc_nodata = stream_jrc_occurrence(bbox_wgs84)

    reprojected_occurrence = np.zeros(reference_shape, dtype=np.uint8)

    reproject(
        source=jrc_raw,
        destination=reprojected_occurrence,
        src_transform=jrc_trans,
        src_crs=jrc_crs,
        dst_transform=reference_transform,
        dst_crs=reference_crs,
        resampling=Resampling.bilinear,
    )

    # Valid permanent water: occurrence >= threshold and not nodata
    permanent_mask = (reprojected_occurrence >= occurrence_threshold_pct) & (reprojected_occurrence <= 100)
    return permanent_mask, reprojected_occurrence


def filter_permanent_water(water_mask: np.ndarray, permanent_mask: np.ndarray) -> np.ndarray:
    """Filter out permanent water from a SAR water mask to isolate temporary floodwaters.

    Output convention:
        0: Land / Non-flood water (including permanent water bodies)
        1: Flood / Temporary Inundation
        255: Nodata / Out-of-swath

    Args:
        water_mask: 2D uint8 array (0=land, 1=water, 255=nodata).
        permanent_mask: 2D bool array where True is permanent water.

    Returns:
        2D uint8 filtered inundation mask.
    """
    filtered = water_mask.copy()
    # Where permanent water exists and water was detected, reset to 0 (non-flood)
    is_perm_water = permanent_mask & (filtered == 1)
    filtered[is_perm_water] = 0
    return filtered
