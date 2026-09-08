"""Height Above Nearest Drainage (HAND) and Slope Terrain Derivatives.

Streams ASF GLO-30 HAND (AWS Open Data) and Copernicus DEM GLO-30 (Planetary Computer/AWS),
reprojects both to the 10m UTM master grid, computes slope in degrees, and generates the
hard-zero exclusion mask (HAND > 30m OR slope > 15°) per FR-3.17.
"""

from typing import Any, Tuple
import math
from pathlib import Path
import numpy as np
import rasterio
from rasterio.windows import from_bounds, transform as window_transform
from rasterio.warp import reproject, Resampling
from pyproj import Transformer
import pystac_client
import planetary_computer

try:
    from .aoi import get_barpeta_bbox_wgs84
    from .stac import get_stac_client
    from .water_mask import save_raster_geotiff
except (ImportError, ValueError):
    from aoi import get_barpeta_bbox_wgs84
    from stac import get_stac_client
    from water_mask import save_raster_geotiff

# ASF GLO-30 HAND public S3 base URL
ASF_HAND_BASE_URL = "https://glo-30-hand.s3.amazonaws.com/v1/2021"

# AWS Open Data Copernicus DEM GLO-30 base URL (fallback if STAC unavailable)
AWS_DEM_BASE_URL = "https://copernicus-dem-30m.s3.amazonaws.com"

# FR-3.17 Screening Thresholds
DEFAULT_HARD_ZERO_HAND_THRESHOLD_M = 30.0
DEFAULT_HARD_ZERO_SLOPE_THRESHOLD_DEG = 15.0


def get_hand_tile_name(lat: int, lon: int) -> str:
    """Generate the standard ASF/Copernicus tile filename for integer lat/lon degrees.

    Args:
        lat: Bottom latitude in integer degrees (e.g. 26).
        lon: Left longitude in integer degrees (e.g. 90).

    Returns:
        Tile filename string, e.g. 'Copernicus_DSM_COG_10_N26_00_E090_00_HAND.tif'.
    """
    lat_prefix = "N" if lat >= 0 else "S"
    lon_prefix = "E" if lon >= 0 else "W"
    lat_str = f"{lat_prefix}{abs(lat):02d}_00"
    lon_str = f"{lon_prefix}{abs(lon):03d}_00"
    return f"Copernicus_DSM_COG_10_{lat_str}_{lon_str}_HAND.tif"


def get_hand_tile_urls(bbox_wgs84: list[float] | None = None) -> list[str]:
    """Get public HTTP URLs for all ASF GLO-30 HAND tiles intersecting the bbox.

    Args:
        bbox_wgs84: [min_lon, min_lat, max_lon, max_lat] in EPSG:4326.
                    Defaults to Barpeta bounding box.

    Returns:
        List of public S3 COG URLs.
    """
    if bbox_wgs84 is None:
        bbox_wgs84 = get_barpeta_bbox_wgs84()

    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    lat_start = int(math.floor(min_lat))
    lat_end = int(math.floor(max_lat))
    lon_start = int(math.floor(min_lon))
    lon_end = int(math.floor(max_lon))

    urls = []
    for lat in range(lat_start, lat_end + 1):
        for lon in range(lon_start, lon_end + 1):
            tile_name = get_hand_tile_name(lat, lon)
            urls.append(f"{ASF_HAND_BASE_URL}/{tile_name}")
    return urls


def get_dem_tile_urls_stac(bbox_wgs84: list[float] | None = None) -> list[dict[str, Any]]:
    """Query Microsoft Planetary Computer STAC for Copernicus DEM GLO-30 items.

    Args:
        bbox_wgs84: Bounding box in EPSG:4326.

    Returns:
        List of dicts with 'id', 'href', and 'bbox'.
    """
    if bbox_wgs84 is None:
        bbox_wgs84 = get_barpeta_bbox_wgs84()

    catalog = get_stac_client()
    search = catalog.search(
        collections=["cop-dem-glo-30"],
        bbox=bbox_wgs84,
    )
    items = list(search.items())
    results = []
    for it in items:
        if "data" in it.assets:
            results.append({
                "id": it.id,
                "href": it.assets["data"].href,
                "bbox": it.bbox,
            })
    return results


