"""Sentinel-1 Flood Surface Provider (Day 3).

Implements FloodSurfaceProtocol using empirical Sentinel-1 SAR inundation history
combined with HAND terrain metrics, without inventing arbitrary formulas.
"""

import math
import logging
from typing import Optional

from core.ml.types import (
    ModelMetadata,
    FeatureContribution,
    HazardPrediction,
    FloodFeatures,
)
from core.ml.protocols import FloodSurfaceProtocol

logger = logging.getLogger("setu_core.ml.sentinel1")


class Sentinel1FloodProvider:
    """Empirical flood susceptibility provider leveraging Sentinel-1 SAR water-mask observations."""

    def __init__(self, version: str = "s1-v1.0") -> None:
        self._metadata = ModelMetadata(
            model_name="sentinel1_sar_flood_surface",
            model_version=version,
            feature_schema_version="v1.0",
            provider="sentinel1_sar",
        )

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    def predict(self, features: FloodFeatures) -> HazardPrediction:
        """Predicts flood susceptibility S_flood using empirical SAR inundation frequency and HAND.
        
        Formula adheres to established repository BaselineFloodProvider computation:
        - hand_risk = exp(-0.4 * hand_m)
        - twi_risk = clamp(twi / 15.0, 0, 1) * 0.2
        - sar_risk = clamp(historical_sar_inundation_freq, 0, 1) * 0.3
        - raw_score = hand_risk * 0.5 + twi_risk + sar_risk
        - susceptibility = clamp(raw_score, 0.0, 1.0)
        """
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
            FeatureContribution(
                feature="historical_sar_inundation_freq",
                value=features.historical_sar_inundation_freq,
                contribution=round(sar_risk, 4),
                method="empirical_sar",
            ),
        ]

        return HazardPrediction(
            susceptibility=round(susceptibility, 4),
            confidence=0.90,
            explanation=contributions,
            metadata=self._metadata,
        )
