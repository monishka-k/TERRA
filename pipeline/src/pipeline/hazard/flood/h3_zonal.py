"""H3 Resolution 8 Zonal Statistics and Aggregation Module (Step 10).

Moves raster-space flood susceptibility onto the platform's common H3 hexagonal grid:
  - Generates H3 Res 8 cells for reporting AOI.
  - Computes exact fractional pixel zonal statistics using exactextract.
  - Applies §10.3 quality control flagging for edge/low-coverage cells.
  - Produces GeoParquet export conforming to PRD schema.
"""

from typing import Sequence, Optional
from pathlib import Path
import h3
import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Polygon
import exactextract
import rasterio

try:
    from .aoi import BARPETA_BBOX_WGS84
except (ImportError, ValueError):
    from aoi import BARPETA_BBOX_WGS84

# Default parameters
DEFAULT_H3_RESOLUTION = 8
DEFAULT_MIN_VALID_PIXEL_FRACTION = 0.5
DEFAULT_MODEL_VERSION = "flood-susceptibility-v0.1"
DEFAULT_HAZARD_TYPE = "riverine_flood"


def polyfill_reporting_aoi(
    bbox_wgs84: Optional[Sequence[float]] = None,
    resolution: int = DEFAULT_H3_RESOLUTION,
) -> list[str]:
    """Polyfills the reporting AOI at the given H3 resolution.

    Args:
        bbox_wgs84: Bounding box [min_lon, min_lat, max_lon, max_lat]. Defaults to Barpeta AOI.
        resolution: H3 resolution level (default 8).

    Returns:
        Sorted list of unique H3 hexadecimal cell strings.
    """
    if bbox_wgs84 is None:
        bbox_wgs84 = BARPETA_BBOX_WGS84

    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    ring = [
        (min_lat, min_lon),
        (max_lat, min_lon),
        (max_lat, max_lon),
        (min_lat, max_lon),
    ]
    poly = h3.LatLngPoly(ring)
    cells = h3.polygon_to_cells(poly, res=resolution)
    return sorted(list(cells))


def h3_cells_to_geodataframe(cells: Sequence[str]) -> gpd.GeoDataFrame:
    """Converts a list of H3 cell hex strings to a GeoDataFrame in EPSG:4326.

    Args:
        cells: Sequence of H3 cell hex strings.

    Returns:
        GeoDataFrame with columns:
          - h3_hex: str
          - h3_int: int64
          - centroid_lon: float
          - centroid_lat: float
          - geometry: shapely.geometry.Polygon (EPSG:4326)
    """
    h3_ints = []
    centroids_lon = []
    centroids_lat = []
    geometries = []

    for c in cells:
        h_int = h3.str_to_int(c)
        h3_ints.append(h_int)
        lat, lng = h3.cell_to_latlng(c)
        centroids_lon.append(round(lng, 6))
        centroids_lat.append(round(lat, 6))

        boundary = h3.cell_to_boundary(c)  # list of (lat, lng)
        poly = Polygon([(b_lng, b_lat) for b_lat, b_lng in boundary])
        geometries.append(poly)

    gdf = gpd.GeoDataFrame(
        {
            "h3_hex": list(cells),
            "h3_int": h3_ints,
            "centroid_lon": centroids_lon,
            "centroid_lat": centroids_lat,
            "geometry": geometries,
        },
        crs="EPSG:4326",
    )
    return gdf


