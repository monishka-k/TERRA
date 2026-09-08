"""Steps 12-13 — derive candidate relocation sites for a district from its flood-stack rasters.

Step 12 screens out land that is unsafe, unbuildable or excluded and vectorises what survives;
Step 13 converts each parcel's area into the households it can physically house. Together they
produce the supply side of the relocation problem, which until now existed only as hand-written
fixtures for the two PRD pilot districts.

Measured per parcel: area (from its own pixel count), mean and max slope, max flood
susceptibility, and cropland / tree-cover / built-up fractions. `cc_land` follows from area by
pure geometry, so it is always computable.

Deliberately left NULL: `cc_water`, `cc_school`, `cc_health`. No CGWB groundwater, UDISE+ school
or IPHS health data exists in this repo, and the capacity engine already treats None as
"unmeasured" rather than zero — which is what keeps a site from looking uninhabitable when the
truth is simply that nobody has surveyed it.

Tenure is unknown for every derived parcel: there is no cadastral source. Sites are therefore
written as screening-grade candidates under a policy that says so explicitly, never as
order-grade land the state has confirmed it can allot.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import numpy as np
import rasterio
import rasterio.features
from pyproj import Transformer
from shapely.ops import transform as shapely_transform
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

REPO_ROOT = Path(__file__).resolve().parents[4]
for sub in ("core/src", "pipeline/src", "api/src"):
    path = str(REPO_ROOT / sub)
    if path not in sys.path:
        sys.path.insert(0, path)

from core.config import settings
from core.domain.capacity import CandidateSitePolicy, CapacityEngine
from core.enums import TenureType
from pipeline.hazard.flood.districts import DISTRICTS
from pipeline.hazard.flood.run_district_flood import load_district_geometry
from pipeline.relocation.eligibility_mask import (
    EligibilityMaskConfig,
    build_eligibility_mask,
    polygonize_mask,
)
from pipeline.relocation.landcover import class_fractions_on_grid

logger = logging.getLogger("setu_pipeline.derive_candidate_sites")

INTERIM_DIR = REPO_ROOT / "data" / "interim" / "flood_districts"
SOURCE_PREFIX = "derived-site"
CALCULATION_VERSION = "step12-13-v1.0"

#: Screening policy under which the mask is run and capacity computed. It is deliberately NOT
#: used to stamp `eligibility_status`: that records the canonical order-grade verdict so the
#: stored value matches what every read path recomputes.
#:
#: Screening policy for land that has no cadastral or statutory-overlay source.
#:
#: Protected-area and CRZ layers are absent from this repo. Leaving those exclusions enabled
#: would reject every parcel for missing data, which reports nothing rather than reporting
#: honestly; disabling them makes the gap explicit and records it per site in `data_gaps`.
#: CRZ additionally does not apply to these landlocked districts — Dholpur and Morena are inland
#: on the Chambal, hundreds of kilometres from any tidal water.
#: Forest and water-body exclusions stay ON, because tree-cover and permanent-water layers exist.
SCREENING_POLICY = CandidateSitePolicy(
    exclude_forest=True,
    exclude_water_body=True,
    exclude_protected_area=False,
    exclude_crz_i_ii=False,
    allow_unverified_tenure=True,
    policy_version="site-eligibility-v1.1-screening",
)

DATA_GAPS = [
    "Land tenure unverified: no cadastral source for this district.",
    "Protected-area overlay unavailable; statutory conservation status not checked.",
    "CRZ not evaluated: district is landlocked, so CRZ-I/II does not apply.",
    "Forest exclusion uses ESA WorldCover tree cover, a physical proxy for land cover, "
    "not the legal Reserved/Protected Forest notification.",
    "cc_water / cc_school / cc_health unmeasured: no CGWB, UDISE+ or IPHS source ingested.",
]


def load_raster(path: Path) -> tuple[np.ndarray, rasterio.Affine, Any, float]:
    with rasterio.open(path) as src:
        data = src.read(1).astype(np.float32)
        if src.nodata is not None and np.isfinite(src.nodata):
            data = np.where(data == src.nodata, np.nan, data)
        return data, src.transform, src.crs, abs(src.transform.a * src.transform.e)


def derive(
    district_key: str,
    engine: Optional[Engine] = None,
    config: Optional[EligibilityMaskConfig] = None,
    limit: Optional[int] = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Runs Step 12 then Step 13 for one district and writes candidate_site rows."""
    cfg = config or EligibilityMaskConfig()
    district = DISTRICTS.get(district_key.lower())
    if district is None:
        raise SystemExit(f"Unknown district '{district_key}'. Known: {sorted(DISTRICTS)}")

    prefix = district.file_prefix
    raster_dir = INTERIM_DIR / district_key.lower()
    required = {
        "susceptibility": raster_dir / f"{prefix}_flood_susceptibility.tif",
        "slope": raster_dir / f"{prefix}_slope.tif",
        "cropland_fraction": raster_dir / f"{prefix}_cropland_fraction.tif",
        "permanent_water": raster_dir / f"{prefix}_jrc_permanent_water.tif",
    }
    missing = [str(p) for p in required.values() if not p.is_file()]
    if missing:
        raise SystemExit("Missing required rasters:\n  " + "\n  ".join(missing))

    logger.info("Loading rasters for %s", district.name)
    susceptibility, transform, crs, pixel_area_m2 = load_raster(required["susceptibility"])
    slope, _, _, _ = load_raster(required["slope"])
    cropland, _, _, _ = load_raster(required["cropland_fraction"])
    permanent_water, _, _, _ = load_raster(required["permanent_water"])

    logger.info("Streaming ESA WorldCover tree-cover and built-up fractions")
    fractions = class_fractions_on_grid(
        bbox_wgs84=district.bbox_wgs84,
        reference_shape=susceptibility.shape,
        reference_transform=transform,
        reference_crs=crs,
    )

    logger.info("Rasterising the district boundary to confine screening to %s", district.name)
    district_geom = load_district_geometry(district)
    to_grid = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform
    aoi_mask = rasterio.features.rasterize(
        [(shapely_transform(to_grid, district_geom), 1)],
        out_shape=susceptibility.shape,
        transform=transform,
        dtype=np.uint8,
    ).astype(bool)

    mask, stats = build_eligibility_mask(
        susceptibility=susceptibility,
        slope=slope,
        tree_cover_fraction=fractions["tree_cover"],
        built_up_fraction=fractions["built_up"],
        permanent_water=permanent_water,
        aoi_mask=aoi_mask,
        config=cfg,
    )
    logger.info(
        "Mask: %s of %s observed pixels eligible (%.2f%%); rejected %s",
        f"{stats.eligible_pixels:,}", f"{stats.valid_pixels:,}",
        stats.eligible_fraction * 100, stats.rejected,
    )

    polygons = polygonize_mask(
        mask=mask,
        transform=transform,
        pixel_area_m2=pixel_area_m2,
        attributes={
            "slope": slope,
            "susceptibility": susceptibility,
            "cropland_fraction": cropland,
            "tree_cover_fraction": fractions["tree_cover"],
            "built_up_fraction": fractions["built_up"],
        },
        config=cfg,
    )
    if limit:
        polygons = polygons[:limit]
    logger.info("Polygonised %s parcels of at least %.1f ha", len(polygons), cfg.min_area_ha)

    summary = {
        "district": district.name,
        "eligible_pixels": stats.eligible_pixels,
        "observed_pixels": stats.valid_pixels,
        "eligible_pct": round(stats.eligible_fraction * 100, 3),
        "rejected_by_gate": stats.rejected,
        "polygons": len(polygons),
        "total_area_ha": round(sum(p.area_ha for p in polygons), 1),
    }
    if dry_run:
        return {"dry_run": True, **summary}

    # Step 13: area -> households, via the canonical engine so norms stay in one place.
    capacity_engine = CapacityEngine(site_policy=SCREENING_POLICY)
    to_wgs84 = Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform

    now = datetime.now(timezone.utc)
    eng = engine or create_engine(settings.get_sqlalchemy_url())
    written = 0

    with eng.begin() as conn:
        admin_id = conn.execute(
            text("SELECT id FROM admin_boundary WHERE lgd_code = :lgd AND level = 'district'"),
            {"lgd": district.lgd_code},
        ).scalar()
        if admin_id is None:
            raise SystemExit(f"District {district.name} (LGD {district.lgd_code}) not in admin_boundary.")

        pipeline_run_id = uuid.uuid4()
        conn.execute(
            text("""
                INSERT INTO pipeline_run (
                    id, run_type, status, started_at, completed_at,
                    code_version, config_version, model_version
                ) VALUES (
                    :id, 'derive_candidate_sites', 'READY', :now, :now,
                    :code_version, :config_version, :model_ver
                );
            """),
            {
                "id": pipeline_run_id, "now": now,
                "code_version": cfg.mask_version,
                "config_version": (
                    f"susc<{cfg.max_susceptibility};slope<{cfg.max_slope_deg};"
                    f"min_area={cfg.min_area_ha}ha"
                ),
                "model_ver": CALCULATION_VERSION,
            },
        )

        current_keys: list[str] = []
        for polygon in polygons:
            capacity = capacity_engine.evaluate_site_capacity(
                area_developable_m2=polygon.area_ha * 10_000.0,
                # Left unmeasured on purpose — see module docstring.
                water_yield_liters_per_day=None,
                spare_school_seats=None,
                spare_health_capacity_pop=None,
                livelihood_multiplier=1.0,
                is_urban=False,
                is_hilly_or_tribal=False,
            )
            # Evaluated under the platform's DEFAULT (order-grade) policy, not the screening
            # policy this job screens with, so the status stored here is the same verdict the
            # API will report. Storing a screening-mode "eligible" while every read path
            # recomputes "unknown" would put two different answers on one parcel.
            eligibility = capacity_engine.evaluate_site_eligibility(
                mhi_max=polygon.susceptibility_max,
                slope_mean=polygon.slope_mean,
                area_ha=polygon.area_ha,
                tenure=TenureType.TENURE_UNVERIFIED,
                is_forest=polygon.tree_cover_fraction >= cfg.tree_cover_threshold,
                is_water_body=False,  # permanent water was masked out before polygonising
                is_protected_area=None,  # no overlay source; stays unverified
                is_crz=None,
                policy=CandidateSitePolicy(),
            )

            geometry_wgs84 = shapely_transform(to_wgs84, polygon.geometry)
            source_key = f"{SOURCE_PREFIX}:{district_key.lower()}:{cfg.mask_version}:{polygon.polygon_id}"
            current_keys.append(source_key)

            metadata = {
                "name": f"{district.name} Parcel {polygon.polygon_id:04d}",
                "provenance": "derived_eligibility_mask",
                "mask_version": cfg.mask_version,
                "calculation_version": CALCULATION_VERSION,
                "policy_version": SCREENING_POLICY.policy_version,
                "slope_max": round(polygon.slope_max, 2),
                "cropland_fraction": round(polygon.cropland_fraction, 4),
                "tree_cover_fraction": round(polygon.tree_cover_fraction, 4),
                "built_up_fraction": round(polygon.built_up_fraction, 4),
                "pixel_count": polygon.pixel_count,
                # Screening asserts these two from real layers; the rest stay unverified.
                "is_forest": bool(polygon.tree_cover_fraction >= cfg.tree_cover_threshold),
                "is_water_body": False,
                "is_protected_area": None,
                "is_crz": None,
                "data_gaps": DATA_GAPS,
                "data_quality": capacity.data_quality.value,
                "is_synthetic": False,
            }

            conn.execute(
                text("""
                    INSERT INTO candidate_site (
                        geom, centroid, area_ha, tenure, slope_mean, mhi_max,
                        cc_land, cc_water, cc_school, cc_health, cc_final, binding_constraint,
                        suitability, admin_id, pipeline_run_id, metadata,
                        source_site_id, assessment_status, eligibility_status
                    ) VALUES (
                        ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)),
                        ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                        :area_ha, :tenure, :slope_mean, :mhi_max,
                        :cc_land, NULL, NULL, NULL, :cc_final, :binding,
                        NULL, :admin_id, :run_id, CAST(:metadata AS jsonb),
                        :source_key, 'screening_only', :eligibility
                    )
                    ON CONFLICT (source_site_id) WHERE source_site_id IS NOT NULL
                    DO UPDATE SET
                        geom = EXCLUDED.geom, centroid = EXCLUDED.centroid,
                        area_ha = EXCLUDED.area_ha, slope_mean = EXCLUDED.slope_mean,
                        mhi_max = EXCLUDED.mhi_max, cc_land = EXCLUDED.cc_land,
                        cc_final = EXCLUDED.cc_final, binding_constraint = EXCLUDED.binding_constraint,
                        metadata = EXCLUDED.metadata, pipeline_run_id = EXCLUDED.pipeline_run_id,
                        eligibility_status = EXCLUDED.eligibility_status;
                """),
                {
                    "geom": json.dumps(geometry_wgs84.__geo_interface__),
                    "lon": geometry_wgs84.centroid.x, "lat": geometry_wgs84.centroid.y,
                    "area_ha": round(polygon.area_ha, 4),
                    "tenure": TenureType.TENURE_UNVERIFIED.value,
                    # Stored unrounded: the H7 gates compare with strict `<`, and rounding a
                    # value like 0.24997 up to 0.2500 would push a parcel the mask accepted
                    # onto the wrong side of its own threshold.
                    "slope_mean": float(polygon.slope_mean),
                    "mhi_max": float(polygon.susceptibility_max),
                    "cc_land": capacity.cc_land,
                    "cc_final": capacity.cc_final,
                    "binding": capacity.binding_constraint.value if capacity.binding_constraint else None,
                    "admin_id": admin_id, "run_id": pipeline_run_id,
                    "metadata": json.dumps(metadata), "source_key": source_key,
                    "eligibility": eligibility.eligibility_status.value,
                },
            )
            written += 1

        # Drop parcels from a superseded mask run, but never one an allocation already used.
        pruned = conn.execute(
            text("""
                DELETE FROM candidate_site cs
                WHERE cs.admin_id = :admin_id
                  AND cs.source_site_id LIKE :like
                  AND cs.source_site_id <> ALL(:keys)
                  AND NOT EXISTS (SELECT 1 FROM relocation_plan rp WHERE rp.site_id = cs.id)
                RETURNING cs.id;
            """),
            {"admin_id": admin_id, "like": f"{SOURCE_PREFIX}:{district_key.lower()}:%",
             "keys": current_keys},
        ).fetchall()
        if pruned:
            logger.info("Pruned %s superseded parcels.", len(pruned))

    return {"sites_written": written, "superseded_pruned": len(pruned),
            "pipeline_run_id": str(pipeline_run_id), **summary}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--district", required=True, help=f"One of: {sorted(DISTRICTS)}")
    parser.add_argument("--min-area-ha", type=float, default=2.0)
    parser.add_argument("--max-susceptibility", type=float, default=0.25)
    parser.add_argument("--max-slope-deg", type=float, default=15.0)
    parser.add_argument("--limit", type=int, default=None, help="Keep only the N largest parcels.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    result = derive(
        district_key=args.district,
        config=EligibilityMaskConfig(
            min_area_ha=args.min_area_ha,
            max_susceptibility=args.max_susceptibility,
            max_slope_deg=args.max_slope_deg,
        ),
        limit=args.limit,
        dry_run=args.dry_run,
    )
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
