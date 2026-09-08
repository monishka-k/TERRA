"""ESA WorldCover 10m ingestion and cropland fraction layer generation.

Streams the ESA WorldCover v200 (2021) 10m land cover classification from Microsoft
Planetary Computer STAC, extracts Class 40 (Cropland), and reprojects/resamples it
onto the Sentinel-1 master processing grid to compute a continuous cropland fraction
layer [0.0, 1.0].
"""

import sys
from pathlib import Path
from typing import Tuple
import numpy as np
import rasterio
from rasterio.windows import from_bounds, transform as window_transform
from rasterio.warp import reproject, Resampling
import pystac_client
import planetary_computer

try:
    from .aoi import get_barpeta_bbox_wgs84
except (ImportError, ValueError):
    from aoi import get_barpeta_bbox_wgs84

PLANETARY_COMPUTER_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION_ESA_WORLDCOVER = "esa-worldcover"
CROPLAND_CLASS_VALUE = 40  # ESA WorldCover Class 40: Cropland / Agriculture


def get_stac_client() -> pystac_client.Client:
    """Open and return an authenticated STAC client with Planetary Computer token signing."""
    return pystac_client.Client.open(
        PLANETARY_COMPUTER_STAC_URL,
        modifier=planetary_computer.sign_inplace,
    )


def query_worldcover_item(
    bbox_wgs84: list[float] | None = None,
    year: int = 2021,
) -> str:
    """Query Planetary Computer STAC for the ESA WorldCover item covering bbox.

    Args:
        bbox_wgs84: Bounding box [min_lon, min_lat, max_lon, max_lat] in EPSG:4326.
        year: Coverage year (2020 for v100, 2021 for v200). Defaults to 2021.

    Returns:
        Signed asset URL for the Cloud-Optimized GeoTIFF 'map'.
    """
    if bbox_wgs84 is None:
        bbox_wgs84 = get_barpeta_bbox_wgs84()

    catalog = get_stac_client()
    datetime_range = f"{year}-01-01/{year}-12-31"
    search = catalog.search(
        collections=[COLLECTION_ESA_WORLDCOVER],
        bbox=bbox_wgs84,
        datetime=datetime_range,
    )
    items = list(search.items())
    if not items:
        raise RuntimeError(
            f"No ESA WorldCover items found on Planetary Computer for bbox {bbox_wgs84} and year {year}"
        )

    # Pick the first covering item (or primary tile)
    item = items[0]
    if "map" not in item.assets:
        raise KeyError(f"ESA WorldCover item {item.id} does not contain 'map' asset")

    return item.assets["map"].href


def stream_worldcover_cropland(
    bbox_wgs84: list[float] | None = None,
    year: int = 2021,
) -> Tuple[np.ndarray, rasterio.Affine, rasterio.crs.CRS, float]:
    """Stream and window-clip 10m ESA WorldCover land cover, returning binary cropland mask.

    Args:
        bbox_wgs84: Bounding box [min_lon, min_lat, max_lon, max_lat] in EPSG:4326.
        year: WorldCover year.

    Returns:
        Tuple of (cropland_binary, win_transform, crs, nodata).
        cropland_binary is float32 array: 1.0 for Class 40 (Cropland), 0.0 otherwise.
    """
    if bbox_wgs84 is None:
        bbox_wgs84 = get_barpeta_bbox_wgs84()

    map_url = query_worldcover_item(bbox_wgs84=bbox_wgs84, year=year)

    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    with rasterio.open(map_url) as src:
        window = from_bounds(min_lon, min_lat, max_lon, max_lat, transform=src.transform)
        raw_data = src.read(1, window=window, boundless=True, fill_value=src.nodata or 0)
        win_trans = window_transform(window, src.transform)
        crs = src.crs
        nodata = float(src.nodata or 0)

    # Class 40 is Cropland
    cropland_mask = np.zeros_like(raw_data, dtype=np.float32)
    valid_mask = raw_data != nodata
    cropland_mask[valid_mask & (raw_data == CROPLAND_CLASS_VALUE)] = 1.0

    return cropland_mask, win_trans, crs, nodata


def generate_cropland_fraction(
    reference_shape: tuple[int, int],
    reference_transform: rasterio.Affine,
    reference_crs: rasterio.crs.CRS | str,
    bbox_wgs84: list[float] | None = None,
    year: int = 2021,
) -> np.ndarray:
    """Reproject ESA WorldCover cropland mask to target SAR master grid with area averaging.

    Args:
        reference_shape: (height, width) of target SAR master grid.
        reference_transform: Affine transform of target SAR master grid.
        reference_crs: Target CRS (e.g. 'EPSG:32645').
        bbox_wgs84: AOI bounding box in EPSG:4326.
        year: WorldCover version year (2021).

    Returns:
        cropland_fraction: float32 array of shape reference_shape with values in [0.0, 1.0].
    """
    if bbox_wgs84 is None:
        bbox_wgs84 = get_barpeta_bbox_wgs84()

    cropland_binary, src_transform, src_crs, _ = stream_worldcover_cropland(
        bbox_wgs84=bbox_wgs84,
        year=year,
    )

    cropland_fraction = np.zeros(reference_shape, dtype=np.float32)

    reproject(
        source=cropland_binary,
        destination=cropland_fraction,
        src_transform=src_transform,
        src_crs=src_crs,
        dst_transform=reference_transform,
        dst_crs=reference_crs,
        resampling=Resampling.average,
    )

    # Clip to valid probability/fraction bounds [0.0, 1.0]
    np.clip(cropland_fraction, 0.0, 1.0, out=cropland_fraction)

    return cropland_fraction


if __name__ == "__main__":
    try:
        from .frequency_stack import create_master_grid
    except (ImportError, ValueError):
        from pipeline.hazard.flood.frequency_stack import create_master_grid

    print("Testing ESA WorldCover cropland extraction for Barpeta...")
    bbox = get_barpeta_bbox_wgs84()
    transform, shape, _ = create_master_grid(bbox, target_crs="EPSG:32645", resolution_m=10.0)
    print(f"Master Grid Shape: {shape}")
    crop_frac = generate_cropland_fraction(shape, transform, "EPSG:32645", bbox)
    print("Cropland fraction stats:")
    print(f"  Shape: {crop_frac.shape}")
    print(f"  Min: {np.nanmin(crop_frac):.3f}, Max: {np.nanmax(crop_frac):.3f}, Mean: {np.nanmean(crop_frac):.3f}")
    print(f"  Pixels with >50% cropland: {np.sum(crop_frac > 0.5):,} ({np.mean(crop_frac > 0.5)*100:.1f}%)")
