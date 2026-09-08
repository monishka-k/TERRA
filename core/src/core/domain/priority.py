"""Pure domain logic for exposure, loss history decay, priority scoring, and triage tiers.

Section refs: docs/PRD1.md §6.6, §6.7, §14.1
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Mapping, Optional, Sequence

from core.constants import LOSS_HALF_LIFE_YEARS, PRIORITY_GAMMA
from core.enums import SortMode, Tier


@dataclass(frozen=True)
class PriorityScoringConfig:
    """Configurable parameters for policy priority scoring.
    
    Decouples policy decision formulas from underlying ML model predictions.
    """
    hazard_weight: float = 1.0
    exposure_weight: float = 1.0
    vulnerability_weight: float = 1.0
    loss_gamma: float = PRIORITY_GAMMA
    loss_half_life_years: float = LOSS_HALF_LIFE_YEARS
    scoring_version: str = "priority-v1.0"
    formula_type: str = "multiplicative_v1"  # "multiplicative_v1", "linear_additive", "calibrated"

    def calculate_score(
        self,
        hazard_intensity: float,
        pop_fraction_in_prz: float,
        vulnerability_index: float,
        decayed_loss: float = 0.0,
    ) -> float:
        """Calculates normalized priority score PS_j in [0.0, inf)."""
        h = min(max(float(hazard_intensity), 0.0), 1.0) * self.hazard_weight
        f = min(max(float(pop_fraction_in_prz), 0.0), 1.0) * self.exposure_weight
        v = min(max(float(vulnerability_index), 0.0), 1.0) * self.vulnerability_weight
        l = max(float(decayed_loss), 0.0)

        if self.formula_type == "linear_additive":
            base = 0.4 * h + 0.3 * f + 0.3 * v
            score = base * (1.0 + self.loss_gamma * l)
        else:
            # Standard multiplicative formulation (PRD §6.6, FR-6.1)
            base_risk = h * f * v
            score = base_risk * (1.0 + self.loss_gamma * l)

        return round(float(score), 4)


@dataclass(frozen=True)
class TriageRuleConfig:
    """Configurable threshold criteria for triage tier classification."""
    immediate_prz_pop_min: float = 0.60
    immediate_hazard_min: float = 0.85
    mitigate_in_situ_prz_pop_max: float = 0.30
    short_term_prz_overlap_min: float = 30.0
    short_term_priority_min: float = 0.30


@dataclass
class TriageEvaluationResult:
    """Detailed result of triage classification with explanatory rationale."""
    tier: Optional[Tier]
    rationale: str
    trigger_factors: list[str] = field(default_factory=list)


def compute_time_decayed_loss(
    events: Sequence[Mapping[str, Any]],
    reference_date: date | None = None,
    half_life_years: float = LOSS_HALF_LIFE_YEARS,
) -> float:
    """Computes time-decayed loss history:
    L_hat = sum_i e^(-lambda * (t_now - t_i)) * severity_i
    where lambda = ln(2) / half_life_years.
    
    PRD §6.6, FR-6.2
    """
    if not events:
        return 0.0

    today = reference_date or date.today()
    decay_constant = math.log(2.0) / max(half_life_years, 0.001)
    total_decayed_loss = 0.0

    for ev in events:
        ev_date = ev.get("ts")
        if isinstance(ev_date, str):
            ev_date = date.fromisoformat(ev_date)
        elif not isinstance(ev_date, date):
            continue

        delta_days = (today - ev_date).days
        if delta_days < 0:
            delta_days = 0  # clamp future dates
        delta_years = delta_days / 365.25

        sev_raw = ev.get("severity")
        severity = float(sev_raw if sev_raw is not None else 1.0)
        weight = math.exp(-decay_constant * delta_years)
        total_decayed_loss += weight * severity

    return round(total_decayed_loss, 4)


def compute_priority_score(
    hazard_intensity: float,
    pop_fraction_in_prz: float,
    vulnerability_index: float,
    decayed_loss: float = 0.0,
    gamma: float = PRIORITY_GAMMA,
    config: Optional[PriorityScoringConfig] = None,
) -> float:
    """Computes habitation priority score:
    PS_j = (h_hat_j * f_hat_j * V_hat_j) * (1 + gamma * L_hat_j).
    
    PRD §6.6, FR-6.1
    """
    cfg = config or PriorityScoringConfig(loss_gamma=gamma)
    return cfg.calculate_score(
        hazard_intensity=hazard_intensity,
        pop_fraction_in_prz=pop_fraction_in_prz,
        vulnerability_index=vulnerability_index,
        decayed_loss=decayed_loss,
    )


def is_within_last_three_monsoons(event_date: date, reference_date: Optional[date] = None) -> bool:
    """Evaluates whether an event date occurred within the last three Indian monsoon seasons.
    
    The Indian South-West Monsoon runs annually from June 1 to September 30 (JJAS).
    Relative to reference_date (year Y_ref):
    - If reference_date is on or after June 1 of Y_ref, the three monsoon seasons are
      Y_ref - 2, Y_ref - 1, and Y_ref (earliest season starts June 1 of Y_ref - 2).
    - If reference_date is before June 1 of Y_ref, the three most recent completed monsoons
      are Y_ref - 3, Y_ref - 2, and Y_ref - 1 (earliest season starts June 1 of Y_ref - 3).
    """
    ref = reference_date or date.today()
    if event_date > ref:
        return False
    
    current_monsoon_start = date(ref.year, 6, 1)
    if ref >= current_monsoon_start:
        earliest_monsoon_start = date(ref.year - 2, 6, 1)
    else:
        earliest_monsoon_start = date(ref.year - 3, 6, 1)
        
    return event_date >= earliest_monsoon_start


def check_fatal_event_last_3_monsoons(
    events: Sequence[Mapping[str, Any]],
    reference_date: Optional[date] = None,
    max_radius_km: float = 2.0,
) -> bool:
    """Canonical derivation of fatal_event_last_3_monsoons from disaster_event records.
    
    A settlement has a recent fatal event if any nearby event satisfies:
    1. Fatalities > 0
    2. Spatial distance from settlement centroid <= max_radius_km (default 2.0 km)
    3. Event date falls within the last three monsoons relative to reference_date.
    """
    ref = reference_date or date.today()
    for ev in events:
        fatalities = ev.get("fatalities") if ev.get("fatalities") is not None else 0
        if fatalities <= 0:
            continue
        dist = ev.get("distance_km")
        if dist is not None and dist > max_radius_km:
            continue
        ev_date = ev.get("ts")
        if isinstance(ev_date, str):
            ev_date = date.fromisoformat(ev_date)
        if ev_date is None:
            continue
        if is_within_last_three_monsoons(ev_date, ref):
            return True
    return False


def evaluate_in_situ_cost_cheaper(
    mitigation_cost: Optional[float],
    relocation_cost: Optional[float],
) -> bool:
    """Evaluates whether in-situ civil mitigation costs less than relocation (PRD §6.7, FR-6.5).
    
    Invariants (H9):
    - Missing data (None or NaN for either cost) MUST NOT be treated as cheap mitigation
      or expensive relocation; returns False.
    - If mitigation_cost < relocation_cost (and both are non-negative, finite): returns True.
    - If mitigation_cost >= relocation_cost: returns False.
    """
    if mitigation_cost is None or relocation_cost is None:
        return False
    try:
        m_cost = float(mitigation_cost)
        r_cost = float(relocation_cost)
    except (ValueError, TypeError):
        return False

    if not (math.isfinite(m_cost) and math.isfinite(r_cost)):
        return False
    if m_cost < 0.0 or r_cost < 0.0:
        return False

    return m_cost < r_cost


def check_loss_frequency_rising(
    events: Sequence[Mapping[str, Any]],
    reference_date: Optional[date] = None,
    recent_window_years: float = 5.0,
    earlier_window_years: float = 5.0,
    max_radius_km: float = 15.0,
) -> bool:
    """Evaluates whether disaster event loss frequency is rising near a settlement (PRD §6.7).
    
    An adverse trend indicator defined in PRD §6.7:
    Event count in recent window (e.g. last 5 years) > event count in previous window
    of equal duration (e.g. 5-10 years ago), with at least one recent event recorded.
    """
    ref = reference_date or date.today()
    recent_days = recent_window_years * 365.25
    total_days = (recent_window_years + earlier_window_years) * 365.25

    recent_count = 0
    earlier_count = 0

    for ev in events:
        dist = ev.get("distance_km")
        if dist is not None and dist > max_radius_km:
            continue
        ev_date = ev.get("ts")
        if isinstance(ev_date, str):
            ev_date = date.fromisoformat(ev_date)
        if not isinstance(ev_date, date):
            continue

        delta_days = (ref - ev_date).days
        if delta_days < 0:
            continue
        if delta_days <= recent_days:
            recent_count += 1
        elif delta_days <= total_days:
            earlier_count += 1

    return recent_count > earlier_count and recent_count > 0


def classify_triage_tier(
    has_prz_overlap: bool = False,
    active_deformation: bool = False,
    fatal_event_last_3_monsoons: bool = False,
    pop_fraction_in_prz: Optional[float] = None,
    hazard_intensity: float = 0.0,
    priority_score: float = 0.0,
    has_active_trigger: bool = False,
    in_situ_cost_cheaper: Optional[bool] = None,
    is_caution_with_adverse_trend: Optional[bool] = None,
    mitigation_cost: Optional[float] = None,
    relocation_cost: Optional[float] = None,
    adverse_trend: Optional[bool] = None,
    rules: Optional[TriageRuleConfig] = None,
) -> Optional[Tier]:
    """Classifies a habitation into one of 4 permanent triage tiers.
    
    IMPORTANT ARCHITECTURAL INVARIANT:
    Active Alert Zones and Forecast Alert Zones (has_active_trigger) do NOT alter
    the permanent relocation tier. Permanent relocation is determined strictly by
    chronic/static risk, structural deformation, and past fatal recurrence.
    Active alerts dictate immediate emergency evacuation, never permanent resettlement.
    
    Rules (PRD §6.7):
    - Immediate (0-6 mo): PRZ overlap AND (active ground deformation OR fatal event in last 3 monsoons OR (f_j > 0.6 AND h_j > 0.85))
    - Mitigate in situ: Small PRZ fraction (< 0.30) where slope stabilisation / embankment / drainage costs less than relocation
    - Short-term (6-24 mo): Significant PRZ overlap (>= 0.30) AND high priority score (PS >= 0.30) AND no active trigger
    - Medium-term (2-5 yr): Caution Zone with adverse trend (built-up area growing or loss frequency rising) or moderate exposure
    """
    cfg = rules or TriageRuleConfig()

    # 1. Resolve in-situ cost comparison
    if in_situ_cost_cheaper is not None:
        cost_cheaper = bool(in_situ_cost_cheaper)
    else:
        cost_cheaper = evaluate_in_situ_cost_cheaper(mitigation_cost, relocation_cost)

    # 2. Resolve PRZ overlap semantics (PRD §6.7, H9)
    threshold_frac = (
        cfg.short_term_prz_overlap_min / 100.0
        if cfg.short_term_prz_overlap_min > 1.0
        else cfg.short_term_prz_overlap_min
    )
    
    if pop_fraction_in_prz is not None:
        frac = max(0.0, float(pop_fraction_in_prz))
        has_prz = frac > 0.0
        is_small_prz = 0.0 < frac < cfg.mitigate_in_situ_prz_pop_max
        is_significant_prz = frac >= threshold_frac
    else:
        has_prz = bool(has_prz_overlap)
        frac = 0.0
        is_small_prz = False
        is_significant_prz = bool(has_prz_overlap)

    # 3. Resolve adverse trend (PRD §6.7, H9 Review §2)
    # Three-state semantics:
    # - None: unknown / not evaluated
    # - False: evaluated and confirmed no adverse trend
    # - True: evaluated and confirmed positive adverse trend
    # INVARIANT: Only a confirmed True can satisfy the Medium-term rule.
    # Missing / None data must NEVER be treated as a positive adverse trend.
    from core.constants import CAUTION_MHI_MIN, PRZ_MHI_STATIC
    caution_adverse = False
    if is_caution_with_adverse_trend is True:
        caution_adverse = True
    elif adverse_trend is True:
        is_caution_hazard = (CAUTION_MHI_MIN <= hazard_intensity < PRZ_MHI_STATIC) or (0.45 <= hazard_intensity < 0.75)
        caution_adverse = is_caution_hazard

    # ====================================================================
    # PRECEDENCE & DECISION ORDER (PRD §6.7)
    # ====================================================================

    # Tier 1: Immediate Relocation (0-6 months)
    # PRZ overlap AND (active ground deformation OR fatal event in last 3 monsoons OR (f_j > 0.6 AND h_j > 0.85))
    if has_prz and (
        active_deformation
        or fatal_event_last_3_monsoons
        or (frac > cfg.immediate_prz_pop_min and hazard_intensity > cfg.immediate_hazard_min)
    ):
        return Tier.IMMEDIATE

    # Tier 4: Mitigate in situ
    # Small PRZ fraction (< 0.30) AND mitigation cost < relocation cost
    # Mandatory tier to avoid unnecessary permanent relocation when civil works are viable
    if cost_cheaper and (is_small_prz or (pop_fraction_in_prz is None and has_prz)):
        return Tier.MITIGATE_IN_SITU

    # Tier 2: Short-term Relocation (6-24 months)
    # Significant PRZ overlap (>= 30%) or high priority score (PS >= 0.30)
    if is_significant_prz or priority_score >= cfg.short_term_priority_min:
        return Tier.SHORT_TERM

    # Tier 3: Medium-term Relocation (2-5 years)
    # Caution Zone with adverse trend (built-up area growing or loss frequency rising)
    if caution_adverse:
        return Tier.MEDIUM_TERM

    # Safe return for habitations satisfying none of the four explicit PRD triage tiers
    return None


def evaluate_triage_with_rationale(
    has_prz_overlap: bool = False,
    active_deformation: bool = False,
    fatal_event_last_3_monsoons: bool = False,
    pop_fraction_in_prz: Optional[float] = None,
    hazard_intensity: float = 0.0,
    priority_score: float = 0.0,
    in_situ_cost_cheaper: Optional[bool] = None,
    is_caution_with_adverse_trend: bool = False,
    mitigation_cost: Optional[float] = None,
    relocation_cost: Optional[float] = None,
    adverse_trend: Optional[bool] = None,
    rules: Optional[TriageRuleConfig] = None,
) -> TriageEvaluationResult:
    """Evaluates triage tier and provides detailed audit rationale."""
    cfg = rules or TriageRuleConfig()
    tier = classify_triage_tier(
        has_prz_overlap=has_prz_overlap,
        active_deformation=active_deformation,
        fatal_event_last_3_monsoons=fatal_event_last_3_monsoons,
        pop_fraction_in_prz=pop_fraction_in_prz,
        hazard_intensity=hazard_intensity,
        priority_score=priority_score,
        in_situ_cost_cheaper=in_situ_cost_cheaper,
        is_caution_with_adverse_trend=is_caution_with_adverse_trend,
        mitigation_cost=mitigation_cost,
        relocation_cost=relocation_cost,
        adverse_trend=adverse_trend,
        rules=cfg,
    )

    factors = []
    if tier == Tier.IMMEDIATE:
        if active_deformation:
            factors.append("Active ground deformation detected in settlement footprint")
        if fatal_event_last_3_monsoons:
            factors.append("Fatal mass-wasting event recorded within the last 3 monsoons")
        if pop_fraction_in_prz is not None and pop_fraction_in_prz > cfg.immediate_prz_pop_min and hazard_intensity > cfg.immediate_hazard_min:
            factors.append("Critical exposure (>60% population in PRZ with severe hazard intensity >0.85)")
        rationale = (
            "Immediate permanent relocation required (0-6 months): "
            + "; ".join(factors)
        )
    elif tier == Tier.MITIGATE_IN_SITU:
        factors.append("Small PRZ exposure (<30%) and in-situ engineering stabilization costs less than relocation")
        rationale = "Mitigate in-situ: Civil mitigation (embankment/retaining wall) recommended over physical relocation."
    elif tier == Tier.SHORT_TERM:
        if pop_fraction_in_prz is not None and pop_fraction_in_prz >= (cfg.short_term_prz_overlap_min / 100.0 if cfg.short_term_prz_overlap_min > 1.0 else cfg.short_term_prz_overlap_min):
            factors.append("Significant Permanent Red Zone (PRZ) boundary overlap (>=30%)")
        else:
            factors.append("Permanent Red Zone (PRZ) boundary overlap")
        if priority_score >= cfg.short_term_priority_min:
            factors.append(f"High composite priority score ({priority_score:.2f} >= {cfg.short_term_priority_min:.2f})")
        rationale = (
            "Short-term planned relocation required (6-24 months): "
            + "; ".join(factors)
        )
    elif tier == Tier.MEDIUM_TERM:
        factors.append("Caution Zone with adverse trend (built-up growth or rising loss frequency)")
        rationale = (
            "Medium-term planned relocation required (2-5 years): "
            + "; ".join(factors)
        )
    else:
        rationale = "Unclassified / Monitoring: Settlement does not meet criteria for permanent relocation or civil in-situ mitigation."

    return TriageEvaluationResult(tier=tier, rationale=rationale, trigger_factors=factors)


def sort_habitations(
    habitations: list[dict[str, Any]],
    mode: SortMode = SortMode.URGENCY,
) -> list[dict[str, Any]]:
    """Sorts habitation records by Urgency (PS_j DESC) or Caseload (PS_j * pop DESC).
    
    Stable ordering: score DESC, id ASC.
    PRD §6.6, FR-6.3
    """
    def sort_key(h: dict[str, Any]) -> tuple[float, int]:
        ps_raw = h.get("priority_score")
        ps = float(ps_raw if ps_raw is not None else 0.0)
        pop_raw = h.get("population")
        pop = int(pop_raw if pop_raw is not None else 0)
        score = ps if mode == SortMode.URGENCY else (ps * pop)
        id_raw = h.get("id")
        h_id = int(id_raw if id_raw is not None else 0)
        return (-score, h_id)

    return sorted(habitations, key=sort_key)


class PriorityScoringEngine:
    """Orchestrates habitation risk prioritization, factor extraction, and triage."""

    def __init__(
        self,
        scoring_config: Optional[PriorityScoringConfig] = None,
        triage_config: Optional[TriageRuleConfig] = None,
    ) -> None:
        self.scoring_config = scoring_config or PriorityScoringConfig()
        self.triage_config = triage_config or TriageRuleConfig()

    def evaluate_habitation(
        self,
        hazard_intensity: float,
        pop_fraction_in_prz: float,
        vulnerability_index: float,
        decayed_loss: float = 0.0,
        population: int = 0,
        active_deformation: bool = False,
        fatal_event_last_3_monsoons: bool = False,
        in_situ_cost_cheaper: bool = False,
        is_caution_with_adverse_trend: bool = False,
        mitigation_cost: Optional[float] = None,
        relocation_cost: Optional[float] = None,
        adverse_trend: Optional[bool] = None,
    ) -> dict[str, Any]:
        """Evaluates priority score, caseload, triage tier, and factors for a habitation."""
        from core.constants import CAUTION_MHI_MIN, PRZ_MHI_STATIC

        has_prz = pop_fraction_in_prz > 0.0

        ps = self.scoring_config.calculate_score(
            hazard_intensity=hazard_intensity,
            pop_fraction_in_prz=pop_fraction_in_prz,
            vulnerability_index=vulnerability_index,
            decayed_loss=decayed_loss,
        )
        caseload = round(ps * max(population, 0), 2)

        cost_cheaper = in_situ_cost_cheaper or evaluate_in_situ_cost_cheaper(mitigation_cost, relocation_cost)
        caution_adverse = False
        if (is_caution_with_adverse_trend is True) or (adverse_trend is True):
            is_caution = (CAUTION_MHI_MIN <= hazard_intensity < PRZ_MHI_STATIC) or (0.45 <= hazard_intensity < 0.75)
            caution_adverse = is_caution

        triage_res = evaluate_triage_with_rationale(
            has_prz_overlap=has_prz,
            active_deformation=active_deformation,
            fatal_event_last_3_monsoons=fatal_event_last_3_monsoons,
            pop_fraction_in_prz=pop_fraction_in_prz,
            hazard_intensity=hazard_intensity,
            priority_score=ps,
            in_situ_cost_cheaper=cost_cheaper,
            is_caution_with_adverse_trend=caution_adverse,
            mitigation_cost=mitigation_cost,
            relocation_cost=relocation_cost,
            adverse_trend=adverse_trend,
            rules=self.triage_config,
        )

        factors = [
            {"factor": "PRZ Built-up Exposure", "weight": round(pop_fraction_in_prz, 2), "method": "heuristic"},
            {"factor": "Vulnerability Index", "weight": round(vulnerability_index, 2), "method": "heuristic"},
            {"factor": "Hazard Intensity", "weight": round(hazard_intensity, 2), "method": "heuristic"},
            {"factor": "Historical Loss Decay", "weight": round(decayed_loss, 2), "method": "heuristic"},
        ]

        return {
            "priority_score": ps,
            "caseload_score": caseload,
            "tier": triage_res.tier,
            "triage_rationale": triage_res.rationale,
            "contributing_factors": factors,
            "scoring_version": self.scoring_config.scoring_version,
        }
