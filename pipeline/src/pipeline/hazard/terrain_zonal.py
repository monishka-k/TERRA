"""Terrain Zonal Statistics & Baseline Hazard Evaluation (L2).

Extracts and evaluates terrain features per H3 cell and passes them
through the baseline heuristic ML providers to produce static susceptibility,
MHI snapshot, and heuristic explanations conforming to the domain contract.
"""

from typing import Any, Sequence
from datetime import datetime, timezone
import math

from core.enums import Hazard, ZoneClass
from core.ml.types import LandslideFeatures, FloodFeatures
from core.ml.protocols import LandslideModelProtocol, FloodSurfaceProtocol
from core.ml.registry import model_registry, ModelRegistry
from core.domain.hazard import compute_mhi, get_dominant_hazard, classify_zone
from core.constants import SCREENING_GRADE_NOTICE


class TerrainHazardEvaluator:
    """Evaluates terrain features and computes static multi-hazard scores and explanations."""

    def __init__(
        self,
        landslide_provider: LandslideModelProtocol | None = None,
        flood_provider: FloodSurfaceProtocol | None = None,
        registry: ModelRegistry | None = None,
    ) -> None:
        reg = registry if registry is not None else model_registry
        self.landslide_provider = (
            landslide_provider if landslide_provider is not None else reg.landslide_model
        )
        self.flood_provider = (
            flood_provider if flood_provider is not None else reg.flood_model
        )

    def evaluate_cell(
        self,
        h3_int: int,
        elevation_m: float,
        slope_deg: float,
        aspect_deg: float = 0.0,
        local_relief_m: float = 100.0,
        dist_to_road_m: float = 500.0,
        dist_to_stream_m: float = 200.0,
        hand_m: float = 10.0,
        twi: float = 8.0,
        has_fatal_event_25yr: bool = False,
        valid_at: datetime | None = None,
    ) -> dict[str, Any]:
        """Evaluates static multi-hazard metrics for a single H3 cell."""
        valid_timestamp = valid_at or datetime.now(timezone.utc)

        # 1. Landslide feature evaluation
        ls_features = LandslideFeatures(
            slope_deg=slope_deg,
            aspect_deg=aspect_deg,
            curvature_plan=0.0,
            curvature_profile=0.0,
            twi=twi,
            local_relief_m=local_relief_m,
            dist_to_road_m=dist_to_road_m,
            dist_to_stream_m=dist_to_stream_m,
            ndvi=0.6,
            soil_class=1,
            mean_annual_rainfall_mm=2500.0,
        )
        ls_pred = self.landslide_provider.predict(ls_features)

        # 2. Flood feature evaluation
        fl_features = FloodFeatures(
            hand_m=hand_m,
            twi=twi,
            elevation_above_river_m=hand_m,
            historical_sar_inundation_freq=0.0,
        )
        fl_pred = self.flood_provider.predict(fl_features)

        # 3. Hazard scores mapping
        hazard_scores = {
            Hazard.LANDSLIDE: ls_pred.susceptibility,
            Hazard.FLASH_FLOOD: fl_pred.susceptibility,
            Hazard.RIVERINE_FLOOD: max(0.0, fl_pred.susceptibility * 0.8),
            Hazard.STORM_SURGE: 0.0,
            Hazard.COASTAL_EROSION: 0.0,
        }

        # 4. Multi-Hazard Index (Probabilistic Union)
        mhi_static = compute_mhi(hazard_scores)
        dominant_hazard, max_weighted_score = get_dominant_hazard(hazard_scores)

        # 5. Zone Classification
        max_susceptibility = max(hazard_scores.values())
        zone_class = classify_zone(
            mhi_static=mhi_static,
            max_susceptibility=max_susceptibility,
            has_fatal_event_25yr=has_fatal_event_25yr,
            mhi_live=0.0,
            mhi_fcst=None,
        )

        # 6. Explanation factors (Combining top factors)
        combined_factors = []
        for c in ls_pred.explanation:
            combined_factors.append({
                "feature": c.feature,
                "value": c.value,
                "contribution": c.contribution,
                "method": getattr(c, "method", "heuristic") or "heuristic",
            })
        for c in fl_pred.explanation:
            combined_factors.append({
                "feature": c.feature,
                "value": c.value,
                "contribution": c.contribution,
                "method": getattr(c, "method", "heuristic") or "heuristic",
            })
        # Sort factors by absolute contribution DESC
        combined_factors.sort(key=lambda x: abs(x["contribution"]), reverse=True)

        return {
            "h3": h3_int,
            "valid_at": valid_timestamp,
            "hazard_statics": [
                {
                    "h3": h3_int,
                    "hazard_type": Hazard.LANDSLIDE.value,
                    "susceptibility": ls_pred.susceptibility,
                    "confidence": ls_pred.confidence,
                    "model_version": ls_pred.metadata.model_version,
                },
                {
                    "h3": h3_int,
                    "hazard_type": Hazard.FLASH_FLOOD.value,
                    "susceptibility": fl_pred.susceptibility,
                    "confidence": fl_pred.confidence,
                    "model_version": fl_pred.metadata.model_version,
                },
            ],
            "mhi_snapshot": {
                "h3": h3_int,
                "valid_at": valid_timestamp,
                "mhi_static": mhi_static,
                "mhi_live": mhi_static,  # In Day 2 static baseline, live matches static
                "mhi_fcst": None,
                "dominant_hazard": dominant_hazard.value,
                "zone_class": zone_class.value,
            },
            "explanation": {
                "h3": h3_int,
                "model_version": ls_pred.metadata.model_version,
                "factors": combined_factors[:5],  # Top 5 factors
                "screening_grade": SCREENING_GRADE_NOTICE,
            },
        }
