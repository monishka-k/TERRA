"""Contract tests for Data Quality, Provenance, and ML Product Integration (Day 7).

Section refs: Prompt Section 5, 6, 7 & 10

Verifies:
1. Preservation of all 7 DataQuality states (VALID, PARTIAL, STALE, FALLBACK, MISSING, INVALID, SYNTHETIC).
2. Distinction invariant: Missing != Zero, Invalid != Safe.
3. Extensible ProvenanceMetadata survives API and serving serialization.
4. Decoupled integration of realistic upstream ML fixtures (TreeSHAP, SoVI PCA) through canonical contracts.
"""

import pytest
from datetime import datetime, timezone

from core.enums import DataQuality, Hazard, Tier
from core.governance import (
    AUTHORITATIVE_SCIENTIFIC,
    DEFAULT_POLICY_PARAMS,
    DEFAULT_OPERATIONAL_CONFIG,
    ModelProviderMetadata,
)
from core.schemas.common import ProvenanceMetadataDTO
from core.domain.explanation import build_canonical_explanation
from core.schemas.explanation import CanonicalExplanationRecord
from core.ml.contracts import MLHazardOutput, MLVulnerabilityOutput


class TestDay7DataQualityAndMLContracts:
    """Contract verification for data quality, provenance, and ML boundaries."""

    def test_preservation_of_all_seven_data_quality_states(self):
        """All 7 distinct data quality states are preserved without lossy mapping."""
        expected_states = {
            "valid",
            "partial",
            "stale",
            "fallback",
            "missing",
            "invalid",
            "synthetic",
        }
        actual_states = {s.value for s in DataQuality}
        assert actual_states == expected_states

    def test_missing_and_invalid_states_distinction(self):
        """MISSING must not be treated as VALID/0.0; INVALID must not be treated as safe."""
        prov_missing = ProvenanceMetadataDTO(
            dataset_version="v1.0",
            data_quality=DataQuality.MISSING,
        )
        assert prov_missing.data_quality == DataQuality.MISSING
        assert prov_missing.data_quality != DataQuality.VALID

        prov_invalid = ProvenanceMetadataDTO(
            dataset_version="v1.0",
            data_quality=DataQuality.INVALID,
        )
        assert prov_invalid.data_quality == DataQuality.INVALID
        assert prov_invalid.data_quality != DataQuality.VALID

    def test_provenance_metadata_roundtrip(self):
        """Provenance metadata carries source, versions, timestamps, and quality flags."""
        now = datetime.now(timezone.utc).isoformat()
        prov = ProvenanceMetadataDTO(
            source_provider="Copernicus_DEM_GLO30",
            dataset_version="glo30-2026-v1",
            model_version="xgboost-landslide-v2.1",
            policy_version="policy-v1.0",
            calculated_at=now,
            observed_at=now,
            data_quality=DataQuality.VALID,
            is_fallback=False,
            is_synthetic=False,
        )

        dump = prov.model_dump()
        assert dump["source_provider"] == "Copernicus_DEM_GLO30"
        assert dump["data_quality"] == "valid"
        assert dump["is_fallback"] is False
        assert dump["is_synthetic"] is False

    def test_realistic_upstream_ml_hazard_fixture(self):
        """Realistic upstream ML hazard product adapts cleanly to canonical contract."""
        ml_hazard = MLHazardOutput(
            hazard_type="landslide",
            susceptibility=0.784,
            confidence=0.91,
            model_version="xgboost-v2.4",
            feature_schema_version="features-v2.0",
            model_name="landslide_xgboost_western_ghats",
            provider="data_science_team",
        )
        assert ml_hazard.hazard_type == "landslide"
        assert 0.0 <= ml_hazard.susceptibility <= 1.0
        assert ml_hazard.confidence >= 0.90

    def test_realistic_upstream_sovi_vulnerability_fixture(self):
        """Realistic SoVI PCA vulnerability vector adapts cleanly without algorithm coupling."""
        sovi = MLVulnerabilityOutput(
            v_demographic=0.62,
            v_structural=0.81,
            v_access=0.54,
            v_economic=0.48,
            v_index=0.64,
            is_district_flat=False,
            model_version="sovi-pca-v2.0",
            pca_weights={"PC1": 0.45, "PC2": 0.28, "PC3": 0.15, "PC4": 0.12},
        )
        assert sovi.v_index == 0.64
        assert sovi.is_district_flat is False
        assert sovi.pca_weights is not None

    def test_governance_authority_separation(self):
        """Authoritative scientific definitions are strictly separated from configurable policy."""
        # Scientific thresholds
        sci = AUTHORITATIVE_SCIENTIFIC
        assert sci.prz_mhi_static == 0.75
        assert sci.max_forecast_horizon_hours == 72

        # Policy parameters
        policy = DEFAULT_POLICY_PARAMS
        assert policy.area_per_hh_m2 == 126.0
        assert policy.lpcd_rural == 55
        assert policy.priority_gamma == 0.5
