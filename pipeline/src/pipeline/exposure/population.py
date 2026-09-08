"""Population exposure domain utilities for SETU-DRR.

Provides raster resolution verification, Census 2011 anchoring comparison (FR-5.3/FR-5.6),
and path resolution for interim/processed population datasets.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
import rasterio
import numpy as np

from core.config import REPO_ROOT

# Census 2011 benchmark totals for pilot districts (FR-5.3 anchoring)
CENSUS_2011_DISTRICT_POPULATION: dict[str, int] = {
    "barpeta": 1693622,
    "wayanad": 817420,
    "dholpur": 1206516,
    "dhaulpur": 1206516,
    "morena": 1965970,
}

INTERIM_EXPOSURE_DIR = REPO_ROOT / "data" / "interim" / "exposure"
PROCESSED_FLOOD_DIR = REPO_ROOT / "data" / "processed" / "flood"


def get_district_population_raster_path(district_name: str = "barpeta") -> Path:
    """Return the preferred path for district population raster."""
    candidates = [
        PROCESSED_FLOOD_DIR / district_name.lower() / "population.tif",
        INTERIM_EXPOSURE_DIR / f"{district_name.lower()}_worldpop_100m.tif",
        INTERIM_EXPOSURE_DIR / f"{district_name.lower()}_population_100m.tif",
    ]
    for p in candidates:
        if p.exists():
            return p
    # Return default expected path
    return INTERIM_EXPOSURE_DIR / f"{district_name.lower()}_worldpop_100m.tif"


def inspect_population_raster(raster_path: Path) -> dict[str, Any]:
    """Inspects population raster metadata, pixel resolution, and estimated total sum."""
    if not raster_path.exists():
        raise FileNotFoundError(f"Population raster not found at {raster_path}")

    with rasterio.open(raster_path) as src:
        data = src.read(1)
        nodata = src.nodata if src.nodata is not None else 0.0
        valid_mask = (data != nodata) & (data > 0)
        valid_pop = data[valid_mask]

        return {
            "path": str(raster_path),
            "crs": str(src.crs),
            "width": src.width,
            "height": src.height,
            "res_degrees": src.res,
            "approx_pixel_res_m": round(src.res[0] * 111320, 1),
            "total_estimated_population": float(np.sum(valid_pop)),
            "peak_pixel_density": float(np.max(valid_pop)) if len(valid_pop) > 0 else 0.0,
            "inhabited_pixel_count": int(np.count_nonzero(valid_mask)),
        }


def validate_population_anchor(district_name: str, estimated_total: float) -> dict[str, Any]:
    """Checks population estimate against Census 2011 district benchmark per FR-5.6."""
    norm_name = district_name.lower().strip()
    census_val = CENSUS_2011_DISTRICT_POPULATION.get(norm_name)

    if census_val is None:
        return {
            "district": district_name,
            "status": "UNANCHORED",
            "message": f"No Census 2011 benchmark registered for {district_name}.",
        }

    ratio = estimated_total / census_val
    # Plausible population growth between 2011 and 2020-2024 is typically 1.05x - 1.25x
    is_plausible = 0.9 <= ratio <= 1.4

    return {
        "district": district_name,
        "census_2011_anchor": census_val,
        "estimated_population": round(estimated_total),
        "growth_ratio": round(ratio, 3),
        "is_plausible": is_plausible,
        "status": "PASSED" if is_plausible else "WARNING_DEVIATION",
    }
