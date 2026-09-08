"""Unit and contract regression tests for Pass 8: M11 + M12 Explanation DTO Consolidation.

Validates:
1. M11: HabitationRiskDossier.top_contributing_factors uses canonical FeatureContributionDTO.
2. M12: Single canonical FeatureContributionDTO definition in core.schemas.explanation is reused everywhere.
3. Legacy factor dictionary normalization preserves exact values, ranks, and weights.
4. Validation rejects invalid contribution structures.
5. JSON serialization across API boundaries preserves wire format.
"""

import pytest
from pydantic import ValidationError
from datetime import date

from core.schemas.explanation import FeatureContributionDTO as CanonicalFeatureContributionDTO
from core.schemas.zones import FeatureContributionDTO as ZonesFeatureContributionDTO
from core.schemas import FeatureContributionDTO as RootFeatureContributionDTO
from core.schemas.habitations import HabitationRiskDossier, VulnerabilityBreakdownDTO
from core.domain.explanation import normalize_feature_contributions
from core.enums import Tier
from api.services.habitations_service import HabitationsService
from unittest.mock import MagicMock


class TestM12DTOConsolidation:
    """M12: Verifies that duplicate and parallel DTO definitions are eliminated."""

    def test_single_canonical_feature_contribution_dto(self):
        """Proves that core.schemas.zones, core.schemas, and core.schemas.explanation export the exact same class."""
        assert ZonesFeatureContributionDTO is CanonicalFeatureContributionDTO
        assert RootFeatureContributionDTO is CanonicalFeatureContributionDTO

    def test_canonical_dto_fields_and_optionality(self):
        """Verifies canonical DTO field types, defaults, and optionality."""
        dto = CanonicalFeatureContributionDTO(
            feature="slope_deg",
            value=32.5,
            contribution=0.45,
        )
        assert dto.feature == "slope_deg"
        assert dto.value == 32.5
        assert dto.contribution == 0.45
        assert dto.method == "heuristic"  # Default
        assert dto.rank is None            # Default optional


class TestM11HabitationExplanationTyping:
    """M11: Verifies that HabitationRiskDossier.top_contributing_factors is strictly typed."""

    def test_habitation_risk_dossier_field_type(self):
        """Proves that top_contributing_factors is typed as list[FeatureContributionDTO]."""
        field_info = HabitationRiskDossier.model_fields["top_contributing_factors"]
        # In Pydantic v2, annotation is list[FeatureContributionDTO]
        assert "FeatureContributionDTO" in str(field_info.annotation)

    def test_habitation_risk_dossier_accepts_valid_dtos(self):
        """Proves that HabitationRiskDossier accepts and serializes FeatureContributionDTO items."""
        factors = [
            CanonicalFeatureContributionDTO(feature="Slope Angle", value=28.0, contribution=0.45, rank=1),
            CanonicalFeatureContributionDTO(feature="PRZ Overlap", value=82.0, contribution=0.82, rank=2),
        ]
        dossier = HabitationRiskDossier(
            id=1,
            name="Chooralmala",
            population=3840,
            households=860,
            centroid=[76.1689, 11.5432],
            priority_score=0.42,
            caseload_score=1612.8,
            tier=Tier.IMMEDIATE,
            triage_rationale="Assigned to IMMEDIATE tier",
            prz_overlap_pct=82.5,
            hazard_intensity=0.85,
            decayed_loss_score=1.2,
            vulnerability=VulnerabilityBreakdownDTO(
                v_demographic=0.58,
                v_structural=0.72,
                v_access=0.65,
                v_economic=0.60,
                v_index=0.64,
            ),
            top_contributing_factors=factors,
        )

        assert len(dossier.top_contributing_factors) == 2
        assert isinstance(dossier.top_contributing_factors[0], CanonicalFeatureContributionDTO)
        assert dossier.top_contributing_factors[0].feature == "Slope Angle"
        assert dossier.top_contributing_factors[0].contribution == 0.45
        assert dossier.top_contributing_factors[0].rank == 1

        # Check JSON serialization
        dumped = dossier.model_dump(mode="json")
        factors_dumped = dumped["top_contributing_factors"]
        assert len(factors_dumped) == 2
        assert factors_dumped[0]["feature"] == "Slope Angle"
        assert factors_dumped[0]["value"] == 28.0
        assert factors_dumped[0]["contribution"] == 0.45
        assert factors_dumped[0]["rank"] == 1

    def test_habitation_risk_dossier_rejects_invalid_contribution_dicts(self):
        """M11 Validation: Proves that arbitrary, invalid dictionaries are rejected rather than silently accepted."""
        with pytest.raises(ValidationError):
            HabitationRiskDossier(
                id=1,
                name="Chooralmala",
                population=100,
                households=20,
                centroid=[76.0, 11.0],
                priority_score=0.1,
                caseload_score=10.0,
                triage_rationale="test",
                prz_overlap_pct=10.0,
                hazard_intensity=0.2,
                decayed_loss_score=0.0,
                vulnerability=VulnerabilityBreakdownDTO(
                    v_demographic=0.1,
                    v_structural=0.1,
                    v_access=0.1,
                    v_economic=0.1,
                    v_index=0.1,
                ),
                top_contributing_factors=[
                    {"arbitrary_invalid_key": 12345}  # Missing feature/name and contribution/weight
                ],
            )


