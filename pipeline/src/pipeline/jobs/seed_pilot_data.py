"""Deterministic Pilot Data Seeding Module & Job (Days 2 & 5).

Populates PostgreSQL with deterministic spatial fixtures for:
1. Administrative Boundaries (Wayanad LGD 555, Kodagu LGD 540)
2. Pilot Habitations with Demographics, Vulnerability, and Loss History
3. Candidate Relocation Sites with Carrying Capacities and PostGIS geometries (Day 5)
4. H3 Res 7 and Res 8 Grids with Dasymetric Population
5. Static Multi-Hazard Scores, MHI Snapshots, and Heuristic Explanations
6. Pipeline Publication (PipelineRun + ServingVersion)

Idempotent: Safely cleans and reseeds pilot records without foreign key conflicts.
"""

import sys
import uuid
import random
import json
import math
import logging
from datetime import datetime, date, timezone
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from core.config import settings
from core.enums import Hazard, Tier, ZoneClass, BindingConstraint, TenureType
from core.h3_utils import (
    h3_to_int,
    h3_to_str,
    h3_to_centroid,
    h3_to_wkt_point,
    h3_to_wkt_polygon,
    h3_get_resolution,
)
from pipeline.grid.district_grid import (
    generate_h3_grid_for_bbox,
    create_grid_cell_records,
)
from pipeline.hazard.terrain_zonal import TerrainHazardEvaluator
from pipeline.hazard.model_loader import load_pipeline_models
from pipeline.capacity.site_generator import (
    RawCandidateSiteSpec,
    build_candidate_site_record,
)
from core.domain.priority import (
    compute_priority_score,
    compute_time_decayed_loss,
    classify_triage_tier,
)
from core.domain.hazard import compute_mhi, classify_zone
from core.domain.capacity import CapacityEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_pilot_data")

# Fixed random seed for 100% deterministic reproducibility
SEED = 42
DATASET_VERSION = "demo-day2-v1"
MODEL_VERSION = "baseline-v1"

# ============================================================================
# PROVENANCE CLASSIFICATION FOR PILOT TRIAGE INPUTS (PRD §6.7, H9 Audit):
#
# The mitigation_cost and relocation_cost values seeded below are:
#   Classification: EXPLICITLY SYNTHETIC DEMO FIXTURES (Category 2)
#
# Provenance Details:
# - These monetary amounts (in INR) are deterministic test fixtures created solely
#   to exercise the four-tier triage decision rules in Day 2 & Day 5 pilot environments.
# - They are NOT field-surveyed civil engineering estimates, DPR quantities, or real
#   resettlement DPR cost models (the authoritative field-engineering cost pipeline
#   is scheduled for v2 as per PRD §14).
# - They must be treated strictly as synthetic demo data for pipeline validation.
# ============================================================================


