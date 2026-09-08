"""ML Model Python Protocols (Contract B).

Provides strict structural subtyping interfaces for ML model implementations.
Enables baseline heuristics and trained ML models to be hot-swapped interchangeably.
"""

from typing import Protocol, runtime_checkable
from core.ml.types import (
    ModelMetadata,
    LandslideFeatures,
    FloodFeatures,
    VulnerabilityFeatures,
    TriggerFeatures,
    HazardPrediction,
    VulnerabilityPrediction,
    TriggerResult,
)


@runtime_checkable
class LandslideModelProtocol(Protocol):
    """Protocol for landslide susceptibility prediction and SHAP explanation."""

    @property
    def metadata(self) -> ModelMetadata:
        ...

    def predict(self, features: LandslideFeatures) -> HazardPrediction:
        """Predicts landslide susceptibility S_landslide in [0, 1] and feature contributions."""
        ...


@runtime_checkable
class FloodSurfaceProtocol(Protocol):
    """Protocol for flood susceptibility prediction using HAND and SAR inundation history."""

    @property
    def metadata(self) -> ModelMetadata:
        ...

    def predict(self, features: FloodFeatures) -> HazardPrediction:
        """Predicts flood susceptibility S_flood in [0, 1]."""
        ...


@runtime_checkable
class VulnerabilityDownscalerProtocol(Protocol):
    """Protocol for dasymetric vulnerability downscaling constrained to district mean."""

    @property
    def metadata(self) -> ModelMetadata:
        ...

    def predict(self, features: VulnerabilityFeatures) -> VulnerabilityPrediction:
        """Predicts downscaled vulnerability indices across demographic, structural, access, and economic dimensions."""
        ...


@runtime_checkable
class TriggerThresholdProtocol(Protocol):
    """Protocol for dynamic antecedent rainfall index (ARI) and I-D power-law thresholding."""

    @property
    def metadata(self) -> ModelMetadata:
        ...

    def evaluate(self, observations: TriggerFeatures) -> TriggerResult:
        """Evaluates dynamic rainfall trigger against threshold curve."""
        ...
