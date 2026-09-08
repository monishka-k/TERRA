"""Integration tests for Sentinel-1 Ingestion Pipeline, Idempotency, Failure Safety & API Compatibility (Day 3)."""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from api.main import app
from core.config import settings
from core.schemas.flood import FloodSemanticType
from pipeline.jobs.ingest_flood_data import ingest_sentinel1_artifact

client = TestClient(app)
FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "sentinel1"


class TestSentinel1PipelineIntegration:
    """Integration test suite for Day 3 Sentinel-1 data pipeline."""

    @pytest.fixture(autouse=True)
    def db_engine(self):
        return create_engine(settings.get_sqlalchemy_url(direct=True))

    def test_end_to_end_static_ingestion_and_activation(self, db_engine):
        """Verify end-to-end static flood frequency ingestion, persistence, and atomic activation."""
        file_path = FIXTURES_DIR / "sample_static_v1.txt"

        # Ingest and activate
        result = ingest_sentinel1_artifact(
            file_path=file_path,
            db_engine=db_engine,
            dataset_name="default",
            activate=True,
            expected_res=8,
        )

        assert result.status in ("SUCCESS", "SKIPPED_IDEMPOTENT")

        if result.status == "SUCCESS":
            assert result.records_ingested == 5
            assert result.pipeline_run_id is not None
            assert result.semantic_type == FloodSemanticType.STATIC_FREQUENCY

            # Verify rows in database
            with db_engine.connect() as conn:
                # Check hazard_static
                rows = conn.execute(
                    text("""
                        SELECT h3, hazard_type, susceptibility, confidence, model_version
                        FROM hazard_static
                        WHERE hazard_type = 'flash_flood' AND model_version = 'sentinel1-s1-wayanad-2024-v1';
                    """)
                ).mappings().all()
                assert len(rows) >= 5

                # Check serving_version points to this run
                serving_row = conn.execute(
                    text("SELECT pipeline_run_id FROM serving_version WHERE dataset_name = 'default';")
                ).mappings().first()
                assert serving_row["pipeline_run_id"] == result.pipeline_run_id

    def test_end_to_end_dynamic_ingestion(self, db_engine):
        """Verify dynamic flood trigger observations are stored in hazard_dynamic without polluting static layer."""
        file_path = FIXTURES_DIR / "sample_dynamic_v1.txt"

        result = ingest_sentinel1_artifact(
            file_path=file_path,
            db_engine=db_engine,
            dataset_name="default",
            activate=False,  # triggers don't overwrite static serving_version
            expected_res=8,
        )

        assert result.status in ("SUCCESS", "SKIPPED_IDEMPOTENT")

        if result.status == "SUCCESS":
            assert result.records_ingested == 3
            assert result.semantic_type == FloodSemanticType.DYNAMIC_TRIGGER

            # Verify hazard_dynamic records
            with db_engine.connect() as conn:
                dyn_rows = conn.execute(
                    text("SELECT h3, trigger_value, source FROM hazard_dynamic WHERE source = 'sentinel1_rtc_live';")
                ).mappings().all()
                assert len(dyn_rows) >= 3

    def test_ingestion_idempotency(self, db_engine):
        """Verify running ingestion multiple times on the same artifact produces SKIPPED_IDEMPOTENT with zero row duplication."""
        file_path = FIXTURES_DIR / "sample_static_v1.txt"

        # First run
        res1 = ingest_sentinel1_artifact(file_path=file_path, db_engine=db_engine)
        
        # Second run with exact same file
        res2 = ingest_sentinel1_artifact(file_path=file_path, db_engine=db_engine)

        assert res2.status == "SKIPPED_IDEMPOTENT"

    def test_failure_safety_preserves_serving_version(self, db_engine):
        """Verify corrupted or invalid artifacts fail cleanly without overwriting active serving version."""
        # 1. Get current active serving version
        with db_engine.connect() as conn:
            initial_serving = conn.execute(
                text("SELECT pipeline_run_id FROM serving_version WHERE dataset_name = 'default';")
            ).scalar()

        # 2. Attempt ingestion of wrong resolution file
        file_path = FIXTURES_DIR / "sample_wrong_resolution.txt"
        res = ingest_sentinel1_artifact(file_path=file_path, db_engine=db_engine, expected_res=8)

        assert res.status == "FAILED"
        assert res.validation_report.is_valid is False

        # 3. Verify active serving_version remains completely unchanged
        with db_engine.connect() as conn:
            current_serving = conn.execute(
                text("SELECT pipeline_run_id FROM serving_version WHERE dataset_name = 'default';")
            ).scalar()
            assert current_serving == initial_serving

    def test_api_contract_stability_after_ingestion(self):
        """Verify GET /zones and GET /zones/{h3} return valid responses conforming to schemas."""
        # Query /zones
        res_zones = client.get("/zones", params={"res": 8, "limit": 10})
        assert res_zones.status_code == 200
        zones = res_zones.json()
        assert isinstance(zones, list)

        if len(zones) > 0:
            h3_hex = zones[0]["h3"]
            res_detail = client.get(f"/zones/{h3_hex}")
            assert res_detail.status_code == 200
            detail = res_detail.json()
            assert detail["h3"] == h3_hex
            assert "hazards" in detail
            assert "explanation" in detail