def stream_and_reproject_hand(
    master_shape: tuple[int, int],
    master_transform: rasterio.Affine,
    master_crs: str,
    bbox_wgs84: list[float] | None = None,
    cache_path: Path | None = None,
) -> np.ndarray:
    """Stream ASF GLO-30 HAND tiles and reproject onto the master grid.

    Args:
        master_shape: (height, width) of master grid.
        master_transform: Affine transform of master grid.
        master_crs: CRS of master grid (e.g. 'EPSG:32645').
        bbox_wgs84: [min_lon, min_lat, max_lon, max_lat] in EPSG:4326.
        cache_path: Optional path to load/save cached GeoTIFF.

    Returns:
        2D float32 array on master grid containing HAND in meters.
    """
    if cache_path is not None and cache_path.exists():
        with rasterio.open(cache_path) as src:
            if src.shape == master_shape:
                print(f"  [+] Loading cached HAND from: {cache_path}")
                return src.read(1)

    if bbox_wgs84 is None:
        bbox_wgs84 = get_barpeta_bbox_wgs84()

    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    tile_urls = get_hand_tile_urls(bbox_wgs84)

    master_hand = np.full(master_shape, np.nan, dtype=np.float32)

    gdal_env = {
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
    }

    with rasterio.Env(**gdal_env):
        for url in tile_urls:
            tile_name = url.split("/")[-1]
            try:
                with rasterio.open(url) as src:
                    ix_min = max(min_lon, src.bounds.left)
                    ix_max = min(max_lon, src.bounds.right)
                    iy_min = max(min_lat, src.bounds.bottom)
                    iy_max = min(max_lat, src.bounds.top)

                    if ix_min >= ix_max or iy_min >= iy_max:
                        continue

                    win = from_bounds(ix_min, iy_min, ix_max, iy_max, transform=src.transform)
                    tile_data = src.read(1, window=win)
                    win_trans = window_transform(win, src.transform)

                    temp_master = np.full(master_shape, np.nan, dtype=np.float32)
                    reproject(
                        source=tile_data,
                        destination=temp_master,
                        src_transform=win_trans,
                        src_crs=src.crs,
                        dst_transform=master_transform,
                        dst_crs=master_crs,
                        src_nodata=src.nodata,
                        dst_nodata=np.nan,
                        resampling=Resampling.bilinear,
                    )

                    valid = np.isfinite(temp_master)
                    master_hand[valid] = temp_master[valid]
                    print(f"  [+] Ingested HAND tile: {tile_name} ({np.sum(valid):,} valid pixels)")
            except Exception as e:
                print(f"  [!] Warning: Failed to stream HAND tile {tile_name}: {e}")

    # Clip negative values resulting from interpolation near 0 to 0.0
    master_hand = np.where(np.isfinite(master_hand), np.maximum(master_hand, 0.0), np.nan)

    if cache_path is not None:
        save_raster_geotiff(cache_path, master_hand, master_transform, master_crs, nodata=np.nan, dtype="float32")
        print(f"  [+] Cached HAND raster to: {cache_path}")

    return master_hand


