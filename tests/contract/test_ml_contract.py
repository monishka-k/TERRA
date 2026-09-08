"""Contract tests for ML Integration Boundary (Day 6).

Section refs: docs/PRD1.md §7.1, §7.2, §14.1

Validates that the backend can safely consume, validate, and normalize upstream ML products
(susceptibility predictions, dynamic triggers, forecast crossings, and SHAP feature attributions)
through canonical adapter contracts WITHOUT executing ML training pipelines or importing model internals.
"""

import pytest
from datetime import datetime, timezone

from core.domain.explanation import build_canonical_explanation, normalize_feature_contributions
from core.schemas.explanation import CanonicalExplanationRecord, FeatureContributionDTO
from core.schemas.dynamic_triggers import (
    CanonicalTriggerRecord,
    TriggerType,
    DataQuality,
)
from pipeline.adapters.trigger_adapter import TriggerParserV1


class TestMLIntegrationContracts:
    """Contract verification for upstream ML data products."""

    def test_ml_shap_explanation_contract(self):
        """Validates that arbitrary ML team SHAP JSON payloads adapt cleanly to canonical contracts."""
        # Simulated raw output from an upstream TreeSHAP / XGBoost pipeline
        raw_ml_payload = {
            "cell_hex": "8860064989fffff",
            "model_metadata": {
                "name": "landslide_xgboost_western_ghats",
                "version": "v2.1.0",
                "algorithm": "treeshap",
                "auc": 0.82,
            },
            "shap_values": [
                {"name": "slope_deg", "value": 31.5, "shap_value": 0.42},
                {"name": "twi", "value": 7.8, "shap_value": -0.28},
                {"name": "dist_to_road_m", "value": 120.0, "shap_value": 0.35},
                {"name": "soil_drainage", "value": 2.0, "shap_value": 0.15},
                {"name": "mean_annual_rainfall_mm", "value": 3100.0, "shap_value": 0.22},
                {"name": "curvature_profile", "value": 0.05, "shap_value": 0.04},
            ],
            "confidence_score": 0.89,
            "uncertainty_bounds": {"p10": 0.35, "p90": 0.65},
        }

        # Adapter translation to canonical explanation
        canonical = build_canonical_explanation(
            h3=raw_ml_payload["cell_hex"],
            raw_factors=raw_ml_payload["shap_values"],
            model_version=raw_ml_payload["model_metadata"]["version"],
            method=raw_ml_payload["model_metadata"]["algorithm"],
            confidence=raw_ml_payload["confidence_score"],
            uncertainty=raw_ml_payload["uncertainty_bounds"],
        )

        assert canonical is not None
        assert isinstance(canonical, CanonicalExplanationRecord)
        assert canonical.h3 == "8860064989fffff"
        assert canonical.model_version == "v2.1.0"
        assert canonical.method == "treeshap"
        assert canonical.confidence == 0.89
        assert canonical.uncertainty == {"p10": 0.35, "p90": 0.65}
        assert len(canonical.factors) == 5  # Top 5 per PRD FR-9.1

        # Check top factor ordering by magnitude
        assert canonical.factors[0].feature == "slope_deg"
        assert canonical.factors[0].rank == 1
        assert canonical.factors[1].feature == "dist_to_road_m"
        assert canonical.factors[1].rank == 2

    def test_ml_dynamic_trigger_contract(self):
        """Validates that upstream trigger arrays transform into canonical trigger records."""
        raw_trigger_csv = """# source: IMERG_EARLY
# provider: NASA/GESDISC
# model_version: imerg-v07b-calibrated
h3,trigger_value,hazard_type,valid_at
8860064989fffff,0.88,landslide,2026-08-30T12:00:00Z
886006498bfffff,0.76,flash_flood,2026-08-30T12:00:00Z
"""
        parser = TriggerParserV1()
        records, report = parser.parse(raw_trigger_csv)

        assert report.valid_records == 2
        assert report.invalid_records == 0
        for rec in records:
            assert isinstance(rec, CanonicalTriggerRecord)
            assert rec.trigger_type == TriggerType.OBSERVED
            assert rec.data_quality == DataQuality.VALID
            assert rec.trigger_value >= 0.0

    def test_ml_forecast_contract_enforces_72h_boundary(self):
        """Validates that meteorological forecast products beyond 72h are rejected at the adapter boundary."""
        raw_forecast_csv = """h3,trigger_value,type,forecast_cycle_at,valid_at,horizon_hours,source
8860064989fffff,0.85,forecast,2026-08-30T00:00:00Z,2026-09-01T00:00:00Z,48,ECMWF_OPEN
886006498bfffff,0.95,forecast,2026-08-30T00:00:00Z,2026-09-04T00:00:00Z,96,ECMWF_OPEN
"""
        parser = TriggerParserV1()
        records, report = parser.parse(raw_forecast_csv)

        # First row (48h) should pass, second row (96h) must fail
        assert report.valid_records == 1
        assert report.invalid_records == 1
        assert records[0].horizon_hours == 48
        assert any("Horizon 96h out of allowed bounds" in err for err in report.errors)

    def test_malformed_ml_outputs_fail_gracefully(self):
        """Ensures that corrupted ML outputs do not crash the pipeline and produce structured error reports."""
        malformed_csv = """h3,trigger_value
not_a_valid_hex,0.80
8860064989fffff,NaN
8860064989fffff,corrupted_float_text
"""
        parser = TriggerParserV1()
        records, report = parser.parse(malformed_csv)

        assert report.valid_records == 0
        assert report.invalid_records == 3
        assert len(report.errors) == 3
        assert len(records) == 0
