"""P0.4 / H10: Focused Unit & Property Tests for MHI Monotonicity & Boundedness.

Section refs: docs/PRD1.md §6.3 (FR-3.4), §14.1

Covers:
1. Invariant 1: Boundedness — 0.0 <= MHI <= 1.0 for all valid inputs, including weights > 1.
2. Invariant 2: Monotonicity — Increasing any hazard score while holding others fixed never decreases MHI.
3. Invariant 3: Zero susceptibility — S_h = 0 -> H_h = 0 -> zero contribution to MHI.
4. Invariant 4: Zero hazard contribution — H_h = 0 -> weighted_term = 0 -> zero contribution to MHI.
5. Invariant 5: Stability — Standard weights (w <= 1.0) produce exact expected probabilistic union values.
6. Explicit Regression Test: Multi-hazard scenario with w > 1.0 that causes negative (1 - w*H) terms
   and non-monotonic MHI drops in the old unclamped implementation.
7. Property-based randomized simulation proving monotonicity across random weights w in [0.0, 2.0]
   and hazard scores in [0.0, 1.0].
8. Zero semantics protection (B3 guard): Explicit zero weight (0.0) is preserved and zeroes out contribution.
"""

import math
import random
import pytest

from core.domain.hazard import (
    compute_hazard_score,
    compute_mhi,
    get_dominant_hazard,
)
from core.enums import Hazard
from core.constants import HAZARD_WEIGHTS


# ============================================================================
# 1. BOUNDEDNESS: 0 <= MHI <= 1
# ============================================================================

@pytest.mark.parametrize(
    "weights",
    [
        None,  # default weights (0.7 - 1.0)
        {},    # empty weights (uses default)
        {Hazard.LANDSLIDE: 0.0, Hazard.FLASH_FLOOD: 0.0},
        {Hazard.LANDSLIDE: 0.5, Hazard.FLASH_FLOOD: 0.5},
        {Hazard.LANDSLIDE: 1.0, Hazard.FLASH_FLOOD: 1.0},
        {Hazard.LANDSLIDE: 1.5, Hazard.FLASH_FLOOD: 1.5},  # over-1 weights (UI range)
        {Hazard.LANDSLIDE: 2.0, Hazard.FLASH_FLOOD: 2.0},  # max UI slider weight
        {Hazard.LANDSLIDE: 5.0, Hazard.FLASH_FLOOD: 10.0}, # extreme weights
    ],
)
@pytest.mark.parametrize(
    "scores",
    [
        {Hazard.LANDSLIDE: 0.0, Hazard.FLASH_FLOOD: 0.0},
        {Hazard.LANDSLIDE: 0.001, Hazard.FLASH_FLOOD: 0.001},
        {Hazard.LANDSLIDE: 0.5, Hazard.FLASH_FLOOD: 0.3},
        {Hazard.LANDSLIDE: 0.8, Hazard.FLASH_FLOOD: 0.9},
        {Hazard.LANDSLIDE: 1.0, Hazard.FLASH_FLOOD: 1.0},
    ],
)
def test_mhi_bounded_in_unit_interval(scores, weights):
    """Invariant 1: MHI must strictly lie within [0.0, 1.0] for all inputs and weights."""
    mhi = compute_mhi(scores, weights=weights)
    assert 0.0 <= mhi <= 1.0, f"MHI {mhi} out of bounds for scores={scores}, weights={weights}"


# ============================================================================
# 2. MONOTONICITY TESTS (SINGLE & MULTI-HAZARD)
# ============================================================================

@pytest.mark.parametrize("weight", [0.5, 0.8, 1.0, 1.2, 1.5, 2.0])
def test_mhi_monotonicity_single_hazard(weight):
    """Invariant 2: For a single hazard, increasing H monotonically increases or maintains MHI."""
    weights = {Hazard.LANDSLIDE: weight}
    prev_mhi = -1.0

    steps = [i / 20.0 for i in range(21)]  # 0.0, 0.05, 0.10, ..., 1.0
    for h in steps:
        mhi = compute_mhi({Hazard.LANDSLIDE: h}, weights=weights)
        assert mhi >= prev_mhi - 1e-9, (
            f"Monotonicity violated at H={h} with w={weight}: {mhi} < {prev_mhi}"
        )
        prev_mhi = mhi


