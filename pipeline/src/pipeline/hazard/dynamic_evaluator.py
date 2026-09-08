"""Dynamic Hazard Domain Evaluator (B7).

Orchestrates static terrain susceptibilities and dynamic observed/forecast triggers
to evaluate dynamic hazard scores, Multi-Hazard Index (live and forecast),
dominant hazard, and zone classification conforming strictly to PRD §6.3.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional

from core.constants import BETA, HAZARD_WEIGHTS
from core.enums import Hazard, ZoneClass
from core.domain.hazard import (
    classify_zone,
    compute_hazard_score,
    compute_mhi,
    get_dominant_hazard,
)

logger = logging.getLogger("setu_pipeline.dynamic_evaluator")


@dataclass(frozen=True)
class DynamicCellEvaluation:
    """Evaluation result for an H3 cell at a specific valid_at timestamp."""
    h3: int
    mhi_static: float
    mhi_live: float
    mhi_fcst: Optional[float]
    dominant_hazard: Hazard
    zone_class: ZoneClass
    hazard_scores_live: dict[Hazard, float] = field(default_factory=dict)
    hazard_scores_fcst: dict[Hazard, float] = field(default_factory=dict)


class DynamicHazardEvaluator:
    """Pure domain evaluator for dynamic multi-hazard scoring and classification."""

    def __init__(
        self,
        beta: float = BETA,
        hazard_weights: Optional[Mapping[Hazard, float]] = None,
    ) -> None:
        self.beta = beta
        self.hazard_weights = dict(hazard_weights if hazard_weights is not None else HAZARD_WEIGHTS)

    def evaluate_cell(
        self,
        h3: int,
        static_susceptibilities: Mapping[Hazard | str, float],
        live_triggers: Optional[Mapping[Hazard | str, float]] = None,
        forecast_triggers: Optional[Mapping[Hazard | str, float]] = None,
        existing_mhi_live: Optional[float] = None,
        existing_mhi_fcst: Optional[float] = None,
        has_fatal_event_25yr: bool = False,
    ) -> DynamicCellEvaluation:
        """Evaluates a single cell combining static susceptibility with live and forecast triggers.
        
        Args:
            h3: 64-bit integer H3 index.
            static_susceptibilities: Map of hazard_type -> static susceptibility S_h in [0, 1].
            live_triggers: Map of hazard_type -> observed trigger value T_h (if observed triggers present).
            forecast_triggers: Map of hazard_type -> forecast trigger value T_fcst (if forecast triggers present).
            existing_mhi_live: Existing persisted mhi_live for this (h3, valid_at), if any (for safe merging).
            existing_mhi_fcst: Existing persisted mhi_fcst for this (h3, valid_at), if any (for safe merging).
            has_fatal_event_25yr: Whether cell had a fatal disaster event in the last 25 years.
        """
        # 1. Normalize static susceptibilities map
        static_map: dict[Hazard, float] = {}
        for k, v in static_susceptibilities.items():
            h_enum = k if isinstance(k, Hazard) else Hazard(str(k))
            static_map[h_enum] = max(0.0, min(1.0, float(v)))

        # 2. Compute baseline MHI_static
        mhi_static = compute_mhi(static_map, weights=self.hazard_weights)
        max_susceptibility = max(static_map.values()) if static_map else 0.0

        # 3. Compute Live Dynamic Hazard Scores and MHI_live
        hazard_scores_live: dict[Hazard, float] = {}
        if live_triggers is not None:
            # Normalize live triggers map
            normalized_live: dict[Hazard, float] = {}
            for k, v in live_triggers.items():
                h_enum = k if isinstance(k, Hazard) else Hazard(str(k))
                if v is not None:
                    normalized_live[h_enum] = float(v)

            # Evaluate each hazard: if triggered, amplify; if not triggered, retain static floor S_h
            for h_enum, s_val in static_map.items():
                if h_enum in normalized_live:
                    t_val = normalized_live[h_enum]
                    hazard_scores_live[h_enum] = compute_hazard_score(
                        susceptibility=s_val,
                        trigger_value=t_val,
                        beta=self.beta,
                    )
                else:
                    # Inactive hazard retains static baseline floor
                    hazard_scores_live[h_enum] = s_val

            mhi_live = compute_mhi(hazard_scores_live, weights=self.hazard_weights)
        elif existing_mhi_live is not None:
            # Preserve existing live calculation when this run only processes forecast
            mhi_live = existing_mhi_live
        else:
            # Default when no live trigger has ever fired: live risk equals static baseline
            mhi_live = mhi_static

        # 4. Compute Forecast Dynamic Hazard Scores and MHI_fcst
        hazard_scores_fcst: dict[Hazard, float] = {}
        if forecast_triggers is not None:
            # Normalize forecast triggers map
            normalized_fcst: dict[Hazard, float] = {}
            for k, v in forecast_triggers.items():
                h_enum = k if isinstance(k, Hazard) else Hazard(str(k))
                if v is not None:
                    normalized_fcst[h_enum] = float(v)

            for h_enum, s_val in static_map.items():
                if h_enum in normalized_fcst:
                    t_val = normalized_fcst[h_enum]
                    hazard_scores_fcst[h_enum] = compute_hazard_score(
                        susceptibility=s_val,
                        trigger_value=t_val,
                        beta=self.beta,
                    )
                else:
                    hazard_scores_fcst[h_enum] = s_val

            mhi_fcst = compute_mhi(hazard_scores_fcst, weights=self.hazard_weights)
        elif existing_mhi_fcst is not None:
            # Preserve existing forecast calculation when this run only processes live
            mhi_fcst = existing_mhi_fcst
        else:
            # No forecast data available: preserve truthful NULL semantics
            mhi_fcst = None

        # 5. Determine Dominant Hazard
        # Order of evaluation: live dynamic scores if triggered, else forecast dynamic scores if triggered, else static
        if live_triggers is not None and hazard_scores_live:
            dominant_h, _ = get_dominant_hazard(hazard_scores_live, weights=self.hazard_weights)
        elif forecast_triggers is not None and hazard_scores_fcst:
            dominant_h, _ = get_dominant_hazard(hazard_scores_fcst, weights=self.hazard_weights)
        elif static_map:
            dominant_h, _ = get_dominant_hazard(static_map, weights=self.hazard_weights)
        else:
            dominant_h = Hazard.LANDSLIDE

        # 6. Classify Zone
        # In B7, zone_class represents the static hazard zone classification (permanent_red, caution, none).
        # Transient weather triggers must NOT mutate zone_class into active_alert or forecast_alert,
        # which would conflate static relocation triage classification with transient alert states.
        # Transient alert states belong to B6 + M18.
        zone_cls = classify_zone(
            mhi_static=mhi_static,
            max_susceptibility=max_susceptibility,
            has_fatal_event_25yr=has_fatal_event_25yr,
            mhi_live=0.0,
            mhi_fcst=None,
        )

        return DynamicCellEvaluation(
            h3=h3,
            mhi_static=mhi_static,
            mhi_live=mhi_live,
            mhi_fcst=mhi_fcst,
            dominant_hazard=dominant_h,
            zone_class=zone_cls,
            hazard_scores_live=hazard_scores_live,
            hazard_scores_fcst=hazard_scores_fcst,
        )
