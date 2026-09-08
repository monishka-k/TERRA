"""Pydantic v2 schemas for Relocation Allocation Optimization.

Endpoint: POST /plan/allocate
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import Field
from core.enums import Tier
from core.schemas.common import BaseSchema, SCREENING_GRADE_NOTICE


class AllocationPlanRequest(BaseSchema):
    """Request payload for min-cost flow allocation solver (POST /plan/allocate)."""
    admin_id: Optional[int] = Field(default=None, description="Scope solver to specific administrative boundary (LGD/ID).")
    max_search_radius_km: float = Field(default=15.0, gt=0.0, le=100.0, description="Max allowed relocation distance.")
    target_tiers: List[Tier] = Field(
        default_factory=lambda: [Tier.IMMEDIATE, Tier.SHORT_TERM],
        description="Tiers included in this relocation budget allocation.",
    )
    allow_group_splits: bool = Field(
        default=True,
        description="Whether a village household group may split across multiple candidate sites.",
    )
    distance_penalty_weight: float = Field(
        default=1.0,
        ge=0.0,
        description="Cost penalty weight per kilometer of distance from source habitation.",
    )


class AllocationAssignmentDTO(BaseSchema):
    habitation_id: int
    habitation_name: str
    site_id: int
    site_distance_km: float
    households: int
    tier: Tier
    priority_score: float
    site_suitability: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="Composite suitability score (0-100, None if unassigned/provisional).",
    )
    has_group_split: bool = False
    split_details: Optional[str] = None


class AllocationPlanResponse(BaseSchema):
    """Response payload for min-cost flow allocation solver (POST /plan/allocate)."""
    allocation_run_id: UUID
    status: str = "COMPLETED"
    admin_id: Optional[int] = None
    total_demand_households: int
    total_relocated_households: int
    unmet_demand_households: int
    solver_latency_ms: float
    assignments: List[AllocationAssignmentDTO] = Field(default_factory=list)
    group_split_warnings: List[str] = Field(default_factory=list)
    screening_grade: str = SCREENING_GRADE_NOTICE


class ExternalRecommendationItem(BaseSchema):
    """External offline recommendation record from upstream partner pipeline."""
    id: int
    import_run_id: UUID
    habitation_id: int
    habitation_name: Optional[str] = None
    site_id: int
    external_habitation_key: str
    external_site_key: str
    origin_type: str = "external"
    decision_status: str = "recommendation"
    households: int
    tier: str
    priority_score: float
    distance_km: float
    site_suitability: Optional[int] = None
    site_cc_final: Optional[int] = None
    site_binding: Optional[str] = None
    has_group_split: bool = False
    rationale: Dict[str, Any] = Field(default_factory=dict)
    screening_grade: str
    screening_caveats: Optional[str] = None
    source_pipeline: str = "external_gis_v1"
    pipeline_version: str = "v1.0"
    created_at: datetime


class ExternalRecommendationListResponse(BaseSchema):
    """List response for external recommendations."""
    district: str
    total_count: int
    total_households_recommended: int
    items: List[ExternalRecommendationItem] = Field(default_factory=list)


class AllocationBenchmarkComparisonItem(BaseSchema):
    """Side-by-side comparison of a habitation's external recommendation vs SETU canonical decision."""
    habitation_id: int
    habitation_name: str
    demand_households: int
    external_recommendation: Optional[Dict[str, Any]] = None
    setu_canonical_allocation: Optional[Dict[str, Any]] = None
    site_match: bool = False
    household_delta: int = 0
    distance_delta_km: Optional[float] = None
    methodology_divergence_notes: List[str] = Field(default_factory=list)


class AllocationBenchmarkResponse(BaseSchema):
    """Comparative evaluation between offline external GIS recommendations and SETU decision engine."""
    district: str
    status: str = "comparative"  # 'comparative' or 'external_only'
    setu_allocation_available: bool = False
    total_external_recommended_households: int = 0
    total_setu_allocated_households: int = 0
    external_recommendations_count: int = 0
    setu_allocations_count: int = 0
    comparisons: List[AllocationBenchmarkComparisonItem] = Field(default_factory=list)
    methodology_summary: Dict[str, str] = Field(
        default_factory=lambda: {
            "external_pipeline": "Offline geometric screening, land-capacity proxy, dormant priority scoring",
            "setu_decision_engine": "Independent H7 hard gate, min-cost flow optimization, multi-hazard priority",
        }
    )
