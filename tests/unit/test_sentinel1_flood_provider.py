"""Unit tests for Sentinel-1 Flood Surface ML Provider (Day 3)."""

import pytest
from core.ml.protocols import FloodSurfaceProtocol
from core.ml.types import FloodFeatures
from core.ml.sentinel1_flood_provider import Sentinel1FloodProvider
from core.ml.registry import ModelRegistry, BaselineFloodProvider
from core.domain.hazard import compute_hazard_score, compute_mhi


class TestSentinel1FloodProvider:
    def test_provider_conforms_to_protocol(self):
        """Verify Sentinel1FloodProvider satisfies FloodSurfaceProtocol structural typing."""
        provider = Sentinel1FloodProvider()
        assert isinstance(provider, FloodSurfaceProtocol)
        assert provider.metadata.provider == "sentinel1_sar"
        assert provider.metadata.model_name == "sentinel1_sar_flood_surface"

    def test_predict_with_sar_inundation_frequency(self):
        """Verify flood susceptibility computation integrates empirical SAR observations."""
        provider = Sentinel1FloodProvider()

        # High flood risk: low HAND + high SAR inundation frequency
        features = FloodFeatures(
            hand_m=1.0,
            twi=12.0,
            historical_sar_inundation_freq=0.75,
        )
        pred = provider.predict(features)

        assert 0.0 <= pred.susceptibility <= 1.0
        assert pred.confidence == 0.90
        assert len(pred.explanation) == 3

        # Check empirical SAR explanation
        sar_exp = next((e for e in pred.explanation if e.feature == "historical_sar_inundation_freq"), None)
        assert sar_exp is not None
        assert sar_exp.method == "empirical_sar"
        assert sar_exp.value == 0.75
        assert sar_exp.contribution > 0.0

    def test_model_registry_hot_swap(self):
        """Verify hot-swapping Sentinel1FloodProvider into ModelRegistry without API disruption."""
        registry = ModelRegistry()

        # Initial baseline state
        assert registry.flood_model.metadata.provider == "baseline"

        # Hot-swap Sentinel-1 provider
        s1_provider = Sentinel1FloodProvider(version="s1-monsoon-2026-v1")
        registry.register_flood_model(s1_provider)

        # Verify active provider switched seamlessly
        assert registry.flood_model.metadata.provider == "sentinel1_sar"
        assert registry.flood_model.metadata.model_version == "s1-monsoon-2026-v1"

        pred = registry.flood_model.predict(FloodFeatures(hand_m=3.0, twi=8.0, historical_sar_inundation_freq=0.4))
        assert 0.0 <= pred.susceptibility <= 1.0

    def test_hazard_invariants_preserved(self):
        """Verify domain invariants: S=0 -> H=0 and MHI bounded in [0, 1]."""
        provider = Sentinel1FloodProvider()

        # Test S = 0.0 leads to H = 0.0 regardless of trigger
        h_score_zero = compute_hazard_score(susceptibility=0.0, trigger_value=5.0)
        assert h_score_zero == 0.0

        # Normal prediction through domain MHI
        pred = provider.predict(FloodFeatures(hand_m=4.0, twi=10.0, historical_sar_inundation_freq=0.3))
        h_score = compute_hazard_score(susceptibility=pred.susceptibility, trigger_value=1.5)
        assert 0.0 <= h_score <= 1.0

        mhi = compute_mhi({"flash_flood": h_score, "landslide": 0.5})
        assert 0.0 <= mhi <= 1.0