# Pilot District Configurations
PILOT_DISTRICTS = [
    {
        "name": "Wayanad",
        "lgd_code": 555,
        "level": "district",
        "state": "Kerala",
        "population": 817420,
        "households": 194000,
        # Bounding box covering Wayanad [min_lon, min_lat, max_lon, max_lat]
        "bbox": (75.80, 11.50, 76.35, 11.90),
        "habitations": [
            {
                "name": "Chooralmala",
                "lgd_code": 627101,
                "lat": 11.5432,
                "lon": 76.1689,
                "population": 3840,
                "households": 860,
                "prz_overlap_pct": 82.5,
                "active_deformation": True,
                "fatal_3_monsoons": True,
                "mitigation_cost": 45000000.0,
                "relocation_cost": 25000000.0,
                "adverse_trend": True,
                "v_demo": 0.58, "v_struct": 0.72, "v_access": 0.65, "v_econ": 0.60,
            },
            {
                "name": "Mundakkai",
                "lgd_code": 627102,
                "lat": 11.5365,
                "lon": 76.1795,
                "population": 2150,
                "households": 490,
                "prz_overlap_pct": 91.0,
                "active_deformation": True,
                "fatal_3_monsoons": True,
                "mitigation_cost": 50000000.0,
                "relocation_cost": 20000000.0,
                "adverse_trend": True,
                "v_demo": 0.62, "v_struct": 0.81, "v_access": 0.74, "v_econ": 0.68,
            },
            {
                "name": "Meppadi",
                "lgd_code": 627103,
                "lat": 11.5512,
                "lon": 76.1284,
                "population": 14200,
                "households": 3200,
                "prz_overlap_pct": 35.0,
                "active_deformation": False,
                "fatal_3_monsoons": False,
                "mitigation_cost": 30000000.0,
                "relocation_cost": 15000000.0,
                "adverse_trend": False,
                "v_demo": 0.44, "v_struct": 0.48, "v_access": 0.35, "v_econ": 0.42,
            },
            {
                "name": "Vythiri",
                "lgd_code": 627104,
                "lat": 11.5520,
                "lon": 76.0410,
                "population": 9800,
                "households": 2150,
                "prz_overlap_pct": 48.0,
                "active_deformation": False,
                "fatal_3_monsoons": False,
                "mitigation_cost": 25000000.0,
                "relocation_cost": 12000000.0,
                "adverse_trend": False,
                "v_demo": 0.51, "v_struct": 0.55, "v_access": 0.42, "v_econ": 0.49,
            },
            {
                "name": "Kalpetta",
                "lgd_code": 627105,
                "lat": 11.6090,
                "lon": 76.0830,
                "population": 31500,
                "households": 7100,
                "prz_overlap_pct": 12.0,
                "active_deformation": False,
                "fatal_3_monsoons": False,
                "mitigation_cost": 4500000.0,
                "relocation_cost": 25000000.0,
                "adverse_trend": False,
                "v_demo": 0.32, "v_struct": 0.30, "v_access": 0.20, "v_econ": 0.28,
            },
            {
                "name": "Mananthavady",
                "lgd_code": 627106,
                "lat": 11.8020,
                "lon": 76.0030,
                "population": 28400,
                "households": 6300,
                "prz_overlap_pct": 18.5,
                "active_deformation": False,
                "fatal_3_monsoons": False,
                "mitigation_cost": 22000000.0,
                "relocation_cost": 15000000.0,
                "adverse_trend": True,
                "v_demo": 0.38, "v_struct": 0.36, "v_access": 0.25, "v_econ": 0.34,
            },
        ],
        "candidate_sites": [
            RawCandidateSiteSpec(
                name="Meppadi Safe Terrace North",
                lat=11.5650,
                lon=76.1420,
                area_ha=6.5,
                tenure=TenureType.GOVERNMENT_REVENUE,
                slope_mean=4.2,
                mhi_max=0.08,
                water_yield_liters_per_day=54450.0,
                spare_school_seats=650,
                spare_health_capacity_pop=4000,
                livelihood_multiplier=1.0,
                suitability=88,
            ),
            RawCandidateSiteSpec(
                name="Kalpetta Revenue Plain East",
                lat=11.6180,
                lon=76.0950,
                area_ha=12.0,
                tenure=TenureType.GOVERNMENT_REVENUE,
                slope_mean=3.5,
                mhi_max=0.04,
                water_yield_liters_per_day=270000.0,
                spare_school_seats=450,
                spare_health_capacity_pop=5500,
                livelihood_multiplier=1.0,
                suitability=92,
            ),
            RawCandidateSiteSpec(
                name="Vythiri Plateau South",
                lat=11.5450,
                lon=76.0480,
                area_ha=4.5,
                tenure=TenureType.PRIVATE,
                slope_mean=7.1,
                mhi_max=0.12,
                water_yield_liters_per_day=135000.0,
                spare_school_seats=500,
                spare_health_capacity_pop=3000,
                livelihood_multiplier=0.95,
                suitability=76,
            ),
            RawCandidateSiteSpec(
                name="Mananthavady Valley Ridge",
                lat=11.8150,
                lon=76.0150,
                area_ha=18.0,
                tenure=TenureType.GOVERNMENT_REVENUE,
                slope_mean=2.8,
                mhi_max=0.05,
                water_yield_liters_per_day=400000.0,
                spare_school_seats=1500,
                spare_health_capacity_pop=2925,
                livelihood_multiplier=1.0,
                suitability=90,
            ),
            RawCandidateSiteSpec(
                name="Sulthan Bathery Plain",
                lat=11.6620,
                lon=76.2550,
                area_ha=22.0,
                tenure=TenureType.GOVERNMENT_REVENUE,
                slope_mean=2.1,
                mhi_max=0.02,
                water_yield_liters_per_day=111375.0,
                spare_school_seats=2000,
                spare_health_capacity_pop=8000,
                livelihood_multiplier=1.0,
                suitability=94,
            ),
            RawCandidateSiteSpec(
                name="Ambalavayal Safe Terrace",
                lat=11.6200,
                lon=76.2100,
                area_ha=7.5,
                tenure=TenureType.TENURE_UNVERIFIED,
                slope_mean=5.2,
                mhi_max=0.09,
                water_yield_liters_per_day=160000.0,
                spare_school_seats=320,
                spare_health_capacity_pop=3500,
                livelihood_multiplier=0.90,
                suitability=72,
            ),
        ],
        "disasters": [
            {
                "ts": date(2024, 7, 30),
                "hazard_type": "landslide",
                "lat": 11.5390,
                "lon": 76.1720,
                "fatalities": 350,
                "injured": 280,
                "houses_damaged": 420,
                "severity": 1.0,
                "source": "GSI / Kerala SDMA",
                "source_ref": "Chooralmala-Mundakkai Debris Flow 2024",
            },
            {
                "ts": date(2019, 8, 8),
                "hazard_type": "landslide",
                "lat": 11.5280,
                "lon": 76.1450,
                "fatalities": 17,
                "injured": 12,
                "houses_damaged": 65,
                "severity": 0.75,
                "source": "Kerala SDMA",
                "source_ref": "Puthumala Landslide 2019",
            },
        ],
    },
    {
        "name": "Kodagu",
        "lgd_code": 540,
        "level": "district",
        "state": "Karnataka",
        "population": 554519,
        "households": 132000,
        # Bounding box covering Kodagu [min_lon, min_lat, max_lon, max_lat]
        "bbox": (75.50, 12.15, 76.05, 12.55),
        "habitations": [
            {
                "name": "Madikeri",
                "lgd_code": 628101,
                "lat": 12.4244,
                "lon": 75.7382,
                "population": 33400,
                "households": 7800,
                "prz_overlap_pct": 28.0,
                "active_deformation": False,
                "fatal_3_monsoons": False,
                "mitigation_cost": 35000000.0,
                "relocation_cost": 20000000.0,
                "adverse_trend": True,
                "v_demo": 0.35, "v_struct": 0.40, "v_access": 0.22, "v_econ": 0.30,
            },
            {
                "name": "Bhagamandala",
                "lgd_code": 628102,
                "lat": 12.3912,
                "lon": 75.5312,
                "population": 4100,
                "households": 920,
                "prz_overlap_pct": 74.0,
                "active_deformation": True,
                "fatal_3_monsoons": False,
                "mitigation_cost": 38000000.0,
                "relocation_cost": 18000000.0,
                "adverse_trend": True,
                "v_demo": 0.54, "v_struct": 0.68, "v_access": 0.62, "v_econ": 0.56,
            },
            {
                "name": "Somwarpet",
                "lgd_code": 628103,
                "lat": 12.5975,
                "lon": 75.8654,
                "population": 11200,
                "households": 2500,
                "prz_overlap_pct": 22.0,
                "active_deformation": False,
                "fatal_3_monsoons": False,
                "mitigation_cost": 3200000.0,
                "relocation_cost": 18000000.0,
                "adverse_trend": False,
                "v_demo": 0.39, "v_struct": 0.42, "v_access": 0.30, "v_econ": 0.35,
            },
        ],
        "candidate_sites": [
            RawCandidateSiteSpec(
                name="Madikeri Safe Plain",
                lat=12.4350,
                lon=75.7420,
                area_ha=9.0,
                tenure=TenureType.GOVERNMENT_REVENUE,
                slope_mean=5.5,
                mhi_max=0.06,
                water_yield_liters_per_day=180000.0,
                spare_school_seats=400,
                spare_health_capacity_pop=3500,
                livelihood_multiplier=1.0,
                suitability=85,
            ),
            RawCandidateSiteSpec(
                name="Kushalnagar East Terrace",
                lat=12.4650,
                lon=75.9650,
                area_ha=15.0,
                tenure=TenureType.GOVERNMENT_REVENUE,
                slope_mean=2.2,
                mhi_max=0.03,
                water_yield_liters_per_day=350000.0,
                spare_school_seats=800,
                spare_health_capacity_pop=6000,
                livelihood_multiplier=1.0,
                suitability=91,
            ),
        ],
        "disasters": [
            {
                "ts": date(2018, 8, 17),
                "hazard_type": "landslide",
                "lat": 12.3950,
                "lon": 75.5400,
                "fatalities": 18,
                "injured": 35,
                "houses_damaged": 210,
                "severity": 0.85,
                "source": "Karnataka SDMA",
                "source_ref": "Kodagu Multi-Landslide Event 2018",
            },
        ],
    },
]


