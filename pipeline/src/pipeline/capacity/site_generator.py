"""Candidate Relocation Site Generator for Pilot Districts (Day 5).

Section refs: docs/PRD1.md §6.8, §9.4, FR-7.1–FR-7.7
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any, Optional

from core.domain.capacity import CapacityEngine, CapacityNormsConfig, CandidateSitePolicy
from core.enums import BindingConstraint, TenureType


@dataclass
class RawCandidateSiteSpec:
    """Specification for generating a candidate relocation site fixture."""
    name: str
    lat: float
    lon: float
    area_ha: float
    tenure: TenureType
    slope_mean: float
    mhi_max: float
    water_yield_liters_per_day: Optional[float]
    spare_school_seats: Optional[int]
    spare_health_capacity_pop: Optional[int]
    livelihood_multiplier: float
    suitability: Optional[int] = None
    is_forest: Optional[bool] = False
    is_protected_area: Optional[bool] = False
    is_crz: Optional[bool] = False
    is_water_body: Optional[bool] = False


def create_polygon_wkt(lon: float, lat: float, area_ha: float) -> str:
    """Generates a regular MultiPolygon WKT boundary with roughly area_ha footprint."""
    # 1 ha = 10,000 m2. Square side = sqrt(area_ha * 10000)
    side_m = math.sqrt(area_ha * 10000.0)
    delta_deg = (side_m / 111320.0) / 2.0  # approximate meters to degrees

    p1 = f"{lon - delta_deg:.6f} {lat - delta_deg:.6f}"
    p2 = f"{lon + delta_deg:.6f} {lat - delta_deg:.6f}"
    p3 = f"{lon + delta_deg:.6f} {lat + delta_deg:.6f}"
    p4 = f"{lon - delta_deg:.6f} {lat + delta_deg:.6f}"
    p5 = p1

    return f"SRID=4326;MULTIPOLYGON((({p1}, {p2}, {p3}, {p4}, {p5})))"


def create_point_wkt(lon: float, lat: float) -> str:
    """Generates Point WKT."""
    return f"SRID=4326;POINT({lon:.6f} {lat:.6f})"


def build_candidate_site_record(
    spec: RawCandidateSiteSpec,
    engine: Optional[CapacityEngine] = None,
) -> dict[str, Any]:
    """Evaluates carrying capacity and builds a candidate_site database insert record."""
    eng = engine or CapacityEngine()
    area_m2 = spec.area_ha * 10000.0

    eval_result = eng.evaluate_site_capacity(
        area_developable_m2=area_m2,
        water_yield_liters_per_day=spec.water_yield_liters_per_day,
        spare_school_seats=spec.spare_school_seats,
        spare_health_capacity_pop=spec.spare_health_capacity_pop,
        livelihood_multiplier=spec.livelihood_multiplier,
        is_urban=False,
        is_hilly_or_tribal=True,
    )

    eval_eligibility = eng.evaluate_site_eligibility(
        mhi_max=spec.mhi_max,
        slope_mean=spec.slope_mean,
        area_ha=spec.area_ha,
        tenure=spec.tenure,
        is_forest=getattr(spec, "is_forest", False),
        is_protected_area=getattr(spec, "is_protected_area", False),
        is_crz=getattr(spec, "is_crz", False),
        is_water_body=getattr(spec, "is_water_body", False),
    )

    augmented_dict = {}
    if eval_result.augmented:
        augmented_dict = {
            "relieved_constraint": eval_result.augmented.relieved_constraint.value,
            "augmented_capacity": eval_result.augmented.augmented_capacity,
            "next_binding_constraint": eval_result.augmented.next_binding_constraint.value
            if eval_result.augmented.next_binding_constraint
            else None,
            "indicative_intervention": eval_result.augmented.indicative_intervention,
            "indicative_cost_inr_lakhs": eval_result.augmented.indicative_cost_inr_lakhs,
        }

    metadata_dict = {
        "name": spec.name,
        "is_eligible": eval_eligibility.is_eligible,
        "rejection_reasons": eval_eligibility.rejection_reasons,
        "is_forest": getattr(spec, "is_forest", False),
        "is_protected_area": getattr(spec, "is_protected_area", False),
        "is_crz": getattr(spec, "is_crz", False),
        "is_water_body": getattr(spec, "is_water_body", False),
        "eligibility_policy_version": eng.policy.policy_version,
        "policy_version": eval_result.policy_version,
        "calculation_version": eval_result.calculation_version,
        "data_quality": eval_result.data_quality.value,
        "livelihood_multiplier": spec.livelihood_multiplier,
        "is_synthetic": True,
        "provenance": "synthetic_pilot_fixture",
    }

    return {
        "geom_wkt": create_polygon_wkt(spec.lon, spec.lat, spec.area_ha),
        "centroid_wkt": create_point_wkt(spec.lon, spec.lat),
        "area_ha": spec.area_ha,
        "tenure": spec.tenure.value,
        "slope_mean": spec.slope_mean,
        "mhi_max": spec.mhi_max,
        "cc_land": eval_result.cc_land,
        "cc_water": eval_result.cc_water,
        "cc_school": eval_result.cc_school,
        "cc_health": eval_result.cc_health,
        "cc_final": eval_result.cc_final,
        "binding_constraint": eval_result.binding_constraint.value,
        "augmented": json.dumps(augmented_dict),
        "suitability": spec.suitability,
        "metadata": json.dumps(metadata_dict),
        "is_eligible": eval_eligibility.is_eligible,
        "rejection_reasons": eval_eligibility.rejection_reasons,
    }
