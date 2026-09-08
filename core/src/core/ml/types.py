"""Domain-level ML types, feature containers, and prediction structures.

Prevents XGBoost/SHAP internal representations from leaking into core domain or serving layers.
"""

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ModelMetadata:
    model_name: str
    model_version: str
    feature_schema_version: str
    provider: str  # 'baseline_heuristic', 'xgboost', 'sar_water_mask', etc.
    trained_date: Optional[str] = None
    auc_score: Optional[float] = None


@dataclass
class FeatureContribution:
    feature: str
    value: float
    contribution: float  # SHAP value or heuristic weight
    method: str = "heuristic"  # TreeSHAP, heuristic, PCA_Loading, policy_factor


@dataclass
class HazardPrediction:
    susceptibility: float  # In range [0.0, 1.0]
    confidence: float      # In range [0.0, 1.0]
    explanation: list[FeatureContribution] = field(default_factory=list)
    metadata: ModelMetadata = field(
        default_factory=lambda: ModelMetadata(
            model_name="default_hazard",
            model_version="v1.0.0",
            feature_schema_version="v1.0",
            provider="baseline",
        )
    )

    def __post_init__(self):
        self.susceptibility = min(max(self.susceptibility, 0.0), 1.0)
        self.confidence = min(max(self.confidence, 0.0), 1.0)


@dataclass
class VulnerabilityPrediction:
    v_demographic: float
    v_structural: float
    v_access: float
    v_economic: float
    v_index: float
    is_district_flat: bool = False
    metadata: ModelMetadata = field(
        default_factory=lambda: ModelMetadata(
            model_name="vulnerability_sovi",
            model_version="v1.0.0",
            feature_schema_version="v1.0",
            provider="baseline",
        )
    )

    def __post_init__(self):
        self.v_demographic = min(max(self.v_demographic, 0.0), 1.0)
        self.v_structural = min(max(self.v_structural, 0.0), 1.0)
        self.v_access = min(max(self.v_access, 0.0), 1.0)
        self.v_economic = min(max(self.v_economic, 0.0), 1.0)
        self.v_index = min(max(self.v_index, 0.0), 1.0)


@dataclass
class TriggerResult:
    trigger_value: float  # In range [0.0, 1.0+]
    threshold_crossed: bool
    ari_15d: float
    rainfall_intensity_mm: float
    metadata: ModelMetadata = field(
        default_factory=lambda: ModelMetadata(
            model_name="rainfall_trigger",
            model_version="v1.0.0",
            feature_schema_version="v1.0",
            provider="baseline",
        )
    )


@dataclass
class LandslideFeatures:
    slope_deg: float
    aspect_deg: float = 0.0
    curvature_plan: float = 0.0
    curvature_profile: float = 0.0
    twi: float = 0.0
    local_relief_m: float = 0.0
    dist_to_fault_m: float = 1000.0
    dist_to_stream_m: float = 500.0
    dist_to_road_m: float = 500.0
    ndvi: float = 0.5
    land_cover_class: int = 10
    soil_class: int = 1
    mean_annual_rainfall_mm: float = 2500.0


@dataclass
class FloodFeatures:
    hand_m: float
    elevation_above_river_m: float = 5.0
    flow_accumulation: float = 100.0
    twi: float = 5.0
    historical_sar_inundation_freq: float = 0.0
    soil_drainage_class: int = 1


@dataclass
class VulnerabilityFeatures:
    district_pca_anchor: float = 0.5
    avg_building_height_m: float = 4.5
    building_footprint_density: float = 0.15
    dist_to_primary_road_m: float = 1200.0
    dist_to_school_m: float = 800.0
    dist_to_health_facility_m: float = 2500.0
    viirs_nightlight_mean: float = 0.8


@dataclass
class TriggerFeatures:
    daily_rainfall_15d_mm: list[float] = field(default_factory=list)
    rolling_24h_mm: float = 0.0
    duration_hours: float = 24.0
    physiographic_zone: str = "western_ghats"
