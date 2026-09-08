"""SAR backscatter ingestion and water mask generation.

Streams Sentinel-1 RTC Cloud-Optimized GeoTIFFs (COGs), clips to the Area of Interest,
converts linear backscatter power to decibels (dB), and computes binary water masks.
"""

from typing import Tuple
from pathlib import Path
import numpy as np
import rasterio
from rasterio.windows import from_bounds, transform as window_transform
from rasterio.enums import Resampling
from pyproj import Transformer
from .aoi import get_barpeta_bbox_wgs84, get_barpeta_bounds_projected, BARPETA_CRS_PROJECTED

# Default threshold in decibels (dB) for VV polarization open water detection
DEFAULT_VV_WATER_THRESHOLD_DB = -16.0
NODATA_VALUE_UINT8 = 255


def linear_to_db(array: np.ndarray, nodata_val: float | None = 0.0) -> Tuple[np.ndarray, np.ndarray]:
    """Convert linear backscatter power (gamma0) to decibels (dB).

    Args:
        array: 2D numpy array of linear backscatter values.
        nodata_val: Value representing nodata or missing data in input.

    Returns:
        Tuple of (array_db, valid_mask):
            - array_db: float32 array in decibels.
            - valid_mask: bool array where True indicates valid observation.
    """
    valid_mask = np.isfinite(array) & (array > 0)
    if nodata_val is not None and not np.isnan(nodata_val):
        valid_mask = valid_mask & (array != nodata_val)

    array_db = np.full(array.shape, np.nan, dtype=np.float32)
    # 10 * log10(gamma0)
    array_db[valid_mask] = 10.0 * np.log10(np.clip(array[valid_mask], 1e-7, None))
    return array_db, valid_mask


def stream_and_clip_raster(
    asset_url: str,
    bbox_wgs84: list[float] | None = None,
    projected_bounds: tuple[float, float, float, float] | None = None,
    decimation: int = 1,
) -> Tuple[np.ndarray, rasterio.Affine, rasterio.crs.CRS, float]:
    """Stream a sub-window of a Cloud-Optimized GeoTIFF without downloading the full image.

    Args:
        asset_url: SAS-signed Azure Blob Storage URL for GeoTIFF.
        bbox_wgs84: Bounding box [min_lon, min_lat, max_lon, max_lat] in EPSG:4326.
                    Dynamically projected to the raster's native CRS.
        projected_bounds: Optional explicit (minx, miny, maxx, maxy) in the raster's native CRS.
        decimation: Integer downsampling factor. ``1`` reads at native resolution;
                    ``k > 1`` reads the window at ~1/k resolution via COG overviews,
                    transferring ~k^2 less data. The returned transform is scaled
                    to match. Useful when the output grid is far coarser than the
                    source (e.g. H3 res-8 aggregation over a slow link).

    Returns:
        Tuple of (data_2d, transform, crs, nodata).
    """
    if bbox_wgs84 is None and projected_bounds is None:
        bbox_wgs84 = get_barpeta_bbox_wgs84()

    k = max(1, int(decimation))

    with rasterio.open(asset_url) as src:
        if projected_bounds is None and bbox_wgs84 is not None:
            min_lon, min_lat, max_lon, max_lat = bbox_wgs84
            transformer = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True)
            minx, miny = transformer.transform(min_lon, min_lat)
            maxx, maxy = transformer.transform(max_lon, max_lat)
        else:
            minx, miny, maxx, maxy = projected_bounds  # type: ignore

        # Determine the window intersecting the requested bounds
        window = from_bounds(minx, miny, maxx, maxy, transform=src.transform)
        win_transform = window_transform(window, src.transform)

        if k == 1:
            data = src.read(1, window=window, boundless=True, fill_value=src.nodata or 0.0)
        else:
            out_h = max(1, int(np.ceil(window.height / k)))
            out_w = max(1, int(np.ceil(window.width / k)))
            data = src.read(
                1,
                window=window,
                boundless=True,
                fill_value=src.nodata or 0.0,
                out_shape=(out_h, out_w),
                resampling=Resampling.average,
            )
            win_transform = win_transform * rasterio.Affine.scale(
                window.width / out_w, window.height / out_h
            )

        crs = src.crs
        nodata = src.nodata or 0.0

    return data, win_transform, crs, nodata


def detect_water(
    vv_db: np.ndarray,
    valid_mask: np.ndarray,
    threshold_db: float = DEFAULT_VV_WATER_THRESHOLD_DB,
) -> np.ndarray:
    """Generate binary water mask from VV backscatter in decibels.

    Output convention:
        0: Land / Valid Non-Water
        1: Inundated / Water
        255: Nodata / Invalid Observation

    Args:
        vv_db: 2D numpy array of VV backscatter in dB.
        valid_mask: 2D bool numpy array indicating valid pixels.
        threshold_db: Threshold in dB below which pixels are classified as water.

    Returns:
        2D uint8 numpy array.
    """
    mask = np.full(vv_db.shape, NODATA_VALUE_UINT8, dtype=np.uint8)
    
    # Valid land vs water
    is_water = (vv_db < threshold_db) & valid_mask
    is_land = (vv_db >= threshold_db) & valid_mask

    mask[is_land] = 0
    mask[is_water] = 1

    return mask


def save_raster_geotiff(
    output_path: str | Path,
    data: np.ndarray,
    transform: rasterio.Affine,
    crs: rasterio.crs.CRS | str,
    nodata: int | float = NODATA_VALUE_UINT8,
    dtype: str = "uint8",
) -> Path:
    """Save a 2D numpy array as a Deflate-compressed GeoTIFF."""
    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    height, width = data.shape
    profile = {
        "driver": "GTiff",
        "height": height,
        "width": width,
        "count": 1,
        "dtype": dtype,
        "crs": crs,
        "transform": transform,
        "nodata": nodata,
        "compress": "deflate",
        "tiled": True,
        "blockxsize": 256,
        "blockysize": 256,
    }

    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(data.astype(dtype), 1)

    return out_path
