"""Canonical Pydantic v2 schemas for ML Explainability & Feature Attributions.

Section refs: docs/PRD1.md §6.10, §14.1 (FR-9.1, FR-9.2)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import Field, model_validator

from core.constants import SCREENING_GRADE_NOTICE
from core.schemas.common import BaseSchema


class FeatureContributionDTO(BaseSchema):
    """Single feature attribution item for a cell or habitation."""
    feature: str = Field(description="Feature name, e.g. slope_deg, hand_m, dist_to_road_m, rainfall_72h.")
    value: float = Field(description="Observed or calculated feature value.")
    contribution: float = Field(description="Attribution weight or SHAP value contribution.")
    method: str = Field(
        default="heuristic",
        description="Explanation method ('treeshap', 'kernelshap', 'heuristic', 'pca_loading').",
    )
    rank: Optional[int] = Field(
        default=None,
        ge=1,
        description="Rank of this feature in importance (1 = top contributing factor).",
    )

    @model_validator(mode="before")
    @classmethod
    def _normalize_raw_fields(cls, data: Any) -> Any:
        """Normalizes legitimate legacy ML attribution keys (name -> feature, shap_value -> contribution).
        
        Preserves strict validation: rejects malformed data, does not map non-explanation keys
        (factor, weight, type), and never manufactures false evidence values (missing value remains invalid).
        """
        if isinstance(data, dict):
            d = dict(data)
            # Legitimate ML contract alias: 'name' is the feature identifier in TreeSHAP outputs
            if "feature" not in d and "name" in d and d["name"] is not None:
                d["feature"] = str(d["name"])
            # Legitimate ML contract alias: 'shap_value' is the local attribution in TreeSHAP outputs
            if "contribution" not in d and "shap_value" in d and d["shap_value"] is not None:
                try:
                    d["contribution"] = float(d["shap_value"])
                except (ValueError, TypeError):
                    pass
            # Note: We intentionally do NOT map 'factor' -> 'feature', 'weight' -> 'contribution',
            # 'type' -> 'method', and do NOT default missing 'value' to 0.0.
            return d
        return data


class CanonicalExplanationRecord(BaseSchema):
    """Canonical model explanation container for an H3 cell.
    
    Decouples raw ML team SHAP outputs / XGBoost trees from core domain serving layers.
    """
    h3: str = Field(description="Hexadecimal H3 index.")
    h3_int: int = Field(description="64-bit integer H3 index.")
    model_version: str = Field(default="v1.0.0", description="Model version that produced the attributions.")
    method: str = Field(default="treeshap", description="Attribution algorithm used.")
    factors: list[FeatureContributionDTO] = Field(
        default_factory=list,
        description="Top contributing feature factors ordered by absolute impact.",
    )
    confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Model confidence score in [0.0, 1.0] if provided by ML team.",
    )
    uncertainty: Optional[dict[str, Any]] = Field(
        default=None,
        description="Preserved uncertainty metrics (e.g. interval bounds, variance) from ML product.",
    )
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when explanation was computed.",
    )
    screening_grade: str = Field(default=SCREENING_GRADE_NOTICE, description="Screening grade disclaimer.")


class ExplanationBatchDTO(BaseSchema):
    """Batch ingestion payload for ML-provided explanations."""
    model_name: str
    model_version: str
    calculation_version: str = "calc-v1.0"
    records: list[CanonicalExplanationRecord] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
