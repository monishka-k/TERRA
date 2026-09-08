"""Unit tests for OR-Tools Min-Cost Flow Allocation Solver (Day 6).

Section refs: docs/PRD1.md §6.9, §14.1, FR-8.1–FR-8.3
"""

import pytest
from core.domain.allocation import (
    MinCostFlowAllocationSolver,
    AllocationConfig,
    HabitationDemand,
    CandidateSiteCapacity,
    HabitationSiteDistance,
    compute_relocation_cost,
    compute_assignment_benefit,
    compute_assignment_cost,
    validate_allocation_invariants,
)
from core.enums import Tier


class TestMinCostFlowAllocation:
    """Tests for exact min-cost-flow optimization, constraints, and group splits."""

    def test_decoupled_cost_and_benefit_formulation(self):
        """FR-8.1: Separates relocation cost c_js from priority-suitability benefit."""
        # c_js linear distance cost term
        c_js = compute_relocation_cost(distance_km=10.0, cost_per_km=1.5)
        assert c_js == 15.0

        # b_js benefit term: PS=0.8, suitability=90 -> 0.8 * 0.9 * 100 = 72.0
        b_js = compute_assignment_benefit(priority_score=0.8, suitability=90, benefit_scale_factor=100.0)
        assert b_js == pytest.approx(72.0)

        # Net cost for min-cost flow: c_js - b_js = 15.0 - 72.0 = -57.0
        net_cost = compute_assignment_cost(
            distance_km=10.0,
            priority_score=0.8,
            suitability=90,
            distance_penalty_weight=1.5,
            benefit_scale_factor=100.0,
        )
        assert net_cost == pytest.approx(-57.0)

    def test_single_habitation_single_site_perfect_fit(self):
        solver = MinCostFlowAllocationSolver()
        habs = [
            HabitationDemand(id=1, name="Puthumala", demand_households=50, priority_score=0.85, tier=Tier.IMMEDIATE)
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="Meppadi Safe Site", capacity_households=100, suitability=85)
        ]
        distances = [
            HabitationSiteDistance(habitation_id=1, site_id=101, distance_km=4.2)
        ]

        res = solver.solve(habs, sites, distances)

        assert res.status == "COMPLETED"
        assert res.solver_status == "OPTIMAL"
        assert res.total_demand_households == 50
        assert res.total_relocated_households == 50
        assert res.unmet_demand_households == 0
        assert len(res.assignments) == 1
        assert res.assignments[0].habitation_id == 1
        assert res.assignments[0].site_id == 101
        assert res.assignments[0].households == 50
        assert res.assignments[0].has_group_split is False
        assert len(res.group_split_warnings) == 0

    def test_group_split_detection_and_warning(self):
        """FR-8.3: A household group splitting across sites must be surfaced explicitly."""
        solver = MinCostFlowAllocationSolver()
        # Habitation demands 100 households
        habs = [
            HabitationDemand(id=1, name="Chooralmala", demand_households=100, priority_score=0.90, tier=Tier.IMMEDIATE)
        ]
        # Site 1 has capacity 60, Site 2 has capacity 60
        sites = [
            CandidateSiteCapacity(id=101, name="Kalpetta North", capacity_households=60, suitability=90),
            CandidateSiteCapacity(id=102, name="Kalpetta South", capacity_households=60, suitability=85),
        ]
        distances = [
            HabitationSiteDistance(habitation_id=1, site_id=101, distance_km=5.0),
            HabitationSiteDistance(habitation_id=1, site_id=102, distance_km=6.0),
        ]

        res = solver.solve(habs, sites, distances)

        assert res.status == "COMPLETED"
        assert res.total_relocated_households == 100
        assert res.unmet_demand_households == 0
        assert len(res.assignments) == 2

        # Both assignments must flag has_group_split = True
        for a in res.assignments:
            assert a.has_group_split is True
            assert a.split_details is not None

        # Warning must be surfaced
        assert len(res.group_split_warnings) >= 1
        assert "Chooralmala" in res.group_split_warnings[0]
        assert "split across 2 sites" in res.group_split_warnings[0]

    def test_insufficient_total_capacity_unmet_demand(self):
        """When total capacity < total demand, unmet demand is calculated and assigned demand is bounded."""
        solver = MinCostFlowAllocationSolver()
        habs = [
            HabitationDemand(id=1, name="Village A", demand_households=80, priority_score=0.8, tier=Tier.IMMEDIATE),
            HabitationDemand(id=2, name="Village B", demand_households=60, priority_score=0.6, tier=Tier.SHORT_TERM),
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="Site X", capacity_households=100, suitability=80),
        ]
        distances = [
            HabitationSiteDistance(habitation_id=1, site_id=101, distance_km=3.0),
            HabitationSiteDistance(habitation_id=2, site_id=101, distance_km=4.0),
        ]

        res = solver.solve(habs, sites, distances)

        assert res.status == "COMPLETED"
        assert res.total_demand_households == 140
        assert res.total_relocated_households == 100
        assert res.unmet_demand_households == 40
        # Priority village A should get fully allocated first (80 HH), remaining 20 to Village B
        assigned_a = sum(a.households for a in res.assignments if a.habitation_id == 1)
        assigned_b = sum(a.households for a in res.assignments if a.habitation_id == 2)
        assert assigned_a == 80
        assert assigned_b == 20

    def test_search_radius_constraint_filtering(self):
        """Sites beyond max_search_radius_km must not receive allocations."""
        config = AllocationConfig(max_search_radius_km=10.0)
        solver = MinCostFlowAllocationSolver(config)

        habs = [
            HabitationDemand(id=1, name="Village Remote", demand_households=40, priority_score=0.8, tier=Tier.IMMEDIATE)
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="Far Site (25km)", capacity_households=100, suitability=90),
        ]
        distances = [
            HabitationSiteDistance(habitation_id=1, site_id=101, distance_km=25.0), # > 10 km
        ]

        res = solver.solve(habs, sites, distances)

        assert res.total_relocated_households == 0
        assert res.unmet_demand_households == 40
        assert len(res.assignments) == 0

    def test_zero_demand_boundary_case(self):
        solver = MinCostFlowAllocationSolver()
        habs = [
            HabitationDemand(id=1, name="Empty Village", demand_households=0, priority_score=0.5, tier=Tier.IMMEDIATE)
        ]
        sites = [
            CandidateSiteCapacity(id=101, name="Site", capacity_households=50, suitability=75)
        ]
        res = solver.solve(habs, sites, [])
        assert res.total_demand_households == 0
        assert res.total_relocated_households == 0
        assert len(res.assignments) == 0

    def test_zero_candidate_sites_boundary_case(self):
        solver = MinCostFlowAllocationSolver()
        habs = [
            HabitationDemand(id=1, name="Village", demand_households=50, priority_score=0.7, tier=Tier.IMMEDIATE)
        ]
        res = solver.solve(habs, [], [])
        assert res.total_demand_households == 50
        assert res.total_relocated_households == 0
        assert res.unmet_demand_households == 50
        assert res.solver_status == "NO_CANDIDATES"

    def test_deterministic_solver_reproducibility(self):
        """Multiple runs on identical inputs must produce identical assignment distributions."""
        solver = MinCostFlowAllocationSolver()
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

        run1 = solver.solve(habs, sites, distances)
        run2 = solver.solve(habs, sites, distances)

        assert run1.total_relocated_households == run2.total_relocated_households
        assert len(run1.assignments) == len(run2.assignments)
        for a1, a2 in zip(run1.assignments, run2.assignments):
            assert a1.habitation_id == a2.habitation_id
            assert a1.site_id == a2.site_id
            assert a1.households == a2.households
