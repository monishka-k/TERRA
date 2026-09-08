"""Focused unit tests for B1: ML Registry Plug-in Seam & Checkpoint Loader.

Validates that:
1. Registering an ML provider in ModelRegistry causes TerrainHazardEvaluator to use it.
2. Emitted hazard_static, mhi_snapshot, and explanation reflect the registered provider.
3. Default fallback to BaselineLandslideProvider / BaselineFloodProvider is preserved.
4. Checkpoint loader reads from configuration and registers model at pipeline startup.
5. Checkpoint loader fails explicitly on missing/invalid files without silent fallback.
6. ModelRegistry.reset() deterministically cleans global state.
"""

import pickle
from pathlib import Path
import pytest

from core.config import Settings
from core.enums import Hazard, ZoneClass
from core.ml.protocols import LandslideModelProtocol, FloodSurfaceProtocol
from core.ml.registry import (
    BaselineLandslideProvider,
    BaselineFloodProvider,
    model_registry,
    ModelRegistry,
)
from core.ml.types import (
    FeatureContribution,
    HazardPrediction,
    LandslideFeatures,
    FloodFeatures,
    ModelMetadata,
)
from pipeline.hazard.terrain_zonal import TerrainHazardEvaluator
from pipeline.hazard.model_loader import load_pipeline_models, load_checkpoint_artifact


class StubLandslideProvider:
    """Deterministic stub provider returning a distinct susceptibility of 0.99."""

    def __init__(self, susceptibility: float = 0.99, version: str = "stub-xgb-v9.9") -> None:
        self._susceptibility = susceptibility
        self._metadata = ModelMetadata(
            model_name="stub_landslide_xgboost",
            model_version=version,
            feature_schema_version="v1.0",
            provider="xgboost",
            auc_score=0.94,
        )

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    def predict(self, features: LandslideFeatures) -> HazardPrediction:
        return HazardPrediction(
            susceptibility=self._susceptibility,
            confidence=0.98,
            explanation=[
                FeatureContribution(
                    feature="slope_deg",
                    value=features.slope_deg,
                    contribution=0.85,
                    method="TreeSHAP",
                ),
                FeatureContribution(
                    feature="dist_to_road_m",
                    value=features.dist_to_road_m,
                    contribution=0.14,
                    method="TreeSHAP",
                ),
            ],
            metadata=self._metadata,
        )


class StubFloodProvider:
    """Deterministic stub provider returning a distinct susceptibility of 0.88."""

    def __init__(self, susceptibility: float = 0.88, version: str = "stub-s1-flood-v2") -> None:
        self._susceptibility = susceptibility
        self._metadata = ModelMetadata(
            model_name="stub_flood_sar",
            model_version=version,
            feature_schema_version="v1.0",
            provider="sentinel1_sar",
        )

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    def predict(self, features: FloodFeatures) -> HazardPrediction:
        return HazardPrediction(
            susceptibility=self._susceptibility,
            confidence=0.95,
            explanation=[
                FeatureContribution(
                    feature="hand_m",
                    value=features.hand_m,
                    contribution=0.55,
                    method="empirical_sar",
                ),
                FeatureContribution(
                    feature="historical_sar_inundation_freq",
                    value=features.historical_sar_inundation_freq,
                    contribution=0.33,
                    method="empirical_sar",
                ),
            ],
            metadata=self._metadata,
        )


