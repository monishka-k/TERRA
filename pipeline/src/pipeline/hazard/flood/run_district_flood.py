"""Parameterised flood-susceptibility runner (Steps 5–10) for registered districts.

This is the district-generic counterpart of `run_milestone_b/c/d/e.py`, which are
pinned to Barpeta. It drives the exact same library functions
(`frequency_stack`, `permanent_water`, `cropland`, `hand_terrain`,
`susceptibility`, `h3_zonal`) from a `DistrictConfig` and finishes by upserting
`grid_cell`, `hazard_static` (hazard_type='riverine_flood') and
`hazard_static_flood` into PostgreSQL — identical target tables and semantics to
Milestone E.

Usage:
    uv run python -m pipeline.hazard.flood.run_district_flood dholpur morena
    uv run python -m pipeline.hazard.flood.run_district_flood morena --no-db --resolution 20

Stages write GeoTIFF caches under data/interim/flood_districts/<key>/, so a
re-run skips any completed stage.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import geopandas as gpd
import rasterio
import yaml

from core.config import REPO_ROOT, settings

try:
    from .districts import DistrictConfig, get_district
    from .frequency_stack import (
        accumulate_inundation_stack,
        calculate_inundation_frequency,
        create_master_grid,
    )
    from .permanent_water import generate_permanent_water_mask
    from .cropland import generate_cropland_fraction
    from .stac import query_sentinel1_rtc
    from .water_mask import save_raster_geotiff, DEFAULT_VV_WATER_THRESHOLD_DB
    from .hand_terrain import (
        compute_hard_zero_mask,
        compute_slope_degrees,
        stream_and_reproject_dem,
        stream_and_reproject_hand,
        DEFAULT_HARD_ZERO_HAND_THRESHOLD_M,
        DEFAULT_HARD_ZERO_SLOPE_THRESHOLD_DEG,
    )
    from .susceptibility import (
        combine_susceptibility,
        compute_confidence,
        normalize_hand_percentile,
        DEFAULT_HAND_CLIP_PERCENTILE,
        DEFAULT_OBSERVATION_CEILING,
        DEFAULT_W_FREQ,
        DEFAULT_W_HAND,
    )
    from .h3_zonal import (
        apply_quality_flags,
        compute_zonal_statistics,
        export_parquet,
        h3_cells_to_geodataframe,
        polyfill_reporting_aoi,
        DEFAULT_H3_RESOLUTION,
        DEFAULT_HAZARD_TYPE,
        DEFAULT_MIN_VALID_PIXEL_FRACTION,
        DEFAULT_MODEL_VERSION,
    )
except ImportError:  # pragma: no cover - script executed as a file
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from districts import DistrictConfig, get_district  # type: ignore
    from frequency_stack import (  # type: ignore
        accumulate_inundation_stack,
        calculate_inundation_frequency,
        create_master_grid,
    )
    from permanent_water import generate_permanent_water_mask  # type: ignore
    from cropland import generate_cropland_fraction  # type: ignore
    from stac import query_sentinel1_rtc  # type: ignore
    from water_mask import save_raster_geotiff, DEFAULT_VV_WATER_THRESHOLD_DB  # type: ignore
    from hand_terrain import (  # type: ignore
        compute_hard_zero_mask,
        compute_slope_degrees,
        stream_and_reproject_dem,
        stream_and_reproject_hand,
        DEFAULT_HARD_ZERO_HAND_THRESHOLD_M,
        DEFAULT_HARD_ZERO_SLOPE_THRESHOLD_DEG,
    )
    from susceptibility import (  # type: ignore
        combine_susceptibility,
        compute_confidence,
        normalize_hand_percentile,
        DEFAULT_HAND_CLIP_PERCENTILE,
        DEFAULT_OBSERVATION_CEILING,
        DEFAULT_W_FREQ,
        DEFAULT_W_HAND,
    )
    from h3_zonal import (  # type: ignore
        apply_quality_flags,
        compute_zonal_statistics,
        export_parquet,
        h3_cells_to_geodataframe,
        polyfill_reporting_aoi,
        DEFAULT_H3_RESOLUTION,
        DEFAULT_HAZARD_TYPE,
        DEFAULT_MIN_VALID_PIXEL_FRACTION,
        DEFAULT_MODEL_VERSION,
    )

DISTRICT_MODEL_VERSION = "flood-susceptibility-v0.1"
BOUNDARIES_SHP = REPO_ROOT / "data" / "raw" / "boundaries" / "2011_Dist.shp"
OCCURRENCE_THRESHOLD_PCT = 80.0
JRC_ATTRIBUTION = "JRC Global Surface Water v1.5 (1984-2024), EC JRC / Google"


def _interim_dir(cfg: DistrictConfig) -> Path:
    d = REPO_ROOT / "data" / "interim" / "flood_districts" / cfg.key
    d.mkdir(parents=True, exist_ok=True)
    return d


def _processed_dir(cfg: DistrictConfig) -> Path:
    d = REPO_ROOT / "data" / "processed" / "flood" / cfg.key
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_district_geometry(cfg: DistrictConfig):
    """Return the dissolved district polygon (EPSG:4326) from the Census 2011 shapefile."""
    districts = gpd.read_file(BOUNDARIES_SHP)
    match = districts[districts["DISTRICT"].astype(str).str.lower() == cfg.shapefile_district_name.lower()]
    if match.empty:
        raise RuntimeError(
            f"District '{cfg.shapefile_district_name}' not found in {BOUNDARIES_SHP.name}"
        )
    geom = match.to_crs("EPSG:4326").geometry.union_all()
    return geom


# ---------------------------------------------------------------------------
# Stage 1 — Inundation frequency (Steps 5–7)
# ---------------------------------------------------------------------------
def build_frequency_layers(
    cfg: DistrictConfig,
    master_transform: rasterio.Affine,
    master_shape: tuple[int, int],
    resolution_m: float,
    threshold_db: float,
    s1_decimation: int,
) -> dict:
    interim = _interim_dir(cfg)
    freq_tif = interim / f"{cfg.file_prefix}_inundation_frequency.tif"
    obs_tif = interim / f"{cfg.file_prefix}_valid_observation_count.tif"
    wdet_tif = interim / f"{cfg.file_prefix}_water_detection_count.tif"
    crop_tif = interim / f"{cfg.file_prefix}_cropland_fraction.tif"
    perm_tif = interim / f"{cfg.file_prefix}_jrc_permanent_water.tif"
    meta_json = interim / f"{cfg.file_prefix}_frequency_meta.json"

    if freq_tif.exists() and obs_tif.exists() and crop_tif.exists() and meta_json.exists():
        print(f"  [cache] Reusing frequency layers for {cfg.name}")
        return json.loads(meta_json.read_text())

    print(f"\n[Step 5] JRC Global Surface Water permanent-water mask ({cfg.name})...")
    permanent_mask, _ = generate_permanent_water_mask(
        reference_shape=master_shape,
        reference_transform=master_transform,
        reference_crs=cfg.processing_crs,
        bbox_wgs84=cfg.bbox_wgs84,
        occurrence_threshold_pct=OCCURRENCE_THRESHOLD_PCT,
    )
    perm_km2 = float(np.sum(permanent_mask)) * (resolution_m ** 2) / 1e6
    print(f"  [+] Permanent water: {int(np.sum(permanent_mask)):,} px ({perm_km2:.2f} km2)")
    save_raster_geotiff(perm_tif, permanent_mask.astype(np.uint8), master_transform,
                        cfg.processing_crs, nodata=255, dtype="uint8")

    print(f"\n[Step 5.2] ESA WorldCover v200 cropland fraction ({cfg.name})...")
    cropland_fraction = generate_cropland_fraction(
        reference_shape=master_shape,
        reference_transform=master_transform,
        reference_crs=cfg.processing_crs,
        bbox_wgs84=cfg.bbox_wgs84,
        year=2021,
    )
    save_raster_geotiff(crop_tif, cropland_fraction, master_transform, cfg.processing_crs,
                        nodata=np.nan, dtype="float32")
    print(f"  [+] Mean cropland fraction: {float(np.nanmean(cropland_fraction)):.3f}")

    print(f"\n[Step 6] Querying Sentinel-1 RTC scenes ({cfg.s1_datetime_range})...")
    all_scenes = query_sentinel1_rtc(
        bbox=cfg.bbox_wgs84,
        datetime_range=cfg.s1_datetime_range,
        limit=None,
    )
    if not all_scenes:
        raise RuntimeError(f"No Sentinel-1 RTC scenes for {cfg.name} in {cfg.s1_datetime_range}")
    all_scenes = sorted(all_scenes, key=lambda s: s.datetime)
    target = cfg.s1_scene_target
    if len(all_scenes) > target:
        idx = np.linspace(0, len(all_scenes) - 1, target).round().astype(int)
        scenes = [all_scenes[i] for i in sorted(set(idx.tolist()))]
    else:
        scenes = all_scenes
    print(f"  [+] {len(all_scenes)} scenes available; using {len(scenes)} evenly across the window "
          f"({scenes[0].datetime:%Y-%m-%d} .. {scenes[-1].datetime:%Y-%m-%d})")

    approx_m = resolution_m if s1_decimation <= 1 else 10.0 * s1_decimation
    print(f"\n[Step 6/7] Accumulating inundation stack + frequency ({cfg.name}); "
          f"S1 read decimation={s1_decimation} (~{approx_m:.0f} m)...")
    water_counts, valid_counts, scene_metas = accumulate_inundation_stack(
        scenes=scenes,
        master_shape=master_shape,
        master_transform=master_transform,
        master_crs=cfg.processing_crs,
        permanent_water_mask=permanent_mask,
        bbox_wgs84=cfg.bbox_wgs84,
        threshold_db=threshold_db,
        verbose=True,
        decimation=s1_decimation,
    )
    frequency, _ = calculate_inundation_frequency(water_counts, valid_counts, min_observations=1)

    save_raster_geotiff(freq_tif, frequency, master_transform, cfg.processing_crs, nodata=np.nan, dtype="float32")
    save_raster_geotiff(obs_tif, valid_counts, master_transform, cfg.processing_crs, nodata=0, dtype="uint16")
    save_raster_geotiff(wdet_tif, water_counts, master_transform, cfg.processing_crs, nodata=0, dtype="uint16")

    meta = {
        "num_scenes": len(scenes),
        "scene_ids": [m.get("id") for m in scene_metas],
        "observation_period": cfg.s1_datetime_range,
        "threshold_db": threshold_db,
        "s1_read_decimation": s1_decimation,
        "mean_frequency": float(np.nanmean(frequency)),
        "max_frequency": float(np.nanmax(frequency)),
        "max_valid_obs": int(valid_counts.max()),
        "permanent_water_km2": perm_km2,
        "mean_cropland_fraction": float(np.nanmean(cropland_fraction)),
    }
    meta_json.write_text(json.dumps(meta, indent=2))
    print(f"  [+] Frequency: mean={meta['mean_frequency']:.4f} max={meta['max_frequency']:.4f} "
          f"| max valid obs={meta['max_valid_obs']}")
    return meta


# ---------------------------------------------------------------------------
# Stage 2 — Terrain / HAND (Step 8)
# ---------------------------------------------------------------------------
def build_terrain_layers(
    cfg: DistrictConfig,
    master_transform: rasterio.Affine,
    master_shape: tuple[int, int],
    resolution_m: float,
) -> None:
    interim = _interim_dir(cfg)
    hand_tif = interim / f"{cfg.file_prefix}_hand.tif"
    slope_tif = interim / f"{cfg.file_prefix}_slope.tif"
    hz_tif = interim / f"{cfg.file_prefix}_hard_zero_mask.tif"
    dem_cache = interim / f"{cfg.file_prefix}_dem_elevation.tif"

    if hand_tif.exists() and slope_tif.exists() and hz_tif.exists():
        print(f"  [cache] Reusing terrain layers for {cfg.name}")
        return

    print(f"\n[Step 8] ASF GLO-30 HAND ({cfg.name})...")
    hand_m = stream_and_reproject_hand(
        master_shape=master_shape,
        master_transform=master_transform,
        master_crs=cfg.processing_crs,
        bbox_wgs84=cfg.bbox_wgs84,
        cache_path=hand_tif,
    )
    print(f"  [+] HAND valid={int(np.sum(np.isfinite(hand_m))):,} "
          f"range=[{np.nanmin(hand_m):.1f}, {np.nanmax(hand_m):.1f}] m")

    print(f"\n[Step 8] Copernicus DEM GLO-30 + slope ({cfg.name})...")
    dem_m = stream_and_reproject_dem(
        master_shape=master_shape,
        master_transform=master_transform,
        master_crs=cfg.processing_crs,
        bbox_wgs84=cfg.bbox_wgs84,
        cache_path=dem_cache,
    )
    slope_deg = compute_slope_degrees(dem_m, resolution_m=resolution_m)
    save_raster_geotiff(slope_tif, slope_deg, master_transform, cfg.processing_crs, nodata=np.nan, dtype="float32")

    hard_zero_mask, flood_eligible_mask = compute_hard_zero_mask(
        hand_m, slope_deg,
        max_hand_m=DEFAULT_HARD_ZERO_HAND_THRESHOLD_M,
        max_slope_deg=DEFAULT_HARD_ZERO_SLOPE_THRESHOLD_DEG,
    )
    mask_raster = np.full(master_shape, 255, dtype=np.uint8)
    valid_terrain = np.isfinite(hand_m) & np.isfinite(slope_deg)
    mask_raster[valid_terrain & flood_eligible_mask] = 0
    mask_raster[valid_terrain & hard_zero_mask] = 1
    save_raster_geotiff(hz_tif, mask_raster, master_transform, cfg.processing_crs, nodata=255, dtype="uint8")

    total_valid = int(np.sum(valid_terrain))
    excl = int(np.sum(hard_zero_mask & valid_terrain))
    print(f"  [+] Hard-zero excluded {excl:,}/{total_valid:,} "
          f"({excl / max(total_valid, 1) * 100:.1f}%); eligible domain {total_valid - excl:,} px")


# ---------------------------------------------------------------------------
# Stage 3 — Susceptibility combination (Step 9)
# ---------------------------------------------------------------------------
def build_susceptibility_layers(cfg: DistrictConfig) -> dict:
    interim = _interim_dir(cfg)
    susc_tif = interim / f"{cfg.file_prefix}_flood_susceptibility.tif"
    conf_tif = interim / f"{cfg.file_prefix}_confidence.tif"

    def _read(path: Path):
        with rasterio.open(path) as src:
            return src.read(1), src.transform, str(src.crs)

    frequency, transform, crs = _read(interim / f"{cfg.file_prefix}_inundation_frequency.tif")
    valid_obs, _, _ = _read(interim / f"{cfg.file_prefix}_valid_observation_count.tif")
    hand_m, _, _ = _read(interim / f"{cfg.file_prefix}_hand.tif")
    hard_zero_raw, _, _ = _read(interim / f"{cfg.file_prefix}_hard_zero_mask.tif")
    eligible_mask = hard_zero_raw == 0

    print(f"\n[Step 9] Combining F + HAND -> susceptibility ({cfg.name})...")
    hand_normalized, p_clip = normalize_hand_percentile(
        hand_m, eligible_mask, clip_percentile=DEFAULT_HAND_CLIP_PERCENTILE
    )
    susceptibility = combine_susceptibility(
        frequency=frequency,
        hand_normalized=hand_normalized,
        eligible_mask=eligible_mask,
        w_freq=DEFAULT_W_FREQ,
        w_hand=DEFAULT_W_HAND,
    )
    confidence = compute_confidence(
        valid_observation_count=valid_obs,
        eligible_mask=eligible_mask,
        observation_ceiling=DEFAULT_OBSERVATION_CEILING,
    )

    save_raster_geotiff(susc_tif, susceptibility, transform, crs, nodata=np.nan, dtype="float32")
    save_raster_geotiff(conf_tif, confidence, transform, crs, nodata=np.nan, dtype="float32")

    finite = np.isfinite(susceptibility)
    summary = {
        "hand_clip_p99_m": round(float(p_clip), 2),
        "mean_susceptibility": round(float(np.nanmean(susceptibility)), 4),
        "max_susceptibility": round(float(np.nanmax(susceptibility)), 4),
        "nonzero_fraction": round(float(np.sum((susceptibility > 0) & finite) / max(np.sum(finite), 1)), 4),
        "mean_confidence_eligible": round(float(np.nanmean(confidence[eligible_mask])), 4)
        if np.any(eligible_mask) else 0.0,
    }
    print(f"  [+] S_f mean={summary['mean_susceptibility']} max={summary['max_susceptibility']} "
          f"| nonzero frac={summary['nonzero_fraction']}")
    return summary


# ---------------------------------------------------------------------------
# Stage 4 — Optional WorldPop exposure raster
# ---------------------------------------------------------------------------
def ensure_population_raster(cfg: DistrictConfig) -> Path | None:
    out_path = REPO_ROOT / "data" / "interim" / "exposure" / f"{cfg.key}_worldpop_100m.tif"
    if out_path.exists():
        print(f"  [cache] Population raster present: {out_path.name}")
        return out_path
    try:
        from pipeline.ingestion.fetch_worldpop import (
            DEFAULT_RAW_FILE,
            crop_population_raster,
            download_worldpop,
        )
    except Exception as exc:  # pragma: no cover
        print(f"  [!] WorldPop ingestion unavailable ({exc}); population -> 0")
        return None
    try:
        source = DEFAULT_RAW_FILE if DEFAULT_RAW_FILE.exists() else download_worldpop()
        crop_population_raster(
            source_raster=source,
            output_raster=out_path,
            district_name=cfg.shapefile_district_name,
        )
        return out_path if out_path.exists() else None
    except Exception as exc:  # pragma: no cover
        print(f"  [!] WorldPop crop failed ({exc}); population -> 0")
        return None


# ---------------------------------------------------------------------------
# Stage 5 — H3 aggregation (Step 10)
# ---------------------------------------------------------------------------
def aggregate_to_h3(
    cfg: DistrictConfig,
    resolution_m: float,
    with_population: bool,
) -> gpd.GeoDataFrame:
    interim = _interim_dir(cfg)
    print(f"\n[Step 10] Polyfilling {cfg.name} at H3 res {DEFAULT_H3_RESOLUTION}...")
    cells = polyfill_reporting_aoi(cfg.bbox_wgs84, resolution=DEFAULT_H3_RESOLUTION)
    cells_gdf = h3_cells_to_geodataframe(cells)

    # Clip the rectangular polyfill to the real district polygon by CENTROID
    # containment. Centroid assignment makes adjacent districts (Dholpur/Morena
    # share the Chambal as their border) mutually exclusive — every H3 cell has
    # exactly one owning district, so grid_cell.admin_id is unambiguous.
    district_geom = load_district_geometry(cfg)
    centroids = gpd.GeoSeries(
        gpd.points_from_xy(cells_gdf["centroid_lon"], cells_gdf["centroid_lat"]),
        crs="EPSG:4326",
    )
    keep = centroids.within(district_geom)
    cells_gdf = cells_gdf.loc[keep.to_numpy()].reset_index(drop=True)
    print(f"  [+] {len(cells_gdf):,} H3 cells centred within the {cfg.name} district polygon")

    raster_paths: dict[str, Path] = {
        "susceptibility": interim / f"{cfg.file_prefix}_flood_susceptibility.tif",
        "confidence": interim / f"{cfg.file_prefix}_confidence.tif",
        "frequency": interim / f"{cfg.file_prefix}_inundation_frequency.tif",
        "hand": interim / f"{cfg.file_prefix}_hand.tif",
        "slope": interim / f"{cfg.file_prefix}_slope.tif",
        "cropland": interim / f"{cfg.file_prefix}_cropland_fraction.tif",
        "hard_zero": interim / f"{cfg.file_prefix}_hard_zero_mask.tif",
    }
    if with_population:
        pop_path = ensure_population_raster(cfg)
        if pop_path is not None:
            raster_paths["population"] = pop_path

    print("  [+] Computing exactextract fractional-coverage zonal statistics...")
    stats_raw = compute_zonal_statistics(
        cells_gdf=cells_gdf,
        raster_paths=raster_paths,
        target_crs=cfg.processing_crs,
        pixel_res_m=resolution_m,
    )
    stats_gdf = apply_quality_flags(
        stats_raw,
        min_valid_fraction=DEFAULT_MIN_VALID_PIXEL_FRACTION,
        model_version=DISTRICT_MODEL_VERSION,
        hazard_type=DEFAULT_HAZARD_TYPE,
    )
    q_counts = stats_gdf["quality_flag"].value_counts().to_dict()
    print(f"  [+] Quality flags: {q_counts}")
    print(f"  [+] Susceptibility mean={stats_gdf['susceptibility'].mean():.4f} "
          f"max={stats_gdf['susceptibility'].max():.4f}")

    parquet_path = _processed_dir(cfg) / "flood_susceptibility_h3_res8.parquet"
    export_parquet(stats_gdf, parquet_path)
    print(f"  [+] GeoParquet -> {parquet_path} ({len(stats_gdf)} rows)")
    return stats_gdf


# ---------------------------------------------------------------------------
# Stage 6 — PostgreSQL load (Milestone E semantics)
# ---------------------------------------------------------------------------
def load_database(
    cfg: DistrictConfig,
    stats_gdf: gpd.GeoDataFrame,
    conninfo: str | None = None,
    admin_geom_wkt: str | None = None,
) -> dict:
    import psycopg

    def _nullable_float(value) -> float | None:
        if value is None:
            return None
        f = float(value)
        return None if np.isnan(f) else f

    min_lon, min_lat, max_lon, max_lat = cfg.bbox_wgs84
    conninfo = conninfo or settings.get_direct_psycopg_conninfo()
    print(f"\n[DB] Connecting to {conninfo.split('@')[-1].split('?')[0]} ...")

    with psycopg.connect(conninfo, autocommit=False) as conn:
        with conn.cursor() as cur:
            if admin_geom_wkt:
                cur.execute(
                    """
                    INSERT INTO admin_boundary (level, lgd_code, name, bbox, geom)
                    VALUES ('district', %s, %s, ST_MakeEnvelope(%s, %s, %s, %s, 4326),
                            ST_Multi(ST_GeomFromText(%s, 4326)))
                    ON CONFLICT (lgd_code) DO UPDATE SET
                        name = EXCLUDED.name, bbox = EXCLUDED.bbox, geom = EXCLUDED.geom
                    RETURNING id;
                    """,
                    (cfg.lgd_code, cfg.name, min_lon, min_lat, max_lon, max_lat, admin_geom_wkt),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO admin_boundary (level, lgd_code, name, bbox)
                    VALUES ('district', %s, %s, ST_MakeEnvelope(%s, %s, %s, %s, 4326))
                    ON CONFLICT (lgd_code) DO UPDATE SET name = EXCLUDED.name, bbox = EXCLUDED.bbox
                    RETURNING id;
                    """,
                    (cfg.lgd_code, cfg.name, min_lon, min_lat, max_lon, max_lat),
                )
            admin_id = cur.fetchone()[0]
            print(f"  [+] admin_boundary: {cfg.name} (id={admin_id}, lgd_code={cfg.lgd_code})")

            cur.execute(
                """
                INSERT INTO pipeline_run (run_type, status, code_version, config_version, model_version)
                VALUES ('HAZARD_STATIC', 'READY', 'run-district-flood', %s, %s)
                RETURNING id;
                """,
                (cfg.processing_crs, DISTRICT_MODEL_VERSION),
            )
            pipeline_run_id = cur.fetchone()[0]
            print(f"  [+] pipeline_run: {pipeline_run_id}")

            grid_rows = []
            for _, row in stats_gdf.iterrows():
                pop_val = float(row["population"]) if "population" in row and not np.isnan(row["population"]) else 0.0
                grid_rows.append((
                    int(row["h3_int"]), 8, admin_id,
                    float(row["centroid_lon"]), float(row["centroid_lat"]),
                    row["geometry"].wkt, pop_val, 0.0, f"{cfg.key}-h3-res8-v1",
                ))
            cur.executemany(
                """
                INSERT INTO grid_cell (h3, res, admin_id, centroid, geom, population, built_area_m2, dataset_version)
                VALUES (%s, %s, %s,
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                        ST_GeomFromText(%s, 4326), %s, %s, %s)
                ON CONFLICT (h3) DO UPDATE SET
                    admin_id = EXCLUDED.admin_id,
                    geom = EXCLUDED.geom, centroid = EXCLUDED.centroid,
                    population = EXCLUDED.population;
                """,
                grid_rows,
            )
            print(f"  [+] grid_cell upserts: {len(grid_rows)}")

            hazard_rows = [
                (
                    int(row["h3_int"]), DEFAULT_HAZARD_TYPE,
                    float(row["susceptibility"]), float(row["confidence"]),
                    str(row["quality_flag"]), DISTRICT_MODEL_VERSION, pipeline_run_id,
                )
                for _, row in stats_gdf.iterrows()
            ]
            cur.executemany(
                """
                INSERT INTO hazard_static (h3, hazard_type, susceptibility, confidence,
                                           quality_flag, model_version, pipeline_run_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (h3, hazard_type) DO UPDATE SET
                    susceptibility = EXCLUDED.susceptibility,
                    confidence = EXCLUDED.confidence,
                    quality_flag = EXCLUDED.quality_flag,
                    model_version = EXCLUDED.model_version,
                    pipeline_run_id = EXCLUDED.pipeline_run_id;
                """,
                hazard_rows,
            )
            print(f"  [+] hazard_static upserts (hazard_type='{DEFAULT_HAZARD_TYPE}'): {len(hazard_rows)}")

            driver_rows = [
                (
                    int(row["h3_int"]),
                    _nullable_float(row["max_flood_susceptibility"]),
                    _nullable_float(row["valid_pixel_fraction"]),
                    _nullable_float(row["hard_zero_fraction"]),
                    _nullable_float(row["mean_inundation_frequency"]),
                    _nullable_float(row["mean_hand"]),
                    _nullable_float(row["min_hand"]),
                    _nullable_float(row["mean_slope"]),
                    _nullable_float(row["mean_cropland_fraction"]),
                    DEFAULT_OBSERVATION_CEILING, DISTRICT_MODEL_VERSION, pipeline_run_id,
                )
                for _, row in stats_gdf.iterrows()
            ]
            cur.executemany(
                """
                INSERT INTO hazard_static_flood (h3, max_susceptibility, valid_pixel_fraction,
                    hard_zero_fraction, mean_inundation_frequency, mean_hand_m, min_hand_m,
                    mean_slope_deg, mean_cropland_fraction, observation_ceiling, model_version, pipeline_run_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (h3) DO UPDATE SET
                    max_susceptibility = EXCLUDED.max_susceptibility,
                    valid_pixel_fraction = EXCLUDED.valid_pixel_fraction,
                    hard_zero_fraction = EXCLUDED.hard_zero_fraction,
                    mean_inundation_frequency = EXCLUDED.mean_inundation_frequency,
                    mean_hand_m = EXCLUDED.mean_hand_m, min_hand_m = EXCLUDED.min_hand_m,
                    mean_slope_deg = EXCLUDED.mean_slope_deg,
                    mean_cropland_fraction = EXCLUDED.mean_cropland_fraction,
                    observation_ceiling = EXCLUDED.observation_ceiling,
                    model_version = EXCLUDED.model_version,
                    pipeline_run_id = EXCLUDED.pipeline_run_id;
                """,
                driver_rows,
            )
            print(f"  [+] hazard_static_flood upserts: {len(driver_rows)}")
            conn.commit()

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*), MIN(susceptibility), MAX(susceptibility), AVG(susceptibility),
                       AVG(confidence), COUNT(*) FILTER (WHERE susceptibility > 0.7)
                FROM hazard_static h JOIN grid_cell g ON h.h3 = g.h3
                WHERE h.hazard_type = %s AND g.admin_id = %s;
                """,
                (DEFAULT_HAZARD_TYPE, admin_id),
            )
            n, smin, smax, savg, cavg, high = cur.fetchone()
    result = {
        "pipeline_run_id": str(pipeline_run_id),
        "admin_id": admin_id,
        "rows": int(n),
        "susc_min": float(smin), "susc_max": float(smax), "susc_avg": float(savg),
        "conf_avg": float(cavg), "high_risk_cells": int(high),
    }
    print(f"  [+] round-trip: {result['rows']:,} rows | S_f [{result['susc_min']:.3f}, "
          f"{result['susc_max']:.3f}] avg {result['susc_avg']:.3f} | high-risk {result['high_risk_cells']:,}")
    return result


def write_metadata(cfg: DistrictConfig, resolution_m: float, freq_meta: dict,
                   susc_summary: dict, db_result: dict | None, n_cells: int) -> Path:
    meta = {
        "pipeline": "run_district_flood (Steps 5-10)",
        "district": cfg.name,
        "state": cfg.state,
        "lgd_code": cfg.lgd_code,
        "census_code_2011": cfg.census_code_2011,
        "river_basin": cfg.river_basin,
        "bbox_wgs84": cfg.bbox_wgs84,
        "processing_crs": cfg.processing_crs,
        "master_grid_resolution_m": resolution_m,
        "h3_resolution": DEFAULT_H3_RESOLUTION,
        "hazard_type": DEFAULT_HAZARD_TYPE,
        "model_version": DISTRICT_MODEL_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "h3_cells": n_cells,
        "sentinel1": {
            "collection": "sentinel-1-rtc (Microsoft Planetary Computer)",
            "observation_period": cfg.s1_datetime_range,
            "num_scenes": freq_meta.get("num_scenes"),
            "scene_ids": freq_meta.get("scene_ids"),
            "polarization": "VV",
            "water_threshold_db": freq_meta.get("threshold_db"),
        },
        "permanent_water": {
            "source": JRC_ATTRIBUTION,
            "occurrence_threshold_pct": OCCURRENCE_THRESHOLD_PCT,
        },
        "hand": {
            "source": "ASF GLO-30 HAND v1/2021 (derived from Copernicus GLO-30)",
            "hard_zero_hand_m": DEFAULT_HARD_ZERO_HAND_THRESHOLD_M,
            "hard_zero_slope_deg": DEFAULT_HARD_ZERO_SLOPE_THRESHOLD_DEG,
            "normalization": f"H_hand = 1 - clip(HAND / P{DEFAULT_HAND_CLIP_PERCENTILE:.0f}, 0, 1)",
            "hand_clip_p99_m": susc_summary.get("hand_clip_p99_m"),
        },
        "combination": {
            "formula": "S_f = w_F * F + w_H * H_hand",
            "w_F": DEFAULT_W_FREQ, "w_H": DEFAULT_W_HAND,
        },
        "confidence": {"formula": f"min(1, n_valid / {DEFAULT_OBSERVATION_CEILING})"},
        "results_summary": {**freq_meta, **susc_summary},
        "database": db_result,
        "licences_and_attribution": [
            "Copernicus Sentinel-1 data, MSPC RTC (CC BY 4.0)",
            "ASF GLO-30 HAND (CC0 1.0, derived from Copernicus GLO-30)",
            "Copernicus DEM GLO-30 (Copernicus licence)",
            JRC_ATTRIBUTION,
            "ESA WorldCover 10m 2021 v200 (CC BY 4.0)",
            "WorldPop India 100m Constrained 2020 (CC BY 4.0)",
        ],
    }
    path = _processed_dir(cfg) / "metadata.yaml"
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(meta, f, sort_keys=False, allow_unicode=True)
    print(f"  [+] metadata -> {path}")
    return path


def run_district(cfg: DistrictConfig, resolution_m: float, threshold_db: float,
                 do_db: bool, with_population: bool, s1_decimation: int) -> dict:
    t0 = time.time()
    print("=" * 78)
    print(f"SETU-DRR flood susceptibility (Steps 5-10) — {cfg.name}, {cfg.state}")
    print(f"bbox={cfg.bbox_wgs84}  crs={cfg.processing_crs}  res={resolution_m}m")
    print("=" * 78)

    master_transform, master_shape, _ = create_master_grid(
        bbox_wgs84=cfg.bbox_wgs84,
        target_crs=cfg.processing_crs,
        resolution_m=resolution_m,
    )
    print(f"Master grid: {master_shape[0]:,} x {master_shape[1]:,} "
          f"({master_shape[0] * master_shape[1] / 1e6:.1f} Mpx)")

    freq_meta = build_frequency_layers(cfg, master_transform, master_shape, resolution_m,
                                       threshold_db, s1_decimation)
    build_terrain_layers(cfg, master_transform, master_shape, resolution_m)
    susc_summary = build_susceptibility_layers(cfg)
    stats_gdf = aggregate_to_h3(cfg, resolution_m, with_population)

    db_result = None
    if do_db:
        try:
            admin_wkt = load_district_geometry(cfg).wkt
        except Exception:
            admin_wkt = None
        db_result = load_database(cfg, stats_gdf, admin_geom_wkt=admin_wkt)
    write_metadata(cfg, resolution_m, freq_meta, susc_summary, db_result, len(stats_gdf))

    print(f"\n{cfg.name} complete in {time.time() - t0:.0f}s")
    return {"district": cfg.name, "h3_cells": len(stats_gdf), "db": db_result}


def main() -> None:
    parser = argparse.ArgumentParser(description="District-parameterised flood susceptibility (Steps 5-10)")
    parser.add_argument("districts", nargs="+", help="District slugs (e.g. dholpur morena)")
    parser.add_argument("--resolution", type=float, default=10.0, help="Master grid resolution in metres")
    parser.add_argument("--threshold-db", type=float, default=DEFAULT_VV_WATER_THRESHOLD_DB,
                        help="VV backscatter water threshold in dB")
    parser.add_argument("--no-db", action="store_true", help="Skip the PostgreSQL load")
    parser.add_argument("--no-population", action="store_true", help="Skip the WorldPop exposure raster")
    parser.add_argument("--s1-decimation", type=int, default=4,
                        help="Integer downsampling factor for Sentinel-1 COG reads "
                             "(1=native 10m; 4~=40m). Cuts transfer ~factor^2 over slow links.")
    args = parser.parse_args()

    configs = [get_district(d) for d in args.districts]
    summaries = []
    for cfg in configs:
        summaries.append(run_district(
            cfg,
            resolution_m=args.resolution,
            threshold_db=args.threshold_db,
            do_db=not args.no_db,
            with_population=not args.no_population,
            s1_decimation=args.s1_decimation,
        ))

    print("\n" + "=" * 78)
    print("ALL DISTRICTS COMPLETE")
    for s in summaries:
        db = s["db"]
        tail = "" if db is None else f" | DB rows={db['rows']:,} run={db['pipeline_run_id']}"
        print(f"  {s['district']}: {s['h3_cells']:,} H3 cells{tail}")
    print("=" * 78)


if __name__ == "__main__":
    main()
