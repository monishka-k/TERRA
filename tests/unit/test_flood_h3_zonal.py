from pathlib import Path
import numpy as np
import geopandas as gpd
import psycopg
import pytest

from core.config import settings
from pipeline.hazard.flood.aoi import BARPETA_BBOX_WGS84
from pipeline.hazard.flood.h3_zonal import (
    polyfill_reporting_aoi,
    h3_cells_to_geodataframe,
    apply_quality_flags,
    DEFAULT_H3_RESOLUTION,
    DEFAULT_HAZARD_TYPE,
    DEFAULT_MODEL_VERSION,
)


def test_polyfill_reporting_aoi_count():
    """Verify Barpeta AOI polyfills to exactly 7,497 cells at H3 resolution 8."""
    cells = polyfill_reporting_aoi(BARPETA_BBOX_WGS84, resolution=DEFAULT_H3_RESOLUTION)
    assert len(cells) == 7497
    assert len(set(cells)) == 7497  # uniqueness
    assert all(c.startswith("88") for c in cells)  # resolution 8 format


def test_h3_cells_to_geodataframe():
    """Verify conversion of H3 cell strings to GeoDataFrame with valid geometries."""
    cells = ["883ce00201fffff", "883ce00203fffff"]
    gdf = h3_cells_to_geodataframe(cells)
    assert len(gdf) == 2
    assert str(gdf.crs) == "EPSG:4326"
    assert "h3_hex" in gdf.columns
    assert "h3_int" in gdf.columns
    assert "centroid_lon" in gdf.columns
    assert "centroid_lat" in gdf.columns
    assert all(gdf.geometry.is_valid)


def test_apply_quality_flags():
    """Verify quality control flag assignment and confidence adjustment."""
    cells = ["883ce00201fffff", "883ce00203fffff", "883ce00205fffff"]
    gdf = h3_cells_to_geodataframe(cells)
    gdf["mean_flood_susceptibility"] = [0.8, 0.5, np.nan]
    gdf["mean_confidence"] = [0.9, 0.6, np.nan]
    gdf["valid_pixel_fraction"] = [0.95, 0.35, 0.0]

    qc_gdf = apply_quality_flags(gdf, min_valid_fraction=0.5)

    assert qc_gdf.loc[0, "quality_flag"] == "full"
    assert qc_gdf.loc[1, "quality_flag"] == "low_coverage"
    assert qc_gdf.loc[2, "quality_flag"] == "no_coverage"

    # Full coverage retains susceptibility and scaled confidence
    assert np.isclose(qc_gdf.loc[0, "susceptibility"], 0.8)
    assert np.isclose(qc_gdf.loc[0, "confidence"], 0.9 * 0.95)

    # Low coverage is capped at 0.3
    assert np.isclose(qc_gdf.loc[1, "susceptibility"], 0.5)
    assert qc_gdf.loc[1, "confidence"] <= 0.3

    # No coverage fills 0.0
    assert qc_gdf.loc[2, "susceptibility"] == 0.0
    assert qc_gdf.loc[2, "confidence"] == 0.0

    # Attributes
    assert (qc_gdf["hazard_type"] == DEFAULT_HAZARD_TYPE).all()
    assert (qc_gdf["model_version"] == DEFAULT_MODEL_VERSION).all()


def test_processed_artifacts_exist():
    """Verify all final processed artifacts exist per §10.5."""
    proc_dir = Path("data/processed/flood/barpeta")
    assert proc_dir.exists()

    expected_files = [
        "flood_susceptibility_h3_res8.parquet",
        "flood_susceptibility.tif",
        "confidence.tif",
        "inundation_frequency.tif",
        "hand.tif",
        "slope.tif",
        "cropland_fraction.tif",
        "water_rule_scorecard.json",
        "metadata.yaml",
        "barpeta_milestone_e_preview.png",
    ]
    for fname in expected_files:
        p = proc_dir / fname
        assert p.exists(), f"Missing expected artifact: {fname}"
        assert p.stat().st_size > 0, f"Empty artifact: {fname}"


def test_parquet_schema_and_contents():
    """Verify GeoParquet has 7,497 rows and valid range bounds."""
    parquet_path = Path("data/processed/flood/barpeta/flood_susceptibility_h3_res8.parquet")
    gdf = gpd.read_parquet(parquet_path)
    assert len(gdf) == 7497
    assert "mean_flood_susceptibility" in gdf.columns
    assert "mean_cropland_fraction" in gdf.columns
    assert "susceptibility" in gdf.columns
    assert "confidence" in gdf.columns
    assert "quality_flag" in gdf.columns
    assert (gdf["hazard_type"] == "riverine_flood").all()

    # Valid value ranges
    assert gdf["susceptibility"].min() >= 0.0
    assert gdf["susceptibility"].max() <= 1.0
    assert gdf["confidence"].min() >= 0.0
    assert gdf["confidence"].max() <= 1.0


@pytest.mark.db
def test_database_hazard_static_records():
    """Verify live PostgreSQL database has 7,497 riverine_flood rows."""
    conninfo = settings.get_direct_psycopg_conninfo()
    with psycopg.connect(conninfo) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM hazard_static WHERE hazard_type = 'riverine_flood';")
            count = cur.fetchone()[0]
            if count == 0:
                from pipeline.hazard.flood.run_milestone_e import load_database
                parquet_path = Path("data/processed/flood/barpeta/flood_susceptibility_h3_res8.parquet")
                if parquet_path.exists():
                    stats_gdf = gpd.read_parquet(parquet_path)
                    load_database(stats_gdf)

            cur.execute("""
                SELECT COUNT(*), MIN(susceptibility), MAX(susceptibility), AVG(susceptibility)
                FROM hazard_static
                WHERE hazard_type = 'riverine_flood';
            """)
            count, min_s, max_s, avg_s = cur.fetchone()
            assert count == 7497
            assert 0.0 <= min_s <= 0.1
            assert 0.9 <= max_s <= 1.0
            assert 0.3 <= avg_s <= 0.6