class TestMLRegistrySeam:
    """Test suite proving the ML registry plug-in seam is genuinely live."""

    def test_registered_landslide_stub_changes_emitted_hazard_static(self):
        """The decisive B1 proof test:
        Register stub provider -> construct TerrainHazardEvaluator -> assert emitted hazard_static is 0.99.
        """
        stub = StubLandslideProvider(susceptibility=0.99, version="xgb-prod-v2")
        assert isinstance(stub, LandslideModelProtocol)

        # 1. Register stub in the global registry
        model_registry.register_landslide_model(stub)

        # 2. Instantiate TerrainHazardEvaluator through default production path (zero arguments)
        evaluator = TerrainHazardEvaluator()

        # 3. Evaluate a cell
        result = evaluator.evaluate_cell(
            h3_int=614178831240003583,
            elevation_m=850.0,
            slope_deg=35.0,
            local_relief_m=250.0,
            dist_to_road_m=300.0,
            hand_m=8.0,
            twi=9.0,
        )

        # 4. Assert emitted hazard_static reflects the registered stub, NOT the baseline
        hs_landslide = next(
            (hs for hs in result["hazard_statics"] if hs["hazard_type"] == Hazard.LANDSLIDE.value),
            None,
        )
        assert hs_landslide is not None
        assert hs_landslide["susceptibility"] == 0.99
        assert hs_landslide["model_version"] == "xgb-prod-v2"
        assert hs_landslide["confidence"] == 0.98

        # 5. Assert explanation reflects registered model metadata and TreeSHAP method
        assert result["explanation"]["model_version"] == "xgb-prod-v2"
        top_factor = result["explanation"]["factors"][0]
        assert top_factor["method"] == "TreeSHAP"
        assert top_factor["contribution"] == 0.85

        # 6. Assert MHI snapshot is impacted by the high susceptibility
        assert result["mhi_snapshot"]["zone_class"] == ZoneClass.PERMANENT_RED.value

    def test_registered_flood_stub_changes_emitted_hazard_static(self):
        """Verify registering flood stub updates flash flood hazard_static in TerrainHazardEvaluator."""
        stub_flood = StubFloodProvider(susceptibility=0.88, version="sar-flood-v2")
        assert isinstance(stub_flood, FloodSurfaceProtocol)

        model_registry.register_flood_model(stub_flood)
        evaluator = TerrainHazardEvaluator()

        result = evaluator.evaluate_cell(
            h3_int=614178831240003583,
            elevation_m=850.0,
            slope_deg=10.0,
            local_relief_m=50.0,
            dist_to_road_m=300.0,
            hand_m=2.0,
            twi=12.0,
        )

        hs_flood = next(
            (hs for hs in result["hazard_statics"] if hs["hazard_type"] == Hazard.FLASH_FLOOD.value),
            None,
        )
        assert hs_flood is not None
        assert hs_flood["susceptibility"] == 0.88
        assert hs_flood["model_version"] == "sar-flood-v2"

    def test_baseline_fallback_when_no_model_registered(self):
        """Verify TerrainHazardEvaluator preserves baseline heuristic providers by default."""
        model_registry.reset()
        evaluator = TerrainHazardEvaluator()

        assert isinstance(evaluator.landslide_provider, BaselineLandslideProvider)
        assert isinstance(evaluator.flood_provider, BaselineFloodProvider)
        assert evaluator.landslide_provider.metadata.provider == "baseline"
        assert evaluator.flood_provider.metadata.provider == "baseline"

        result = evaluator.evaluate_cell(
            h3_int=614178831240003583,
            elevation_m=850.0,
            slope_deg=35.0,
            local_relief_m=250.0,
            dist_to_road_m=300.0,
            hand_m=8.0,
            twi=9.0,
        )

        for hs in result["hazard_statics"]:
            assert hs["model_version"] == "baseline-v1"

        for factor in result["explanation"]["factors"]:
            assert factor["method"] == "heuristic"

    def test_explicit_provider_parameter_overrides_registry(self):
        """Verify passing an explicit provider to constructor overrides registry."""
        registry_stub = StubLandslideProvider(susceptibility=0.99, version="registry-v1")
        model_registry.register_landslide_model(registry_stub)

        explicit_stub = StubLandslideProvider(susceptibility=0.42, version="explicit-v1")
        evaluator = TerrainHazardEvaluator(landslide_provider=explicit_stub)

        result = evaluator.evaluate_cell(
            h3_int=614178831240003583,
            elevation_m=850.0,
            slope_deg=35.0,
        )

        hs = next(hs for hs in result["hazard_statics"] if hs["hazard_type"] == Hazard.LANDSLIDE.value)
        assert hs["susceptibility"] == 0.42
        assert hs["model_version"] == "explicit-v1"

    def test_model_registry_reset_restores_all_baseline_providers(self):
        """Verify reset() restores baseline heuristic providers deterministically."""
        model_registry.register_landslide_model(StubLandslideProvider())
        model_registry.register_flood_model(StubFloodProvider())

        assert model_registry.landslide_model.metadata.provider == "xgboost"
        assert model_registry.flood_model.metadata.provider == "sentinel1_sar"

        model_registry.reset()

        assert model_registry.landslide_model.metadata.provider == "baseline"
        assert model_registry.flood_model.metadata.provider == "baseline"
        assert model_registry.vulnerability_model.metadata.provider == "baseline"
        assert model_registry.trigger_model.metadata.provider == "baseline"


