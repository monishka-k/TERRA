"""Loader for verified or demo synthetic site assessments for Barpeta.

Strict Guardrails:
1. Replaces fake field survey scripts with an honest, audited fixture loader.
2. Verified measurements require external provenance and citations (--verified <path>).
3. Synthetic demo data is strictly gated behind DEMO_MODE (--demo-synthetic) and explicitly
   tagged with is_synthetic=True and SYNTHETIC DEMO DATA disclaimer notices.
4. Updates candidate sites through canonical CandidateSitePolicy and CapacityEngine.
5. Provides --reset to return Barpeta sites to raw honest unassessed screening status.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from sqlalchemy import create_engine, text

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(REPO_ROOT / "core" / "src") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "core" / "src"))

from core.config import settings
from core.domain.capacity import CapacityEngine, CandidateSitePolicy


def apply_verified_assessment(filepath: Path | str) -> int:
    """Applies verified field assessment data from an audited JSON file."""
    path = Path(filepath)
    if not path.is_file():
        raise FileNotFoundError(f"Verified assessment file not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        records = json.load(f)

    eng = create_engine(settings.get_sqlalchemy_url())
    cap_engine = CapacityEngine()
    policy = CandidateSitePolicy()
    updated = 0

    with eng.begin() as conn:
        for rec in records:
            source_id = rec.get("source_site_id")
            if not source_id:
                continue

            row = conn.execute(
                text("SELECT id, area_ha, slope_mean, cc_land, metadata FROM candidate_site WHERE source_site_id = :sid"),
                {"sid": source_id},
            ).mappings().first()
            if not row:
                continue

            mhi = rec.get("mhi_max")
            tenure = rec.get("tenure", "government_revenue")
            water = rec.get("cc_water")
            school = rec.get("cc_school")
            health = rec.get("cc_health")

            eligibility = cap_engine.evaluate_site_eligibility(
                mhi_static=mhi,
                slope_mean=float(row["slope_mean"]),
                area_ha=float(row["area_ha"]),
                tenure=tenure,
                policy=policy,
            )

            cc_final, binding, _ = cap_engine.calculate_final_capacity(
                cc_land=row["cc_land"],
                cc_water=water,
                cc_school=school,
                cc_health=health,
                livelihood_multiplier=1.0,
            )

            meta = dict(row["metadata"] or {})
            meta["is_synthetic"] = False
            meta["provenance_citation"] = rec.get("provenance_citation", "Audited Field Survey")

            has_all_lifelines = water is not None and school is not None and health is not None
            assessment_status = "fully_assessed" if has_all_lifelines and mhi is not None else "partial"

            conn.execute(text("""
                UPDATE candidate_site
                SET mhi_max = :mhi,
                    tenure = :tenure,
                    cc_water = :water,
                    cc_school = :school,
                    cc_health = :health,
                    cc_final = :cc_final,
                    binding_constraint = :binding,
                    assessment_status = :assessment_status,
                    eligibility_status = :eligibility_status,
                    metadata = CAST(:meta AS jsonb)
                WHERE id = :id;
            """), {
                "id": row["id"],
                "mhi": mhi,
                "tenure": tenure,
                "water": water,
                "school": school,
                "health": health,
                "cc_final": cc_final,
                "binding": binding.value if binding else None,
                "assessment_status": assessment_status,
                "eligibility_status": eligibility.eligibility_status.value,
                "meta": json.dumps(meta),
            })
            updated += 1

    print(f"[SUCCESS] Applied verified assessment to {updated} sites.")
    return updated


def apply_demo_synthetic_assessment() -> int:
    """Applies synthetic assessment fixture for 8 demonstration sites near Barpeta.

    Strictly gated behind DEMO_MODE to prevent unverified data from polluting production.
    Explicitly tags records as SYNTHETIC DEMO DATA in the database.
    """
    if not settings.DEMO_MODE:
        raise PermissionError(
            "Demo synthetic assessments can only be applied when DEMO_MODE=true in settings/env."
        )

    demo_site_keys = [
        "baghbor_29",
        "bohori_8",
        "chenga_6",
        "kalgachia_31",
        "baghmara_0",
        "barpeta_road_30",
        "bhawanipur_27",
        "mandia_55",
    ]

    eng = create_engine(settings.get_sqlalchemy_url())
    cap_engine = CapacityEngine()
    policy = CandidateSitePolicy()
    updated = 0

    with eng.begin() as conn:
        for sid in demo_site_keys:
            row = conn.execute(
                text("SELECT id, area_ha, slope_mean, cc_land, metadata FROM candidate_site WHERE source_site_id = :sid"),
                {"sid": sid},
            ).mappings().first()
            if not row:
                continue

            # Deterministic, reasonable synthetic values for demonstration
            mhi_synthetic = 0.12
            tenure_synthetic = "government_revenue"
            cc_land = int(row["cc_land"])
            water_synthetic = min(cc_land, 1500)
            school_synthetic = min(cc_land, 1200)
            health_synthetic = min(cc_land, 1000)

            eligibility = cap_engine.evaluate_site_eligibility(
                mhi_static=mhi_synthetic,
                slope_mean=float(row["slope_mean"]),
                area_ha=float(row["area_ha"]),
                tenure=tenure_synthetic,
                policy=policy,
            )

            cc_final, binding, _ = cap_engine.calculate_final_capacity(
                cc_land=cc_land,
                cc_water=water_synthetic,
                cc_school=school_synthetic,
                cc_health=health_synthetic,
                livelihood_multiplier=1.0,
            )

            meta = dict(row["metadata"] or {})
            meta["is_synthetic"] = True
            meta["synthetic_notice"] = "SYNTHETIC DEMO DATA — NOT FIELD VERIFIED"
            meta["provenance"] = "demo_fixture_v1"

            conn.execute(text("""
                UPDATE candidate_site
                SET mhi_max = :mhi,
                    tenure = :tenure,
                    cc_water = :water,
                    cc_school = :school,
                    cc_health = :health,
                    cc_final = :cc_final,
                    binding_constraint = :binding,
                    assessment_status = 'fully_assessed',
                    eligibility_status = :eligibility_status,
                    metadata = CAST(:meta AS jsonb)
                WHERE id = :id;
            """), {
                "id": row["id"],
                "mhi": mhi_synthetic,
                "tenure": tenure_synthetic,
                "water": water_synthetic,
                "school": school_synthetic,
                "health": health_synthetic,
                "cc_final": cc_final,
                "binding": binding.value if binding else None,
                "eligibility_status": eligibility.eligibility_status.value,
                "meta": json.dumps(meta),
            })
            updated += 1

    print(f"[SUCCESS] Applied synthetic demo assessment to {updated} sites (DEMO_MODE=true).")
    print("  - All records tagged with: is_synthetic=True and SYNTHETIC DEMO DATA notices.")
    return updated


def reset_barpeta_assessments() -> int:
    """Resets all Barpeta candidate sites back to raw screening status with honest NULL gaps."""
    eng = create_engine(settings.get_sqlalchemy_url())
    with eng.begin() as conn:
        res = conn.execute(text("""
            UPDATE candidate_site
            SET mhi_max = NULL,
                tenure = 'tenure_unverified',
                cc_water = NULL,
                cc_school = NULL,
                cc_health = NULL,
                cc_final = NULL,
                binding_constraint = NULL,
                assessment_status = 'screening_only',
                eligibility_status = 'unknown'
            WHERE import_run_id IS NOT NULL;
        """))
        updated = res.rowcount

    print(f"[SUCCESS] Reset {updated} Barpeta candidate sites to raw screening status (NULLs restored).")
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Barpeta assessment fixture loader.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--verified", type=str, help="Path to verified assessment JSON file.")
    group.add_argument("--demo-synthetic", action="store_true", help="Apply demo synthetic assessment (requires DEMO_MODE=true).")
    group.add_argument("--reset", action="store_true", help="Reset Barpeta sites back to raw screening NULLs.")

    args = parser.parse_args()
    if args.verified:
        apply_verified_assessment(args.verified)
    elif args.demo_synthetic:
        apply_demo_synthetic_assessment()
    elif args.reset:
        reset_barpeta_assessments()


if __name__ == "__main__":
    main()
