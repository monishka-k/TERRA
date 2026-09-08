"""Unit and Production-Path Integration Tests for P0.5 / H7 Candidate-Site Eligibility.

Section refs: docs/PRD1.md §6.8, §9.5, §9.6, FR-7.1, FR-7.2, FR-7.3

Verifies that no candidate site violating hard H7 constraints can reach allocation:
- static MHI < 0.25
- slope < 15°
- not forest
- not protected area
- not CRZ
- not water
- contiguous area >= 2 ha
- within search radius (default 15 km)
- tenure explicitly known/valid (government_revenue or private; unverified/unknown rejected)
"""

from unittest.mock import MagicMock
import pytest

from core.domain.capacity import CapacityEngine, CandidateSitePolicy, EligibilityResult
from core.enums import TenureType, Tier
from core.domain.allocation import HabitationDemand
from api.services.allocation_service import AllocationService
from core.schemas.allocation import AllocationPlanRequest


class TestH7DomainEligibilityBoundaries:
    """Rigorous boundary and uncertainty tests for CapacityEngine.evaluate_site_eligibility."""

    @pytest.fixture
    def engine(self) -> CapacityEngine:
        return CapacityEngine()

    # --- Static MHI Boundaries ---
    def test_mhi_zero_is_eligible(self, engine: CapacityEngine):
        """0.0 must be preserved as valid and eligible (B3 zero semantics)."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.0,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is True
        assert len(res.exclusion_reasons) == 0

    def test_mhi_just_below_threshold_is_eligible(self, engine: CapacityEngine):
        """0.249999 < 0.25 -> eligible."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.249999,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is True

    def test_mhi_exactly_at_threshold_is_rejected(self, engine: CapacityEngine):
        """0.25 is NOT < 0.25 -> must be rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.25,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is False
        assert any("mhi" in r.lower() for r in res.exclusion_reasons)

    def test_mhi_above_threshold_is_rejected(self, engine: CapacityEngine):
        """0.30 > 0.25 -> rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.30,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is False

    def test_mhi_missing_is_rejected(self, engine: CapacityEngine):
        """Missing MHI is never assumed safe -> rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=None,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is False
        assert any("missing" in r.lower() and "mhi" in r.lower() for r in res.exclusion_reasons)

    # --- Slope Boundaries ---
    def test_slope_zero_is_eligible(self, engine: CapacityEngine):
        """0.0 deg slope must be preserved as flat, valid, and eligible."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=0.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is True

    def test_slope_just_below_threshold_is_eligible(self, engine: CapacityEngine):
        """14.99 deg < 15.0 deg -> eligible."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=14.99,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is True

    def test_slope_exactly_at_threshold_is_rejected(self, engine: CapacityEngine):
        """15.0 deg is NOT < 15.0 deg -> rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=15.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is False
        assert any("slope" in r.lower() for r in res.exclusion_reasons)

    def test_slope_above_threshold_is_rejected(self, engine: CapacityEngine):
        """16.0 deg > 15.0 deg -> rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=16.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is False

    def test_slope_missing_is_rejected(self, engine: CapacityEngine):
        """Missing slope is never assumed flat -> rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=None,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is False
        assert any("missing" in r.lower() and "slope" in r.lower() for r in res.exclusion_reasons)

    # --- Contiguous Area Boundaries ---
    def test_area_below_minimum_is_rejected(self, engine: CapacityEngine):
        """1.99 ha < 2.0 ha minimum -> rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=1.99,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is False
        assert any("contiguous area" in r.lower() for r in res.exclusion_reasons)

    def test_area_exactly_at_minimum_is_eligible(self, engine: CapacityEngine):
        """2.00 ha == 2.0 ha minimum -> eligible."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=2.00,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is True

    def test_area_above_minimum_is_eligible(self, engine: CapacityEngine):
        """2.01 ha > 2.0 ha minimum -> eligible."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=2.01,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is True

    def test_area_missing_is_rejected(self, engine: CapacityEngine):
        """Missing area -> rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=None,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is False

    # --- Search Radius Boundaries ---
    def test_distance_inside_radius_is_eligible(self, engine: CapacityEngine):
        """14.9 km <= 15.0 km -> eligible."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
            distance_km=14.9,
        )
        assert res.is_eligible is True

    def test_distance_exactly_at_radius_is_eligible(self, engine: CapacityEngine):
        """15.0 km <= 15.0 km -> eligible."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
            distance_km=15.0,
        )
        assert res.is_eligible is True

    def test_distance_outside_radius_is_rejected(self, engine: CapacityEngine):
        """15.01 km > 15.0 km -> rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
            distance_km=15.01,
        )
        assert res.is_eligible is False
        assert any("radius" in r.lower() or "distance" in r.lower() for r in res.exclusion_reasons)

    # --- Tenure Hard Validation ---
    def test_tenure_government_revenue_is_eligible(self, engine: CapacityEngine):
        """Government revenue tenure is explicitly valid."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
        )
        assert res.is_eligible is True

    def test_tenure_private_is_eligible(self, engine: CapacityEngine):
        """Private tenure is explicitly valid."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.PRIVATE,
        )
        assert res.is_eligible is True

    def test_tenure_unverified_is_rejected(self, engine: CapacityEngine):
        """tenure_unverified != valid tenure -> must be rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.TENURE_UNVERIFIED,
        )
        assert res.is_eligible is False
        assert any("unverified" in r.lower() for r in res.exclusion_reasons)

    def test_tenure_missing_none_is_rejected(self, engine: CapacityEngine):
        """None tenure is not valid -> must be rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=None,
        )
        assert res.is_eligible is False
        assert any("tenure" in r.lower() for r in res.exclusion_reasons)

    def test_tenure_unknown_string_is_rejected(self, engine: CapacityEngine):
        """Arbitrary unknown tenure string -> rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure="unknown",
        )
        assert res.is_eligible is False
        assert any("tenure" in r.lower() for r in res.exclusion_reasons)

    # --- Environmental & Land-Cover Exclusions ---
    def test_forest_site_is_rejected(self, engine: CapacityEngine):
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
            is_forest=True,
        )
        assert res.is_eligible is False
        assert any("forest" in r.lower() for r in res.exclusion_reasons)

    def test_forest_missing_uncertainty_is_rejected(self, engine: CapacityEngine):
        """Explicitly None forest status is not assumed safe -> rejected."""
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
            is_forest=None,
        )
        assert res.is_eligible is False
        assert any("forest" in r.lower() and "unverified" in r.lower() for r in res.exclusion_reasons)

    def test_protected_area_site_is_rejected(self, engine: CapacityEngine):
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
            is_protected_area=True,
        )
        assert res.is_eligible is False
        assert any("protected" in r.lower() for r in res.exclusion_reasons)

    def test_crz_site_is_rejected(self, engine: CapacityEngine):
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
            is_crz=True,
        )
        assert res.is_eligible is False
        assert any("crz" in r.lower() or "coastal" in r.lower() for r in res.exclusion_reasons)

    def test_water_body_site_is_rejected(self, engine: CapacityEngine):
        res = engine.evaluate_site_eligibility(
            mhi_max=0.10,
            slope_mean=5.0,
            area_ha=3.0,
            tenure=TenureType.GOVERNMENT_REVENUE,
            is_water_body=True,
        )
        assert res.is_eligible is False
        assert any("water" in r.lower() for r in res.exclusion_reasons)


