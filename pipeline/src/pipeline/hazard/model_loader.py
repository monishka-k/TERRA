"""ML Checkpoint Loader and Pipeline Model Registration Seam (B1).

Loads trained ML model checkpoints specified by configuration at pipeline startup
and registers them into ModelRegistry.

If no checkpoints are configured, the registry retains its default baseline heuristic
providers. If a configured checkpoint is missing or invalid, an explicit, diagnosable
error is raised.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from core.config import settings, Settings
from core.ml.protocols import LandslideModelProtocol, FloodSurfaceProtocol
from core.ml.registry import model_registry, ModelRegistry

logger = logging.getLogger("setu_pipeline.model_loader")


def load_checkpoint_artifact(path: str | Path) -> Any:
    """Loads a serialized checkpoint artifact from local disk.
    
    Supports .joblib, .pkl, and .pickle formats for local, trusted model files.
    Raises ValueError if a remote URL or directory is provided.
    Raises FileNotFoundError if the file does not exist.
    Raises RuntimeError if deserialization fails.
    """
    path_str = str(path).strip()
    if path_str.startswith(("http://", "https://", "ftp://", "s3://", "gs://")):
        raise ValueError(f"Remote model URLs are not supported for checkpoints: {path_str}")

    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Model checkpoint file not found: {p.resolve()}")

    if p.is_dir():
        raise ValueError(f"Checkpoint path must be a file, not a directory: {p.resolve()}")

    try:
        import joblib
        return joblib.load(p)
    except Exception as exc:
        # Fallback to standard library pickle if joblib fails
        try:
            import pickle
            with open(p, "rb") as f:
                return pickle.load(f)
        except Exception:
            raise RuntimeError(
                f"Failed to deserialize model checkpoint from '{p.resolve()}': {exc}"
            ) from exc


def load_pipeline_models(
    registry: ModelRegistry | None = None,
    cfg: Settings | None = None,
) -> None:
    """Loads configured model checkpoints at pipeline startup and registers them into ModelRegistry.
    
    Preserves baseline providers if no checkpoints are configured.
    """
    target_registry = registry or model_registry
    app_settings = cfg or settings

    # 1. Landslide Model Checkpoint (LANDSLIDE_MODEL_PATH or generic MODEL_CHECKPOINT_PATH)
    landslide_path = app_settings.LANDSLIDE_MODEL_PATH or app_settings.MODEL_CHECKPOINT_PATH
    if landslide_path:
        p = Path(landslide_path)
        if not p.exists():
            raise FileNotFoundError(
                f"Configured landslide model checkpoint not found: {p.resolve()}"
            )
        logger.info(f"Loading landslide model checkpoint from {p.resolve()}...")
        model = load_checkpoint_artifact(p)
        if not isinstance(model, LandslideModelProtocol):
            raise TypeError(
                f"Checkpoint at '{p.resolve()}' does not implement LandslideModelProtocol. "
                f"Got object of type: {type(model).__name__}"
            )
        target_registry.register_landslide_model(model)
        logger.info(
            f"Successfully registered landslide model: {model.metadata.model_name} "
            f"({model.metadata.model_version})"
        )

    # 2. Dedicated Flood Model Checkpoint
    if app_settings.FLOOD_MODEL_PATH:
        p = Path(app_settings.FLOOD_MODEL_PATH)
        if not p.exists():
            raise FileNotFoundError(
                f"Configured flood model checkpoint not found: {p.resolve()}"
            )
        logger.info(f"Loading flood model checkpoint from {p.resolve()}...")
        model = load_checkpoint_artifact(p)
        if not isinstance(model, FloodSurfaceProtocol):
            raise TypeError(
                f"Checkpoint at '{p.resolve()}' does not implement FloodSurfaceProtocol. "
                f"Got object of type: {type(model).__name__}"
            )
        target_registry.register_flood_model(model)
        logger.info(
            f"Successfully registered flood model: {model.metadata.model_name} "
            f"({model.metadata.model_version})"
        )
