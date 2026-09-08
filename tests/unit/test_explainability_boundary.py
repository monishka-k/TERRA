"""Unit tests for ML Explainability Boundary, Normalization & SHAP Isolation (Day 6).

Section refs: docs/PRD1.md §6.10, §14.1 (FR-9.1, FR-9.2)
"""

import pytest
from core.domain.explanation import (
    build_canonical_explanation,
    normalize_feature_contributions,
)
from core.schemas.explanation import FeatureContributionDTO


class TestExplainabilityBoundary:
    """Tests for canonical explanation construction, factor ranking, and ML decoupling."""

    def test_top_five_factors_sorted_by_absolute_importance(self):
        """FR-9.1: Top 5 contributing factors ordered by magnitude."""
        raw_factors = [
            {"feature": "dist_to_road_m", "value": 350.0, "contribution": 0.12},
            {"feature": "slope_deg", "value": 34.2, "contribution": 0.55},
            {"feature": "twi", "value": 8.1, "contribution": -0.42},
            {"feature": "rainfall_72h", "value": 280.0, "contribution": 0.38},
            {"feature": "ndvi", "value": 0.45, "contribution": -0.05},
            {"feature": "curvature", "value": 0.02, "contribution": 0.01}, # Should be truncated beyond 5
        ]

        factors = normalize_feature_contributions(raw_factors)
        assert len(factors) == 5

        # Check ordering: slope_deg (0.55) > twi (-0.42) > rainfall_72h (0.38) > dist_to_road (0.12) > ndvi (-0.05)
        assert factors[0].feature == "slope_deg"
        assert factors[0].rank == 1
        assert factors[1].feature == "twi"
        assert factors[1].rank == 2
        assert factors[2].feature == "rainfall_72h"
        assert factors[2].rank == 3
        assert factors[3].feature == "dist_to_road_m"
        assert factors[3].rank == 4
        assert factors[4].feature == "ndvi"
        assert factors[4].rank == 5

    def test_build_canonical_explanation_success(self):
        raw_factors = [
            {"name": "slope_deg", "value": 28.5, "shap_value": 0.45},
            {"name": "hand_m", "value": 2.1, "shap_value": 0.30},
        ]
        record = build_canonical_explanation(
            h3="8860064989fffff",
            raw_factors=raw_factors,
            model_version="landslide-xgb-v1.2",
            method="treeshap",
            confidence=0.88,
            uncertainty={"variance": 0.04, "interval_95": [0.38, 0.52]},
        )

        assert record is not None
        assert record.h3 == "8860064989fffff"
        assert record.model_version == "landslide-xgb-v1.2"
        assert record.method == "treeshap"
        assert record.confidence == 0.88
        assert record.uncertainty == {"variance": 0.04, "interval_95": [0.38, 0.52]}
        assert len(record.factors) == 2

    def test_reject_invalid_h3(self):
        record = build_canonical_explanation(
            h3="not_a_valid_h3",
            raw_factors=[{"feature": "slope_deg", "value": 20.0, "contribution": 0.3}],
        )
        assert record is None
