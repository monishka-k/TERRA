"""ML Model Registry and Baseline Heuristic Providers.

Implements baseline providers satisfying ML protocols to guarantee the backend and API
are 100% functional immediately without waiting for trained ML weights.
"""

import math
import logging
from typing import Optional
from core.ml.types import (
    ModelMetadata,
    FeatureContribution,
    HazardPrediction,
    VulnerabilityPrediction,
    TriggerResult,
    LandslideFeatures,
    FloodFeatures,
    VulnerabilityFeatures,
    TriggerFeatures,
)
from core.ml.protocols import (
    LandslideModelProtocol,
    FloodSurfaceProtocol,
    VulnerabilityDownscalerProtocol,
    TriggerThresholdProtocol,
)
from core.constants import ARI_DECAY_K, ARI_WINDOW_DAYS

logger = logging.getLogger("setu_core.ml")


class BaselineLandslideProvider:
    """Analytical baseline estimator for landslide susceptibility based on slope and terrain relief."""

    def __init__(self, version: str = "baseline-v1") -> None:
        self._metadata = ModelMetadata(
            model_name="baseline_landslide_heuristic",
            model_version=version,
            feature_schema_version="baseline-v1",
            provider="baseline",
        )

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    def predict(self, features: LandslideFeatures) -> HazardPrediction:
        slope = max(0.0, features.slope_deg)
        # Sigmoid slope risk curve: critical slope ~25-35 deg
        slope_risk = 1.0 / (1.0 + math.exp(-0.2 * (slope - 28.0)))
        
        # Rainfall / Relief factors
        relief_factor = min(features.local_relief_m / 500.0, 1.0) * 0.15
        road_factor = max(0.0, (1000.0 - features.dist_to_road_m) / 1000.0) * 0.1
        
        raw_score = slope_risk * 0.75 + relief_factor + road_factor
        susceptibility = min(max(raw_score, 0.0), 1.0)

        # Baseline feature attributions
        contributions = [
            FeatureContribution(
                feature="slope_deg",
                value=features.slope_deg,
                contribution=round(slope_risk * 0.75, 4),
                method="heuristic",
            ),
            FeatureContribution(
                feature="local_relief_m",
                value=features.local_relief_m,
                contribution=round(relief_factor, 4),
                method="heuristic",
            ),
            FeatureContribution(
                feature="dist_to_road_m",
                value=features.dist_to_road_m,
                contribution=round(road_factor, 4),
                method="heuristic",
            ),
        ]

        return HazardPrediction(
            susceptibility=round(susceptibility, 4),
            confidence=0.85,
            explanation=contributions,
            metadata=self._metadata,
        )


class BaselineFloodProvider:
    """Analytical baseline estimator for flood susceptibility based on HAND and TWI."""

    def __init__(self, version: str = "baseline-v1") -> None:
        self._metadata = ModelMetadata(
            model_name="baseline_flood_heuristic",
            model_version=version,
            feature_schema_version="baseline-v1",
            provider="baseline",
        )

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    def predict(self, features: FloodFeatures) -> HazardPrediction:
        # HAND <= 5m indicates high flood susceptibility
        hand = max(0.0, features.hand_m)
        hand_risk = math.exp(-0.4 * hand)
        twi_risk = min(max(features.twi / 15.0, 0.0), 1.0) * 0.2
        sar_risk = min(max(features.historical_sar_inundation_freq, 0.0), 1.0) * 0.3

        raw_score = hand_risk * 0.5 + twi_risk + sar_risk
        susceptibility = min(max(raw_score, 0.0), 1.0)

        contributions = [
            FeatureContribution(
                feature="hand_m",
                value=features.hand_m,
                contribution=round(hand_risk * 0.5, 4),
                method="heuristic",
            ),
            FeatureContribution(
                feature="twi",
                value=features.twi,
                contribution=round(twi_risk, 4),
                method="heuristic",
            ),
        ]

        return HazardPrediction(
            susceptibility=round(susceptibility, 4),
            confidence=0.80,
            explanation=contributions,
            metadata=self._metadata,
        )


class BaselineVulnerabilityProvider:
    """Analytical baseline estimator for dasymetrically downscaled SoVI vulnerability."""

    def __init__(self, version: str = "baseline-v1") -> None:
        self._metadata = ModelMetadata(
            model_name="baseline_vulnerability_heuristic",
            model_version=version,
            feature_schema_version="baseline-v1",
            provider="baseline",
        )

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    def predict(self, features: VulnerabilityFeatures) -> VulnerabilityPrediction:
        # Demographic anchor
        v_demo = min(max(features.district_pca_anchor, 0.0), 1.0)

        # Structural proxy: lower height + higher density -> higher vulnerability
        v_struct = min(max(0.7 - (features.avg_building_height_m * 0.05) + (features.building_footprint_density * 0.5), 0.0), 1.0)

        # Access proxy: distance to road and health facilities
        v_access = min(max((features.dist_to_primary_road_m / 5000.0) * 0.5 + (features.dist_to_health_facility_m / 10000.0) * 0.5, 0.0), 1.0)

        # Economic proxy: inversely proportional to nightlights
        v_econ = min(max(1.0 - (features.viirs_nightlight_mean / 5.0), 0.0), 1.0)

        # SoVI Composite index (equal weights in baseline)
        v_index = (v_demo * 0.25) + (v_struct * 0.25) + (v_access * 0.25) + (v_econ * 0.25)

        return VulnerabilityPrediction(
            v_demographic=round(v_demo, 4),
            v_structural=round(v_struct, 4),
            v_access=round(v_access, 4),
            v_economic=round(v_econ, 4),
            v_index=round(v_index, 4),
            is_district_flat=False,
            metadata=self._metadata,
        )