def compute_zonal_statistics(
    cells_gdf: gpd.GeoDataFrame,
    raster_paths: dict[str, Path | str],
    target_crs: str = "EPSG:32645",
    pixel_res_m: float = 10.0,
) -> gpd.GeoDataFrame:
    """Computes exact fractional-coverage zonal statistics for all input rasters.

    Args:
        cells_gdf: GeoDataFrame of H3 cells in EPSG:4326.
        raster_paths: Dictionary mapping metric keys to raster filepaths:
          - 'susceptibility': Path to flood susceptibility GeoTIFF
          - 'confidence': Path to confidence GeoTIFF
          - 'frequency': Path to inundation frequency GeoTIFF
          - 'hand': Path to HAND GeoTIFF
          - 'slope': Path to slope GeoTIFF
          - 'cropland': Path to cropland fraction GeoTIFF (optional)
          - 'hard_zero': Path to hard-zero mask GeoTIFF (optional)
        target_crs: Projected CRS matching the rasters (default EPSG:32645).
        pixel_res_m: Raster pixel resolution in meters (default 10.0).

    Returns:
        GeoDataFrame with original EPSG:4326 geometry and aggregated metric columns.
    """
    # Reproject cells to raster projected CRS for exact planar overlap
    cells_proj = cells_gdf.to_crs(target_crs)
    pixel_area_m2 = pixel_res_m * pixel_res_m
    expected_pixels = cells_proj.geometry.area / pixel_area_m2

    res_df = cells_gdf.copy()

    # 1. Flood Susceptibility (mean, max, count for valid pixel fraction)
    susc_path = str(raster_paths["susceptibility"])
    susc_stats = exactextract.exact_extract(
        susc_path,
        cells_proj,
        ["mean", "max", "count"],
        output="pandas",
    )
    valid_count = susc_stats["count"].to_numpy()
    valid_frac = np.clip(valid_count / expected_pixels.to_numpy(), 0.0, 1.0)

    res_df["mean_flood_susceptibility"] = susc_stats["mean"].astype("float32")
    res_df["max_flood_susceptibility"] = susc_stats["max"].astype("float32")
    res_df["valid_pixel_fraction"] = valid_frac.astype("float32")

    # 2. Confidence (mean)
    if "confidence" in raster_paths and raster_paths["confidence"]:
        conf_path = str(raster_paths["confidence"])
        conf_stats = exactextract.exact_extract(conf_path, cells_proj, ["mean"], output="pandas")
        res_df["mean_confidence"] = conf_stats["mean"].astype("float32")
    else:
        res_df["mean_confidence"] = np.float32(1.0)

    # 3. Inundation Frequency (mean)
    if "frequency" in raster_paths and raster_paths["frequency"]:
        freq_path = str(raster_paths["frequency"])
        freq_stats = exactextract.exact_extract(freq_path, cells_proj, ["mean"], output="pandas")
        res_df["mean_inundation_frequency"] = freq_stats["mean"].astype("float32")
    else:
        res_df["mean_inundation_frequency"] = np.float32(0.0)

    # 4. HAND (mean, min)
    if "hand" in raster_paths and raster_paths["hand"]:
        hand_path = str(raster_paths["hand"])
        hand_stats = exactextract.exact_extract(hand_path, cells_proj, ["mean", "min"], output="pandas")
        res_df["mean_hand"] = hand_stats["mean"].astype("float32")
        res_df["min_hand"] = hand_stats["min"].astype("float32")
    else:
        res_df["mean_hand"] = np.nan
        res_df["min_hand"] = np.nan

    # 5. Slope (mean)
    if "slope" in raster_paths and raster_paths["slope"]:
        slope_path = str(raster_paths["slope"])
        slope_stats = exactextract.exact_extract(slope_path, cells_proj, ["mean"], output="pandas")
        res_df["mean_slope"] = slope_stats["mean"].astype("float32")
    else:
        res_df["mean_slope"] = np.nan

    # 6. Cropland Fraction (mean)
    if "cropland" in raster_paths and raster_paths["cropland"]:
        crop_path = str(raster_paths["cropland"])
        crop_stats = exactextract.exact_extract(crop_path, cells_proj, ["mean"], output="pandas")
        res_df["mean_cropland_fraction"] = crop_stats["mean"].astype("float32")
    else:
        res_df["mean_cropland_fraction"] = np.nan

    # 7. Hard-Zero Mask (mean fraction of hard-zero pixels)
    if "hard_zero" in raster_paths and raster_paths["hard_zero"]:
        hz_path = str(raster_paths["hard_zero"])
        hz_stats = exactextract.exact_extract(hz_path, cells_proj, ["mean"], output="pandas")
        res_df["hard_zero_fraction"] = hz_stats["mean"].astype("float32")
    else:
        res_df["hard_zero_fraction"] = np.float32(0.0)

    # 8. Population Count (sum of people per pixel within cell)
    if "population" in raster_paths and raster_paths["population"]:
        pop_path = str(raster_paths["population"])
        with rasterio.open(pop_path) as pop_src:
            pop_crs = str(pop_src.crs)

        # Match CRS: use native EPSG:4326 cells if raster is in EPSG:4326 to preserve counts
        if "4326" in pop_crs:
            pop_features = cells_gdf
        elif pop_crs == str(cells_proj.crs):
            pop_features = cells_proj
        else:
            pop_features = cells_gdf.to_crs(pop_crs)

        pop_stats = exactextract.exact_extract(pop_path, pop_features, ["sum"], output="pandas")
        res_df["population"] = np.nan_to_num(pop_stats["sum"].to_numpy(), nan=0.0).round().astype("float32")
    else:
        res_df["population"] = np.float32(0.0)

    return res_df