class TestCheckpointLoader:
    """Test suite for checkpoint loading and startup registration."""

    def test_checkpoint_loader_registers_landslide_model(self, tmp_path: Path):
        """Verify load_pipeline_models loads a serialized model and registers it."""
        model_file = tmp_path / "landslide_model.pkl"
        stub = StubLandslideProvider(susceptibility=0.93, version="xgb-ckpt-v1")
        with open(model_file, "wb") as f:
            pickle.dump(stub, f)

        cfg = Settings(LANDSLIDE_MODEL_PATH=str(model_file))
        load_pipeline_models(cfg=cfg)

        assert model_registry.landslide_model.metadata.model_name == "stub_landslide_xgboost"
        assert model_registry.landslide_model.metadata.model_version == "xgb-ckpt-v1"

        # Check that TerrainHazardEvaluator picks it up
        evaluator = TerrainHazardEvaluator()
        res = evaluator.evaluate_cell(h3_int=614178831240003583, elevation_m=800.0, slope_deg=30.0)
        hs = next(hs for hs in res["hazard_statics"] if hs["hazard_type"] == Hazard.LANDSLIDE.value)
        assert hs["susceptibility"] == 0.93
        assert hs["model_version"] == "xgb-ckpt-v1"

    def test_checkpoint_loader_registers_flood_model(self, tmp_path: Path):
        """Verify load_pipeline_models loads a flood checkpoint."""
        model_file = tmp_path / "flood_model.pkl"
        stub = StubFloodProvider(susceptibility=0.77, version="s1-ckpt-v1")
        with open(model_file, "wb") as f:
            pickle.dump(stub, f)

        cfg = Settings(FLOOD_MODEL_PATH=str(model_file))
        load_pipeline_models(cfg=cfg)

        assert model_registry.flood_model.metadata.model_name == "stub_flood_sar"
        assert model_registry.flood_model.metadata.model_version == "s1-ckpt-v1"

    def test_checkpoint_loader_generic_checkpoint_path_file(self, tmp_path: Path):
        """Verify generic MODEL_CHECKPOINT_PATH loads model from local file."""
        ls_file = tmp_path / "landslide_xgboost.pkl"
        with open(ls_file, "wb") as f:
            pickle.dump(StubLandslideProvider(susceptibility=0.91), f)

        cfg = Settings(MODEL_CHECKPOINT_PATH=str(ls_file))
        load_pipeline_models(cfg=cfg)

        assert model_registry.landslide_model.metadata.provider == "xgboost"

    def test_checkpoint_loader_rejects_remote_url(self):
        """Verify remote model URLs are explicitly rejected."""
        with pytest.raises(ValueError) as excinfo:
            load_checkpoint_artifact("https://example.com/models/model.joblib")
        assert "Remote model URLs are not supported" in str(excinfo.value)

    def test_checkpoint_loader_rejects_directory(self, tmp_path: Path):
        """Verify passing a directory raises ValueError."""
        with pytest.raises(ValueError) as excinfo:
            load_checkpoint_artifact(tmp_path)
        assert "must be a file, not a directory" in str(excinfo.value)

    def test_checkpoint_loader_missing_file_raises_filenotfound(self, tmp_path: Path):
        """Verify missing checkpoint path raises explicit FileNotFoundError."""
        missing = tmp_path / "does_not_exist.joblib"
        cfg = Settings(LANDSLIDE_MODEL_PATH=str(missing))

        with pytest.raises(FileNotFoundError) as excinfo:
            load_pipeline_models(cfg=cfg)
        assert "Configured landslide model checkpoint not found" in str(excinfo.value)

    def test_checkpoint_loader_invalid_protocol_raises_typeerror(self, tmp_path: Path):
        """Verify non-conforming checkpoint raises explicit TypeError."""
        bad_file = tmp_path / "invalid_model.pkl"
        with open(bad_file, "wb") as f:
            pickle.dump({"not_a": "model"}, f)

        cfg = Settings(LANDSLIDE_MODEL_PATH=str(bad_file))
        with pytest.raises(TypeError) as excinfo:
            load_pipeline_models(cfg=cfg)
        assert "does not implement LandslideModelProtocol" in str(excinfo.value)

    def test_checkpoint_loader_corrupt_file_raises_runtimeerror(self, tmp_path: Path):
        """Verify corrupted checkpoint raises explicit RuntimeError."""
        corrupt_file = tmp_path / "corrupt.pkl"
        with open(corrupt_file, "wb") as f:
            f.write(b"NOT_A_VALID_PICKLE_STREAM")

        with pytest.raises(RuntimeError) as excinfo:
            load_checkpoint_artifact(corrupt_file)
        assert "Failed to deserialize model checkpoint" in str(excinfo.value)

    def test_checkpoint_loader_preserves_baseline_when_no_checkpoint_configured(self):
        """Verify load_pipeline_models retains baseline providers when paths are empty."""
        model_registry.reset()
        cfg = Settings(
            LANDSLIDE_MODEL_PATH=None,
            FLOOD_MODEL_PATH=None,
            MODEL_CHECKPOINT_PATH=None,
        )
        load_pipeline_models(cfg=cfg)

        assert model_registry.landslide_model.metadata.provider == "baseline"
        assert model_registry.flood_model.metadata.provider == "baseline"