def test_mhi_monotonicity_multi_hazard_over_one_regression():
    """EXPLICIT REGRESSION TEST for H10:
    In the old implementation without clamping on w * H, when multiple weights exceed 1.0
    (e.g., scenario simulation with w_1 = 1.5, w_2 = 1.5), the terms (1 - w * H) become negative.
    Their product becomes positive, which previously caused MHI to DECREASE when H_1 increased!

    Old calculation demonstration:
      w1=1.5, H1=0.7, w2=1.5, H2=0.8 -> (1 - 1.05)*(1 - 1.2) = (-0.05)*(-0.2) = +0.01 -> MHI = 0.99
      w1=1.5, H1=0.8, w2=1.5, H2=0.8 -> (1 - 1.20)*(1 - 1.2) = (-0.20)*(-0.2) = +0.04 -> MHI = 0.96 (DROPPED!)
      w1=1.5, H1=0.9, w2=1.5, H2=0.8 -> (1 - 1.35)*(1 - 1.2) = (-0.35)*(-0.2) = +0.07 -> MHI = 0.93 (DROPPED!)

    The corrected implementation clamps weighted_term to [0, 1], so (1 - 1.0) = 0.0,
    and MHI remains properly saturated at 1.0 without dropping.
    """
    weights = {
        Hazard.LANDSLIDE: 1.5,
        Hazard.FLASH_FLOOD: 1.5,
    }
    h2_fixed = 0.8  # w2 * h2 = 1.2 > 1.0

    # Test monotonic progression of H1 from 0.0 to 1.0 while H2 is fixed
    h1_values = [0.0, 0.2, 0.4, 0.6, 0.66, 0.67, 0.7, 0.8, 0.9, 1.0]
    previous_mhi = 0.0

    for h1 in h1_values:
        scores = {Hazard.LANDSLIDE: h1, Hazard.FLASH_FLOOD: h2_fixed}
        current_mhi = compute_mhi(scores, weights=weights)

        # Monotonicity check: MHI must not decrease as H1 increases
        assert current_mhi >= previous_mhi - 1e-9, (
            f"H10 Regression: MHI decreased from {previous_mhi} to {current_mhi} "
            f"as H1 increased to {h1} with H2={h2_fixed}, weights={weights}"
        )
        # Unit interval check
        assert 0.0 <= current_mhi <= 1.0
        previous_mhi = current_mhi

    # At H1=0.8 and H1=0.9 with w=1.5, both should be safely at 1.0
    mhi_08 = compute_mhi({Hazard.LANDSLIDE: 0.8, Hazard.FLASH_FLOOD: 0.8}, weights=weights)
    mhi_09 = compute_mhi({Hazard.LANDSLIDE: 0.9, Hazard.FLASH_FLOOD: 0.8}, weights=weights)
    assert mhi_08 == 1.0
    assert mhi_09 == 1.0


# ============================================================================
# 3. ZERO SUSCEPTIBILITY & ZERO HAZARD CONTRIBUTION
# ============================================================================

def test_zero_susceptibility_invariant():
    """Invariant 3: If S_h == 0, then H_h == 0 regardless of trigger, and contribution to MHI is 0."""
    # Step 1: Compute hazard score with zero susceptibility and large trigger
    h_score = compute_hazard_score(susceptibility=0.0, trigger_value=15.0, beta=1.0)
    assert h_score == 0.0

    # Step 2: Ensure zero hazard contributes zero to MHI
    mhi_with_zero = compute_mhi({Hazard.LANDSLIDE: h_score})
    assert mhi_with_zero == 0.0

    # Step 3: Ensure adding zero hazard to an existing hazard does not alter MHI
    baseline_mhi = compute_mhi({Hazard.FLASH_FLOOD: 0.6})
    compound_mhi = compute_mhi({Hazard.FLASH_FLOOD: 0.6, Hazard.LANDSLIDE: h_score})
    assert compound_mhi == baseline_mhi


def test_zero_hazard_contribution_with_over_one_weights():
    """Invariant 4: If H_h == 0, weighted term is 0 regardless of weight (even if w > 1)."""
    weights = {
        Hazard.LANDSLIDE: 2.0,       # over-1 weight
        Hazard.FLASH_FLOOD: 1.5,     # over-1 weight
    }
    # Both zero -> MHI must be strictly 0.0
    assert compute_mhi({Hazard.LANDSLIDE: 0.0, Hazard.FLASH_FLOOD: 0.0}, weights=weights) == 0.0

    # One zero, one active -> zero hazard must not affect active hazard MHI
    active_only = compute_mhi({Hazard.FLASH_FLOOD: 0.5}, weights=weights)
    with_zero = compute_mhi({Hazard.FLASH_FLOOD: 0.5, Hazard.LANDSLIDE: 0.0}, weights=weights)
    assert with_zero == active_only