class TestSemanticAndValuePreservation:
    """Proves that underlying explanation values and semantics remain 100% identical."""

    def test_legacy_database_seeded_factors_normalization(self):
        """Normalizes stored database fixture dicts (with name, contribution, type) without value loss.
        
        Verifies that 'type' (hazard category) does not corrupt the explanation method ('heuristic').
        """
        seeded_db_payload = [
            {"name": "Slope & Terrain Curvature", "contribution": 0.45, "type": "hazard"},
            {"name": "Permanent Red Zone Overlap", "contribution": 0.82, "type": "exposure"},
            {"name": "Structural Housing Vulnerability", "contribution": 0.72, "type": "vulnerability"},
        ]
        normalized = normalize_feature_contributions(seeded_db_payload, default_method="heuristic")
        assert len(normalized) == 3
        # Sorted descending by absolute magnitude
        assert normalized[0].feature == "Permanent Red Zone Overlap"
        assert normalized[0].contribution == 0.82
        assert normalized[0].rank == 1
        assert normalized[0].method == "heuristic"  # Retains genuine explanation method, NOT domain category

        assert normalized[1].feature == "Structural Housing Vulnerability"
        assert normalized[1].contribution == 0.72
        assert normalized[1].rank == 2
        assert normalized[1].method == "heuristic"

        assert normalized[2].feature == "Slope & Terrain Curvature"
        assert normalized[2].contribution == 0.45
        assert normalized[2].rank == 3
        assert normalized[2].method == "heuristic"

    def test_legacy_evaluator_factors_normalization(self):
        """Normalizes PriorityScoringEngine factor dicts (with factor, weight) without value loss."""
        eval_payload = [
            {"factor": "PRZ Built-up Exposure", "weight": 0.80, "method": "heuristic"},
            {"factor": "Vulnerability Index", "weight": 0.60, "method": "heuristic"},
            {"factor": "Hazard Intensity", "weight": 0.85, "method": "heuristic"},
            {"factor": "Historical Loss Decay", "weight": 1.20, "method": "heuristic"},
        ]
        normalized = normalize_feature_contributions(eval_payload)
        assert len(normalized) == 4
        # Sorted by magnitude
        assert normalized[0].feature == "Historical Loss Decay"
        assert normalized[0].contribution == 1.20
        assert normalized[0].rank == 1

        assert normalized[1].feature == "Hazard Intensity"
        assert normalized[1].contribution == 0.85
        assert normalized[1].rank == 2

        assert normalized[2].feature == "PRZ Built-up Exposure"
        assert normalized[2].contribution == 0.80
        assert normalized[2].rank == 3

        assert normalized[3].feature == "Vulnerability Index"
        assert normalized[3].contribution == 0.60
        assert normalized[3].rank == 4

    def test_habitations_service_dossier_construction(self):
        """Verifies end-to-end service construction returns strongly-typed top_contributing_factors."""
        mock_db = MagicMock()
        service = HabitationsService(mock_db)

        raw_habitation = {
            "id": 1,
            "lgd_code": 627101,
            "name": "Chooralmala",
            "type": "village",
            "admin_id": 555,
            "admin_name": "Wayanad",
            "lat": 11.5432,
            "lon": 76.1689,
            "population": 3840,
            "households": 860,
            "v_demographic": 0.58,
            "v_structural": 0.72,
            "v_access": 0.65,
            "v_economic": 0.60,
            "v_index": 0.64,
            "hazard_intensity": 0.85,
            "prz_overlap_pct": 82.5,
            "active_deformation": True,
            "fatal_event_last_3_monsoons": True,
            "priority_score": 0.65,
            "caseload_score": 2496.0,
            "tier": "immediate",
            "triage_rationale": "Assigned to IMMEDIATE tier",
            "contributing_factors": [
                {"name": "Slope & Terrain Curvature", "contribution": 0.45, "type": "hazard"},
                {"name": "Permanent Red Zone Overlap", "contribution": 0.82, "type": "exposure"},
            ],
        }

        service.repo.get_habitation_by_id = MagicMock(return_value=raw_habitation)
        service.repo.get_nearby_disaster_events = MagicMock(return_value=[])

        dossier = service.get_habitation_risk_dossier(1)
        assert len(dossier.top_contributing_factors) == 2
        for f in dossier.top_contributing_factors:
            assert isinstance(f, CanonicalFeatureContributionDTO)

        # Check values
        f1, f2 = dossier.top_contributing_factors
        assert f1.feature == "Permanent Red Zone Overlap"
        assert f1.contribution == 0.82
        assert f1.rank == 1

        assert f2.feature == "Slope & Terrain Curvature"
        assert f2.contribution == 0.45
        assert f2.rank == 2


