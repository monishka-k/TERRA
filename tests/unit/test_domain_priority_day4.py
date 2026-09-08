"""Unit tests for Day 4 configurable priority scoring, triage rules, and alert isolation invariant.

Section refs: docs/PRD1.md §6.6, §6.7, §14.1
"""

import pytest
from core.domain.priority import (
    PriorityScoringConfig,
    PriorityScoringEngine,
    TriageRuleConfig,
    classify_triage_tier,
    evaluate_triage_with_rationale,
)
from core.enums import Tier


class TestPriorityScoringAndTriageDay4:
    def test_configurable_priority_scoring_custom_gamma(self):
        """Priority score with customized loss weight gamma and formula versions."""
        config_standard = PriorityScoringConfig(loss_gamma=0.5)
        config_high_loss = PriorityScoringConfig(loss_gamma=1.0)

        # h=0.8, f=0.5, v=0.5 -> base=0.20; loss=2.0
        # standard: 0.20 * (1 + 0.5*2.0) = 0.20 * 2.0 = 0.40
        # high_loss: 0.20 * (1 + 1.0*2.0) = 0.20 * 3.0 = 0.60
        score_std = config_standard.calculate_score(
            hazard_intensity=0.8,
            pop_fraction_in_prz=0.5,
            vulnerability_index=0.5,
            decayed_loss=2.0,
        )
        score_high = config_high_loss.calculate_score(
            hazard_intensity=0.8,
            pop_fraction_in_prz=0.5,
            vulnerability_index=0.5,
            decayed_loss=2.0,
        )

        assert pytest.approx(score_std, 0.001) == 0.40
        assert pytest.approx(score_high, 0.001) == 0.60

    def test_priority_score_linear_additive_formula(self):
        """Replaceable formula evaluation (linear additive formulation)."""
        config_linear = PriorityScoringConfig(
            formula_type="linear_additive",
            loss_gamma=0.5,
            scoring_version="priority-linear-v2",
        )
        # h=0.5, f=0.5, v=0.5 -> base = 0.4*0.5 + 0.3*0.5 + 0.3*0.5 = 0.50
        # loss=1.0 -> 0.50 * 1.5 = 0.75
        score = config_linear.calculate_score(
            hazard_intensity=0.5,
            pop_fraction_in_prz=0.5,
            vulnerability_index=0.5,
            decayed_loss=1.0,
        )
        assert pytest.approx(score, 0.001) == 0.75

    def test_priority_score_edge_cases(self):
        """Zero hazard, zero exposure, zero loss edge cases."""
        config = PriorityScoringConfig()
        assert config.calculate_score(0.0, 0.5, 0.5, 1.0) == 0.0
        assert config.calculate_score(0.8, 0.0, 0.5, 1.0) == 0.0
        assert config.calculate_score(0.8, 0.5, 0.0, 1.0) == 0.0
        # Zero loss should leave base risk unamplified: 0.8 * 0.5 * 0.5 * 1.0 = 0.20
        assert pytest.approx(config.calculate_score(0.8, 0.5, 0.5, 0.0), 0.001) == 0.20

    def test_alert_isolation_invariant_active_alerts_do_not_alter_relocation_tier(self):
        """CRITICAL INVARIANT: Active alerts and Forecast alerts MUST NOT change permanent relocation tier.
        
        Permanent relocation is governed by static/chronic risk.
        Emergency evacuation is governed by dynamic alerts.
        """
        # Case A: Caution zone with adverse trend (Medium-term)
        tier_baseline = classify_triage_tier(
            has_prz_overlap=False,
            active_deformation=False,
            fatal_event_last_3_monsoons=False,
            pop_fraction_in_prz=0.0,
            hazard_intensity=0.55,
            priority_score=0.15,
            is_caution_with_adverse_trend=True,
            has_active_trigger=False,
        )
        assert tier_baseline == Tier.MEDIUM_TERM

        # When an active rainfall trigger / active alert occurs, relocation tier MUST remain MEDIUM_TERM
        tier_during_active_alert = classify_triage_tier(
            has_prz_overlap=False,
            active_deformation=False,
            fatal_event_last_3_monsoons=False,
            pop_fraction_in_prz=0.0,
            hazard_intensity=0.55,
            priority_score=0.15,
            is_caution_with_adverse_trend=True,
            has_active_trigger=True,  # Active emergency trigger
        )
        assert tier_during_active_alert == Tier.MEDIUM_TERM

        # Case B: Mitigate in-situ settlement
        tier_mitigate = classify_triage_tier(
            has_prz_overlap=True,
            pop_fraction_in_prz=0.15,
            in_situ_cost_cheaper=True,
            has_active_trigger=True,
        )
        assert tier_mitigate == Tier.MITIGATE_IN_SITU

    def test_triage_evaluation_with_detailed_rationale(self):
        """Verifies triage tier classification generates clear explainable rationale."""
        res_imm = evaluate_triage_with_rationale(
            has_prz_overlap=True,
            active_deformation=True,
            fatal_event_last_3_monsoons=True,
        )
        assert res_imm.tier == Tier.IMMEDIATE
        assert "Active ground deformation" in res_imm.rationale
        assert "Fatal mass-wasting event" in res_imm.rationale

        res_mitigate = evaluate_triage_with_rationale(
            has_prz_overlap=True,
            pop_fraction_in_prz=0.10,
            in_situ_cost_cheaper=True,
        )
        assert res_mitigate.tier == Tier.MITIGATE_IN_SITU
        assert "in-situ" in res_mitigate.rationale.lower()

    def test_priority_scoring_engine_full_evaluation(self):
        """PriorityScoringEngine executes complete evaluation and factor decomposition."""
        engine = PriorityScoringEngine()
        result = engine.evaluate_habitation(
            hazard_intensity=0.85,
            pop_fraction_in_prz=0.80,
            vulnerability_index=0.60,
            decayed_loss=1.20,
            population=2500,
            active_deformation=True,
            fatal_event_last_3_monsoons=True,
        )

        assert result["priority_score"] > 0.50
        assert result["caseload_score"] == round(result["priority_score"] * 2500, 2)
        assert result["tier"] == Tier.IMMEDIATE
        assert len(result["contributing_factors"]) == 4
        assert result["scoring_version"] == "priority-v1.0"
