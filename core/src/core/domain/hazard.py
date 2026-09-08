"""Pure domain logic for hazard calculation, MHI combination, and zone classification.

Section refs: docs/PRD1.md §6.3, §14.1
"""

from datetime import datetime, timezone
from typing import Any, Mapping, Optional
from core.constants import (
    ACTIVE_ALERT_MHI_LIVE,
    BETA,
    CAUTION_MHI_MIN,
    HAZARD_WEIGHTS,
    MAX_TRIGGER_AGE_HOURS,
    PRZ_ANY_SUSCEPTIBILITY,
    PRZ_FATAL_EVENT_MHI,
    PRZ_MHI_STATIC,
)
from core.enums import DataQuality, Hazard, ZoneClass


def compute_hazard_score(
    susceptibility: float,
    trigger_value: float = 0.0,
    beta: float = BETA,
) -> float:
    """Computes per-hazard score H_h(c, t) = clamp(S_h(c) * (1 + beta * T_h(c, t)), 0, 1).
    
    Invariant (FR-3.3): If susceptibility == 0, score is strictly 0.0 regardless of trigger.
    """
    if susceptibility <= 0.0:
        return 0.0

    s = min(max(susceptibility, 0.0), 1.0)
    t = max(trigger_value, 0.0)
    score = s * (1.0 + beta * t)
    return min(max(score, 0.0), 1.0)


def compute_mhi(
    hazard_scores: Mapping[Hazard | str, float],
    weights: Mapping[Hazard | str, float] | None = None,
) -> float:
    """Computes Multi-Hazard Index via probabilistic union:
    MHI = 1 - Prod_h (1 - w_h * H_h).
    
    PRD §6.3, FR-3.4
    """
    active_weights = weights or HAZARD_WEIGHTS

    prob_complement_product = 1.0
    for hazard_key, score in hazard_scores.items():
        # Map string to enum if necessary
        hazard_enum = hazard_key if isinstance(hazard_key, Hazard) else Hazard(str(hazard_key))
        w_val = active_weights.get(hazard_enum)
        w = float(w_val if w_val is not None else 1.0)
        clamped_score = min(max(score, 0.0), 1.0)
        weighted_term = min(max(w * clamped_score, 0.0), 1.0)
        prob_complement_product *= (1.0 - weighted_term)

    mhi = 1.0 - prob_complement_product
    return min(max(mhi, 0.0), 1.0)


def get_dominant_hazard(
    hazard_scores: Mapping[Hazard | str, float],
    weights: Mapping[Hazard | str, float] | None = None,
) -> tuple[Hazard, float]:
    """Finds dominant hazard = argmax_h (w_h * H_h) and its weighted score.
    
    PRD §6.3, FR-3.7
    """
    active_weights = weights or HAZARD_WEIGHTS
    max_hazard = Hazard.LANDSLIDE
    max_val = -1.0

    for hazard_key, score in hazard_scores.items():
        hazard_enum = hazard_key if isinstance(hazard_key, Hazard) else Hazard(str(hazard_key))
        w_val = active_weights.get(hazard_enum)
        w = float(w_val if w_val is not None else 1.0)
        weighted_score = w * min(max(score, 0.0), 1.0)
        if weighted_score > max_val:
            max_val = weighted_score
            max_hazard = hazard_enum

    return max_hazard, max(max_val, 0.0)


def classify_zone(
    mhi_static: float,
    max_susceptibility: float = 0.0,
    has_fatal_event_25yr: bool = False,
    mhi_live: float = 0.0,
    mhi_fcst: float | None = None,
) -> ZoneClass:
    """Classifies cell into Permanent Red, Caution, Active Alert, Forecast Alert, or None.
    
    Rules (PRD §6.3, FR-3.8, FR-3.9, FR-3.10, FR-3.12):
    1. Permanent Red Zone (PRZ):
       - MHI_static >= 0.75 OR
       - any S_h >= 0.85 OR
       - fatal event in 25 yr with MHI_static >= 0.60
    2. Caution Zone:
       - 0.45 <= MHI_static < 0.75
    3. Active Alert Zone:
       - MHI_live >= 0.75 AND MHI_static < 0.75
    4. Forecast Alert Zone:
       - MHI_fcst >= 0.75 AND MHI_static < 0.75 AND MHI_live < 0.75
    5. None: otherwise.
    """
    # 1. Permanent Red Zone
    if (
        mhi_static >= PRZ_MHI_STATIC
        or max_susceptibility >= PRZ_ANY_SUSCEPTIBILITY
        or (has_fatal_event_25yr and mhi_static >= PRZ_FATAL_EVENT_MHI)
    ):
        return ZoneClass.PERMANENT_RED

    # 2. Active Alert Zone (Live trigger crossing threshold)
    if mhi_live >= ACTIVE_ALERT_MHI_LIVE:
        return ZoneClass.ACTIVE_ALERT

    # 3. Forecast Alert Zone (72h prediction crossing threshold)
    if mhi_fcst is not None and mhi_fcst >= ACTIVE_ALERT_MHI_LIVE:
        return ZoneClass.FORECAST_ALERT

    # 4. Caution Zone
    if mhi_static >= CAUTION_MHI_MIN:
        return ZoneClass.CAUTION

    return ZoneClass.NONE


def evaluate_trigger_freshness(
    valid_at: datetime,
    as_of: Optional[datetime] = None,
    max_age_hours: float = MAX_TRIGGER_AGE_HOURS,
    source: Optional[str] = None,
) -> dict[str, Any]:
    """Evaluates dynamic trigger freshness according to H5 canonical rules.
    
    Age is computed as (as_of - valid_at).
    - Fresh: 0.0 <= age_hours <= max_age_hours
    - Stale: age_hours > max_age_hours
    
    Returns a dict with:
        age_hours: float (rounded to 2 decimal places)
        is_fresh: bool
        status: 'fresh' | 'stale' | 'future'
        data_quality: DataQuality (STALE if stale; SYNTHETIC if synthetic/demo; VALID otherwise)
    """
    as_of_dt = as_of or datetime.now(timezone.utc)
    if valid_at.tzinfo is None:
        valid_at = valid_at.replace(tzinfo=timezone.utc)
    if as_of_dt.tzinfo is None:
        as_of_dt = as_of_dt.replace(tzinfo=timezone.utc)

    diff_seconds = (as_of_dt - valid_at).total_seconds()
    age_hours = round(diff_seconds / 3600.0, 4)

    is_fresh = (0.0 <= age_hours <= max_age_hours)

    if age_hours > max_age_hours:
        quality = DataQuality.STALE
        status = "stale"
    elif age_hours < 0.0:
        quality = DataQuality.SYNTHETIC if (source == "SYNTHETIC_DEMO" or (source and source.startswith("SYNTHETIC"))) else DataQuality.VALID
        status = "future"
    else:
        is_synthetic = (source == "SYNTHETIC_DEMO" or (source and source.startswith("SYNTHETIC")))
        quality = DataQuality.SYNTHETIC if is_synthetic else DataQuality.VALID
        status = "fresh"

    return {
        "age_hours": round(age_hours, 2),
        "is_fresh": is_fresh,
        "status": status,
        "data_quality": quality,
    }