# ============================================================================
# 4. EXISTING VALID BEHAVIOUR STABILITY (STANDARD WEIGHTS w <= 1.0)
# ============================================================================

def test_mhi_stability_standard_weights():
    """Invariant 5: For standard weights within [0, 1], the formula produces exact historical results."""
    # Landslide w=1.0, Flash Flood w=1.0: 1 - (1 - 1.0*0.5)*(1 - 1.0*0.5) = 1 - 0.25 = 0.75
    scores = {Hazard.LANDSLIDE: 0.5, Hazard.FLASH_FLOOD: 0.5}
    mhi = compute_mhi(scores)
    assert pytest.approx(mhi, 0.0001) == 0.75

    # Coastal erosion w=0.7, Riverine flood w=0.8:
    # 1 - (1 - 0.7*0.5) * (1 - 0.8*0.4) = 1 - (0.65 * 0.68) = 1 - 0.442 = 0.558
    scores_partial = {Hazard.COASTAL_EROSION: 0.5, Hazard.RIVERINE_FLOOD: 0.4}
    mhi_partial = compute_mhi(scores_partial)
    assert pytest.approx(mhi_partial, 0.0001) == 0.558


# ============================================================================
# 5. ZERO SEMANTICS PROTECTION (B3 REGRESSION GUARD)
# ============================================================================

def test_explicit_zero_weight_removes_contribution():
    """B3 Invariant: Explicit zero weight (w=0.0) removes hazard contribution."""
    scores = {Hazard.LANDSLIDE: 0.8, Hazard.FLASH_FLOOD: 0.6}
    # Explicit zero weight on Flash Flood
    weights = {Hazard.LANDSLIDE: 1.0, Hazard.FLASH_FLOOD: 0.0}
    mhi = compute_mhi(scores, weights=weights)

    # Only Landslide should contribute: 1 - (1 - 1.0 * 0.8) * (1 - 0.0) = 0.8
    assert pytest.approx(mhi, 0.0001) == 0.8


# ============================================================================
# 6. RANDOMIZED PROPERTY-BASED MONOTONICITY & BOUNDEDNESS
# ============================================================================

def test_randomized_monotonicity_and_bounds_property():
    """Property test over randomized domains:
    For any random configuration of weights w in [0.0, 2.0] and scores H in [0.0, 1.0],
    increasing any single hazard H_k by delta > 0 MUST NOT decrease MHI.
    """
    rng = random.Random(42)  # Deterministic seed for reproducible property tests
    hazards = list(Hazard)

    for iteration in range(200):
        # 1. Random weights in [0.0, 2.0] (UI slider range)
        weights = {h: rng.uniform(0.0, 2.0) for h in hazards}

        # 2. Random baseline scores in [0.0, 1.0]
        base_scores = {h: rng.uniform(0.0, 1.0) for h in hazards}

        mhi_base = compute_mhi(base_scores, weights=weights)
        assert 0.0 <= mhi_base <= 1.0, f"MHI {mhi_base} out of bounds at iter {iteration}"

        # 3. Pick a random hazard to increase
        target_hazard = rng.choice(hazards)
        current_val = base_scores[target_hazard]
        delta = rng.uniform(0.0, 1.0 - current_val)
        increased_val = min(current_val + delta, 1.0)

        increased_scores = dict(base_scores)
        increased_scores[target_hazard] = increased_val

        mhi_increased = compute_mhi(increased_scores, weights=weights)
        assert 0.0 <= mhi_increased <= 1.0, f"Increased MHI {mhi_increased} out of bounds at iter {iteration}"

        # Monotonicity invariant: increasing a hazard cannot decrease MHI
        assert mhi_increased >= mhi_base - 1e-12, (
            f"Monotonicity violation at iteration {iteration} for {target_hazard}: "
            f"MHI decreased from {mhi_base:.6f} to {mhi_increased:.6f} "
            f"when score increased from {current_val:.4f} to {increased_val:.4f} "
            f"with weight {weights[target_hazard]:.4f}"
        )
