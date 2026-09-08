"""Unit tests for exposure, loss history decay, priority scoring, and triage tiers."""

import pytest
from datetime import date
from core.domain.priority import (
    compute_time_decayed_loss,
    compute_priority_score,
    classify_triage_tier,
    sort_habitations,
)
from core.enums import Tier, SortMode


def test_time_decayed_loss_half_life():
    """FR-6.2: Event exactly 10 years ago should have weight 0.5."""
    ref_date = date(2026, 8, 30)
    event_10y_ago = {"ts": date(2016, 8, 30), "severity": 1.0}
    event_today = {"ts": date(2026, 8, 30), "severity": 1.0}

    decayed_10y = compute_time_decayed_loss([event_10y_ago], reference_date=ref_date)
    decayed_today = compute_time_decayed_loss([event_today], reference_date=ref_date)

    assert pytest.approx(decayed_today, 0.01) == 1.0
    assert pytest.approx(decayed_10y, 0.01) == 0.5


def test_priority_score_formula():
    """FR-6.1: PS_j = (h * f * V) * (1 + gamma * L)."""
    # h=0.8, f=0.5, V=0.6 -> base_risk = 0.24
    # L=1.0, gamma=0.5 -> 0.24 * 1.5 = 0.36
    score = compute_priority_score(
        hazard_intensity=0.8,
        pop_fraction_in_prz=0.5,
        vulnerability_index=0.6,
        decayed_loss=1.0,
        gamma=0.5,
    )
    assert pytest.approx(score, 0.001) == 0.36


def test_classify_triage_tiers():
    """FR-6.7: Tier classification rules."""
    # Immediate: PRZ overlap + active deformation
    assert classify_triage_tier(has_prz_overlap=True, active_deformation=True) == Tier.IMMEDIATE

    # Immediate: Fatal event in last 3 monsoons
    assert classify_triage_tier(has_prz_overlap=True, fatal_event_last_3_monsoons=True) == Tier.IMMEDIATE

    # Mitigate in situ: small footprint and mitigation cheaper than relocation
    assert classify_triage_tier(
        has_prz_overlap=True,
        pop_fraction_in_prz=0.15,
        in_situ_cost_cheaper=True,
    ) == Tier.MITIGATE_IN_SITU

    # Short-term: PRZ overlap without active emergency
    assert classify_triage_tier(has_prz_overlap=True) == Tier.SHORT_TERM

    # Medium-term: Caution zone with adverse trend
    assert classify_triage_tier(has_prz_overlap=False, is_caution_with_adverse_trend=True) == Tier.MEDIUM_TERM


def test_sort_habitations_urgency_vs_caseload():
    """FR-6.3: Dual sorting by Urgency (PS) and Caseload (PS * pop)."""
    habs = [
        {"id": 1, "name": "Small High Risk", "priority_score": 0.8, "population": 100},  # Caseload: 80
        {"id": 2, "name": "Large Med Risk", "priority_score": 0.4, "population": 1000}, # Caseload: 400
    ]

    urgency_sorted = sort_habitations(habs, mode=SortMode.URGENCY)
    assert urgency_sorted[0]["id"] == 1
    assert urgency_sorted[1]["id"] == 2

    caseload_sorted = sort_habitations(habs, mode=SortMode.CASELOAD)
    assert caseload_sorted[0]["id"] == 2
    assert caseload_sorted[1]["id"] == 1
