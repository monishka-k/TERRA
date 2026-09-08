"""Automated ingestion and clipping for WorldPop India 100m Constrained population raster.

Fetches the national 100m constrained population GeoTIFF from Southampton WorldPop repository,
verifies integrity, and crops to the pilot district (Barpeta, Assam) boundary for downstream
H3 zonal statistics.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
import geopandas as gpd
import numpy as np
import rasterio
from rasterio.mask import mask
import requests
from tqdm import tqdm

from core.config import REPO_ROOT
from pipeline.hazard.flood.aoi import BARPETA_BBOX_WGS84

# Canonical WorldPop India 100m Constrained (BSGM 2020) URL
DEFAULT_WORLDPOP_URL = (
    "https://data.worldpop.org/GIS/Population/Global_2000_2020_Constrained/"
    "2020/BSGM/IND/ind_ppp_2020_constrained.tif"
)
EXPECTED_SIZE_BYTES = 531062384  # 506.4 MB

RAW_WORLDPOP_DIR = REPO_ROOT / "data" / "raw" / "worldpop"
DEFAULT_RAW_FILE = RAW_WORLDPOP_DIR / "ind_ppp_2020_constrained.tif"
INTERIM_EXPOSURE_DIR = REPO_ROOT / "data" / "interim" / "exposure"
DEFAULT_OUTPUT_FILE = INTERIM_EXPOSURE_DIR / "barpeta_worldpop_100m.tif"
BOUNDARIES_DIR = REPO_ROOT / "data" / "raw" / "boundaries"
DEFAULT_DISTRICTS_SHP = BOUNDARIES_DIR / "2011_Dist.shp"
FALLBACK_DISTRICTS_SHP = REPO_ROOT / "2011_Dist.shp"


def download_worldpop(
    url: str = DEFAULT_WORLDPOP_URL,
    dest_path: Path = DEFAULT_RAW_FILE,
    chunk_size: int = 1024 * 1024,
) -> Path:
    """Download national WorldPop raster with progress reporting and cache checks.

    Args:
        url: Remote URL for the GeoTIFF.
        dest_path: Target local file path.
        chunk_size: Streaming chunk size in bytes (default 1MB).

    Returns:
        Path to the downloaded raster file.
    """
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    if dest_path.exists():
        file_size = dest_path.stat().st_size
        if file_size == EXPECTED_SIZE_BYTES or file_size > 400 * 1024 * 1024:
            print(f"  [+] Using cached WorldPop raster: {dest_path} ({file_size / (1024 * 1024):.1f} MB)")
            return dest_path
        print(f"  [!] Existing file {dest_path} is incomplete ({file_size} bytes). Re-downloading...")

    print(f"  [+] Connecting to WorldPop: {url}")
    response = requests.get(url, stream=True, timeout=30)
    response.raise_for_status()

    total_size = int(response.headers.get("content-length", 0))
    print(f"  [+] Downloading national raster ({total_size / (1024 * 1024):.1f} MB) -> {dest_path}")

    with open(dest_path, "wb") as f, tqdm(
        total=total_size,
        unit="B",
        unit_scale=True,
        unit_divisor=1024,
        desc="WorldPop 100m",
    ) as progress_bar:
        for chunk in response.iter_content(chunk_size=chunk_size):
            if chunk:
                f.write(chunk)
                progress_bar.update(len(chunk))

    print(f"  [✓] Download finished: {dest_path} ({dest_path.stat().st_size / (1024 * 1024):.1f} MB)")
    return dest_path


def crop_population_raster(
    source_raster: Path,
    output_raster: Path,
    districts_shp: Path = DEFAULT_DISTRICTS_SHP,
    district_name: str = "Barpeta",
    bbox: list[float] | None = None,
) -> Path:
    """Crops population raster to district boundary polygon or bounding box.

    Args:
        source_raster: Path to the input population GeoTIFF (WorldPop or LandScan).
        output_raster: Destination path for cropped GeoTIFF.
        districts_shp: Path to Census 2011 district shapefile.
        district_name: Name of the district to crop (e.g., 'Barpeta').
        bbox: Optional [min_lon, min_lat, max_lon, max_lat] bounding box fallback.

    Returns:
        Path to the cropped GeoTIFF.
    """
    output_raster.parent.mkdir(parents=True, exist_ok=True)

    if not source_raster.exists():
        raise FileNotFoundError(f"Source population raster not found: {source_raster}")

    shapes = None
    target_shp = districts_shp if districts_shp.exists() else FALLBACK_DISTRICTS_SHP
    if target_shp.exists():
        print(f"  [+] Loading district boundaries from {target_shp.name}...")
        districts = gpd.read_file(target_shp)
        matched = districts[districts["DISTRICT"].astype(str).str.lower() == district_name.lower()]
        if not matched.empty:
            shapes = matched.geometry.values
            print(f"  [+] Matched district polygon for '{district_name}' (rows: {len(matched)})")
        else:
            print(f"  [!] District '{district_name}' not found in shapefile; using bbox fallback.")

    with rasterio.open(source_raster) as src:
        nodata_val = src.nodata if src.nodata is not None else -99999.0

        if shapes is not None:
            if districts.crs != src.crs:
                matched = matched.to_crs(src.crs)
                shapes = matched.geometry.values
            out_image, out_transform = mask(src, shapes, crop=True, nodata=nodata_val)
        else:
            from shapely.geometry import box
            crop_bbox = bbox or BARPETA_BBOX_WGS84
            geom_box = [box(*crop_bbox)]
            print(f"  [+] Masking to bounding box: {crop_bbox}")
            out_image, out_transform = mask(src, geom_box, crop=True, nodata=nodata_val)

        # Retain counts, replace nodata / negative with 0
        pop_slice = out_image[0]
        cleaned_pop = np.where((pop_slice == nodata_val) | (pop_slice < 0), 0.0, pop_slice).astype(np.float32)
        out_image[0] = cleaned_pop

        out_meta = src.meta.copy()
        out_meta.update({
            "driver": "GTiff",
            "height": out_image.shape[1],
            "width": out_image.shape[2],
            "transform": out_transform,
            "count": 1,
            "dtype": "float32",
            "nodata": 0.0,
            "compress": "lzw",
        })

        with rasterio.open(output_raster, "w", **out_meta) as dst:
            dst.write(out_image)

    total_pop = float(np.sum(cleaned_pop))
    print(f"  [✓] Cropped population raster written to: {output_raster}")
    print(f"      Dimensions: {out_image.shape[2]} x {out_image.shape[1]} pixels")
    print(f"      Total District Population Sum: {int(total_pop):,} citizens")

    return output_raster


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch and crop WorldPop India 100m population raster.")
    parser.add_argument(
        "--crop-only",
        action="store_true",
        help="Skip downloading and crop existing raw raster.",
    )
    parser.add_argument(
        "--fallback-raster",
        type=Path,
        default=None,
        help="Use local raster file instead of downloading WorldPop.",
    )
    parser.add_argument(
        "--district",
        default="Barpeta",
        help="District name to crop (default: Barpeta).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_FILE,
        help=f"Target output cropped raster path (default: {DEFAULT_OUTPUT_FILE}).",
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_WORLDPOP_URL,
        help="Custom WorldPop URL.",
    )

    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("🌍 SETU-DRR: WorldPop Population Ingestion Pipeline")
    print("=" * 60)

    if args.fallback_raster:
        print(f"  [*] Mode: Fallback to local raster: {args.fallback_raster}")
        if not args.fallback_raster.exists():
            print(f"  [✗] Error: {args.fallback_raster} not found!")
            sys.exit(1)
        source_raster = args.fallback_raster
    else:
        if args.crop_only:
            print("  [*] Mode: Crop existing WorldPop raw raster")
            source_raster = DEFAULT_RAW_FILE
        else:
            print("  [*] Mode: Download & Crop WorldPop India 100m Constrained")
            source_raster = download_worldpop(url=args.url, dest_path=DEFAULT_RAW_FILE)

    crop_population_raster(
        source_raster=source_raster,
        output_raster=args.output,
        district_name=args.district,
    )
    print("\n[✓] Population ingestion completed successfully.\n")


if __name__ == "__main__":
    main()