class BaselineTriggerProvider:
    """Analytical baseline estimator for antecedent rainfall and I-D power law."""

    def __init__(self, version: str = "baseline-v1") -> None:
        self._metadata = ModelMetadata(
            model_name="baseline_trigger_heuristic",
            model_version=version,
            feature_schema_version="baseline-v1",
            provider="baseline",
        )

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    def evaluate(self, observations: TriggerFeatures) -> TriggerResult:
        # Compute 15-day Antecedent Rainfall Index: API = sum(k^i * P_(t-i))
        rainfall_seq = observations.daily_rainfall_15d_mm or [0.0] * ARI_WINDOW_DAYS
        ari = 0.0
        for i, p in enumerate(reversed(rainfall_seq[:ARI_WINDOW_DAYS])):
            ari += (ARI_DECAY_K ** i) * max(p, 0.0)

        # Western Ghats I-D curve sample: I_c = 45 * D^(-0.4)
        duration_h = max(observations.duration_hours, 1.0)
        threshold_intensity = 45.0 * (duration_h ** -0.4)
        actual_intensity = max(observations.rolling_24h_mm, 0.0) / (duration_h if duration_h > 0 else 24.0)

        threshold_crossed = actual_intensity >= threshold_intensity
        # Continuous ramp trigger value [0, 1.0+]
        trigger_val = actual_intensity / threshold_intensity if threshold_intensity > 0 else 0.0

        return TriggerResult(
            trigger_value=round(trigger_val, 4),
            threshold_crossed=threshold_crossed,
            ari_15d=round(ari, 2),
            rainfall_intensity_mm=round(actual_intensity, 2),
            metadata=self._metadata,
        )


class ModelRegistry:
    """Central singleton registry managing active ML model implementations and hot-swapping."""

    def __init__(self) -> None:
        self.landslide_model: LandslideModelProtocol = BaselineLandslideProvider()
        self.flood_model: FloodSurfaceProtocol = BaselineFloodProvider()
        self.vulnerability_model: VulnerabilityDownscalerProtocol = BaselineVulnerabilityProvider()
        self.trigger_model: TriggerThresholdProtocol = BaselineTriggerProvider()
        logger.info("ModelRegistry initialized with default baseline heuristic providers.")

    def register_landslide_model(self, model: LandslideModelProtocol) -> None:
        logger.info(f"Registering landslide model: {model.metadata.model_name} ({model.metadata.model_version})")
        self.landslide_model = model

    def register_flood_model(self, model: FloodSurfaceProtocol) -> None:
        logger.info(f"Registering flood model: {model.metadata.model_name} ({model.metadata.model_version})")
        self.flood_model = model

    def register_vulnerability_model(self, model: VulnerabilityDownscalerProtocol) -> None:
        logger.info(f"Registering vulnerability model: {model.metadata.model_name} ({model.metadata.model_version})")
        self.vulnerability_model = model

    def register_trigger_model(self, model: TriggerThresholdProtocol) -> None:
        logger.info(f"Registering trigger model: {model.metadata.model_name} ({model.metadata.model_version})")
        self.trigger_model = model

    def reset(self) -> None:
        """Resets all registered models back to default baseline heuristic providers."""
        self.landslide_model = BaselineLandslideProvider()
        self.flood_model = BaselineFloodProvider()
        self.vulnerability_model = BaselineVulnerabilityProvider()
        self.trigger_model = BaselineTriggerProvider()
        logger.info("ModelRegistry reset to default baseline heuristic providers.")

    def get_status(self) -> dict[str, dict[str, str]]:
        """Returns metadata of currently active ML model providers."""
        return {
            "landslide": {
                "name": self.landslide_model.metadata.model_name,
                "version": self.landslide_model.metadata.model_version,
                "provider": self.landslide_model.metadata.provider,
            },
            "flood": {
                "name": self.flood_model.metadata.model_name,
                "version": self.flood_model.metadata.model_version,
                "provider": self.flood_model.metadata.provider,
            },
            "vulnerability": {
                "name": self.vulnerability_model.metadata.model_name,
                "version": self.vulnerability_model.metadata.model_version,
                "provider": self.vulnerability_model.metadata.provider,
            },
            "trigger": {
                "name": self.trigger_model.metadata.model_name,
                "version": self.trigger_model.metadata.model_version,
                "provider": self.trigger_model.metadata.provider,
            },
        }


# Global model registry instance
model_registry = ModelRegistry()