class TestCompatibilityAndValidationBoundaries:
    """Rigorous tests proving Accepted (legitimate legacy) vs Rejected (malformed/fabricated) inputs.
    
    Guarantees:
    - Only legitimate ML TreeSHAP contract mappings (name -> feature, shap_value -> contribution) are accepted.
    - Missing or null value is strictly REJECTED (no false evidence 0.0 manufactured).
    - Loose/ambiguous keys (weight, factor) are REJECTED by the canonical DTO.
    - Hazard domain category ('type') does NOT corrupt explanation 'method'.
    """

    def test_accepted_canonical_representation(self):
        """Proves canonical dictionary shape validates without alteration."""
        raw = {"feature": "slope_deg", "value": 31.5, "contribution": 0.42, "method": "treeshap", "rank": 1}
        dto = CanonicalFeatureContributionDTO.model_validate(raw)
        assert dto.feature == "slope_deg"
        assert dto.value == 31.5
        assert dto.contribution == 0.42
        assert dto.method == "treeshap"
        assert dto.rank == 1

    def test_accepted_legitimate_ml_contract_representation(self):
        """Proves legitimate TreeSHAP payloads (name, value, shap_value) adapt cleanly without value fabrication."""
        raw = {"name": "dist_to_road_m", "value": 120.0, "shap_value": 0.35}
        dto = CanonicalFeatureContributionDTO.model_validate(raw)
        assert dto.feature == "dist_to_road_m"
        assert dto.value == 120.0
        assert dto.contribution == 0.35
        assert dto.method == "heuristic"  # Default
        assert dto.rank is None

    def test_rejected_missing_value_never_manufactures_zero(self):
        """Evidence Integrity: Proves missing 'value' is rejected rather than silently fabricated as 0.0."""
        raw_missing_value = {"feature": "slope_deg", "contribution": 0.42}
        with pytest.raises(ValidationError) as exc_info:
            CanonicalFeatureContributionDTO.model_validate(raw_missing_value)
        errors = exc_info.value.errors()
        assert any(err["loc"] == ("value",) and err["type"] == "missing" for err in errors)

    def test_rejected_null_value(self):
        """Evidence Integrity: Proves explicit null value is rejected rather than coerced to 0.0."""
        raw_null_value = {"feature": "slope_deg", "value": None, "contribution": 0.42}
        with pytest.raises(ValidationError) as exc_info:
            CanonicalFeatureContributionDTO.model_validate(raw_null_value)
        errors = exc_info.value.errors()
        assert any(err["loc"] == ("value",) for err in errors)

    def test_rejected_weight_as_contribution(self):
        """Semantic Safety: Model/scoring 'weight' is not an attribution and must not be accepted as contribution."""
        raw_with_weight = {"feature": "PRZ Built-up Exposure", "value": 0.80, "weight": 0.80}
        with pytest.raises(ValidationError) as exc_info:
            CanonicalFeatureContributionDTO.model_validate(raw_with_weight)
        errors = exc_info.value.errors()
        assert any(err["loc"] == ("contribution",) and err["type"] == "missing" for err in errors)

    def test_rejected_factor_as_feature(self):
        """Contract Strictness: Internal priority engine key 'factor' is not a canonical DTO field."""
        raw_with_factor = {"factor": "Hazard Intensity", "value": 0.85, "contribution": 0.85}
        with pytest.raises(ValidationError) as exc_info:
            CanonicalFeatureContributionDTO.model_validate(raw_with_factor)
        errors = exc_info.value.errors()
        assert any(err["loc"] == ("feature",) and err["type"] == "missing" for err in errors)

    def test_rejected_hazard_category_type_does_not_corrupt_method(self):
        """Method Semantic Preservation: Hazard domain category 'type' ('hazard', 'exposure') must NOT overwrite 'method'."""
        raw = {"feature": "Slope & Curvature", "value": 24.0, "contribution": 0.45, "type": "hazard"}
        dto = CanonicalFeatureContributionDTO.model_validate(raw)
        assert dto.method == "heuristic"  # Stays default explanation method, NOT corrupted to 'hazard'

    def test_rejected_malformed_and_ambiguous_dictionaries(self):
        """Malformed Data Rejection: Dictionaries with non-contract fields must be rejected."""
        with pytest.raises(ValidationError):
            CanonicalFeatureContributionDTO.model_validate({"arbitrary_invalid_key": 12345})
        with pytest.raises(ValidationError):
            CanonicalFeatureContributionDTO.model_validate({"name": "slope_deg"})
        with pytest.raises(ValidationError):
            CanonicalFeatureContributionDTO.model_validate({"shap_value": 0.5})

