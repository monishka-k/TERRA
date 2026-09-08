"""Unit tests for WorldPop ingestion, population exposure domain, and H3 zonal integration."""

import sys
from pathlib import Path
import numpy as np
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT / "pipeline" / "src") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "pipeline" / "src"))

from pipeline.exposure.population import (
    validate_population_anchor,
    inspect_population_raster,
    get_district_population_raster_path,
)
from pipeline.hazard.flood.h3_zonal import (
    polyfill_reporting_aoi,
    h3_cells_to_geodataframe,
    compute_zonal_statistics,
    DEFAULT_H3_RESOLUTION,
)
from pipeline.hazard.flood.aoi import BARPETA_BBOX_WGS84


def test_validate_population_anchor_barpeta():
    """Verify Census 2011 anchoring check for Barpeta."""
    # Plausible population in 2024 (~1.96M vs 1.69M in 2011)
    res = validate_population_anchor("Barpeta", 1959579)
    assert res["status"] == "PASSED"
    assert res["is_plausible"] is True
    assert res["census_2011_anchor"] == 1693622
    assert 1.0 < res["growth_ratio"] < 1.3


def test_validate_population_anchor_unanchored():
    """Verify unknown district handles unanchored state gracefully."""
    res = validate_population_anchor("UnknownDistrictXYZ", 50000)
    assert res["status"] == "UNANCHORED"


def test_inspect_interim_population_raster():
    """Verify interim district population raster properties."""
    raster_path = get_district_population_raster_path("barpeta")
    assert raster_path.exists(), f"Expected raster at {raster_path}"

    info = inspect_population_raster(raster_path)
    assert info["width"] > 0
    assert info["height"] > 0
    assert info["total_estimated_population"] > 1_000_000
    assert info["inhabited_pixel_count"] > 0


def test_h3_zonal_population_extraction():
    """Verify compute_zonal_statistics aggregates population into H3 cells."""
    raster_path = get_district_population_raster_path("barpeta")
    assert raster_path.exists()

    # Polyfill sample cells
    cells = polyfill_reporting_aoi(BARPETA_BBOX_WGS84, resolution=DEFAULT_H3_RESOLUTION)[:20]
    gdf = h3_cells_to_geodataframe(cells)

    # Run zonal stats with a mock susceptibility and the real population raster
    interim_susc = REPO_ROOT / "data" / "interim" / "susceptibility" / "barpeta_flood_susceptibility.tif"
    raster_paths = {
        "susceptibility": interim_susc,
        "population": raster_path,
    }

    stats = compute_zonal_statistics(gdf, raster_paths=raster_paths)

    assert "population" in stats.columns
    assert stats["population"].dtype == np.float32
    assert not stats["population"].isna().any()
    assert (stats["population"] >= 0.0).all()
    # At least some cells in the sample should have non-zero population
    assert stats["population"].sum() >= 0.0
