"""Sentinel-1 Flood Ingestion and Safe Activation Pipeline Job (Day 3).

Orchestrates the end-to-end ingestion lifecycle:
1. Artifact discovery and SHA256 checksum calculation.
2. Idempotency checking (reuses existing run if identical snapshot exists).
3. Strict validation through Sentinel1Adapter.
4. Failure-safe staging: Invalid data NEVER touches or corrupts active serving dataset.
5. Atomic persistence into PostgreSQL (hazard_static / hazard_dynamic).
6. Controlled serving_version promotion and provenance recording.
"""

import sys
import uuid
import hashlib
import logging
from dataclasses import dataclass
from typing import Optional, Any
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from core.config import settings
from core.enums import Hazard
from core.schemas.flood import FloodSemanticType, CanonicalFloodRecord, ValidationReport
from pipeline.adapters.sentinel1_adapter import sentinel1_adapter
from pipeline.jobs.compute_dynamic_hazard import compute_and_persist_dynamic_snapshots

logger = logging.getLogger("setu_pipeline.ingest_flood_data")


@dataclass
class IngestionResult:
    """Outcome of the Sentinel-1 ingestion execution."""
    status: str  # 'SUCCESS', 'FAILED', 'SKIPPED_IDEMPOTENT'
    pipeline_run_id: Optional[uuid.UUID]
    dataset_version: str
    semantic_type: FloodSemanticType
    records_ingested: int
    validation_report: ValidationReport
    error: Optional[str] = None


