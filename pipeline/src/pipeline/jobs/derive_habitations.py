"""Derives habitation records for a district from constrained population + the hazard layer.

Closes blocker B1 ("the pilot district has hazard data but no people") for districts where the
flood pipeline has run but no habitation list exists. Demand is derived from WorldPop's
settlement-constrained raster already zonal-aggregated into `grid_cell.population`; hazard
exposure comes from the district's real `hazard_static` cells.

What is genuinely measured, and what is not:

  population          measured  — summed constrained-raster population over the settlement's cells
  centroid            measured  — population-weighted
  hazard_intensity    measured  — population-weighted mean susceptibility over the same cells
  prz_overlap_pct     measured  — share of settlement population in cells at/above the PRZ threshold
  households          derived   — population / persons-per-household norm
  name                synthetic — no gazetteer exists; labels are positional, not toponyms
  lgd_code            absent    — left NULL rather than invented
  vulnerability       flat      — no SoVI source; one district-level value, is_district_flat = True

Because vulnerability is constant across the district it cannot discriminate between habitations,
but it also cannot distort their order: the ranking within a district is driven entirely by the
measured hazard and exposure terms. Rows are written with data_quality='derived' so nothing here
is mistaken for surveyed ground truth.
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

import h3
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine

REPO_ROOT = Path(__file__).resolve().parents[4]
for sub in ("core/src", "pipeline/src", "api/src"):
    p = str(REPO_ROOT / sub)
    if p not in sys.path:
        sys.path.insert(0, p)

from core.config import settings
from core.constants import PRZ_ANY_SUSCEPTIBILITY
from core.domain.capacity import CapacityNormsConfig
from core.domain.priority import compute_priority_score, evaluate_triage_with_rationale
from pipeline.exposure.settlements import (
    DerivedSettlement,
    SettlementSegmentationConfig,
    segment_settlements,
    summarize,
)

logger = logging.getLogger("setu_pipeline.derive_habitations")

MODEL_VERSION = "settlement-derived-v1.0"
DATASET_VERSION = "worldpop-2020-constrained"
SOURCE_PREFIX = "derived-settlement"

#: No district SoVI source exists in this repo, so vulnerability is a single neutral constant
#: rather than a fabricated per-habitation estimate. It scales every priority score in the
#: district identically and therefore does not affect their order. Replace with a Census-anchored
#: value via --vulnerability-anchor once one is available.
DEFAULT_VULNERABILITY_ANCHOR = 0.5


def fetch_district(conn: Connection, district: str) -> dict[str, Any]:
    row = conn.execute(
        text("SELECT id, name, lgd_code FROM admin_boundary WHERE lower(name)=lower(:n) AND level='district'"),
        {"n": district},
    ).mappings().first()
    if row is None:
        raise SystemExit(f"District '{district}' not found in admin_boundary.")
    return dict(row)


def fetch_cells(conn: Connection, admin_id: int, res: int) -> tuple[dict[str, float], dict[str, float], str]:
    """Returns (population by cell, susceptibility by cell, dominant hazard type)."""
    rows = conn.execute(
        text("""
            SELECT gc.h3, gc.population, hs.susceptibility, hs.hazard_type
            FROM grid_cell gc
            LEFT JOIN LATERAL (
                SELECT susceptibility, hazard_type FROM hazard_static
                WHERE h3 = gc.h3 ORDER BY susceptibility DESC LIMIT 1
            ) hs ON TRUE
            WHERE gc.admin_id = :admin_id AND gc.res = :res AND gc.population > 0
        """),
        {"admin_id": admin_id, "res": res},
    ).mappings().all()

    population: dict[str, float] = {}
    susceptibility: dict[str, float] = {}
    hazard_counts: dict[str, int] = {}
    for r in rows:
        cell = h3.int_to_str(int(r["h3"])) if isinstance(r["h3"], int) else str(r["h3"])
        population[cell] = float(r["population"])
        if r["susceptibility"] is not None:
            susceptibility[cell] = float(r["susceptibility"])
        if r["hazard_type"]:
            hazard_counts[r["hazard_type"]] = hazard_counts.get(r["hazard_type"], 0) + 1

    dominant = max(hazard_counts, key=hazard_counts.get) if hazard_counts else "riverine_flood"
    return population, susceptibility, dominant


def score_settlement(
    settlement: DerivedSettlement,
    population: dict[str, float],
    susceptibility: dict[str, float],
    vulnerability_anchor: float,
) -> dict[str, Any]:
    """Computes measured exposure terms and runs the canonical priority/triage engines."""
    cells = settlement.cells
    total_pop = sum(population.get(c, 0.0) for c in cells)

    # Population-weighted mean susceptibility: what the residents actually sit in. Taking the max
    # would let one hazardous fringe cell speak for a whole settlement.
    scored_pop = sum(population.get(c, 0.0) for c in cells if c in susceptibility)
    if scored_pop > 0:
        hazard_intensity = sum(
            susceptibility[c] * population.get(c, 0.0) for c in cells if c in susceptibility
        ) / scored_pop
    else:
        hazard_intensity = 0.0

    prz_pop = sum(
        population.get(c, 0.0)
        for c in cells
        if susceptibility.get(c, 0.0) >= PRZ_ANY_SUSCEPTIBILITY
    )
    pop_fraction_in_prz = (prz_pop / total_pop) if total_pop > 0 else 0.0

    priority_score = compute_priority_score(
        hazard_intensity=hazard_intensity,
        pop_fraction_in_prz=pop_fraction_in_prz,
        vulnerability_index=vulnerability_anchor,
    )
    triage = evaluate_triage_with_rationale(
        has_prz_overlap=prz_pop > 0,
        pop_fraction_in_prz=pop_fraction_in_prz,
        hazard_intensity=hazard_intensity,
        priority_score=priority_score,
    )
    tier = getattr(triage.tier, "value", triage.tier) if triage.tier is not None else None

    return {
        "population": total_pop,
        "hazard_intensity": round(min(max(hazard_intensity, 0.0), 1.0), 4),
        "prz_overlap_pct": round(min(max(pop_fraction_in_prz * 100.0, 0.0), 100.0), 2),
        "pop_fraction_in_prz": pop_fraction_in_prz,
        "priority_score": priority_score,
        "tier": tier,
        "rationale": triage.rationale,
        "scored_population_pct": round(scored_pop / total_pop * 100.0, 1) if total_pop else 0.0,
    }


def derive(
    district: str,
    engine: Optional[Engine] = None,
    res: int = 8,
    config: Optional[SettlementSegmentationConfig] = None,
    vulnerability_anchor: float = DEFAULT_VULNERABILITY_ANCHOR,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Segments a district's population surface and writes habitation + risk records."""
    eng = engine or create_engine(settings.get_sqlalchemy_url())
    cfg = config or SettlementSegmentationConfig()
    norms = CapacityNormsConfig()
    now = datetime.now(timezone.utc)

    with eng.begin() as conn:
        district_row = fetch_district(conn, district)
        admin_id = int(district_row["id"])
        population, susceptibility, dominant_hazard = fetch_cells(conn, admin_id, res)
        if not population:
            raise SystemExit(
                f"No populated res-{res} grid cells for {district_row['name']}. "
                "Run the population zonal job for this district first."
            )

        settlements = segment_settlements(population, cfg)
        stats = summarize(settlements, sum(population.values()))
        logger.info(
            "%s: %s settlements from %s populated cells, covering %.1f%% of district population",
            district_row["name"], stats["settlements"], len(population), stats["coverage_pct"],
        )
        if dry_run:
            return {"district": district_row["name"], "dry_run": True, **stats}

        pipeline_run_id = uuid.uuid4()
        conn.execute(
            text("""
                INSERT INTO pipeline_run (
                    id, run_type, status, started_at, completed_at,
                    code_version, config_version, model_version
                ) VALUES (
                    :id, 'derive_habitations', 'READY', :now, :now,
                    :code_version, :config_version, :model_ver
                );
            """),
            {
                "id": pipeline_run_id, "now": now,
                "code_version": cfg.method_version,
                "config_version": f"budget={cfg.population_budget:.0f};min={cfg.min_population:.0f};res={res}",
                "model_ver": MODEL_VERSION,
            },
        )

        written = 0
        current_keys: list[str] = []
        for rank, settlement in enumerate(settlements, start=1):
            scored = score_settlement(settlement, population, susceptibility, vulnerability_anchor)
            lon, lat = settlement.centroid(population)
            pop_int = int(round(scored["population"]))
            households = int(round(pop_int / norms.persons_per_hh))
            source_key = f"{SOURCE_PREFIX}:{district_row['name'].lower()}:r{res}:{settlement.seed_h3}"

            # Positional label, not a toponym: no gazetteer exists to name these. The district
            # is deliberately not repeated here — every view that shows the name shows the
            # district alongside it, and the prefix crowded out the distinguishing ordinal.
            # `source_habitation_id` carries the unambiguous district-qualified identity.
            name = f"Settlement {rank:03d}"

            hab_id = conn.execute(
                text("""
                    INSERT INTO habitation (
                        lgd_code, name, type, admin_id, geom_point, population, households,
                        source_habitation_id, risk_status
                    ) VALUES (
                        NULL, :name, 'derived_settlement', :admin_id,
                        ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), :pop, :hh, :source_key, 'scored'
                    )
                    -- Predicate repeated so the planner matches the partial unique index.
                    ON CONFLICT (source_habitation_id) WHERE source_habitation_id IS NOT NULL
                    DO UPDATE SET
                        name = EXCLUDED.name, population = EXCLUDED.population,
                        households = EXCLUDED.households, geom_point = EXCLUDED.geom_point,
                        risk_status = 'scored'
                    RETURNING id;
                """),
                {"name": name, "admin_id": admin_id, "lon": lon, "lat": lat,
                 "pop": pop_int, "hh": households, "source_key": source_key},
            ).scalar_one()

            conn.execute(
                text("""
                    INSERT INTO vulnerability (
                        habitation_id, v_demographic, v_structural, v_access, v_economic,
                        v_index, is_district_flat, pipeline_run_id, metadata
                    ) VALUES (
                        :hab_id, :v, :v, :v, :v, :v, TRUE, :run_id, CAST(:meta AS jsonb)
                    )
                    ON CONFLICT (habitation_id) DO UPDATE SET
                        v_index = EXCLUDED.v_index, is_district_flat = TRUE,
                        pipeline_run_id = EXCLUDED.pipeline_run_id, metadata = EXCLUDED.metadata;
                """),
                {"hab_id": hab_id, "v": vulnerability_anchor, "run_id": pipeline_run_id,
                 "meta": json.dumps({
                     "provenance": "district_flat_placeholder",
                     "note": "No SoVI source available; constant across the district and therefore "
                             "does not affect intra-district ranking.",
                 })},
            )

            contributing = [
                {"name": "Flood susceptibility (population-weighted)",
                 "contribution": scored["hazard_intensity"], "type": "hazard"},
                {"name": "Population in permanent red zone",
                 "contribution": round(scored["pop_fraction_in_prz"], 4), "type": "exposure"},
                {"name": "District-flat vulnerability placeholder",
                 "contribution": vulnerability_anchor, "type": "vulnerability"},
            ]

            conn.execute(
                text("""
                    INSERT INTO habitation_risk (
                        habitation_id, admin_id, population, households,
                        hazard_intensity, prz_overlap_pct, decayed_loss, v_index,
                        priority_score, caseload_score, tier, triage_rationale,
                        contributing_factors, dominant_hazard, model_version, scoring_version,
                        dataset_version, data_quality, confidence, calculated_at, pipeline_run_id
                    ) VALUES (
                        :hab_id, :admin_id, :pop, :hh,
                        :hazard, :prz, 0.0, :v,
                        :ps, :caseload, :tier, :rationale,
                        CAST(:factors AS jsonb), :dominant, :model_ver, 'priority-v1.0',
                        :dataset_ver, 'derived', :confidence, :now, :run_id
                    )
                    ON CONFLICT (habitation_id) DO UPDATE SET
                        population = EXCLUDED.population, households = EXCLUDED.households,
                        hazard_intensity = EXCLUDED.hazard_intensity,
                        prz_overlap_pct = EXCLUDED.prz_overlap_pct, v_index = EXCLUDED.v_index,
                        priority_score = EXCLUDED.priority_score,
                        caseload_score = EXCLUDED.caseload_score, tier = EXCLUDED.tier,
                        triage_rationale = EXCLUDED.triage_rationale,
                        contributing_factors = EXCLUDED.contributing_factors,
                        calculated_at = EXCLUDED.calculated_at,
                        pipeline_run_id = EXCLUDED.pipeline_run_id;
                """),
                {
                    "hab_id": hab_id, "admin_id": admin_id, "pop": pop_int, "hh": households,
                    "hazard": scored["hazard_intensity"], "prz": scored["prz_overlap_pct"],
                    "v": vulnerability_anchor, "ps": scored["priority_score"],
                    "caseload": round(scored["priority_score"] * pop_int, 2),
                    "tier": scored["tier"], "rationale": scored["rationale"],
                    "factors": json.dumps(contributing), "dominant": dominant_hazard,
                    "model_ver": MODEL_VERSION, "dataset_ver": DATASET_VERSION,
                    # Confidence tracks how much of the settlement actually has a hazard score.
                    "confidence": round(scored["scored_population_pct"] / 100.0, 3),
                    "now": now, "run_id": pipeline_run_id,
                },
            )
            written += 1
            current_keys.append(source_key)

        # Re-segmenting with a different resolution or raster moves the seeding peaks, which
        # orphans the rows keyed to the old ones. Remove them so a district reflects exactly one
        # segmentation — but never a settlement that a relocation decision already refers to:
        # relocation_plan cascades on delete, so pruning one would destroy the audit record.
        pruned = conn.execute(
            text("""
                DELETE FROM habitation h
                WHERE h.type = 'derived_settlement'
                  AND h.admin_id = :admin_id
                  AND h.source_habitation_id <> ALL(:keys)
                  AND NOT EXISTS (SELECT 1 FROM relocation_plan rp WHERE rp.habitation_id = h.id)
                  AND NOT EXISTS (
                      SELECT 1 FROM external_relocation_recommendation e WHERE e.habitation_id = h.id)
                RETURNING h.id;
            """),
            {"admin_id": admin_id, "keys": current_keys},
        ).fetchall()

        retained = conn.execute(
            text("""
                SELECT count(*) FROM habitation h
                WHERE h.type = 'derived_settlement' AND h.admin_id = :admin_id
                  AND h.source_habitation_id <> ALL(:keys)
            """),
            {"admin_id": admin_id, "keys": current_keys},
        ).scalar_one()

        if pruned:
            logger.info("Pruned %s superseded derived settlements.", len(pruned))
        if retained:
            logger.warning(
                "%s superseded settlements kept: a relocation decision still references them.",
                retained,
            )

    return {"district": district_row["name"], "habitations_written": written,
            "superseded_pruned": len(pruned), "superseded_retained": int(retained),
            "pipeline_run_id": str(pipeline_run_id), **stats}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--district", required=True, help="District name as in admin_boundary.")
    parser.add_argument("--res", type=int, default=8, help="H3 resolution of the population grid.")
    parser.add_argument("--population-budget", type=float, default=12000.0,
                        help="Population at which a settlement stops absorbing neighbours.")
    parser.add_argument("--min-population", type=float, default=250.0,
                        help="Drop settlements below this population.")
    parser.add_argument("--vulnerability-anchor", type=float, default=DEFAULT_VULNERABILITY_ANCHOR,
                        help="District-flat vulnerability index; constant, so it does not affect ranking.")
    parser.add_argument("--dry-run", action="store_true", help="Report segmentation without writing.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    result = derive(
        district=args.district,
        res=args.res,
        config=SettlementSegmentationConfig(
            population_budget=args.population_budget,
            min_population=args.min_population,
        ),
        vulnerability_anchor=args.vulnerability_anchor,
        dry_run=args.dry_run,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
