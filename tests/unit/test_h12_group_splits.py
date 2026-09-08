"""Focused unit and regression tests for H12: Enforce allow_group_splits=False.

Section refs: PRD §6.9, FR-8.1–FR-8.3
Verifies that when allow_group_splits=False:
- No habitation/community/group is allocated across multiple candidate relocation sites.
- When no single site can accommodate the full group, the group is not partially split,
  and honest unmet demand is recorded.
- Invariants (site capacity, demand conservation, determinism, cost parity) are preserved.
- When allow_group_splits=True, existing split-capable behavior remains 100% backward-compatible.
"""

import pytest
from core.domain.allocation import (
    AllocationConfig,
    CandidateSiteCapacity,
    HabitationDemand,
    HabitationSiteDistance,
    MinCostFlowAllocationSolver,
    validate_allocation_invariants,
)
from core.enums import Tier


class TestH12GroupSplitPrevention:
    """Rigorous regression tests for H12 allow_group_splits enforcement."""

    def test_1_split_enabled_backward_compatibility(self):
        """Test 1 — Split enabled: allow_group_splits=True allows distribution across multiple sites."""
        config = AllocationConfig(allow_group_splits=True)
        solver = MinCostFlowAllocationSolver(config)

        habs = [
            HabitationDemand(id=1, name="Chooralmala", demand_households=100, priority_score=0.90, tier=Tier.IMMEDIATE)
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="Site Alpha", capacity_households=60, suitability=90),
            CandidateSiteCapacity(id=102, name="Site Beta", capacity_households=60, suitability=85),
        ]
        distances = [
            HabitationSiteDistance(habitation_id=1, site_id=101, distance_km=5.0),
            HabitationSiteDistance(habitation_id=1, site_id=102, distance_km=6.0),
        ]

        res = solver.solve(habs, sites, distances)

        assert res.status == "COMPLETED"
        assert res.total_demand_households == 100
        assert res.total_relocated_households == 100
        assert res.unmet_demand_households == 0
        # More than one site receives the habitation
        assert len(res.assignments) == 2
        for a in res.assignments:
            assert a.has_group_split is True
            assert a.split_details is not None
        assert len(res.group_split_warnings) >= 1
        assert "split across 2 sites" in res.group_split_warnings[0]

    def test_2_split_disabled_full_fit_site_exists(self):
        """Test 2 — Split disabled, full-fit site exists: all 100 assigned to exactly one site."""
        config = AllocationConfig(allow_group_splits=False)
        solver = MinCostFlowAllocationSolver(config)

        habs = [
            HabitationDemand(id=1, name="Chooralmala", demand_households=100, priority_score=0.90, tier=Tier.IMMEDIATE)
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="Site Alpha", capacity_households=150, suitability=90),
            CandidateSiteCapacity(id=102, name="Site Beta", capacity_households=150, suitability=85),
        ]
        distances = [
            HabitationSiteDistance(habitation_id=1, site_id=101, distance_km=4.0),
            HabitationSiteDistance(habitation_id=1, site_id=102, distance_km=10.0),
        ]

        res = solver.solve(habs, sites, distances)

        assert res.status == "COMPLETED"
        assert res.solver_status in ("OPTIMAL", "FEASIBLE")
        assert res.total_demand_households == 100
        assert res.total_relocated_households == 100
        assert res.unmet_demand_households == 0
        # Exactly one site receives all 100
        assert len(res.assignments) == 1
        a = res.assignments[0]
        assert a.habitation_id == 1
        assert a.site_id == 101  # Closer site with higher suitability
        assert a.households == 100
        assert a.has_group_split is False
        assert a.split_details is None
        assert len(res.group_split_warnings) == 0

    def test_3_split_disabled_no_site_can_fit_group(self):
        """Test 3 — Split disabled, no single site can accommodate full group: no split, honest unmet demand."""
        config = AllocationConfig(allow_group_splits=False)
        solver = MinCostFlowAllocationSolver(config)

        habs = [
            HabitationDemand(id=1, name="Chooralmala", demand_households=100, priority_score=0.90, tier=Tier.IMMEDIATE)
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="Site Alpha", capacity_households=60, suitability=90),
            CandidateSiteCapacity(id=102, name="Site Beta", capacity_households=60, suitability=85),
        ]
        distances = [
            HabitationSiteDistance(habitation_id=1, site_id=101, distance_km=5.0),
            HabitationSiteDistance(habitation_id=1, site_id=102, distance_km=6.0),
        ]

        res = solver.solve(habs, sites, distances)

        assert res.status == "COMPLETED"
        assert res.solver_status in ("OPTIMAL", "FEASIBLE")
        assert res.total_demand_households == 100
        # Must not split into 60 and 40
        assert res.total_relocated_households == 0
        assert res.unmet_demand_households == 100
        assert len(res.assignments) == 0
        assert len(res.group_split_warnings) == 0
        # Demand conservation
        assert res.total_relocated_households + res.unmet_demand_households == res.total_demand_households

    def test_4_multiple_habitations_independent_allocation(self):
        """Test 4 — Multiple habitations: group integrity applies independently, preventing artificial coupling."""
        config = AllocationConfig(allow_group_splits=False)
        solver = MinCostFlowAllocationSolver(config)

        habs = [
            HabitationDemand(id=1, name="Village Large", demand_households=100, priority_score=0.90, tier=Tier.IMMEDIATE),
            HabitationDemand(id=2, name="Village Small", demand_households=40, priority_score=0.75, tier=Tier.SHORT_TERM),
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="Site Alpha (60)", capacity_households=60, suitability=90),
            CandidateSiteCapacity(id=102, name="Site Beta (60)", capacity_households=60, suitability=85),
        ]
        distances = [
            HabitationSiteDistance(habitation_id=1, site_id=101, distance_km=5.0),
            HabitationSiteDistance(habitation_id=1, site_id=102, distance_km=6.0),
            HabitationSiteDistance(habitation_id=2, site_id=101, distance_km=4.0),
            HabitationSiteDistance(habitation_id=2, site_id=102, distance_km=7.0),
        ]

        res = solver.solve(habs, sites, distances)

        assert res.status == "COMPLETED"
        assert res.total_demand_households == 140
        # Village Large (100) cannot fit in either 60-capacity site -> 100 unmet
        # Village Small (40) fits in Site Alpha (60) -> 40 relocated
        assert res.total_relocated_households == 40
        assert res.unmet_demand_households == 100
        assert len(res.assignments) == 1
        assert res.assignments[0].habitation_id == 2
        assert res.assignments[0].site_id == 101
        assert res.assignments[0].households == 40
        assert res.assignments[0].has_group_split is False
        assert len(res.group_split_warnings) == 0

    def test_5_capacity_invariants_respected(self):
        """Test 5 — Capacity invariant: sum of allocations to any site <= site capacity."""
        config = AllocationConfig(allow_group_splits=False)
        solver = MinCostFlowAllocationSolver(config)

        habs = [
            HabitationDemand(id=1, name="V1", demand_households=30, priority_score=0.8, tier=Tier.IMMEDIATE),
            HabitationDemand(id=2, name="V2", demand_households=40, priority_score=0.8, tier=Tier.IMMEDIATE),
            HabitationDemand(id=3, name="V3", demand_households=50, priority_score=0.8, tier=Tier.IMMEDIATE),
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="S1", capacity_households=75, suitability=85),
            CandidateSiteCapacity(id=102, name="S2", capacity_households=50, suitability=80),
        ]
        distances = [
            HabitationSiteDistance(1, 101, 3.0),
            HabitationSiteDistance(2, 101, 3.0),
            HabitationSiteDistance(3, 101, 3.0),
            HabitationSiteDistance(1, 102, 5.0),
            HabitationSiteDistance(2, 102, 5.0),
            HabitationSiteDistance(3, 102, 5.0),
        ]

        res = solver.solve(habs, sites, distances)

        # Check invariant validator
        demands_map = {h.id: h.demand_households for h in habs}
        capacities_map = {s.id: s.capacity_households for s in sites}
        violations = validate_allocation_invariants(demands_map, capacities_map, res.assignments)
        assert len(violations) == 0

        # Direct capacity check
        site_load: dict[int, int] = {}
        for a in res.assignments:
            site_load[a.site_id] = site_load.get(a.site_id, 0) + a.households
        for s_id, load in site_load.items():
            assert load <= capacities_map[s_id]

    def test_6_demand_conservation(self):
        """Test 6 — Demand conservation: allocated + unmet == total demand for every case."""
        config = AllocationConfig(allow_group_splits=False)
        solver = MinCostFlowAllocationSolver(config)

        habs = [
            HabitationDemand(id=1, name="V1", demand_households=45, priority_score=0.9, tier=Tier.IMMEDIATE),
            HabitationDemand(id=2, name="V2", demand_households=70, priority_score=0.7, tier=Tier.SHORT_TERM),
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="S1", capacity_households=50, suitability=90),
        ]
        distances = [
            HabitationSiteDistance(1, 101, 4.0),
            HabitationSiteDistance(2, 101, 4.0),
        ]

        res = solver.solve(habs, sites, distances)

        assert res.total_demand_households == 115
        assert res.total_relocated_households == 45
        assert res.unmet_demand_households == 70
        assert res.total_relocated_households + res.unmet_demand_households == res.total_demand_households

    def test_7_determinism(self):
        """Test 7 — Determinism: identical inputs across multiple runs produce identical allocation outputs."""
        config = AllocationConfig(allow_group_splits=False)
        solver = MinCostFlowAllocationSolver(config)

        habs = [
            HabitationDemand(id=1, name="V1", demand_households=45, priority_score=0.88, tier=Tier.IMMEDIATE),
            HabitationDemand(id=2, name="V2", demand_households=70, priority_score=0.75, tier=Tier.SHORT_TERM),
            HabitationDemand(id=3, name="V3", demand_households=30, priority_score=0.65, tier=Tier.MEDIUM_TERM),
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="S1", capacity_households=60, suitability=90),
            CandidateSiteCapacity(id=102, name="S2", capacity_households=50, suitability=80),
            CandidateSiteCapacity(id=103, name="S3", capacity_households=40, suitability=70),
        ]
        distances = [
            HabitationSiteDistance(1, 101, 3.5),
            HabitationSiteDistance(1, 102, 8.0),
            HabitationSiteDistance(2, 101, 7.2),
            HabitationSiteDistance(2, 102, 4.1),
            HabitationSiteDistance(3, 102, 6.0),
            HabitationSiteDistance(3, 103, 2.5),
        ]

        runs = [solver.solve(habs, sites, distances) for _ in range(10)]

        first = runs[0]
        for idx, run in enumerate(runs[1:], start=1):
            assert run.total_relocated_households == first.total_relocated_households
            assert run.unmet_demand_households == first.unmet_demand_households
            assert len(run.assignments) == len(first.assignments)
            for a1, a2 in zip(first.assignments, run.assignments):
                assert a1.habitation_id == a2.habitation_id
                assert a1.site_id == a2.site_id
                assert a1.households == a2.households

    def test_8_cost_parity_on_single_site_fit(self):
        """Test 8 — Cost parity: on a fixture where non-split is natural, both solvers pick identical assignment."""
        habs = [
            HabitationDemand(id=1, name="Puthumala", demand_households=50, priority_score=0.85, tier=Tier.IMMEDIATE)
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="Meppadi Safe Site", capacity_households=100, suitability=85),
            CandidateSiteCapacity(id=102, name="Far Low Suitability Site", capacity_households=100, suitability=40),
        ]
        distances = [
            HabitationSiteDistance(habitation_id=1, site_id=101, distance_km=4.2),
            HabitationSiteDistance(habitation_id=1, site_id=102, distance_km=14.0),
        ]

        solver_split = MinCostFlowAllocationSolver(AllocationConfig(allow_group_splits=True))
        solver_nosplit = MinCostFlowAllocationSolver(AllocationConfig(allow_group_splits=False))

        res_split = solver_split.solve(habs, sites, distances)
        res_nosplit = solver_nosplit.solve(habs, sites, distances)

        assert res_split.total_relocated_households == res_nosplit.total_relocated_households == 50
        assert res_split.unmet_demand_households == res_nosplit.unmet_demand_households == 0
        assert len(res_split.assignments) == len(res_nosplit.assignments) == 1

        a_split = res_split.assignments[0]
        a_nosplit = res_nosplit.assignments[0]
        assert a_split.site_id == a_nosplit.site_id == 101
        assert a_split.households == a_nosplit.households == 50
        assert a_split.site_distance_km == a_nosplit.site_distance_km == 4.2
        assert a_split.site_suitability == a_nosplit.site_suitability == 85
