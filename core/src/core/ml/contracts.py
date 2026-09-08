"""ML Integration Boundaries and Replaceable Product Contracts.

Defines the contract boundary between the ML/Data science team outputs and the
backend persistence/serving layers.

ML Team produces:
- Susceptibility scores / calibrated probabilities
- Confidence metrics
- SHAP feature contributions
- Model version and training metadata
- Vulnerability dimension vectors (SoVI / PCA)

Backend consumes:
- Validated, normalized prediction products
- Stored provenance and metadata
- Feeds into policy scoring and triage engines without coupling to ML algorithms
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from core.ml.types import FeatureContribution, ModelMetadata

logger = logging.getLogger("setu_core.ml.contracts")


@dataclass
class MLHazardOutput:
    """Standardized normalized ML hazard prediction output."""
    hazard_type: str
    susceptibility: float
    confidence: float = 1.0
    model_version: str = "baseline-v1"
    feature_schema_version: str = "v1.0"
    model_name: str = "hazard_model"
    provider: str = "baseline"
    explanation: list[FeatureContribution] = field(default_factory=list)
    calculated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not (0.0 <= self.susceptibility <= 1.0):
            raise ValueError(f"Susceptibility must be in [0.0, 1.0], got {self.susceptibility}")
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"Confidence must be in [0.0, 1.0], got {self.confidence}")


@dataclass
class MLVulnerabilityOutput:
    """Standardized normalized ML/Data downscaled vulnerability product."""
    v_demographic: float
    v_structural: float
    v_access: float
    v_economic: float
    v_index: Optional[float] = None
    is_district_flat: bool = False
    model_version: str = "sovi-v1.0"
    pca_weights: Optional[dict[str, float]] = None
    validation_status: str = "VALID"
    calculated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        for dim, val in [
            ("v_demographic", self.v_demographic),
            ("v_structural", self.v_structural),
            ("v_access", self.v_access),
            ("v_economic", self.v_economic),
        ]:
            if not (0.0 <= float(val) <= 1.0):
                raise ValueError(f"Vulnerability dimension '{dim}' must be in [0.0, 1.0], got {val}")
        if self.v_index is not None and not (0.0 <= float(self.v_index) <= 1.0):
            raise ValueError(f"v_index must be in [0.0, 1.0], got {self.v_index}")