class TestH7ProductionAllocationWiring:
    """Tests the real production path through AllocationService verifying that ineligible candidates NEVER reach allocation."""

    def test_ineligible_candidates_rejected_and_valid_survives(self):
        """Proves both directions on the production candidate-site assembly path:
        - 9 invalid candidates representing each H7 violation are rejected.
        - 1 fully valid candidate survives and is assigned.
        """
        repo = MagicMock()
        repo.get_habitations_for_allocation.return_value = [
            {
                "id": 1,
                "name": "Chooralmala Urgent",
                "households": 40,
                "priority_score": 0.85,
                "tier": "immediate",
                "lat": 11.54,
                "lon": 76.16,
            }
        ]

        # 10 candidate sites: 9 invalid across every H7 constraint + 1 valid
        repo.get_candidate_sites_and_distances.return_value = (
            [
                # 1. Invalid: MHI = 0.25 (threshold violation)
                {"id": 101, "name": "Site_MHI_25", "capacity": 50, "suitability": 80, "lat": 11.55, "lon": 76.15,
                 "mhi_max": 0.25, "slope_mean": 5.0, "area_ha": 4.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
                # 2. Invalid: Slope = 15.0 deg (threshold violation)
                {"id": 102, "name": "Site_Slope_15", "capacity": 50, "suitability": 80, "lat": 11.55, "lon": 76.15,
                 "mhi_max": 0.10, "slope_mean": 15.0, "area_ha": 4.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
                # 3. Invalid: Forest = True
                {"id": 103, "name": "Site_Forest", "capacity": 50, "suitability": 80, "lat": 11.55, "lon": 76.15,
                 "mhi_max": 0.10, "slope_mean": 5.0, "area_ha": 4.0, "tenure": "government_revenue",
                 "is_forest": True, "is_protected_area": False, "is_crz": False, "is_water_body": False},
                # 4. Invalid: Protected Area = True
                {"id": 104, "name": "Site_Protected", "capacity": 50, "suitability": 80, "lat": 11.55, "lon": 76.15,
                 "mhi_max": 0.10, "slope_mean": 5.0, "area_ha": 4.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": True, "is_crz": False, "is_water_body": False},
                # 5. Invalid: CRZ = True
                {"id": 105, "name": "Site_CRZ", "capacity": 50, "suitability": 80, "lat": 11.55, "lon": 76.15,
                 "mhi_max": 0.10, "slope_mean": 5.0, "area_ha": 4.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": True, "is_water_body": False},
                # 6. Invalid: Water Body = True
                {"id": 106, "name": "Site_Water", "capacity": 50, "suitability": 80, "lat": 11.55, "lon": 76.15,
                 "mhi_max": 0.10, "slope_mean": 5.0, "area_ha": 4.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": True},
                # 7. Invalid: Area < 2.0 ha (1.99 ha)
                {"id": 107, "name": "Site_Area_Small", "capacity": 50, "suitability": 80, "lat": 11.55, "lon": 76.15,
                 "mhi_max": 0.10, "slope_mean": 5.0, "area_ha": 1.99, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
                # 8. Invalid: Outside radius (16.0 km > 15.0 km default)
                {"id": 108, "name": "Site_Far", "capacity": 50, "suitability": 80, "lat": 11.55, "lon": 76.15,
                 "mhi_max": 0.10, "slope_mean": 5.0, "area_ha": 4.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
                # 9. Invalid: Tenure unverified
                {"id": 109, "name": "Site_Unverified_Tenure", "capacity": 50, "suitability": 80, "lat": 11.55, "lon": 76.15,
                 "mhi_max": 0.10, "slope_mean": 5.0, "area_ha": 4.0, "tenure": "tenure_unverified",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
                # 10. VALID CANDIDATE: satisfies all H7 rules
                {"id": 200, "name": "Site_Valid_Safe", "capacity": 60, "suitability": 90, "lat": 11.55, "lon": 76.15,
                 "mhi_max": 0.08, "slope_mean": 4.5, "area_ha": 5.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
            ],
            [
                {"habitation_id": 1, "site_id": 101, "distance_km": 5.0},
                {"habitation_id": 1, "site_id": 102, "distance_km": 5.0},
                {"habitation_id": 1, "site_id": 103, "distance_km": 5.0},
                {"habitation_id": 1, "site_id": 104, "distance_km": 5.0},
                {"habitation_id": 1, "site_id": 105, "distance_km": 5.0},
                {"habitation_id": 1, "site_id": 106, "distance_km": 5.0},
                {"habitation_id": 1, "site_id": 107, "distance_km": 5.0},
                {"habitation_id": 1, "site_id": 108, "distance_km": 16.0},  # outside 15km
                {"habitation_id": 1, "site_id": 109, "distance_km": 5.0},
                {"habitation_id": 1, "site_id": 200, "distance_km": 5.0},  # valid candidate within 15km
            ],
        )

        service = AllocationService(db=MagicMock())
        service.repo = repo

        req = AllocationPlanRequest(
            admin_id=1,
            max_search_radius_km=15.0,
            target_tiers=[Tier.IMMEDIATE],
        )

        plan = service.generate_allocation_plan(req)

        assert plan is not None
        # All 40 households must be relocated to the ONLY valid site (id: 200)
        assert plan.total_relocated_households == 40
        assert len(plan.assignments) == 1
        assert plan.assignments[0].site_id == 200
        assert plan.assignments[0].site_id not in (101, 102, 103, 104, 105, 106, 107, 108, 109)

    def test_legacy_fixture_missing_metadata_cannot_bypass_h7(self):
        """Proves that a candidate site lacking H7 eligibility fields CANNOT bypass eligibility.
        
        Even if shaped like an old legacy fixture with only {id, name, capacity, suitability, lat, lon},
        it must be rejected due to missing H7 hard fields (uncertainty principle: missing != safe).
        """
        repo = MagicMock()
        repo.get_habitations_for_allocation.return_value = [
            {"id": 1, "name": "Hab1", "households": 20, "priority_score": 0.8, "tier": "immediate", "lat": 11.5, "lon": 76.1}
        ]
        repo.get_candidate_sites_and_distances.return_value = (
            [
                # Bare legacy mock fixture: completely missing all H7 eligibility metadata
                {"id": 999, "name": "LegacyMockSite", "capacity": 50, "suitability": 85, "lat": 11.5, "lon": 76.1}
            ],
            [
                {"habitation_id": 1, "site_id": 999, "distance_km": 4.0}
            ],
        )

        service = AllocationService(db=MagicMock())
        service.repo = repo

        req = AllocationPlanRequest(admin_id=1, max_search_radius_km=15.0, target_tiers=[Tier.IMMEDIATE])
        plan = service.generate_allocation_plan(req)

        # The legacy candidate site MUST be rejected
        assert plan.total_relocated_households == 0
        assert len(plan.assignments) == 0
        assert plan.unmet_demand_households == 20

    def test_missing_individual_hard_fields_rejected_on_production_path(self):
        """Tests that missing ANY single hard constraint on the production path causes rejection."""
        service = AllocationService(db=MagicMock())

        base_valid_site = {
            "id": 1,
            "name": "BaseValid",
            "capacity": 50,
            "suitability": 80,
            "mhi_max": 0.10,
            "slope_mean": 5.0,
            "area_ha": 3.0,
            "tenure": "government_revenue",
            "is_forest": False,
            "is_protected_area": False,
            "is_crz": False,
            "is_water_body": False,
        }

        # 1. Missing mhi_max
        site_no_mhi = dict(base_valid_site, id=2)
        del site_no_mhi["mhi_max"]
        sites, dists = service._filter_eligible_candidates(
            site_rows=[site_no_mhi],
            distance_rows=[{"site_id": 2, "distance_km": 5.0}],
        )
        assert len(sites) == 0

        # 2. Missing slope_mean
        site_no_slope = dict(base_valid_site, id=3)
        del site_no_slope["slope_mean"]
        sites, dists = service._filter_eligible_candidates(
            site_rows=[site_no_slope],
            distance_rows=[{"site_id": 3, "distance_km": 5.0}],
        )
        assert len(sites) == 0

        # 3. Missing area_ha
        site_no_area = dict(base_valid_site, id=4)
        del site_no_area["area_ha"]
        sites, dists = service._filter_eligible_candidates(
            site_rows=[site_no_area],
            distance_rows=[{"site_id": 4, "distance_km": 5.0}],
        )
        assert len(sites) == 0

        # 4. Missing tenure
        site_no_tenure = dict(base_valid_site, id=5)
        del site_no_tenure["tenure"]
        sites, dists = service._filter_eligible_candidates(
            site_rows=[site_no_tenure],
            distance_rows=[{"site_id": 5, "distance_km": 5.0}],
        )
        assert len(sites) == 0

        # 5. Missing distance (no edge in distance_rows)
        sites, dists = service._filter_eligible_candidates(
            site_rows=[dict(base_valid_site, id=6)],
            distance_rows=[],  # No distance to any habitation
        )
        assert len(sites) == 0

        # 6. Missing forest exclusion status
        site_no_forest = dict(base_valid_site, id=7)
        del site_no_forest["is_forest"]
        sites, dists = service._filter_eligible_candidates(
            site_rows=[site_no_forest],
            distance_rows=[{"site_id": 7, "distance_km": 5.0}],
        )
        assert len(sites) == 0

        # 7. Missing protected area status
        site_no_prot = dict(base_valid_site, id=8)
        del site_no_prot["is_protected_area"]
        sites, dists = service._filter_eligible_candidates(
            site_rows=[site_no_prot],
            distance_rows=[{"site_id": 8, "distance_km": 5.0}],
        )
        assert len(sites) == 0

        # 8. Missing CRZ status
        site_no_crz = dict(base_valid_site, id=9)
        del site_no_crz["is_crz"]
        sites, dists = service._filter_eligible_candidates(
            site_rows=[site_no_crz],
            distance_rows=[{"site_id": 9, "distance_km": 5.0}],
        )
        assert len(sites) == 0

        # 9. Missing water body status
        site_no_water = dict(base_valid_site, id=10)
        del site_no_water["is_water_body"]
        sites, dists = service._filter_eligible_candidates(
            site_rows=[site_no_water],
            distance_rows=[{"site_id": 10, "distance_km": 5.0}],
        )
        assert len(sites) == 0

    def test_allocation_solver_observes_only_eligible_candidates(self, monkeypatch):
        """Directly observes CandidateSiteCapacity objects handed to MinCostFlowAllocationSolver."""
        from core.domain import allocation as alloc_module

        observed_capacities = []

        original_solve = alloc_module.MinCostFlowAllocationSolver.solve

        def mock_solve(self_solver, demands, site_capacities, distances):
            observed_capacities.extend(site_capacities)
            return original_solve(self_solver, demands, site_capacities, distances)

        monkeypatch.setattr(alloc_module.MinCostFlowAllocationSolver, "solve", mock_solve)

        repo = MagicMock()
        repo.get_habitations_for_allocation.return_value = [
            {"id": 1, "name": "Hab1", "households": 10, "priority_score": 0.9, "tier": "immediate", "lat": 11.5, "lon": 76.1}
        ]
        repo.get_candidate_sites_and_distances.return_value = (
            [
                # Ineligible: MHI 0.30
                {"id": 1, "name": "BadMHI", "capacity": 50, "suitability": 80, "lat": 11.5, "lon": 76.1,
                 "mhi_max": 0.30, "slope_mean": 5.0, "area_ha": 3.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
                # Ineligible: Slope 20.0
                {"id": 2, "name": "BadSlope", "capacity": 50, "suitability": 80, "lat": 11.5, "lon": 76.1,
                 "mhi_max": 0.10, "slope_mean": 20.0, "area_ha": 3.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
                # Eligible: passes every H7 constraint
                {"id": 3, "name": "GoodSite", "capacity": 50, "suitability": 80, "lat": 11.5, "lon": 76.1,
                 "mhi_max": 0.10, "slope_mean": 5.0, "area_ha": 3.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
            ],
            [
                {"habitation_id": 1, "site_id": 1, "distance_km": 4.0},
                {"habitation_id": 1, "site_id": 2, "distance_km": 4.0},
                {"habitation_id": 1, "site_id": 3, "distance_km": 4.0},
            ],
        )

        service = AllocationService(db=MagicMock())
        service.repo = repo

        req = AllocationPlanRequest(admin_id=1, max_search_radius_km=15.0, target_tiers=[Tier.IMMEDIATE])
        service.generate_allocation_plan(req)

        # The solver MUST only receive GoodSite (id: 3)
        assert len(observed_capacities) == 1
        assert observed_capacities[0].id == 3

    def test_all_ineligible_candidates_yields_zero_allocation(self):
        """When every candidate site violates eligibility, zero households are allocated."""
        repo = MagicMock()
        repo.get_habitations_for_allocation.return_value = [
            {
                "id": 1,
                "name": "Habitation A",
                "households": 50,
                "priority_score": 0.9,
                "tier": "immediate",
                "lat": 11.5,
                "lon": 76.1,
            }
        ]
        repo.get_candidate_sites_and_distances.return_value = (
            [
                {"id": 10, "name": "SteepSite", "capacity": 100, "suitability": 80, "lat": 11.5, "lon": 76.1,
                 "mhi_max": 0.05, "slope_mean": 22.0, "area_ha": 5.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
                {"id": 20, "name": "HazardSite", "capacity": 100, "suitability": 80, "lat": 11.5, "lon": 76.1,
                 "mhi_max": 0.35, "slope_mean": 5.0, "area_ha": 5.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
            ],
            [
                {"habitation_id": 1, "site_id": 10, "distance_km": 4.0},
                {"habitation_id": 1, "site_id": 20, "distance_km": 4.0},
            ],
        )

        service = AllocationService(db=MagicMock())
        service.repo = repo

        req = AllocationPlanRequest(admin_id=1, max_search_radius_km=15.0, target_tiers=[Tier.IMMEDIATE])
        plan = service.generate_allocation_plan(req)

        assert plan.total_relocated_households == 0
        assert plan.unmet_demand_households == 50
        assert len(plan.assignments) == 0
        assert plan.status == "COMPLETED"

    def test_simulate_allocation_enforces_eligibility_without_persistence(self):
        """Verifies that simulate_allocation (used in what-if scenarios) also filters ineligible candidates."""
        repo = MagicMock()
        repo.get_candidate_sites_and_distances.return_value = (
            [
                # Ineligible site (water body)
                {"id": 501, "name": "LakeSite", "capacity": 100, "suitability": 85, "lat": 11.5, "lon": 76.1,
                 "mhi_max": 0.05, "slope_mean": 3.0, "area_ha": 5.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": True},
                # Ineligible site (missing exclusion metadata)
                {"id": 503, "name": "MissingMetaSite", "capacity": 100, "suitability": 85, "lat": 11.5, "lon": 76.1,
                 "mhi_max": 0.05, "slope_mean": 3.0, "area_ha": 5.0, "tenure": "government_revenue"},
                # Eligible site
                {"id": 502, "name": "SafeSite", "capacity": 100, "suitability": 85, "lat": 11.5, "lon": 76.1,
                 "mhi_max": 0.05, "slope_mean": 3.0, "area_ha": 5.0, "tenure": "government_revenue",
                 "is_forest": False, "is_protected_area": False, "is_crz": False, "is_water_body": False},
            ],
            [
                {"habitation_id": 1, "site_id": 501, "distance_km": 3.0},
                {"habitation_id": 1, "site_id": 502, "distance_km": 3.0},
                {"habitation_id": 1, "site_id": 503, "distance_km": 3.0},
            ],
        )

        service = AllocationService(db=MagicMock())
        service.repo = repo

        demands = [
            HabitationDemand(id=1, name="SimHab", demand_households=30, priority_score=0.8, tier=Tier.IMMEDIATE)
        ]

        res = service.simulate_allocation(demands, max_search_radius_km=15.0)

        assert res.total_relocated_households == 30
        assert len(res.assignments) == 1
        assert res.assignments[0].site_id == 502
        # Repo save must NOT have been called
        repo.save_allocation_run.assert_not_called()