def apply_quality_flags(
    stats_gdf: gpd.GeoDataFrame,
    min_valid_fraction: float = DEFAULT_MIN_VALID_PIXEL_FRACTION,
    model_version: str = DEFAULT_MODEL_VERSION,
    hazard_type: str = DEFAULT_HAZARD_TYPE,
) -> gpd.GeoDataFrame:
    """Applies §10.3 quality control: flags low-coverage cells and adjusts confidence.

    Args:
        stats_gdf: GeoDataFrame output from compute_zonal_statistics.
        min_valid_fraction: Minimum valid pixel fraction threshold (default 0.5).
        model_version: Tag string for model version.
        hazard_type: Must be 'riverine_flood' (FR-3.16).

    Returns:
        GeoDataFrame with quality_flag, clean susceptibility, and confidence columns.
    """
    df = stats_gdf.copy()
    valid_frac = df["valid_pixel_fraction"].to_numpy()

    # Determine quality flag
    quality_flag = np.where(
        valid_frac >= min_valid_fraction,
        "full",
        np.where(valid_frac > 0.0, "low_coverage", "no_coverage"),
    )
    df["quality_flag"] = quality_flag

    # Clean susceptibility: fill NaNs with 0.0 for cells outside coverage
    mean_susc = df["mean_flood_susceptibility"].to_numpy()
    clean_susc = np.nan_to_num(mean_susc, nan=0.0)
    clean_susc = np.clip(clean_susc, 0.0, 1.0)
    df["susceptibility"] = clean_susc.astype("float32")

    # Quality-adjusted confidence
    # Full coverage: retain mean confidence * valid_frac
    # Low coverage (<0.5): scale down and cap at 0.3
    # No coverage: 0.0
    mean_conf = np.nan_to_num(df["mean_confidence"].to_numpy(), nan=0.0)
    adj_conf = mean_conf * valid_frac
    adj_conf = np.where(
        quality_flag == "full",
        adj_conf,
        np.where(quality_flag == "low_coverage", np.minimum(adj_conf, 0.3), 0.0),
    )
    adj_conf = np.clip(adj_conf, 0.0, 1.0)
    df["confidence"] = adj_conf.astype("float32")

    # Add metadata columns
    df["hazard_type"] = hazard_type
    df["model_version"] = model_version

    return df


def export_parquet(stats_gdf: gpd.GeoDataFrame, output_path: Path | str) -> Path:
    """Exports the H3 zonal statistics GeoDataFrame to GeoParquet.

    Args:
        stats_gdf: Enriched GeoDataFrame in EPSG:4326.
        output_path: Target path for the .parquet file.

    Returns:
        Path to the saved GeoParquet file.
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    stats_gdf.to_parquet(path, index=False)
    return path