def seed_database(db_url: Optional[str] = None) -> None:
    """Executes deterministic seeding for pilot districts."""
    load_pipeline_models()
    url = db_url or settings.get_sqlalchemy_url(direct=True)
    engine = create_engine(url, pool_pre_ping=True)
    rng = random.Random(SEED)
    evaluator = TerrainHazardEvaluator()
    capacity_engine = CapacityEngine()

    logger.info("Connecting to database for Day 5 pilot seeding...")

    with engine.begin() as conn:
        # 1. Clean existing pilot data cleanly and instantly
        logger.info("Purging any existing seed data with TRUNCATE CASCADE...")
        conn.execute(
            text("""
                TRUNCATE TABLE
                    serving_version,
                    explanation,
                    mhi_snapshot,
                    hazard_dynamic,
                    hazard_static,
                    grid_cell,
                    relocation_plan,
                    candidate_site,
                    habitation_risk,
                    vulnerability,
                    disaster_event,
                    habitation,
                    admin_boundary,
                    allocation_run,
                    pipeline_run
                CASCADE;
            """)
        )

        # 2. Record Pipeline Run
        pipeline_run_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        conn.execute(
            text("""
                INSERT INTO pipeline_run (
                    id, run_type, status, started_at, completed_at,
                    code_version, config_version, model_version
                ) VALUES (
                    :id, 'pilot_seed', 'READY', :now, :now,
                    'day5-seed', 'v1.0', :model_ver
                );
            """),
            {"id": pipeline_run_id, "now": now, "model_ver": MODEL_VERSION},
        )
        logger.info(f"Created PipelineRun: {pipeline_run_id}")

        # 3. Seed Each Pilot District
        total_cells_seeded = 0
        total_habitations_seeded = 0
        total_sites_seeded = 0

        for dist in PILOT_DISTRICTS:
            name = dist["name"]
            lgd = dist["lgd_code"]
            min_lon, min_lat, max_lon, max_lat = dist["bbox"]

            logger.info(f"Seeding district {name} (LGD: {lgd})...")

            # District bounding box polygon
            wkt_geom = f"MULTIPOLYGON((({min_lon} {min_lat}, {max_lon} {min_lat}, {max_lon} {max_lat}, {min_lon} {max_lat}, {min_lon} {min_lat})))"
            wkt_bbox = f"POLYGON(({min_lon} {min_lat}, {max_lon} {min_lat}, {max_lon} {max_lat}, {min_lon} {max_lat}, {min_lon} {min_lat}))"

            admin_res = conn.execute(
                text("""
                    INSERT INTO admin_boundary (level, lgd_code, name, geom, bbox)
                    VALUES (:level, :lgd, :name, ST_GeomFromText(:geom, 4326), ST_GeomFromText(:bbox, 4326))
                    RETURNING id;
                """),
                {
                    "level": dist["level"],
                    "lgd": lgd,
                    "name": name,
                    "geom": wkt_geom,
                    "bbox": wkt_bbox,
                },
            )
            admin_id = admin_res.scalar_one()

            # Seed Disaster Events
            for d in dist["disasters"]:
                conn.execute(
                    text("""
                        INSERT INTO disaster_event (
                            ts, hazard_type, geom, fatalities, injured, houses_damaged, severity, source, source_ref
                        ) VALUES (
                            :ts, :hazard_type, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                            :fatalities, :injured, :houses_damaged, :severity, :source, :source_ref
                        );
                    """),
                    {
                        "ts": d["ts"],
                        "hazard_type": d["hazard_type"],
                        "lat": d["lat"],
                        "lon": d["lon"],
                        "fatalities": d["fatalities"],
                        "injured": d["injured"],
                        "houses_damaged": d["houses_damaged"],
                        "severity": d["severity"],
                        "source": d["source"],
                        "source_ref": d["source_ref"],
                    },
                )

            # Seed Habitations & Vulnerability
            for h in dist["habitations"]:
                hab_res = conn.execute(
                    text("""
                        INSERT INTO habitation (
                            lgd_code, name, type, admin_id, geom_point, population, households
                        ) VALUES (
                            :lgd, :name, 'village', :admin_id,
                            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                            :pop, :hh
                        ) RETURNING id;
                    """),
                    {
                        "lgd": h["lgd_code"],
                        "name": h["name"],
                        "admin_id": admin_id,
                        "lon": h["lon"],
                        "lat": h["lat"],
                        "pop": h["population"],
                        "hh": h["households"],
                    },
                )
                hab_id = hab_res.scalar_one()
                total_habitations_seeded += 1

                # Vulnerability SoVI composite calculation
                v_demo = h["v_demo"]
                v_struct = h["v_struct"]
                v_access = h["v_access"]
                v_econ = h["v_econ"]
                v_index = round(0.25 * (v_demo + v_struct + v_access + v_econ), 4)

                conn.execute(
                    text("""
                        INSERT INTO vulnerability (
                            habitation_id, v_demographic, v_structural, v_access, v_economic, v_index, is_district_flat, pipeline_run_id
                        ) VALUES (
                            :hab_id, :v_demo, :v_struct, :v_access, :v_econ, :v_index, FALSE, :pipeline_run_id
                        );
                    """),
                    {
                        "hab_id": hab_id,
                        "v_demo": v_demo,
                        "v_struct": v_struct,
                        "v_access": v_access,
                        "v_econ": v_econ,
                        "v_index": v_index,
                        "pipeline_run_id": pipeline_run_id,
                    },
                )

                # Habitation Priority Scoring & Triage
                prz_overlap = h["prz_overlap_pct"]
                pop_frac_in_prz = prz_overlap / 100.0
                is_high_risk = bool(h["active_deformation"] or prz_overlap >= 70.0)
                hazard_intensity = 0.88 if is_high_risk else 0.42

                # Loss history
                nearby_disasters = []
                for d in dist["disasters"]:
                    d_lat, d_lon = d["lat"], d["lon"]
                    dist_km = math.sqrt(((d_lat - h["lat"]) * 111.0)**2 + ((d_lon - h["lon"]) * 111.0 * math.cos(math.radians(h["lat"])))**2)
                    if dist_km <= 15.0:
                        nearby_disasters.append(d)
                decayed_loss = compute_time_decayed_loss(nearby_disasters, reference_date=date(2026, 8, 31)) if is_high_risk else 0.0

                ps = compute_priority_score(
                    hazard_intensity=hazard_intensity,
                    pop_fraction_in_prz=pop_frac_in_prz,
                    vulnerability_index=v_index,
                    decayed_loss=decayed_loss,
                )
                caseload = round(ps * h["population"], 2)

                m_cost = h.get("mitigation_cost")
                r_cost = h.get("relocation_cost")
                adv_trend = h.get("adverse_trend")

                tier = classify_triage_tier(
                    has_prz_overlap=(prz_overlap > 0.0),
                    active_deformation=h["active_deformation"],
                    fatal_event_last_3_monsoons=h["fatal_3_monsoons"],
                    pop_fraction_in_prz=pop_frac_in_prz,
                    hazard_intensity=hazard_intensity,
                    priority_score=ps,
                    mitigation_cost=m_cost,
                    relocation_cost=r_cost,
                    adverse_trend=adv_trend,
                )

                tier_val = tier.value if tier is not None else None
                rationale = (
                    f"Assigned to {tier.value.upper()} tier based on PRZ overlap ({prz_overlap:.1f}%), active deformation ({h['active_deformation']}), and SoVI vulnerability ({v_index:.2f})."
                    if tier is not None
                    else "Unclassified / Monitoring: Does not meet criteria for permanent relocation or civil in-situ mitigation."
                )
                contributing_factors = [
                    {"name": "Slope & Terrain Curvature", "contribution": 0.45, "type": "hazard"},
                    {"name": "Permanent Red Zone Overlap", "contribution": round(pop_frac_in_prz, 2), "type": "exposure"},
                    {"name": "Structural Housing Vulnerability", "contribution": v_struct, "type": "vulnerability"},
                ]

                conn.execute(
                    text("""
                        INSERT INTO habitation_risk (
                            habitation_id, admin_id, population, households,
                            hazard_intensity, prz_overlap_pct, decayed_loss, v_index,
                            priority_score, caseload_score, tier, triage_rationale,
                            contributing_factors, dominant_hazard, model_version, scoring_version,
                            dataset_version, data_quality, confidence, calculated_at, pipeline_run_id,
                            active_deformation, fatal_event_last_3_monsoons,
                            mitigation_cost, relocation_cost, adverse_trend
                        ) VALUES (
                            :hab_id, :admin_id, :pop, :hh,
                            :hazard_intensity, :prz_overlap_pct, :decayed_loss, :v_index,
                            :ps, :caseload, :tier, :rationale,
                            CAST(:contributing_factors AS jsonb), 'landslide', :model_ver, 'priority-v1.0',
                            :dataset_ver, 'synthetic', 0.95, :now, :pipeline_run_id,
                            :active_deformation, :fatal_event_last_3_monsoons,
                            :mitigation_cost, :relocation_cost, :adverse_trend
                        );
                    """),
                    {
                        "hab_id": hab_id,
                        "admin_id": admin_id,
                        "pop": h["population"],
                        "hh": h["households"],
                        "hazard_intensity": hazard_intensity,
                        "prz_overlap_pct": prz_overlap,
                        "decayed_loss": decayed_loss,
                        "v_index": v_index,
                        "ps": ps,
                        "caseload": caseload,
                        "tier": tier_val,
                        "rationale": rationale,
                        "contributing_factors": json.dumps(contributing_factors),
                        "model_ver": MODEL_VERSION,
                        "dataset_ver": DATASET_VERSION,
                        "now": now,
                        "pipeline_run_id": pipeline_run_id,
                        "active_deformation": h["active_deformation"],
                        "fatal_event_last_3_monsoons": h["fatal_3_monsoons"],
                        "mitigation_cost": m_cost,
                        "relocation_cost": r_cost,
                        "adverse_trend": bool(adv_trend) if adv_trend is not None else None,
                    },
                )

            # Seed Candidate Relocation Sites for District
            if "candidate_sites" in dist:
                logger.info(f"Seeding {len(dist['candidate_sites'])} candidate sites for {name}...")
                for site_spec in dist["candidate_sites"]:
                    site_data = build_candidate_site_record(site_spec, engine=capacity_engine)
                    conn.execute(
                        text("""
                            INSERT INTO candidate_site (
                                geom, centroid, area_ha, tenure, slope_mean, mhi_max,
                                cc_land, cc_water, cc_school, cc_health, cc_final,
                                binding_constraint, augmented, suitability, metadata, pipeline_run_id
                            ) VALUES (
                                ST_GeomFromText(:geom_wkt, 4326),
                                ST_GeomFromText(:centroid_wkt, 4326),
                                :area_ha, :tenure, :slope_mean, :mhi_max,
                                :cc_land, :cc_water, :cc_school, :cc_health, :cc_final,
                                :binding_constraint, CAST(:augmented AS jsonb), :suitability, CAST(:metadata AS jsonb), :pipeline_run_id
                            );
                        """),
                        {
                            "geom_wkt": site_data["geom_wkt"],
                            "centroid_wkt": site_data["centroid_wkt"],
                            "area_ha": site_data["area_ha"],
                            "tenure": site_data["tenure"],
                            "slope_mean": site_data["slope_mean"],
                            "mhi_max": site_data["mhi_max"],
                            "cc_land": site_data["cc_land"],
                            "cc_water": site_data["cc_water"],
                            "cc_school": site_data["cc_school"],
                            "cc_health": site_data["cc_health"],
                            "cc_final": site_data["cc_final"],
                            "binding_constraint": site_data["binding_constraint"],
                            "augmented": site_data["augmented"],
                            "suitability": site_data["suitability"],
                            "metadata": site_data["metadata"],
                            "pipeline_run_id": pipeline_run_id,
                        },
                    )
                    total_sites_seeded += 1

            # Seed H3 Grids & Hazard Layers (Res 7 and Res 8)
            for res_level in (7, 8):
                logger.info(f"Generating H3 grids for {name} bounding box at resolution {res_level}...")
                cells = generate_h3_grid_for_bbox(min_lon, min_lat, max_lon, max_lat, resolution=res_level)
                logger.info(f"Generated {len(cells)} H3 resolution-{res_level} cells for {name}.")

                grid_records = create_grid_cell_records(
                    h3_cells=cells,
                    admin_id=admin_id,
                    dataset_version=DATASET_VERSION,
                    total_population=dist["population"],
                )

                grid_cell_rows = []
                hazard_static_rows = []
                mhi_snapshot_rows = []
                explanation_rows = []

                for cell_rec in grid_records:
                    h_int = cell_rec["h3"]
                    lat, lon = h3_to_centroid(h_int)

                    grid_cell_rows.append({
                        "h3": h_int,
                        "res": res_level,
                        "admin_id": admin_id,
                        "centroid": cell_rec["centroid"],
                        "geom": cell_rec["geom"],
                        "population": cell_rec["population"],
                        "built_area_m2": cell_rec["built_area_m2"],
                        "dataset_version": DATASET_VERSION,
                    })

                    # Deterministic synthetic terrain features based on cell location
                    r_cell = random.Random(h_int)
                    base_slope = 26.0 if (lon > 76.10 and lat < 11.65) else 14.0
                    slope_deg = max(0.0, r_cell.gauss(base_slope, 8.0))
                    elevation_m = r_cell.uniform(400.0, 1800.0)
                    local_relief = r_cell.uniform(50.0, 450.0)
                    dist_road = r_cell.uniform(50.0, 3000.0)
                    hand = r_cell.uniform(1.0, 40.0)
                    twi = r_cell.uniform(4.0, 14.0)

                    eval_result = evaluator.evaluate_cell(
                        h3_int=h_int,
                        elevation_m=elevation_m,
                        slope_deg=slope_deg,
                        local_relief_m=local_relief,
                        dist_to_road_m=dist_road,
                        hand_m=hand,
                        twi=twi,
                        valid_at=now,
                    )

                    for hs in eval_result["hazard_statics"]:
                        hazard_static_rows.append({
                            "h3": hs["h3"],
                            "hazard_type": hs["hazard_type"],
                            "susceptibility": hs["susceptibility"],
                            "confidence": hs["confidence"],
                            "model_version": hs["model_version"],
                            "pipeline_run_id": pipeline_run_id,
                        })

                    mhi_snap = eval_result["mhi_snapshot"]
                    mhi_snapshot_rows.append({
                        "h3": mhi_snap["h3"],
                        "valid_at": mhi_snap["valid_at"],
                        "mhi_static": mhi_snap["mhi_static"],
                        "mhi_live": mhi_snap["mhi_live"],
                        "mhi_fcst": mhi_snap["mhi_fcst"],
                        "dominant_hazard": mhi_snap["dominant_hazard"],
                        "zone_class": mhi_snap["zone_class"],
                        "pipeline_run_id": pipeline_run_id,
                    })

                    expl = eval_result["explanation"]
                    explanation_rows.append({
                        "h3": expl["h3"],
                        "model_version": expl["model_version"],
                        "factors": json.dumps(expl["factors"]),
                        "screening_grade": expl["screening_grade"],
                    })

                    total_cells_seeded += 1

                logger.info(f"Bulk inserting {len(grid_cell_rows)} res-{res_level} cells for {name}...")

                # Chunked bulk insert
                def chunker(seq, size=1000):
                    return (seq[pos:pos + size] for pos in range(0, len(seq), size))

                for chunk in chunker(grid_cell_rows):
                    conn.execute(
                        text("""
                            INSERT INTO grid_cell (
                                h3, res, admin_id, centroid, geom, population, built_area_m2, dataset_version
                            ) VALUES (
                                :h3, :res, :admin_id,
                                ST_GeogFromText(:centroid),
                                ST_GeomFromText(:geom, 4326),
                                :population, :built_area_m2, :dataset_version
                            );
                        """),
                        chunk,
                    )

                for chunk in chunker(hazard_static_rows):
                    conn.execute(
                        text("""
                            INSERT INTO hazard_static (
                                h3, hazard_type, susceptibility, confidence, model_version, pipeline_run_id
                            ) VALUES (
                                :h3, :hazard_type, :susceptibility, :confidence, :model_version, :pipeline_run_id
                            );
                        """),
                        chunk,
                    )

                for chunk in chunker(mhi_snapshot_rows):
                    conn.execute(
                        text("""
                            INSERT INTO mhi_snapshot (
                                h3, valid_at, mhi_static, mhi_live, mhi_fcst, dominant_hazard, zone_class, pipeline_run_id
                            ) VALUES (
                                :h3, :valid_at, :mhi_static, :mhi_live, :mhi_fcst, :dominant_hazard, :zone_class, :pipeline_run_id
                            );
                        """),
                        chunk,
                    )

                for chunk in chunker(explanation_rows):
                    conn.execute(
                        text("""
                            INSERT INTO explanation (
                                h3, model_version, factors, screening_grade
                            ) VALUES (
                                :h3, :model_version, CAST(:factors AS jsonb), :screening_grade
                            );
                        """),
                        chunk,
                    )

        # 4. Publish Dataset Version
        conn.execute(
            text("""
                INSERT INTO serving_version (dataset_name, pipeline_run_id, updated_at)
                VALUES ('default', :run_id, :now);
            """),
            {"run_id": pipeline_run_id, "now": now},
        )

        # 5. Deterministically seed demo users if app_user table exists
        try:
            from core.domain.auth import hash_password
            from core.enums import Role

            wayanad_admin_id = conn.execute(
                text("SELECT id FROM admin_boundary WHERE name = 'Wayanad' LIMIT 1;")
            ).scalar()
            kodagu_admin_id = conn.execute(
                text("SELECT id FROM admin_boundary WHERE name = 'Kodagu' LIMIT 1;")
            ).scalar()

            demo_accounts = [
                ("civilian@setu.gov.in", settings.DEMO_CIVILIAN_PASSWORD, "Demo Citizen", Role.CIVILIAN.value, None),
                # National operations account: no assigned district -> authorized across every
                # pilot district. This is the single "Government" login the portal exposes.
                ("gov@setu.gov.in", settings.DEMO_OFFICER_PASSWORD, "SETU-DRR National Operations", Role.GOVERNMENT_OFFICIAL.value, None),
                ("officer@setu.gov.in", settings.DEMO_OFFICER_PASSWORD, "District Magistrate Wayanad", Role.GOVERNMENT_OFFICIAL.value, wayanad_admin_id),
                ("officer_kodagu@setu.gov.in", settings.DEMO_OFFICER_PASSWORD, "District Magistrate Kodagu", Role.GOVERNMENT_OFFICIAL.value, kodagu_admin_id),
                ("rescue@setu.gov.in", settings.DEMO_RESCUE_PASSWORD, "NDRF Commander 4th BN", Role.GOVERNMENT_OFFICIAL.value, wayanad_admin_id),
            ]
            for email, pw, name, role, a_id in demo_accounts:
                conn.execute(
                    text("""
                        INSERT INTO app_user (id, email, password_hash, full_name, role, admin_id, is_active, created_at, updated_at)
                        VALUES (gen_random_uuid(), :email, :pw_hash, :name, :role, :admin_id, true, now(), now())
                        ON CONFLICT (email) DO UPDATE SET admin_id = EXCLUDED.admin_id, role = EXCLUDED.role;
                    """),
                    {"email": email, "pw_hash": hash_password(pw), "name": name, "role": role, "admin_id": a_id},
                )
            logger.info(f"Seeded {len(demo_accounts)} demo accounts with jurisdiction assignments.")
        except Exception as auth_err:
            logger.debug(f"Auth user seeding bypassed (table may not exist in earlier migrations): {auth_err}")

        # 6. Deterministically seed synthetic dynamic triggers (B6)
        logger.info("Seeding deterministic synthetic dynamic triggers for alert verification (B6)...")
        from datetime import timedelta

        candidate_cells = conn.execute(
            text("""
                SELECT gc.h3, hs.susceptibility, ms.mhi_static
                FROM grid_cell gc
                JOIN admin_boundary ab ON gc.admin_id = ab.id
                JOIN hazard_static hs ON gc.h3 = hs.h3 AND hs.hazard_type = 'landslide'
                JOIN mhi_snapshot ms ON gc.h3 = ms.h3 AND ms.valid_at = :now
                WHERE ab.name = 'Wayanad' AND gc.res = 8
                  AND ms.mhi_static BETWEEN 0.35 AND 0.60
                  AND hs.susceptibility >= 0.35
                ORDER BY gc.h3 ASC
                LIMIT 4;
            """),
            {"now": now},
        ).fetchall()

        if len(candidate_cells) >= 4:
            dynamic_trigger_rows = [
                # Cell 0: Active live trigger at valid_at = now
                {
                    "h3": int(candidate_cells[0][0]),
                    "hazard_type": "landslide",
                    "valid_at": now,
                    "forecast_cycle_at": None,
                    "trigger_value": 1.25,
                    "source": "SYNTHETIC_DEMO",
                    "pipeline_run_id": pipeline_run_id,
                },
                # Cell 1: Forecast trigger at valid_at = now + 24h (24h horizon)
                {
                    "h3": int(candidate_cells[1][0]),
                    "hazard_type": "landslide",
                    "valid_at": now + timedelta(hours=24),
                    "forecast_cycle_at": now,
                    "trigger_value": 1.25,
                    "source": "SYNTHETIC_DEMO",
                    "pipeline_run_id": pipeline_run_id,
                },
                # Cell 2: Forecast trigger at valid_at = now + 48h (48h horizon)
                {
                    "h3": int(candidate_cells[2][0]),
                    "hazard_type": "landslide",
                    "valid_at": now + timedelta(hours=48),
                    "forecast_cycle_at": now,
                    "trigger_value": 1.25,
                    "source": "SYNTHETIC_DEMO",
                    "pipeline_run_id": pipeline_run_id,
                },
                # Cell 3: Forecast trigger at valid_at = now + 72h (72h horizon)
                {
                    "h3": int(candidate_cells[3][0]),
                    "hazard_type": "landslide",
                    "valid_at": now + timedelta(hours=72),
                    "forecast_cycle_at": now,
                    "trigger_value": 1.25,
                    "source": "SYNTHETIC_DEMO",
                    "pipeline_run_id": pipeline_run_id,
                },
            ]
            conn.execute(
                text("""
                    INSERT INTO hazard_dynamic (
                        h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source, pipeline_run_id
                    ) VALUES (
                        :h3, :hazard_type, :valid_at, :forecast_cycle_at, :trigger_value, :source, :pipeline_run_id
                    );
                """),
                dynamic_trigger_rows,
            )
            logger.info(f"Seeded {len(dynamic_trigger_rows)} deterministic synthetic dynamic triggers.")
        else:
            logger.warning(f"Could not find 4 candidate cells in Wayanad; found {len(candidate_cells)}.")

    # 7. Execute production dynamic snapshot pipeline to derive MHI_live and MHI_fcst (B6)
    logger.info("Computing and persisting dynamic hazard snapshots from synthetic triggers...")
    from pipeline.jobs.compute_dynamic_hazard import compute_and_persist_dynamic_snapshots

    dynamic_res = compute_and_persist_dynamic_snapshots(engine, pipeline_run_id=pipeline_run_id)
    logger.info(
        f"Dynamic snapshot computation completed: status={dynamic_res.status}, "
        f"persisted={dynamic_res.snapshots_persisted}, timestamps={len(dynamic_res.valid_timestamps)}"
    )

    logger.info("Pilot data seeding completed successfully!")
    logger.info(f"Seeded: {len(PILOT_DISTRICTS)} districts, {total_habitations_seeded} habitations, {total_sites_seeded} candidate sites, {total_cells_seeded} H3 cells.")


if __name__ == "__main__":
    seed_database()
