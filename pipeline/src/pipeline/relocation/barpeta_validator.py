"""Validation layer for Barpeta relocation pipeline artifacts.

Ensures manifest integrity, spatial AOI containment, numeric bounds,
referential consistency, and strict preservation of unmeasured data gaps (NULLs).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd
from shapely import wkt
from shapely.geometry import Point, shape
from shapely.geometry.base import BaseGeometry

from pipeline.relocation.manifest_util import (
    compute_file_sha256,
    compute_manifest_payload_hash,
)


class BarpetaValidationError(Exception):
    """Raised when Barpeta artifact validation fails."""

    pass


@dataclass
class ValidationReport:
    """Structured report produced by BarpetaValidator."""

    is_valid: bool = True
    manifest_hash: str = ""
    habitations_count: int = 0
    candidate_sites_count: int = 0
    external_recommendations_count: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class BarpetaValidator:
    """Validates external Barpeta relocation artifacts prior to staging or database ingestion."""

    def __init__(self, repo_root: Path | str | None = None) -> None:
        if repo_root is None:
            self.root = Path(__file__).resolve().parents[4]
        else:
            self.root = Path(repo_root)

        self.manifest_path = self.root / "data" / "processed" / "relocation" / "barpeta" / "manifest.json"
        self.boundary_path = self.root / "data" / "raw" / "boundaries" / "barpeta.geojson"
        self.habitations_path = self.root / "data" / "interim" / "relocation" / "barpeta" / "habitations.parquet"
        self.sites_path = self.root / "data" / "processed" / "relocation" / "barpeta" / "candidate_site_rows.jsonl"
        self.recs_path = self.root / "data" / "processed" / "relocation" / "barpeta" / "relocation_plan_rows.jsonl"

    def validate_all(self) -> ValidationReport:
        """Runs the complete suite of validations on the Barpeta artifacts."""
        report = ValidationReport()

        try:
            manifest = self.validate_manifest(report)
            poly = self.validate_boundary(report)
            hab_ids = self.validate_habitations(poly, manifest, report)
            site_ids = self.validate_candidate_sites(poly, manifest, report)
            self.validate_external_recommendations(hab_ids, site_ids, manifest, report)
        except BarpetaValidationError as e:
            report.is_valid = False
            report.errors.append(str(e))
        except Exception as e:
            report.is_valid = False
            report.errors.append(f"Unexpected validation error: {e}")

        if report.errors:
            report.is_valid = False

        return report

    def validate_manifest(self, report: ValidationReport) -> dict[str, Any]:
        """Validates manifest integrity, checksums, and non-circular manifest_hash."""
        if not self.manifest_path.is_file():
            raise BarpetaValidationError(f"Manifest file not found: {self.manifest_path}")

        try:
            with open(self.manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception as e:
            raise BarpetaValidationError(f"Failed to parse manifest JSON: {e}") from e

        # 1. Verify manifest_hash
        claimed_hash = manifest.get("manifest_hash")
        if not claimed_hash:
            raise BarpetaValidationError("Manifest is missing 'manifest_hash'")

        computed_manifest_hash = compute_manifest_payload_hash(manifest)
        if computed_manifest_hash != claimed_hash:
            raise BarpetaValidationError(
                f"Manifest payload hash mismatch: computed {computed_manifest_hash} != {claimed_hash}"
            )
        report.manifest_hash = claimed_hash

        # 2. Verify artifact checksums
        artifacts = manifest.get("artifacts", {})
        artifact_paths = {
            "barpeta.geojson": self.boundary_path,
            "habitations.parquet": self.habitations_path,
            "candidate_site_rows.jsonl": self.sites_path,
            "relocation_plan_rows.jsonl": self.recs_path,
        }

        for name, expected_sha in artifacts.items():
            path = artifact_paths.get(name)
            if not path or not path.is_file():
                raise BarpetaValidationError(f"Artifact file listed in manifest does not exist: {name} at {path}")
            actual_sha = compute_file_sha256(path)
            if actual_sha != expected_sha:
                raise BarpetaValidationError(
                    f"Checksum mismatch for {name}: expected {expected_sha}, computed {actual_sha}"
                )

        return manifest

    def validate_boundary(self, report: ValidationReport) -> BaseGeometry:
        """Validates Barpeta boundary polygon."""
        if not self.boundary_path.is_file():
            raise BarpetaValidationError(f"Boundary file not found: {self.boundary_path}")

        try:
            with open(self.boundary_path, "r", encoding="utf-8") as f:
                geo = json.load(f)
            features = geo.get("features", [])
            if not features:
                raise BarpetaValidationError("Boundary GeoJSON contains no features")
            geom = features[0].get("geometry")
            poly = shape(geom)
            if not poly.is_valid:
                raise BarpetaValidationError("Boundary geometry is invalid Shapely geometry")
            return poly
        except Exception as e:
            raise BarpetaValidationError(f"Error loading boundary polygon: {e}") from e

    def validate_habitations(
        self,
        boundary_polygon: BaseGeometry,
        manifest: dict[str, Any],
        report: ValidationReport,
    ) -> set[str]:
        """Validates habitation records: counts, bounds, uniqueness, and AOI containment."""
        try:
            df = pd.read_parquet(self.habitations_path)
        except Exception as e:
            raise BarpetaValidationError(f"Error reading habitations parquet: {e}") from e

        report.habitations_count = len(df)
        expected = manifest.get("expected_counts", {}).get("habitations", 14)
        if len(df) != expected:
            raise BarpetaValidationError(f"Habitations count mismatch: found {len(df)}, expected {expected}")

        # Uniqueness of ID
        ids = df["habitation_id"].tolist()
        if len(ids) != len(set(ids)):
            raise BarpetaValidationError("Duplicate habitation_id found in habitations.parquet")

        for _, row in df.iterrows():
            hid = row["habitation_id"]
            if row.get("population", 0) < 0:
                raise BarpetaValidationError(f"Negative population in habitation {hid}")
            if row.get("households", 0) < 0:
                raise BarpetaValidationError(f"Negative households in habitation {hid}")

            lon, lat = row["lon"], row["lat"]
            pt = Point(lon, lat)
            if not boundary_polygon.covers(pt):
                raise BarpetaValidationError(
                    f"Habitation {hid} at ({lon}, {lat}) is outside Barpeta boundary polygon"
                )

        return set(ids)

    def validate_candidate_sites(
        self,
        boundary_polygon: BaseGeometry,
        manifest: dict[str, Any],
        report: ValidationReport,
    ) -> set[str]:
        """Validates candidate sites: count, uniqueness, honest NULL gaps, and AOI containment."""
        try:
            with open(self.sites_path, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
        except Exception as e:
            raise BarpetaValidationError(f"Error reading candidate sites jsonl: {e}") from e

        report.candidate_sites_count = len(lines)
        expected = manifest.get("expected_counts", {}).get("candidate_sites", 629)
        if len(lines) != expected:
            raise BarpetaValidationError(f"Candidate sites count mismatch: found {len(lines)}, expected {expected}")

        polygon_ids: set[str] = set()

        for idx, line in enumerate(lines):
            try:
                site = json.loads(line)
            except Exception as e:
                raise BarpetaValidationError(f"Malformed JSON on line {idx + 1} of candidate sites: {e}") from e

            p_id = site.get("polygon_id")
            if not p_id:
                raise BarpetaValidationError(f"Missing polygon_id on line {idx + 1}")
            if p_id in polygon_ids:
                raise BarpetaValidationError(f"Duplicate polygon_id found: {p_id}")
            polygon_ids.add(p_id)

            # Strict check: Honest data gaps must NOT be coerced to 0 or arbitrary numbers
            if site.get("mhi_max") is not None:
                raise BarpetaValidationError(
                    f"Site {p_id} has mhi_max={site['mhi_max']}. Raw Barpeta screening candidates must have mhi_max=NULL"
                )
            if site.get("cc_water") is not None:
                raise BarpetaValidationError(f"Site {p_id} has cc_water={site['cc_water']}. Raw screening must have cc_water=NULL")
            if site.get("cc_school") is not None:
                raise BarpetaValidationError(f"Site {p_id} has cc_school={site['cc_school']}. Raw screening must have cc_school=NULL")
            if site.get("cc_health") is not None:
                raise BarpetaValidationError(f"Site {p_id} has cc_health={site['cc_health']}. Raw screening must have cc_health=NULL")

            # If raw file contains offline cc_final / binding_constraint, note that SETU enforces honest NULLs in DB
            if site.get("cc_final") is not None or site.get("binding_constraint") is not None:
                if len(report.warnings) == 0:
                    report.warnings.append(
                        "Candidate sites contain external cc_final/binding_constraint; SETU loader will enforce honest NULL in canonical candidate_site table until full assessment."
                    )

            # Numeric bounds on screening metrics
            area_ha = site.get("area_ha")
            if area_ha is None or area_ha <= 0:
                raise BarpetaValidationError(f"Site {p_id} has invalid area_ha: {area_ha}")

            slope = site.get("slope_mean")
            if slope is None or slope < 0:
                raise BarpetaValidationError(f"Site {p_id} has invalid slope_mean: {slope}")

            cc_land = site.get("cc_land")
            if cc_land is None or cc_land < 0:
                raise BarpetaValidationError(f"Site {p_id} has invalid cc_land: {cc_land}")

            # AOI containment
            centroid_wkt_str = site.get("centroid_wkt", "")
            if not centroid_wkt_str:
                raise BarpetaValidationError(f"Site {p_id} missing centroid_wkt")

            clean_wkt = centroid_wkt_str.split(";", 1)[-1] if ";" in centroid_wkt_str else centroid_wkt_str
            try:
                pt = wkt.loads(clean_wkt)
            except Exception as e:
                raise BarpetaValidationError(f"Site {p_id} invalid centroid WKT: {centroid_wkt_str} ({e})") from e

            if not boundary_polygon.covers(pt):
                raise BarpetaValidationError(
                    f"Site {p_id} centroid ({pt.x}, {pt.y}) is outside Barpeta boundary polygon"
                )

        return polygon_ids

    def validate_external_recommendations(
        self,
        habitation_ids: set[str],
        site_polygon_ids: set[str],
        manifest: dict[str, Any],
        report: ValidationReport,
    ) -> None:
        """Validates external recommendations: count, bounds, and referential integrity."""
        try:
            with open(self.recs_path, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
        except Exception as e:
            raise BarpetaValidationError(f"Error reading recommendations jsonl: {e}") from e

        report.external_recommendations_count = len(lines)
        expected = manifest.get("expected_counts", {}).get("external_recommendations", 14)
        if len(lines) != expected:
            raise BarpetaValidationError(
                f"External recommendations count mismatch: found {len(lines)}, expected {expected}"
            )

        for idx, line in enumerate(lines):
            try:
                rec = json.loads(line)
            except Exception as e:
                raise BarpetaValidationError(f"Malformed JSON on line {idx + 1} of recommendations: {e}") from e

            hid = rec.get("habitation_id")
            sid = rec.get("site_id")

            if not hid or hid not in habitation_ids:
                raise BarpetaValidationError(
                    f"Recommendation line {idx + 1} references unknown habitation_id: {hid}"
                )
            if not sid or sid not in site_polygon_ids:
                raise BarpetaValidationError(
                    f"Recommendation line {idx + 1} references unknown site_id: {sid}"
                )

            if rec.get("households", 0) < 0:
                raise BarpetaValidationError(f"Recommendation line {idx + 1} has negative households")
            if rec.get("distance_km", 0.0) < 0.0:
                raise BarpetaValidationError(f"Recommendation line {idx + 1} has negative distance_km")