def stream_and_reproject_dem(
    master_shape: tuple[int, int],
    master_transform: rasterio.Affine,
    master_crs: str,
    bbox_wgs84: list[float] | None = None,
    cache_path: Path | None = None,
) -> np.ndarray:
    """Stream Copernicus DEM GLO-30 tiles and reproject onto the master grid.

    Args:
        master_shape: (height, width) of master grid.
        master_transform: Affine transform of master grid.
        master_crs: CRS of master grid.
        bbox_wgs84: Bounding box in EPSG:4326.
        cache_path: Optional path to load/save cached GeoTIFF.

    Returns:
        2D float32 array on master grid containing elevation in meters.
    """
    if cache_path is not None and cache_path.exists():
        with rasterio.open(cache_path) as src:
            if src.shape == master_shape:
                print(f"  [+] Loading cached DEM from: {cache_path}")
                return src.read(1)

    if bbox_wgs84 is None:
        bbox_wgs84 = get_barpeta_bbox_wgs84()

    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    master_dem = np.full(master_shape, np.nan, dtype=np.float32)

    # Query STAC items
    stac_items = get_dem_tile_urls_stac(bbox_wgs84)
    if not stac_items:
        # Fallback to direct AWS Open Data URLs
        lat_start = int(math.floor(min_lat))
        lat_end = int(math.floor(max_lat))
        lon_start = int(math.floor(min_lon))
        lon_end = int(math.floor(max_lon))
        for lat in range(lat_start, lat_end + 1):
            for lon in range(lon_start, lon_end + 1):
                lat_str = f"N{abs(lat):02d}_00" if lat >= 0 else f"S{abs(lat):02d}_00"
                lon_str = f"E{abs(lon):03d}_00" if lon >= 0 else f"W{abs(lon):03d}_00"
                tile_id = f"Copernicus_DSM_COG_10_{lat_str}_{lon_str}_DEM"
                href = f"{AWS_DEM_BASE_URL}/{tile_id}/{tile_id}.tif"
                stac_items.append({"id": tile_id, "href": href})

    gdal_env = {
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
    }

    with rasterio.Env(**gdal_env):
        for item in stac_items:
            tile_id = item["id"]
            href = item["href"]
            try:
                with rasterio.open(href) as src:
                    ix_min = max(min_lon, src.bounds.left)
                    ix_max = min(max_lon, src.bounds.right)
                    iy_min = max(min_lat, src.bounds.bottom)
                    iy_max = min(max_lat, src.bounds.top)

                    if ix_min >= ix_max or iy_min >= iy_max:
                        continue

                    win = from_bounds(ix_min, iy_min, ix_max, iy_max, transform=src.transform)
                    tile_data = src.read(1, window=win)
                    win_trans = window_transform(win, src.transform)

                    temp_master = np.full(master_shape, np.nan, dtype=np.float32)
                    reproject(
                        source=tile_data,
                        destination=temp_master,
                        src_transform=win_trans,
                        src_crs=src.crs,
                        dst_transform=master_transform,
                        dst_crs=master_crs,
                        src_nodata=src.nodata,
                        dst_nodata=np.nan,
                        resampling=Resampling.bilinear,
                    )

                    valid = np.isfinite(temp_master)
                    master_dem[valid] = temp_master[valid]
                    print(f"  [+] Ingested DEM tile: {tile_id} ({np.sum(valid):,} valid pixels)")
            except Exception as e:
                print(f"  [!] Warning: Failed to stream DEM tile {tile_id}: {e}")

    if cache_path is not None:
        save_raster_geotiff(cache_path, master_dem, master_transform, master_crs, nodata=np.nan, dtype="float32")
        print(f"  [+] Cached DEM raster to: {cache_path}")

    return master_dem


def compute_slope_degrees(
    dem_elevation_m: np.ndarray,
    resolution_m: float = 10.0,
) -> np.ndarray:
    """Compute terrain slope in degrees using central differences (Horn's method equivalent).

    Args:
        dem_elevation_m: 2D float array of elevation in meters on a metric grid.
        resolution_m: Pixel size in meters (e.g. 10.0m).

    Returns:
        2D float32 array of slope in degrees [0.0, 90.0].
    """
    dz_dy, dz_dx = np.gradient(dem_elevation_m, resolution_m, resolution_m)
    slope_rad = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
    slope_deg = np.rad2deg(slope_rad).astype(np.float32)

    # Invalidate where DEM is NaN or invalid
    slope_deg[~np.isfinite(dem_elevation_m)] = np.nan
    return slope_deg


def compute_hard_zero_mask(
    hand_m: np.ndarray,
    slope_deg: np.ndarray,
    max_hand_m: float = DEFAULT_HARD_ZERO_HAND_THRESHOLD_M,
    max_slope_deg: float = DEFAULT_HARD_ZERO_SLOPE_THRESHOLD_DEG,
) -> Tuple[np.ndarray, np.ndarray]:
    """Compute the FR-3.17 hard-zero exclusion mask and flood-eligible domain mask.

    Per PRD FR-3.17 & Plan §9.1:
        S_flood = 0  where  HAND > 30 m  OR  slope > 15°

    Args:
        hand_m: 2D array of HAND values in meters.
        slope_deg: 2D array of slope values in degrees.
        max_hand_m: Threshold above which flood susceptibility is forced to 0 (default 30m).
        max_slope_deg: Threshold above which flood susceptibility is forced to 0 (default 15°).

    Returns:
        Tuple of (hard_zero_mask, flood_eligible_mask):
            - hard_zero_mask: bool array (True where terrain is excluded from flood susceptibility).
            - flood_eligible_mask: bool array (True where terrain is within low-lying flood domain).
    """
    valid_terrain = np.isfinite(hand_m) & np.isfinite(slope_deg)
    hard_zero_mask = (hand_m > max_hand_m) | (slope_deg > max_slope_deg)

    # Flood-eligible is valid terrain that does not meet the hard-zero condition
    flood_eligible_mask = valid_terrain & (~hard_zero_mask)
    return hard_zero_mask, flood_eligible_mask
