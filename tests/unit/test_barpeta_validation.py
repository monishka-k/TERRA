"""Unit tests for Barpeta artifact validation layer and manifest hashing."""

from __future__ import annotations

import json
from pathlib import Path
import pytest
from shapely.geometry import Point, box

from pipeline.relocation.barpeta_validator import (
    BarpetaValidationError,
    BarpetaValidator,
    ValidationReport,
)
from pipeline.relocation.manifest_util import (
    compute_file_sha256,
    compute_manifest_payload_hash,
)

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_barpeta_manifest_hash_non_circular():
    """Verifies that compute_manifest_payload_hash excludes manifest_hash itself and is deterministic."""
    manifest = {
        "dataset": "test_dataset",
        "district": "Barpeta",
        "manifest_hash": "existing_hash_should_be_ignored",
        "expected_counts": {"habitations": 14},
    }
    h1 = compute_manifest_payload_hash(manifest)

    # Changing manifest_hash should NOT change payload hash
    manifest["manifest_hash"] = "completely_different_hash"
    h2 = compute_manifest_payload_hash(manifest)
    assert h1 == h2

    # Changing payload content DOES change hash
    manifest["district"] = "Wayanad"
    h3 = compute_manifest_payload_hash(manifest)
    assert h1 != h3


def test_barpeta_validator_passes_canonical_artifacts():
    """Verifies that the canonical Barpeta artifacts pass all validation checks."""
    validator = BarpetaValidator(REPO_ROOT)
    report = validator.validate_all()
    assert report.is_valid is True
    assert report.habitations_count == 14
    assert report.candidate_sites_count == 629
    assert report.external_recommendations_count == 14
    assert len(report.errors) == 0


def test_barpeta_validator_catches_tampered_manifest(tmp_path: Path):
    """Verifies that tampered artifact hashes or invalid manifest_hash fail validation."""
    validator = BarpetaValidator(REPO_ROOT)
    report = ValidationReport()

    # Create dummy manifest with bad manifest_hash
    bad_manifest = {
        "dataset": "barpeta_relocation",
        "manifest_hash": "bad_hash",
        "artifacts": {},
    }
    manifest_file = tmp_path / "manifest.json"
    manifest_file.write_text(json.dumps(bad_manifest), encoding="utf-8")
    validator.manifest_path = manifest_file

    with pytest.raises(BarpetaValidationError, match="Manifest payload hash mismatch"):
        validator.validate_manifest(report)


def test_barpeta_validator_enforces_honest_null_lifelines():
    """Verifies that raw screening candidate sites with fake non-null lifelines fail validation."""
    validator = BarpetaValidator(REPO_ROOT)
    boundary = box(0, 0, 100, 100)
    manifest = {"expected_counts": {"candidate_sites": 1}}
    report = ValidationReport()

    # Fake site with cc_water populated in raw screening
    fake_site = {
        "polygon_id": "test_0",
        "area_ha": 5.0,
        "slope_mean": 1.0,
        "cc_land": 100,
        "mhi_max": None,
        "cc_water": 500,  # VIOLATION: raw screening should be NULL
        "cc_school": None,
        "cc_health": None,
        "centroid_wkt": "POINT(50 50)",
    }

    import tempfile
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".jsonl") as f:
        f.write(json.dumps(fake_site) + "\n")
        temp_sites = Path(f.name)

    validator.sites_path = temp_sites
    try:
        with pytest.raises(BarpetaValidationError, match="Raw screening must have cc_water=NULL"):
            validator.validate_candidate_sites(boundary, manifest, report)
    finally:
        temp_sites.unlink(missing_ok=True)