def compute_file_sha256(file_path: Path) -> str:
    """Computes SHA256 hash of a file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def ingest_sentinel1_artifact(
    file_path: str | Path,
    db_engine: Optional[Engine] = None,
    dataset_name: str = "default",
    activate: bool = True,
    expected_res: int = 8,
    aoi_lgd: Optional[int] = None,
    dataset_version_override: Optional[str] = None,
) -> IngestionResult:
    """Ingests a Sentinel-1 flood artifact with strict validation, failure safety, and idempotency."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Sentinel-1 artifact not found: '{file_path}'")

    engine = db_engine or create_engine(settings.get_sqlalchemy_url(direct=True))
    sha256 = compute_file_sha256(path)
    file_size = path.stat().st_size
    now = datetime.now(timezone.utc)

    logger.info(f"Starting Sentinel-1 ingestion for '{path.name}' (SHA256: {sha256[:12]}..., Size: {file_size} bytes)")

    # 1. Check Idempotency
    with engine.connect() as conn:
        existing_run = conn.execute(
            text("""
                SELECT r.id, r.status, r.config_version, s.metadata
                FROM pipeline_run r
                JOIN source_snapshot s ON r.source_snapshot_id = s.id
                WHERE s.sha256 = :sha256 AND r.status IN ('READY', 'COMPLETED')
                ORDER BY r.started_at DESC LIMIT 1;
            """),
            {"sha256": sha256},
        ).mappings().first()

        if existing_run:
            run_id = existing_run["id"]
            logger.info(f"Idempotency check passed: artifact already ingested in PipelineRun {run_id}. Skipping.")
            return IngestionResult(
                status="SKIPPED_IDEMPOTENT",
                pipeline_run_id=run_id,
                dataset_version=existing_run["config_version"] or "existing",
                semantic_type=FloodSemanticType.STATIC_FREQUENCY,
                records_ingested=0,
                validation_report=ValidationReport(
                    dataset_version=existing_run["config_version"] or "existing",
                    total_rows=0,
                    accepted_rows=0,
                ),
            )

    # 2. Parse & Validate Artifact through Ingestion Boundary
    records, report = sentinel1_adapter.parse_artifact_file(
        file_path=path,
        aoi_lgd=aoi_lgd,
        expected_res=expected_res,
        dataset_version_override=dataset_version_override,
    )

    # 3. Failure Safety Check
    if not report.is_valid or len(records) == 0:
        error_msg = (
            f"Artifact validation failed for '{path.name}': "
            f"{report.rejected_rows} rejected rows out of {report.total_rows} total rows. "
            f"Errors: {[e.model_dump() for e in report.errors[:5]]}"
        )
        logger.error(error_msg)

        # Record failed pipeline run for auditability WITHOUT modifying serving dataset
        with engine.begin() as conn:
            snapshot_id = uuid.uuid4()
            conn.execute(
                text("""
                    INSERT INTO source_snapshot (id, source_id, retrieved_at, uri, sha256, size_bytes, metadata)
                    VALUES (:id, :source_id, :now, :uri, :sha256, :size_bytes, CAST(:metadata AS jsonb));
                """),
                {
                    "id": snapshot_id,
                    "source_id": report.source,
                    "now": now,
                    "uri": str(path),
                    "sha256": sha256,
                    "size_bytes": file_size,
                    "metadata": '{"validation_error": true}',
                },
            )

            failed_run_id = uuid.uuid4()
            conn.execute(
                text("""
                    INSERT INTO pipeline_run (
                        id, run_type, status, started_at, completed_at,
                        code_version, config_version, model_version, source_snapshot_id, error
                    ) VALUES (
                        :id, 'flood_ingest', 'FAILED', :now, :now,
                        'day3-s1-ingest', :config_ver, 's1-v1.0', :snapshot_id, :error
                    );
                """),
                {
                    "id": failed_run_id,
                    "now": now,
                    "config_ver": report.dataset_version,
                    "snapshot_id": snapshot_id,
                    "error": error_msg[:500],
                },
            )

        # Return FAILED result while keeping existing serving version untouched
        return IngestionResult(
            status="FAILED",
            pipeline_run_id=failed_run_id,
            dataset_version=report.dataset_version,
            semantic_type=report.semantic_type,
            records_ingested=0,
            validation_report=report,
            error=error_msg,
        )

    # 4. Atomic Transaction: Persist Validated Canonical Records & Activate Dataset
    pipeline_run_id = uuid.uuid4()
    snapshot_id = uuid.uuid4()

    with engine.begin() as conn:
        # 4.1 Record Source Snapshot
        conn.execute(
            text("""
                INSERT INTO source_snapshot (id, source_id, retrieved_at, uri, sha256, size_bytes, metadata)
                VALUES (:id, :source_id, :now, :uri, :sha256, :size_bytes, CAST(:metadata AS jsonb));
            """),
            {
                "id": snapshot_id,
                "source_id": report.source,
                "now": now,
                "uri": str(path),
                "sha256": sha256,
                "size_bytes": file_size,
                "metadata": '{"format_version": "' + report.format_version + '", "accepted_rows": ' + str(report.accepted_rows) + '}',
            },
        )

        # 4.2 Record Pipeline Run in RUNNING state
        conn.execute(
            text("""
                INSERT INTO pipeline_run (
                    id, run_type, status, started_at,
                    code_version, config_version, model_version, source_snapshot_id
                ) VALUES (
                    :id, 'flood_ingest', 'RUNNING', :now,
                    'day3-s1-ingest', :config_ver, 's1-v1.0', :snapshot_id
                );
            """),
            {
                "id": pipeline_run_id,
                "now": now,
                "config_ver": report.dataset_version,
                "snapshot_id": snapshot_id,
            },
        )

        # 4.3 Bulk Persist according to Semantic Type
        if report.semantic_type == FloodSemanticType.STATIC_FREQUENCY:
            logger.info(f"Persisting {len(records)} static flood susceptibility records into hazard_static...")
            
            # Prepare rows
            static_rows = []
            for rec in records:
                static_rows.append({
                    "h3": rec.h3_int,
                    "hazard_type": Hazard.FLASH_FLOOD.value,
                    "susceptibility": rec.value,
                    "confidence": rec.confidence,
                    "model_version": f"sentinel1-{rec.dataset_version}",
                    "pipeline_run_id": pipeline_run_id,
                })

            # Upsert into hazard_static
            for chunk in _chunker(static_rows, 1000):
                conn.execute(
                    text("""
                        INSERT INTO hazard_static (h3, hazard_type, susceptibility, confidence, model_version, pipeline_run_id)
                        VALUES (:h3, :hazard_type, :susceptibility, :confidence, :model_version, :pipeline_run_id)
                        ON CONFLICT (h3, hazard_type) DO UPDATE SET
                            susceptibility = EXCLUDED.susceptibility,
                            confidence = EXCLUDED.confidence,
                            model_version = EXCLUDED.model_version,
                            pipeline_run_id = EXCLUDED.pipeline_run_id;
                    """),
                    chunk,
                )

        elif report.semantic_type == FloodSemanticType.DYNAMIC_TRIGGER:
            logger.info(f"Persisting {len(records)} dynamic flood trigger observations into hazard_dynamic...")
            
            dynamic_rows = []
            for rec in records:
                dynamic_rows.append({
                    "h3": rec.h3_int,
                    "hazard_type": Hazard.FLASH_FLOOD.value,
                    "valid_at": rec.valid_at or now,
                    "ingested_at": now,
                    "trigger_value": rec.value,
                    "source": rec.source,
                    "pipeline_run_id": pipeline_run_id,
                })

            for chunk in _chunker(dynamic_rows, 1000):
                conn.execute(
                    text("""
                        INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, ingested_at, trigger_value, source, pipeline_run_id)
                        VALUES (:h3, :hazard_type, :valid_at, :ingested_at, :trigger_value, :source, :pipeline_run_id);
                    """),
                    chunk,
                )

            # B7 Production Flow: Automatically trigger dynamic hazard evaluation for staged timestamps
            distinct_valid_timestamps = {r["valid_at"] for r in dynamic_rows}
            for v_ts in distinct_valid_timestamps:
                compute_and_persist_dynamic_snapshots(
                    db=conn,
                    valid_at=v_ts,
                    pipeline_run_id=pipeline_run_id,
                )

        # 4.4 Mark Pipeline Run as READY
        conn.execute(
            text("""
                UPDATE pipeline_run
                SET status = 'READY', completed_at = :completed_at
                WHERE id = :run_id;
            """),
            {"run_id": pipeline_run_id, "completed_at": datetime.now(timezone.utc)},
        )

        # 4.5 Staged Publication: Atomically activate dataset if requested
        if activate:
            conn.execute(
                text("""
                    INSERT INTO serving_version (dataset_name, pipeline_run_id, updated_at)
                    VALUES (:dataset_name, :run_id, :now)
                    ON CONFLICT (dataset_name) DO UPDATE SET
                        pipeline_run_id = EXCLUDED.pipeline_run_id,
                        updated_at = EXCLUDED.updated_at;
                """),
                {"dataset_name": dataset_name, "run_id": pipeline_run_id, "now": now},
            )
            logger.info(f"Published dataset '{dataset_name}' with PipelineRun {pipeline_run_id}.")

    logger.info(f"Successfully completed Sentinel-1 ingestion job. Ingested {len(records)} canonical records.")
    return IngestionResult(
        status="SUCCESS",
        pipeline_run_id=pipeline_run_id,
        dataset_version=report.dataset_version,
        semantic_type=report.semantic_type,
        records_ingested=len(records),
        validation_report=report,
    )


def _chunker(seq: list[Any], size: int = 1000):
    return (seq[pos:pos + size] for pos in range(0, len(seq), size))


if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    parser = argparse.ArgumentParser(description="SETU-DRR Sentinel-1 Flood Ingestion Pipeline")
    parser.add_argument("file_path", type=str, help="Path to Sentinel-1 .txt / .csv artifact")
    parser.add_argument("--dataset-name", default="default", help="Dataset name in serving_version")
    parser.add_argument("--res", type=int, default=8, help="Expected H3 grid resolution (default: 8)")
    parser.add_argument("--no-activate", action="store_true", help="Do not activate dataset in serving_version")

    args = parser.parse_args()
    res = ingest_sentinel1_artifact(
        file_path=args.file_path,
        dataset_name=args.dataset_name,
        activate=not args.no_activate,
        expected_res=args.res,
    )
    print(f"\nIngestion Result: {res.status}")
    print(f"Pipeline Run ID:  {res.pipeline_run_id}")
    print(f"Records Ingested: {res.records_ingested}")
    if res.error:
        print(f"Error:            {res.error}")
