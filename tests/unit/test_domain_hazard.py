"""Unit tests for pure domain hazard calculations, MHI union, and zone classification."""

import pytest
from core.domain.hazard import (
    compute_hazard_score,
    compute_mhi,
    get_dominant_hazard,
    classify_zone,
)
from core.enums import Hazard, ZoneClass


def test_hazard_score_zero_susceptibility_invariant():
    """FR-3.3 Invariant: S_h == 0 MUST result in H_h == 0 regardless of trigger."""
    assert compute_hazard_score(susceptibility=0.0, trigger_value=10.0, beta=1.0) == 0.0
    assert compute_hazard_score(susceptibility=0.0, trigger_value=0.0, beta=1.0) == 0.0


def test_hazard_score_amplification_and_clamping():
    """FR-3.2: H_h = clamp(S_h * (1 + beta * T_h), 0, 1)."""
    # S=0.5, T=0.5, beta=1.0 -> 0.5 * (1 + 0.5) = 0.75
    assert compute_hazard_score(susceptibility=0.5, trigger_value=0.5, beta=1.0) == 0.75
    # S=0.8, T=1.0, beta=1.0 -> 0.8 * 2.0 = 1.6 -> clamp to 1.0
    assert compute_hazard_score(susceptibility=0.8, trigger_value=1.0, beta=1.0) == 1.0


def test_mhi_probabilistic_union():
    """FR-3.4: MHI = 1 - Prod(1 - w_h * H_h)."""
    scores = {
        Hazard.LANDSLIDE: 0.5,       # w=1.0 -> 1 - 0.5 = 0.5
        Hazard.FLASH_FLOOD: 0.5,     # w=1.0 -> 1 - 0.5 = 0.5
    }
    # MHI = 1 - (0.5 * 0.5) = 0.75
    mhi = compute_mhi(scores)
    assert pytest.approx(mhi, 0.001) == 0.75


def test_dominant_hazard_detection():
    """FR-3.7: dominant_hazard = argmax_h (w_h * H_h)."""
    scores = {
        Hazard.COASTAL_EROSION: 0.8, # w=0.7 -> 0.56
        Hazard.LANDSLIDE: 0.6,       # w=1.0 -> 0.60
    }
    dominant, val = get_dominant_hazard(scores)
    assert dominant == Hazard.LANDSLIDE
    assert pytest.approx(val, 0.001) == 0.60


def test_classify_permanent_red_zone():
    """FR-3.8: PRZ conditions."""
    # 1. Static MHI >= 0.75
    assert classify_zone(mhi_static=0.76) == ZoneClass.PERMANENT_RED

    # 2. Any single hazard S_h >= 0.85
    assert classify_zone(mhi_static=0.50, max_susceptibility=0.86) == ZoneClass.PERMANENT_RED

    # 3. Fatal event in 25 yr and MHI_static >= 0.60
    assert classify_zone(mhi_static=0.62, has_fatal_event_25yr=True) == ZoneClass.PERMANENT_RED


def test_classify_caution_and_alert_zones():
    """FR-3.9, FR-3.10, FR-3.12."""
    # Caution zone: 0.45 <= MHI_static < 0.75
    assert classify_zone(mhi_static=0.55) == ZoneClass.CAUTION

    # Active alert: live trigger crosses 0.75 while static < 0.75
    assert classify_zone(mhi_static=0.30, mhi_live=0.80) == ZoneClass.ACTIVE_ALERT

    # Forecast alert: 72h forecast crosses 0.75 while static and live < 0.75
    assert classify_zone(mhi_static=0.30, mhi_live=0.40, mhi_fcst=0.85) == ZoneClass.FORECAST_ALERT

    # None
    assert classify_zone(mhi_static=0.20, mhi_live=0.20) == ZoneClass.NONE
