"""Unit tests for ML Protocols, baseline providers, and ModelRegistry hot-swapping."""

import pytest
from core.ml.types import (
    LandslideFeatures,
    FloodFeatures,
    VulnerabilityFeatures,
    TriggerFeatures,
    HazardPrediction,
    ModelMetadata,
    FeatureContribution,
)
from core.ml.protocols import (
    LandslideModelProtocol,
    FloodSurfaceProtocol,
    VulnerabilityDownscalerProtocol,
    TriggerThresholdProtocol,
)
from core.ml.registry import (
    BaselineLandslideProvider,
    BaselineFloodProvider,
    BaselineVulnerabilityProvider,
    BaselineTriggerProvider,
    ModelRegistry,
)


def test_baseline_providers_satisfy_protocols():
    """Verify that baseline providers adhere to ML protocols via runtime check."""
    ls_provider = BaselineLandslideProvider()
    assert isinstance(ls_provider, LandslideModelProtocol)

    flood_provider = BaselineFloodProvider()
    assert isinstance(flood_provider, FloodSurfaceProtocol)

    vuln_provider = BaselineVulnerabilityProvider()
    assert isinstance(vuln_provider, VulnerabilityDownscalerProtocol)

    trigger_provider = BaselineTriggerProvider()
    assert isinstance(trigger_provider, TriggerThresholdProtocol)


def test_baseline_landslide_prediction():
    """Verify baseline landslide prediction range and explanations."""
    provider = BaselineLandslideProvider()
    features = LandslideFeatures(slope_deg=35.0, local_relief_m=400.0, dist_to_road_m=200.0)
    pred = provider.predict(features)

    assert 0.0 <= pred.susceptibility <= 1.0
    assert 0.0 <= pred.confidence <= 1.0
    assert len(pred.explanation) >= 2
    assert pred.metadata.provider == "baseline"


def test_baseline_trigger_evaluation():
    """Verify baseline trigger evaluates 15-day ARI and threshold crossing."""
    provider = BaselineTriggerProvider()
    # High rainfall sequence
    features = TriggerFeatures(
        daily_rainfall_15d_mm=[50.0] * 15,
        rolling_24h_mm=350.0,
        duration_hours=24.0,
    )
    res = provider.evaluate(features)

    assert res.ari_15d > 0.0
    assert res.trigger_value > 0.0
    assert res.threshold_crossed is True


def test_model_registry_hot_swap():
    """Contract B test: Verify hot-swapping a custom trained provider into ModelRegistry."""
    registry = ModelRegistry()

    # Initial state is baseline
    assert registry.landslide_model.metadata.provider == "baseline"

    # Mock a new trained XGBoost provider satisfying LandslideModelProtocol
    class MockXGBoostProvider:
        @property
        def metadata(self) -> ModelMetadata:
            return ModelMetadata(
                model_name="xgboost_western_ghats",
                model_version="v2.1.0-prod",
                feature_schema_version="v1.0",
                provider="xgboost",
                auc_score=0.88,
            )

        def predict(self, features: LandslideFeatures) -> HazardPrediction:
            return HazardPrediction(
                susceptibility=0.92,
                confidence=0.95,
                explanation=[
                    FeatureContribution(feature="slope_deg", value=features.slope_deg, contribution=0.6, method="TreeSHAP")
                ],
                metadata=self.metadata,
            )

    mock_xgb = MockXGBoostProvider()
    assert isinstance(mock_xgb, LandslideModelProtocol)

    # Hot-swap into registry
    registry.register_landslide_model(mock_xgb)

    # Verify active provider switched seamlessly
    assert registry.landslide_model.metadata.provider == "xgboost"
    assert registry.landslide_model.metadata.model_version == "v2.1.0-prod"
    
    # Test prediction through registry
    pred = registry.landslide_model.predict(LandslideFeatures(slope_deg=40.0))
    assert pred.susceptibility == 0.92
    assert pred.metadata.model_name == "xgboost_western_ghats"
