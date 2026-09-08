"""Flood Susceptibility Combination (Step 9).

Pure-function module implementing the empirical flood-susceptibility algebra:
  - FR-3.17 hard-zero enforcement (HAND > 30m OR slope > 15°)
  - Percentile-based HAND normalization over the flood-eligible domain
  - Weighted combination: S_f = w_F * F + w_H * H_hand
  - Confidence layer: min(1, n_valid / 30)

No I/O — only numpy array operations on grid-aligned rasters from Steps 5–8.
"""

from typing import Tuple
import numpy as np


# Default combination weights for Barpeta pilot (equal weighting)
DEFAULT_W_FREQ = 0.5
DEFAULT_W_HAND = 0.5

# Default percentile ceiling for HAND normalization
DEFAULT_HAND_CLIP_PERCENTILE = 99.0

# Default observation ceiling for confidence calculation
DEFAULT_OBSERVATION_CEILING = 30


def normalize_hand_percentile(
    hand_m: np.ndarray,
    eligible_mask: np.ndarray,
    clip_percentile: float = DEFAULT_HAND_CLIP_PERCENTILE,
) -> Tuple[np.ndarray, float]:
    """Normalize HAND into [0.0, 1.0] using percentile-based normalization.

    Per Plan §9.2: H_hand = 1 - N(HAND) over the non-zeroed domain.
    Percentile-based normalization is the "more defensible default because it is
    not hostage to a single outlier cell."

    Low HAND → high susceptibility (near drainage).
    High HAND → low susceptibility (elevated terrain).

    Args:
        hand_m: 2D float32 array of HAND values in meters.
        eligible_mask: 2D bool array (True where flood-eligible, i.e. not hard-zeroed).
        clip_percentile: Percentile of eligible-domain HAND used as normalization ceiling.

    Returns:
        Tuple of (hand_normalized, clip_value_m):
            - hand_normalized: 2D float32 array in [0.0, 1.0], NaN outside eligible domain.
            - clip_value_m: The percentile value in meters used for normalization.
    """
    hand_normalized = np.full(hand_m.shape, np.nan, dtype=np.float32)

    eligible_hand = hand_m[eligible_mask & np.isfinite(hand_m)]
    if eligible_hand.size == 0:
        return hand_normalized, 0.0

    clip_value_m = float(np.percentile(eligible_hand, clip_percentile))
    if clip_value_m <= 0:
        clip_value_m = 1.0  # Safety fallback

    # Normalize: 0m → 1.0 (most susceptible), clip_value_m → 0.0 (least susceptible)
    valid = eligible_mask & np.isfinite(hand_m)
    normalized = 1.0 - np.clip(hand_m[valid] / clip_value_m, 0.0, 1.0)
    hand_normalized[valid] = normalized.astype(np.float32)

    return hand_normalized, clip_value_m


def combine_susceptibility(
    frequency: np.ndarray,
    hand_normalized: np.ndarray,
    eligible_mask: np.ndarray,
    w_freq: float = DEFAULT_W_FREQ,
    w_hand: float = DEFAULT_W_HAND,
) -> np.ndarray:
    """Combine inundation frequency and normalized HAND into flood susceptibility.

    Per Plan §9.3: S_f = w_F * F + w_H * H_hand
    Per Plan §9.1 / FR-3.17: Hard-zero pixels are forced to exactly 0.0.
    Per FR-3.3: Zeros must survive downstream trigger amplification — they are 0.0, not NaN.

    Args:
        frequency: 2D float32 array of inundation frequency F(x,y) in [0.0, 1.0].
        hand_normalized: 2D float32 array of normalized HAND H_hand in [0.0, 1.0].
        eligible_mask: 2D bool array (True where flood-eligible).
        w_freq: Weight for inundation frequency (default 0.5).
        w_hand: Weight for normalized HAND (default 0.5).

    Returns:
        2D float32 array of flood susceptibility in [0.0, 1.0].
        - Eligible pixels: weighted combination.
        - Hard-zero pixels (valid terrain but not eligible): exactly 0.0.
        - No-data pixels (no terrain): NaN.
    """
    assert abs((w_freq + w_hand) - 1.0) < 1e-6, f"Weights must sum to 1.0, got {w_freq + w_hand}"

    susceptibility = np.full(frequency.shape, np.nan, dtype=np.float32)

    # For eligible pixels, compute the weighted combination
    # Handle NaN in either input: use available signal where one component is missing
    valid_both = eligible_mask & np.isfinite(frequency) & np.isfinite(hand_normalized)
    valid_freq_only = eligible_mask & np.isfinite(frequency) & (~np.isfinite(hand_normalized))
    valid_hand_only = eligible_mask & (~np.isfinite(frequency)) & np.isfinite(hand_normalized)

    # Standard combination where both signals are available
    susceptibility[valid_both] = (
        w_freq * frequency[valid_both] + w_hand * hand_normalized[valid_both]
    )

    # Graceful degradation: use available signal scaled to full range
    susceptibility[valid_freq_only] = frequency[valid_freq_only]
    susceptibility[valid_hand_only] = hand_normalized[valid_hand_only]

    # FR-3.17 / FR-3.3: Hard-zero enforcement
    # Valid terrain that is NOT eligible gets exactly 0.0 (not NaN)
    valid_terrain = np.isfinite(frequency) | np.isfinite(hand_normalized)
    hard_zero = valid_terrain & (~eligible_mask)
    susceptibility[hard_zero] = 0.0

    # Final clamp to [0.0, 1.0]
    finite_mask = np.isfinite(susceptibility)
    susceptibility[finite_mask] = np.clip(susceptibility[finite_mask], 0.0, 1.0)

    return susceptibility


def compute_confidence(
    valid_observation_count: np.ndarray,
    eligible_mask: np.ndarray,
    observation_ceiling: int = DEFAULT_OBSERVATION_CEILING,
) -> np.ndarray:
    """Compute pixel-wise confidence for the flood susceptibility estimate.

    Per Plan §9.4: confidence = min(1, n_valid / 30)

    Args:
        valid_observation_count: 2D uint16 array of valid SAR observation counts per pixel.
        eligible_mask: 2D bool array (True where flood-eligible).
        observation_ceiling: Number of observations for full confidence (default 30).

    Returns:
        2D float32 array of confidence in [0.0, 1.0].
        - Eligible pixels: min(1, n_valid / ceiling).
        - Hard-zero pixels: 0.0 (certain-zero by construction, not by observation).
        - No-data pixels: NaN.
    """
    confidence = np.full(valid_observation_count.shape, np.nan, dtype=np.float32)

    # Eligible domain: confidence scales with observation density
    valid = eligible_mask & (valid_observation_count > 0)
    confidence[valid] = np.minimum(
        1.0,
        valid_observation_count[valid].astype(np.float32) / float(observation_ceiling),
    )

    # Zero-observation eligible pixels
    zero_obs_eligible = eligible_mask & (valid_observation_count == 0)
    confidence[zero_obs_eligible] = 0.0

    # Hard-zero pixels: confidence = 0.0 (their susceptibility is deterministic, not observed)
    has_terrain = np.isfinite(confidence) | (valid_observation_count > 0)
    hard_zero = has_terrain & (~eligible_mask)
    confidence[hard_zero] = 0.0

    return confidence
