"""Domain-driven semantic backfill for existing candidate sites and habitations.

Evaluates existing non-imported candidate sites through canonical CandidateSitePolicy
to establish true assessment and eligibility statuses based on domain rules,
rather than guessing heuristics in SQL migrations.
"""

from __future__ import annotations

import sys
from pathlib import Path
from sqlalchemy import create_engine, text

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(REPO_ROOT / "core" / "src") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "core" / "src"))
if str(REPO_ROOT / "api" / "src") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "api" / "src"))

from core.config import settings
from api.services.site_eligibility import evaluate_row_eligibility
from core.domain.capacity import CapacityEngine, CandidateSitePolicy
from core.enums import TenureType


def backfill_candidate_sites(engine=None) -> int:
    eng = engine or create_engine(settings.get_sqlalchemy_url())
    cap_engine = CapacityEngine()
    policy = CandidateSitePolicy()

    updated_sites = 0
    with eng.begin() as conn:
        # 1. Fetch non-imported candidate sites
        # Seed runs predating the exclusion-flag fields left `is_forest` / `is_protected_area` /
        # `is_crz` / `is_water_body` out of metadata. H7 treats an absent flag as unverified and
        # rejects the site, so those stale rows are invisible to the allocator. The originating
        # RawCandidateSiteSpec asserts all four as False for the synthetic pilot fixtures, so the
        # values are restored from the fixture contract — and only for rows that fixture produced.
        restored = conn.execute(text("""
            UPDATE candidate_site
            SET metadata = jsonb_build_object(
                    'is_forest', false,
                    'is_protected_area', false,
                    'is_crz', false,
                    'is_water_body', false
                ) || metadata
            WHERE import_run_id IS NULL
              AND metadata->>'provenance' = 'synthetic_pilot_fixture'
              AND NOT (metadata ? 'is_forest')
            RETURNING id;
        """)).fetchall()
        if restored:
            print(f"[INFO] Restored exclusion flags on {len(restored)} synthetic fixture sites.")

        rows = conn.execute(text("""
            SELECT id, area_ha, tenure, slope_mean, mhi_max, cc_land, cc_water, cc_school, cc_health, cc_final,
                   metadata
            FROM candidate_site
            WHERE import_run_id IS NULL
        """)).mappings().fetchall()

        for r in rows:
            eligibility = evaluate_row_eligibility(
                engine=cap_engine,
                row=dict(r),
                policy=policy,
            )

            # Determine assessment completeness
            has_lifelines = (
                r["cc_water"] is not None and r["cc_school"] is not None and r["cc_health"] is not None
            )

            if eligibility.is_eligible and has_lifelines:
                assessment_status = "fully_assessed"
                eligibility_status = "eligible"
            elif r["tenure"] == TenureType.TENURE_UNVERIFIED.value or r["mhi_max"] is None:
                assessment_status = "screening_only" if not has_lifelines else "partial"
                eligibility_status = "unknown"
            else:
                assessment_status = "fully_assessed" if has_lifelines else "partial"
                eligibility_status = "ineligible"

            conn.execute(text("""
                UPDATE candidate_site
                SET assessment_status = :assessment_status,
                    eligibility_status = :eligibility_status
                WHERE id = :id
            """), {
                "id": r["id"],
                "assessment_status": assessment_status,
                "eligibility_status": eligibility_status,
            })
            updated_sites += 1

        # 2. Backfill admin_id for existing candidate sites based on spatial containment
        conn.execute(text("""
            UPDATE candidate_site cs
            SET admin_id = ab.id
            FROM admin_boundary ab
            WHERE cs.admin_id IS NULL
              AND ST_Within(cs.centroid, ab.geom);
        """))

        # 3. Backfill existing habitations risk_status based on whether habitation_risk profile exists
        conn.execute(text("""
            UPDATE habitation h
            SET risk_status = CASE
                WHEN hr.habitation_id IS NOT NULL THEN 'scored'
                ELSE 'pending'
            END
            FROM habitation_risk hr
            WHERE h.id = hr.habitation_id
              AND h.import_run_id IS NULL;
        """))

    print(f"[SUCCESS] Backfilled {updated_sites} existing candidate sites via CandidateSitePolicy.")
    return updated_sites


if __name__ == "__main__":
    backfill_candidate_sites()
