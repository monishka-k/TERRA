"""Pure domain logic for min-cost flow allocation formulation, OR-Tools optimization, and constraint checks.

Section refs: docs/PRD1.md §6.9, §14.1 (FR-8.1, FR-8.2, FR-8.3)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Sequence
from ortools.graph.python import min_cost_flow
from ortools.sat.python import cp_model

from core.enums import Tier
from core.schemas.common import SCREENING_GRADE_NOTICE


@dataclass(frozen=True)
class HabitationDemand:
    """Input demand specification for a vulnerable habitation."""
    id: int
    name: str
    demand_households: int
    priority_score: float
    tier: Tier
    lat: Optional[float] = None
    lon: Optional[float] = None


@dataclass(frozen=True)
class CandidateSiteCapacity:
    """Input capacity specification for a destination candidate site."""
    id: int
    name: str
    capacity_households: int
    suitability: Optional[int] = None  # 0 to 100, None if unverified/unknown
    lat: Optional[float] = None
    lon: Optional[float] = None


@dataclass(frozen=True)
class HabitationSiteDistance:
    """Precomputed spatial distance between a habitation and a candidate site."""
    habitation_id: int
    site_id: int
    distance_km: float


@dataclass(frozen=True)
class AllocationConfig:
    """Configurable policy parameters for min-cost flow allocation solver."""
    max_search_radius_km: float = 15.0
    distance_penalty_weight: float = 1.0
    benefit_scale_factor: float = 100.0
    unmet_demand_penalty: int = 50_000
    allow_group_splits: bool = True
    cost_strategy: str = "linear_distance_v1"
    cost_strategy_version: str = "c_js-v1.0"
    policy_version: str = "allocation-v1.0"


@dataclass
class AssignmentOutcome:
    """Result assignment record for a habitation to a candidate site."""
    habitation_id: int
    habitation_name: str
    site_id: int
    site_name: str
    site_distance_km: float
    households: int
    tier: Tier
    priority_score: float
    site_suitability: Optional[int] = None
    has_group_split: bool = False
    split_details: Optional[str] = None


@dataclass
class AllocationResult:
    """Complete outcome of the min-cost-flow optimization execution."""
    status: str
    solver_status: str
    total_demand_households: int
    total_relocated_households: int
    unmet_demand_households: int
    solver_latency_ms: float
    assignments: list[AssignmentOutcome] = field(default_factory=list)
    group_split_warnings: list[str] = field(default_factory=list)
    policy_version: str = "allocation-v1.0"
    screening_grade: str = SCREENING_GRADE_NOTICE


def compute_relocation_cost(
    distance_km: float,
    cost_per_km: float = 1.0,
    strategy: str = "linear_distance_v1",
) -> float:
    """Computes the explicit relocation cost term c_js between habitation j and site s (PRD FR-8.1).
    
    Default baseline is linear transport/infrastructure relocation cost c_js = dist * cost_per_km.
    Can be replaced or parameterized without changing the optimization solver structure.
    """
    return max(distance_km * cost_per_km, 0.0)


def compute_assignment_benefit(
    priority_score: float,
    suitability: Optional[int],
    benefit_scale_factor: float = 100.0,
) -> float:
    """Computes the objective benefit term b_js = (PS_j * suit_s) * scale (PRD FR-8.1).
    
    When suitability evidence is unverified / unknown (None), no positive suitability bonus
    is claimed (suit_norm = 0.0). Hard eligibility and capacity remain fully respected.
    """
    if suitability is None:
        return 0.0
    suit_norm = min(max(suitability, 0), 100) / 100.0
    ps_norm = min(max(priority_score, 0.0), 1.0)
    return ps_norm * suit_norm * benefit_scale_factor


def compute_assignment_cost(
    distance_km: float,
    priority_score: float,
    suitability: Optional[int] = None,
    distance_penalty_weight: float = 1.0,
    benefit_scale_factor: float = 100.0,
) -> float:
    """Computes the net edge cost for min-cost flow solver: c_js - b_js.
    
    Objective (FR-8.1): Maximise sum x_js * (PS_j * suit_s) - c_js * x_js.
    Equivalent min-cost formulation: Minimize sum x_js * (c_js - b_js).
    """
    c_js = compute_relocation_cost(distance_km, cost_per_km=distance_penalty_weight)
    b_js = compute_assignment_benefit(priority_score, suitability, benefit_scale_factor)
    return c_js - b_js


def compute_integer_edge_cost(
    distance_km: float,
    priority_score: float,
    suitability: Optional[int] = None,
    config: AllocationConfig = AllocationConfig(),
    base_offset: int = 10_000,
) -> int:
    """Converts continuous assignment cost into a scaled integer for OR-Tools SimpleMinCostFlow.
    
    Adds base_offset to maintain non-negative arc costs and scales by 100 for precision.
    """
    cont_cost = compute_assignment_cost(
        distance_km=distance_km,
        priority_score=priority_score,
        suitability=suitability,
        distance_penalty_weight=config.distance_penalty_weight,
        benefit_scale_factor=config.benefit_scale_factor,
    )
    int_cost = int(round(cont_cost * 100.0)) + base_offset
    return max(int_cost, 0)


def validate_allocation_invariants(
    demands: Mapping[int, int],
    capacities: Mapping[int, int],
    assignments: Sequence[Mapping[str, Any] | AssignmentOutcome],
) -> list[str]:
    """Validates that assignments do not violate demand or capacity constraints.
    
    Invariants (FR-8.1):
    1. sum_s x_js <= demand_j (Never allocate more households than exist in a habitation)
    2. sum_j x_js <= CC_s    (Never exceed effective carrying capacity of a site)
    3. x_js >= 0             (Non-negative integer allocations)
    """
    violations: list[str] = []
    hab_assigned: dict[int, int] = {}
    site_assigned: dict[int, int] = {}

    for a in assignments:
        if isinstance(a, AssignmentOutcome):
            h_id = a.habitation_id
            s_id = a.site_id
            hh = a.households
        else:
            h_id = a["habitation_id"]
            s_id = a["site_id"]
            hh = a["households"]

        if hh < 0:
            violations.append(f"Negative household allocation ({hh}) found for Habitation {h_id} to Site {s_id}.")

        hab_assigned[h_id] = hab_assigned.get(h_id, 0) + hh
        site_assigned[s_id] = site_assigned.get(s_id, 0) + hh

    for h_id, assigned_hh in hab_assigned.items():
        demand = demands.get(h_id, 0)
        if assigned_hh > demand:
            violations.append(
                f"Habitation {h_id} assigned {assigned_hh} households exceeding demand {demand}."
            )

    for s_id, assigned_hh in site_assigned.items():
        cap = capacities.get(s_id, 0)
        if assigned_hh > cap:
            violations.append(
                f"Site {s_id} assigned {assigned_hh} households exceeding capacity {cap}."
            )

    return violations


class MinCostFlowAllocationSolver:
    """Exact min-cost flow allocation solver using Google OR-Tools SimpleMinCostFlow.
    
    Section refs: PRD §6.9, FR-8.1, FR-8.2, FR-8.3
    """

    def __init__(self, config: Optional[AllocationConfig] = None) -> None:
        self.config = config or AllocationConfig()

    def solve(
        self,
        habitations: Sequence[HabitationDemand],
        sites: Sequence[CandidateSiteCapacity],
        distances: Sequence[HabitationSiteDistance],
    ) -> AllocationResult:
        """Solves the habitation-to-site optimal relocation assignment."""
        start_time = time.perf_counter()

        # Filter positive demand and positive capacity
        valid_habs = [h for h in habitations if h.demand_households > 0]
        valid_sites = [s for s in sites if s.capacity_households > 0]

        total_demand = sum(h.demand_households for h in valid_habs)
        total_capacity = sum(s.capacity_households for s in valid_sites)

        # Handle zero-demand or zero-candidate boundary cases immediately
        if total_demand == 0 or len(valid_habs) == 0:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return AllocationResult(
                status="COMPLETED",
                solver_status="OPTIMAL",
                total_demand_households=0,
                total_relocated_households=0,
                unmet_demand_households=0,
                solver_latency_ms=round(latency_ms, 2),
                assignments=[],
                group_split_warnings=[],
                policy_version=self.config.policy_version,
            )

        if len(valid_sites) == 0:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return AllocationResult(
                status="COMPLETED",
                solver_status="NO_CANDIDATES",
                total_demand_households=total_demand,
                total_relocated_households=0,
                unmet_demand_households=total_demand,
                solver_latency_ms=round(latency_ms, 2),
                assignments=[],
                group_split_warnings=["No eligible candidate sites with positive carrying capacity available."],
                policy_version=self.config.policy_version,
            )

        if self.config.allow_group_splits:
            return self._solve_min_cost_flow(
                valid_habs=valid_habs,
                valid_sites=valid_sites,
                distances=distances,
                total_demand=total_demand,
                start_time=start_time,
            )
        return self._solve_no_splits_cp_sat(
            valid_habs=valid_habs,
            valid_sites=valid_sites,
            distances=distances,
            total_demand=total_demand,
            start_time=start_time,
        )

    def _solve_min_cost_flow(
        self,
        valid_habs: list[HabitationDemand],
        valid_sites: list[CandidateSiteCapacity],
        distances: Sequence[HabitationSiteDistance],
        total_demand: int,
        start_time: float,
    ) -> AllocationResult:
        # Deterministic node indexing:
        # 0: Source node (S)
        # 1 .. N_h: Habitation nodes
        # N_h + 1 .. N_h + N_s: Site nodes
        # N_h + N_s + 1: Sink node (T)
        sorted_habs = sorted(valid_habs, key=lambda h: h.id)
        sorted_sites = sorted(valid_sites, key=lambda s: s.id)

        hab_node_map: dict[int, int] = {h.id: idx + 1 for idx, h in enumerate(sorted_habs)}
        num_habs = len(sorted_habs)
        site_node_map: dict[int, int] = {s.id: num_habs + 1 + idx for idx, s in enumerate(sorted_sites)}
        num_sites = len(sorted_sites)

        source_node = 0
        sink_node = num_habs + num_sites + 1

        smcf = min_cost_flow.SimpleMinCostFlow()

        # Distance lookup map
        dist_map: dict[tuple[int, int], float] = {
            (d.habitation_id, d.site_id): d.distance_km for d in distances
        }

        # 1. Source -> Habitation edges (capacity = demand_j, cost = 0)
        for h in sorted_habs:
            h_node = hab_node_map[h.id]
            smcf.add_arc_with_capacity_and_unit_cost(
                source_node, h_node, h.demand_households, 0
            )

        # 2. Habitation -> Site edges (within max_search_radius_km)
        arc_meta: dict[int, tuple[HabitationDemand, CandidateSiteCapacity, float]] = {}
        hab_by_id = {h.id: h for h in sorted_habs}
        site_by_id = {s.id: s for s in sorted_sites}

        for h in sorted_habs:
            h_node = hab_node_map[h.id]
            for s in sorted_sites:
                s_node = site_node_map[s.id]
                dist_km = dist_map.get((h.id, s.id))
                if dist_km is None or dist_km > self.config.max_search_radius_km:
                    continue

                edge_cap = min(h.demand_households, s.capacity_households)
                unit_cost = compute_integer_edge_cost(
                    distance_km=dist_km,
                    priority_score=h.priority_score,
                    suitability=s.suitability,
                    config=self.config,
                )
                arc_idx = smcf.add_arc_with_capacity_and_unit_cost(
                    h_node, s_node, edge_cap, unit_cost
                )
                arc_meta[arc_idx] = (h, s, dist_km)

        # 3. Site -> Sink edges (capacity = CC_s, cost = 0)
        for s in sorted_sites:
            s_node = site_node_map[s.id]
            smcf.add_arc_with_capacity_and_unit_cost(
                s_node, sink_node, s.capacity_households, 0
            )

        # 4. Source -> Sink slack arc for unmet demand (capacity = total_demand, cost = unmet_penalty)
        smcf.add_arc_with_capacity_and_unit_cost(
            source_node, sink_node, total_demand, self.config.unmet_demand_penalty
        )

        # 5. Node supplies: Source = +total_demand, Sink = -total_demand
        smcf.set_node_supply(source_node, total_demand)
        smcf.set_node_supply(sink_node, -total_demand)
        for node in range(1, sink_node):
            smcf.set_node_supply(node, 0)

        # 6. Solve min-cost flow
        status_code = smcf.solve()

        latency_ms = (time.perf_counter() - start_time) * 1000.0
        status_map = {
            smcf.OPTIMAL: "OPTIMAL",
            smcf.FEASIBLE: "FEASIBLE",
            smcf.INFEASIBLE: "INFEASIBLE",
            smcf.UNBALANCED: "UNBALANCED",
            smcf.BAD_RESULT: "BAD_RESULT",
            smcf.BAD_COST_RANGE: "BAD_COST_RANGE",
        }
        solver_status = status_map.get(status_code, f"UNKNOWN_{status_code}")

        if status_code not in (smcf.OPTIMAL, smcf.FEASIBLE):
            return AllocationResult(
                status="FAILED",
                solver_status=solver_status,
                total_demand_households=total_demand,
                total_relocated_households=0,
                unmet_demand_households=total_demand,
                solver_latency_ms=round(latency_ms, 2),
                assignments=[],
                group_split_warnings=[f"Solver failed with status {solver_status}"],
                policy_version=self.config.policy_version,
            )

        # 7. Extract assignments from flow on Habitation -> Site arcs
        assignments: list[AssignmentOutcome] = []
        hab_allocations: dict[int, list[tuple[CandidateSiteCapacity, int, float]]] = {}

        for arc_idx, (h, s, dist_km) in arc_meta.items():
            flow = smcf.flow(arc_idx)
            if flow > 0:
                hab_allocations.setdefault(h.id, []).append((s, flow, dist_km))

        # 8. Check group splits and construct final AssignmentOutcome records
        group_split_warnings: list[str] = []
        total_relocated = 0

        for h in sorted_habs:
            alloc_list = hab_allocations.get(h.id, [])
            if not alloc_list:
                continue

            has_split = len(alloc_list) > 1
            if has_split:
                site_summaries = ", ".join(f"{s.name} ({flow} HH)" for s, flow, _ in alloc_list)
                warning_msg = (
                    f"Habitation '{h.name}' (ID: {h.id}, Demand: {h.demand_households} HH) is split across "
                    f"{len(alloc_list)} sites: {site_summaries}. Requires social sign-off."
                )
                group_split_warnings.append(warning_msg)

            for s, flow, dist_km in alloc_list:
                total_relocated += flow
                split_detail = None
                if has_split:
                    split_detail = f"Split allocation: {flow}/{h.demand_households} HH assigned to {s.name}."

                assignments.append(
                    AssignmentOutcome(
                        habitation_id=h.id,
                        habitation_name=h.name,
                        site_id=s.id,
                        site_name=s.name,
                        site_distance_km=round(dist_km, 2),
                        households=flow,
                        tier=h.tier,
                        priority_score=h.priority_score,
                        site_suitability=s.suitability,
                        has_group_split=has_split,
                        split_details=split_detail,
                    )
                )

        unmet_demand = max(total_demand - total_relocated, 0)

        # 9. Verify mathematical invariants
        demands_map = {h.id: h.demand_households for h in sorted_habs}
        capacities_map = {s.id: s.capacity_households for s in sorted_sites}
        violations = validate_allocation_invariants(demands_map, capacities_map, assignments)
        if violations:
            group_split_warnings.extend(violations)

        return AllocationResult(
            status="COMPLETED",
            solver_status=solver_status,
            total_demand_households=total_demand,
            total_relocated_households=total_relocated,
            unmet_demand_households=unmet_demand,
            solver_latency_ms=round(latency_ms, 2),
            assignments=assignments,
            group_split_warnings=group_split_warnings,
            policy_version=self.config.policy_version,
        )

    def _solve_no_splits_cp_sat(
        self,
        valid_habs: list[HabitationDemand],
        valid_sites: list[CandidateSiteCapacity],
        distances: Sequence[HabitationSiteDistance],
        total_demand: int,
        start_time: float,
    ) -> AllocationResult:
        """Solves allocation enforcing group integrity (at most one site per habitation) using OR-Tools CP-SAT."""
        sorted_habs = sorted(valid_habs, key=lambda h: h.id)
        sorted_sites = sorted(valid_sites, key=lambda s: s.id)

        dist_map: dict[tuple[int, int], float] = {
            (d.habitation_id, d.site_id): d.distance_km for d in distances
        }

        model = cp_model.CpModel()

        # Decision variables: y[h.id, s.id] == 1 iff habitation h is fully allocated to site s
        y_vars: dict[tuple[int, int], cp_model.IntVar] = {}
        arc_meta: dict[tuple[int, int], tuple[HabitationDemand, CandidateSiteCapacity, float, int]] = {}

        # 1. Create variables for eligible (habitation, site) pairs within search radius
        for h in sorted_habs:
            for s in sorted_sites:
                dist_km = dist_map.get((h.id, s.id))
                if dist_km is None or dist_km > self.config.max_search_radius_km:
                    continue

                unit_cost = compute_integer_edge_cost(
                    distance_km=dist_km,
                    priority_score=h.priority_score,
                    suitability=s.suitability,
                    config=self.config,
                )

                var = model.NewBoolVar(f"y_{h.id}_{s.id}")
                y_vars[(h.id, s.id)] = var
                arc_meta[(h.id, s.id)] = (h, s, dist_km, unit_cost)

        # 2. Group integrity constraint: at most one site per habitation
        for h in sorted_habs:
            h_vars = [y_vars[(h.id, s.id)] for s in sorted_sites if (h.id, s.id) in y_vars]
            if h_vars:
                model.Add(sum(h_vars) <= 1)

        # 3. Site capacity constraint: sum of allocated households cannot exceed site capacity
        for s in sorted_sites:
            s_vars = [
                (h.demand_households, y_vars[(h.id, s.id)])
                for h in sorted_habs
                if (h.id, s.id) in y_vars
            ]
            if s_vars:
                model.Add(sum(demand * var for demand, var in s_vars) <= s.capacity_households)

        # 4. Objective: Minimize total allocation cost + unmet demand penalty
        # Equivalent to: sum_{(h,s)} (unit_cost - unmet_demand_penalty) * demand_h * y_{hs} + constant
        obj_terms = []
        for (h_id, s_id), (h, s, dist_km, unit_cost) in arc_meta.items():
            var = y_vars[(h_id, s_id)]
            net_coeff = (unit_cost - self.config.unmet_demand_penalty) * h.demand_households
            obj_terms.append(net_coeff * var)

        if obj_terms:
            model.Minimize(sum(obj_terms))

        # 5. Solve CP-SAT model with deterministic parameters
        solver = cp_model.CpSolver()
        solver.parameters.num_search_workers = 1
        solver.parameters.random_seed = 42
        solver.parameters.max_time_in_seconds = 30.0

        status_code = solver.Solve(model)
        latency_ms = (time.perf_counter() - start_time) * 1000.0

        status_map = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE",
            cp_model.INFEASIBLE: "INFEASIBLE",
            cp_model.MODEL_INVALID: "MODEL_INVALID",
            cp_model.UNKNOWN: "UNKNOWN",
        }
        solver_status = status_map.get(status_code, f"UNKNOWN_{status_code}")

        if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return AllocationResult(
                status="FAILED",
                solver_status=solver_status,
                total_demand_households=total_demand,
                total_relocated_households=0,
                unmet_demand_households=total_demand,
                solver_latency_ms=round(latency_ms, 2),
                assignments=[],
                group_split_warnings=[f"Solver failed with status {solver_status}"],
                policy_version=self.config.policy_version,
            )

        # 6. Extract assignments
        assignments: list[AssignmentOutcome] = []
        total_relocated = 0

        for h in sorted_habs:
            for s in sorted_sites:
                var = y_vars.get((h.id, s.id))
                if var is not None and solver.Value(var) == 1:
                    dist_km = dist_map[(h.id, s.id)]
                    flow = h.demand_households
                    total_relocated += flow
                    assignments.append(
                        AssignmentOutcome(
                            habitation_id=h.id,
                            habitation_name=h.name,
                            site_id=s.id,
                            site_name=s.name,
                            site_distance_km=round(dist_km, 2),
                            households=flow,
                            tier=h.tier,
                            priority_score=h.priority_score,
                            site_suitability=s.suitability,
                            has_group_split=False,
                            split_details=None,
                        )
                    )
                    break

        unmet_demand = max(total_demand - total_relocated, 0)
        group_split_warnings: list[str] = []

        # 7. Verify mathematical invariants
        demands_map = {h.id: h.demand_households for h in sorted_habs}
        capacities_map = {s.id: s.capacity_households for s in sorted_sites}
        violations = validate_allocation_invariants(demands_map, capacities_map, assignments)
        if violations:
            group_split_warnings.extend(violations)

        return AllocationResult(
            status="COMPLETED",
            solver_status=solver_status,
            total_demand_households=total_demand,
            total_relocated_households=total_relocated,
            unmet_demand_households=unmet_demand,
            solver_latency_ms=round(latency_ms, 2),
            assignments=assignments,
            group_split_warnings=group_split_warnings,
            policy_version=self.config.policy_version,
        )
