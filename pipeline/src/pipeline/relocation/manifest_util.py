"""Utilities for artifact hashing and manifest generation for SETU-DRR relocation datasets."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


def compute_file_sha256(filepath: Path | str) -> str:
    """Computes SHA-256 hex digest for a file."""
    p = Path(filepath)
    if not p.is_file():
        raise FileNotFoundError(f"Artifact file not found: {p}")
    h = hashlib.sha256()
    with open(p, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def compute_manifest_payload_hash(manifest: dict[str, Any]) -> str:
    """Computes deterministic SHA-256 hash of manifest excluding the 'manifest_hash' field itself.

    Prevents circular self-hashing by serializing keys in sorted order without the hash key.
    """
    payload = {k: v for k, v in manifest.items() if k != "manifest_hash"}
    canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def generate_barpeta_manifest(repo_root: Path | str) -> dict[str, Any]:
    """Generates canonical manifest for the Barpeta relocation artifacts."""
    root = Path(repo_root)
    artifacts = {
        "barpeta.geojson": root / "data" / "raw" / "boundaries" / "barpeta.geojson",
        "habitations.parquet": root / "data" / "interim" / "relocation" / "barpeta" / "habitations.parquet",
        "candidate_site_rows.jsonl": root / "data" / "processed" / "relocation" / "barpeta" / "candidate_site_rows.jsonl",
        "relocation_plan_rows.jsonl": root / "data" / "processed" / "relocation" / "barpeta" / "relocation_plan_rows.jsonl",
    }

    artifact_hashes = {name: compute_file_sha256(path) for name, path in artifacts.items()}

    manifest: dict[str, Any] = {
        "dataset": "barpeta_relocation",
        "version": "r01",
        "district": "Barpeta",
        "state": "Assam",
        "source_pipeline": "external_gis_v1",
        "pipeline_version": "v1.0",
        "artifacts": artifact_hashes,
        "expected_counts": {
            "habitations": 14,
            "candidate_sites": 629,
            "external_recommendations": 14,
        },
    }

    manifest["manifest_hash"] = compute_manifest_payload_hash(manifest)
    return manifest
