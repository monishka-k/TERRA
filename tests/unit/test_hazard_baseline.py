"""Unit tests for ML Baseline Providers, Terrain Evaluators, and Heuristic Explanations."""

import pytest
from core.ml.types import LandslideFeatures, FloodFeatures
from core.ml.registry import BaselineLandslideProvider, BaselineFloodProvider
from pipeline.hazard.terrain_zonal import TerrainHazardEvaluator
from core.enums import ZoneClass, Hazard


class TestBaselineMLProviders:
    def test_baseline_landslide_provider_contract(self):
        provider = BaselineLandslideProvider()
        assert provider.metadata.provider == "baseline"
        assert provider.metadata.model_version == "baseline-v1"

        features = LandslideFeatures(
            slope_deg=32.0,
            local_relief_m=300.0,
            dist_to_road_m=200.0,
        )
        pred = provider.predict(features)

        assert 0.0 <= pred.susceptibility <= 1.0
        assert 0.0 <= pred.confidence <= 1.0
        assert len(pred.explanation) > 0

        # Verify Day 2 requirement: method must be 'heuristic'
        for exp in pred.explanation:
            assert exp.method == "heuristic"
            assert exp.feature in ("slope_deg", "local_relief_m", "dist_to_road_m")

    def test_baseline_flood_provider_contract(self):
        provider = BaselineFloodProvider()
        assert provider.metadata.provider == "baseline"

        features = FloodFeatures(
            hand_m=2.5,
            twi=12.0,
        )
        pred = provider.predict(features)

        assert 0.0 <= pred.susceptibility <= 1.0
        assert 0.0 <= pred.confidence <= 1.0

        for exp in pred.explanation:
            assert exp.method == "heuristic"


class TestTerrainHazardEvaluator:
    def test_evaluator_cell_output(self):
        evaluator = TerrainHazardEvaluator()
        result = evaluator.evaluate_cell(
            h3_int=614178831240003583,
            elevation_m=850.0,
            slope_deg=35.0,
            local_relief_m=250.0,
            dist_to_road_m=300.0,
            hand_m=8.0,
            twi=9.0,
        )

        assert "hazard_statics" in result
        assert "mhi_snapshot" in result
        assert "explanation" in result

        mhi_snap = result["mhi_snapshot"]
        assert 0.0 <= mhi_snap["mhi_static"] <= 1.0
        assert mhi_snap["zone_class"] in (
            ZoneClass.PERMANENT_RED.value,
            ZoneClass.CAUTION.value,
            ZoneClass.NONE.value,
        )

        expl = result["explanation"]
        assert expl["model_version"] == "baseline-v1"
        assert len(expl["factors"]) <= 5
        for factor in expl["factors"]:
            assert factor["method"] == "heuristic"
