"""Unit tests for min-cost flow allocation formulation and constraint checks."""

import pytest
from core.domain.allocation import (
    compute_assignment_cost,
    validate_allocation_invariants,
)


def test_assignment_cost_formulation():
    """FR-8.1: Assignment benefit vs distance penalty."""
    # Near site with high priority and high suitability
    cost_near = compute_assignment_cost(distance_km=2.0, priority_score=0.8, suitability=90)
    # Far site with low suitability
    cost_far = compute_assignment_cost(distance_km=15.0, priority_score=0.8, suitability=50)

    assert cost_near < cost_far


def test_allocation_invariants_validation():
    """Invariants: assigned <= demand AND assigned <= capacity."""
    demands = {101: 50, 102: 80}
    capacities = {201: 100, 202: 50}

    # Valid assignment
    valid_assignments = [
        {"habitation_id": 101, "site_id": 201, "households": 50},
        {"habitation_id": 102, "site_id": 201, "households": 30},
        {"habitation_id": 102, "site_id": 202, "households": 50},
    ]
    violations = validate_allocation_invariants(demands, capacities, valid_assignments)
    assert len(violations) == 0

    # Over-demand assignment
    over_demand = [
        {"habitation_id": 101, "site_id": 201, "households": 60}, # demand is 50
    ]
    violations = validate_allocation_invariants(demands, capacities, over_demand)
    assert len(violations) == 1
    assert "exceeding demand" in violations[0]

    # Over-capacity assignment
    over_capacity = [
        {"habitation_id": 102, "site_id": 202, "households": 70}, # capacity is 50
    ]
    violations = validate_allocation_invariants(demands, capacities, over_capacity)
    assert len(violations) == 1
    assert "exceeding capacity" in violations[0]
