"""Domain logic for ML Explainability ingestion, validation, and canonical normalization.

Section refs: docs/PRD1.md §6.10, §14.1 (FR-9.1, FR-9.2)

The backend acts as an integration boundary that consumes canonical explanation products
without executing ML training scripts, importing XGBoost objects, or computing SHAP on the fly.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Mapping, Optional, Sequence

from core.constants import SCREENING_GRADE_NOTICE
from core.h3_utils import h3_to_int, is_valid_h3
from core.schemas.explanation import (
    CanonicalExplanationRecord,
    FeatureContributionDTO,
)

logger = logging.getLogger("setu_core.explanation")


def normalize_feature_contributions(
    raw_factors: Sequence[Mapping[str, Any] | FeatureContributionDTO],
    default_method: str = "treeshap",
    max_factors: int = 5,
) -> list[FeatureContributionDTO]:
    """Normalizes, ranks, and sorts feature contributions by absolute importance (FR-9.1).
    
    PRD FR-9.1: Top five contributing factors are retained and served.
    """
    parsed: list[tuple[float, FeatureContributionDTO]] = []

    for f in raw_factors:
        if isinstance(f, FeatureContributionDTO):
            feat_name = f.feature
            feat_val = float(f.value)
            feat_contrib = float(f.contribution)
            method = f.method or default_method
        elif isinstance(f, dict):
            feat_name = str(f.get("feature") or f.get("name") or f.get("factor") or "unknown_feature")
            try:
                raw_v = f.get("value")
                feat_val = float(raw_v if raw_v is not None else 0.0)
                raw_c = f.get("contribution")
                if raw_c is None:
                    raw_c = f.get("shap_value")
                if raw_c is None:
                    raw_c = f.get("weight")
                feat_contrib = float(raw_c if raw_c is not None else 0.0)
            except (ValueError, TypeError):
                continue
            method = str(f.get("method") or default_method)
        else:
            continue

        item = FeatureContributionDTO(
            feature=feat_name,
            value=feat_val,
            contribution=round(feat_contrib, 4),
            method=method,
        )
        parsed.append((abs(feat_contrib), item))

    # Sort descending by absolute attribution magnitude
    parsed.sort(key=lambda x: x[0], reverse=True)
    top_factors = [item for _, item in parsed[:max_factors]]

    # Assign rank 1..N
    for rank_idx, item in enumerate(top_factors, start=1):
        item.rank = rank_idx

    return top_factors


def build_canonical_explanation(
    h3: str,
    raw_factors: Sequence[Mapping[str, Any] | FeatureContributionDTO],
    model_version: str = "v1.0.0",
    method: str = "treeshap",
    confidence: Optional[float] = None,
    uncertainty: Optional[dict[str, Any]] = None,
    generated_at: Optional[datetime] = None,
) -> Optional[CanonicalExplanationRecord]:
    """Builds a strictly validated CanonicalExplanationRecord from raw ML outputs.
    
    Fails cleanly (returning None) if H3 index is invalid.
    """
    if not is_valid_h3(h3):
        logger.warning(f"Rejecting explanation: Invalid H3 index '{h3}'.")
        return None

    h3_int_val = h3_to_int(h3)
    norm_factors = normalize_feature_contributions(raw_factors, default_method=method)

    conf_val: Optional[float] = None
    if confidence is not None:
        try:
            c = float(confidence)
            if 0.0 <= c <= 1.0:
                conf_val = c
        except (ValueError, TypeError):
            conf_val = None

    return CanonicalExplanationRecord(
        h3=h3,
        h3_int=h3_int_val,
        model_version=model_version,
        method=method,
        factors=norm_factors,
        confidence=conf_val,
        uncertainty=uncertainty,
        generated_at=generated_at or datetime.now(timezone.utc),
        screening_grade=SCREENING_GRADE_NOTICE,
    )
