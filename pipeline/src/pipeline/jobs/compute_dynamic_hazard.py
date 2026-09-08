"""Dynamic Hazard Computation and Snapshot Persistence Pipeline Job (B7).

Connects:
hazard_dynamic (persisted triggers)
    ↓
DynamicHazardEvaluator (authoritative compute_hazard_score & compute_mhi)
    ↓
mhi_snapshot (persisted Multi-Hazard Index with live/forecast channel preservation)
    ↓
zones / alerts read paths (GET /zones, GET /alerts/active, GET /alerts/forecast)
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, List, Optional, Sequence

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Session

from core.constants import BETA, HAZARD_WEIGHTS
from core.enums import Hazard, ZoneClass
from core.schemas.dynamic_triggers import CanonicalTriggerRecord
from pipeline.hazard.dynamic_evaluator import DynamicHazardEvaluator

logger = logging.getLogger("setu_pipeline.compute_dynamic_hazard")


@dataclass
class DynamicProcessingResult:
    """Outcome report of dynamic hazard evaluation and snapshot persistence."""
    status: str  # 'SUCCESS', 'NO_DATA', 'FAILED'
    snapshots_persisted: int
    valid_timestamps: list[datetime] = field(default_factory=list)
    h3_cells_processed: int = 0
    pipeline_run_id: Optional[uuid.UUID] = None
    error: Optional[str] = None


def _chunker(seq: Sequence[Any], size: int = 1000) -> Iterable[Sequence[Any]]:
    """Yield successive chunks of size from sequence."""
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def compute_and_persist_dynamic_snapshots(
    db: Session | Engine | Connection,
    valid_at: Optional[datetime] = None,
    h3_list: Optional[Sequence[int]] = None,
    aoi_lgd: Optional[int] = None,
    pipeline_run_id: Optional[uuid.UUID] = None,
    beta: float = BETA,
) -> DynamicProcessingResult:
    """Computes dynamic hazard scores and persists snapshots into mhi_snapshot.
    
    Reads real persisted dynamic triggers from hazard_dynamic, joins with static
    susceptibility from hazard_static, applies domain formulas, and performs
    a safe bidirectional live/forecast merge into mhi_snapshot.
    
    Args:
        db: SQLAlchemy Session, Engine, or Connection.
        valid_at: Specific timestamp to process. If None, processes all timestamps in hazard_dynamic.
        h3_list: Optional filter to restrict computation to specific H3 cell integers.
        aoi_lgd: Optional filter for administrative boundary LGD code.
        pipeline_run_id: Optional UUID of the parent pipeline_run.
        beta: Dynamic trigger amplification exponent (default core.constants.BETA = 1.0).
        
    Returns:
        DynamicProcessingResult summarizing persisted snapshot records and timestamps.
    """
    evaluator = DynamicHazardEvaluator(beta=beta, hazard_weights=HAZARD_WEIGHTS)

    # Resolve session vs connection vs engine
    session_managed = False
    if isinstance(db, Session):
        session = db
    elif isinstance(db, Engine):
        session = Session(db)
        session_managed = True
    elif isinstance(db, Connection):
        session = Session(bind=db)
        session_managed = True
    else:
        raise ValueError(f"Unsupported db type: {type(db)}")

    try:
        # 1. Determine target valid_at timestamps
        if valid_at is not None:
            target_timestamps = [valid_at]
        else:
            time_query = text("""
                SELECT DISTINCT valid_at 
                FROM hazard_dynamic 
                ORDER BY valid_at ASC;
            """)
            rows = session.execute(time_query).mappings().fetchall()
            target_timestamps = [r["valid_at"] for r in rows]

        if not target_timestamps:
            logger.info("No dynamic trigger timestamps found in hazard_dynamic to evaluate.")
            return DynamicProcessingResult(
                status="NO_DATA",
                snapshots_persisted=0,
                valid_timestamps=[],
                h3_cells_processed=0,
                pipeline_run_id=pipeline_run_id,
            )

        total_persisted = 0
        all_processed_cells: set[int] = set()
        successful_timestamps: list[datetime] = []

        for ts in target_timestamps:
            # 2. Query dynamic triggers for this timestamp
            # Ordered by forecast_cycle_at DESC, ingested_at DESC, id DESC so that
            # for any (h3, hazard_type), the first row encountered is the latest authoritative observation/cycle.
            trigger_params: dict[str, Any] = {"valid_at": ts}
            where_clauses = ["hd.valid_at = :valid_at"]

            if h3_list:
                where_clauses.append("hd.h3 = ANY(:h3_list)")
                trigger_params["h3_list"] = [int(x) for x in h3_list]

            if aoi_lgd:
                where_clauses.append("(gc.admin_id = :aoi_lgd OR ab.lgd_code = :aoi_lgd)")
                trigger_params["aoi_lgd"] = int(aoi_lgd)

            join_clause = ""
            if aoi_lgd:
                join_clause = """
                    JOIN grid_cell gc ON hd.h3 = gc.h3
                    LEFT JOIN admin_boundary ab ON gc.admin_id = ab.id
                """

            where_sql = " AND ".join(where_clauses)
            trigger_sql = text(f"""
                SELECT 
                    hd.id,
                    hd.h3,
                    hd.hazard_type,
                    hd.valid_at,
                    hd.forecast_cycle_at,
                    hd.trigger_value,
                    hd.source
                FROM hazard_dynamic hd
                {join_clause}
                WHERE {where_sql}
                ORDER BY hd.h3, hd.hazard_type, hd.forecast_cycle_at DESC NULLS LAST, hd.ingested_at DESC, hd.id DESC;
            """)

            trigger_rows = session.execute(trigger_sql, trigger_params).mappings().fetchall()
            if not trigger_rows:
                continue

            # Group triggers by cell into observed (live) and forecast
            live_triggers_by_h3: dict[int, dict[Hazard, float]] = {}
            fcst_triggers_by_h3: dict[int, dict[Hazard, float]] = {}
            ts_cells: set[int] = set()

            for r in trigger_rows:
                h_int = int(r["h3"])
                ts_cells.add(h_int)
                raw_hz = r["hazard_type"]
                try:
                    hz_enum = Hazard(raw_hz.lower().strip())
                except ValueError:
                    # Unsupported or unmapped hazard type, skip
                    continue

                t_val = float(r["trigger_value"])
                is_forecast = r["forecast_cycle_at"] is not None

                if is_forecast:
                    if h_int not in fcst_triggers_by_h3:
                        fcst_triggers_by_h3[h_int] = {}
                    # Only take latest cycle/ingestion (due to ORDER BY)
                    if hz_enum not in fcst_triggers_by_h3[h_int]:
                        fcst_triggers_by_h3[h_int][hz_enum] = t_val
                else:
                    if h_int not in live_triggers_by_h3:
                        live_triggers_by_h3[h_int] = {}
                    if hz_enum not in live_triggers_by_h3[h_int]:
                        live_triggers_by_h3[h_int][hz_enum] = t_val

            if not ts_cells:
                continue

            # 3. Query static susceptibilities for affected cells from hazard_static
            cell_list = list(ts_cells)
            static_sql = text("""
                SELECT h3, hazard_type, susceptibility
                FROM hazard_static
                WHERE h3 = ANY(:cell_list);
            """)
            static_rows = session.execute(static_sql, {"cell_list": cell_list}).mappings().fetchall()

            static_by_h3: dict[int, dict[Hazard, float]] = {}
            for sr in static_rows:
                h_int = int(sr["h3"])
                raw_hz = sr["hazard_type"]
                try:
                    hz_enum = Hazard(raw_hz.lower().strip())
                except ValueError:
                    continue
                if h_int not in static_by_h3:
                    static_by_h3[h_int] = {}
                static_by_h3[h_int][hz_enum] = float(sr["susceptibility"])

            # 4. Query existing snapshot values for affected cells at (h3, valid_at) for safe bidirectional channel merge
            existing_sql = text("""
                SELECT h3, mhi_live, mhi_fcst
                FROM mhi_snapshot
                WHERE valid_at = :valid_at AND h3 = ANY(:cell_list);
            """)
            existing_rows = session.execute(
                existing_sql, {"valid_at": ts, "cell_list": cell_list}
            ).mappings().fetchall()

            existing_by_h3: dict[int, tuple[Optional[float], Optional[float]]] = {}
            for er in existing_rows:
                h_int = int(er["h3"])
                ex_live = float(er["mhi_live"]) if er["mhi_live"] is not None else None
                ex_fcst = float(er["mhi_fcst"]) if er["mhi_fcst"] is not None else None
                existing_by_h3[h_int] = (ex_live, ex_fcst)

            # 5. Check 25-year fatal events for cells (for PRZ classification precedence)
            fatal_cells: set[int] = set()
            try:
                fatal_sql = text("""
                    SELECT DISTINCT gc.h3
                    FROM grid_cell gc
                    JOIN disaster_event de ON ST_Intersects(gc.geom, de.geom)
                    WHERE gc.h3 = ANY(:cell_list) AND de.fatalities > 0 AND de.ts >= (CURRENT_DATE - INTERVAL '25 years');
                """)
                fatal_rows = session.execute(fatal_sql, {"cell_list": cell_list}).mappings().fetchall()
                fatal_cells = {int(fr["h3"]) for fr in fatal_rows}
            except Exception as e:
                logger.debug(f"Disaster event query bypassed: {e}")

            # 6. Evaluate each cell using DynamicHazardEvaluator
            snapshot_rows: list[dict[str, Any]] = []

            for h_int in ts_cells:
                static_hazards = static_by_h3.get(h_int)
                if not static_hazards:
                    # Cell has no static susceptibility records in hazard_static; cannot evaluate
                    continue

                live_map = live_triggers_by_h3.get(h_int)
                fcst_map = fcst_triggers_by_h3.get(h_int)
                ex_live, ex_fcst = existing_by_h3.get(h_int, (None, None))
                has_fatal = h_int in fatal_cells

                eval_cell = evaluator.evaluate_cell(
                    h3=h_int,
                    static_susceptibilities=static_hazards,
                    live_triggers=live_map,
                    forecast_triggers=fcst_map,
                    existing_mhi_live=ex_live,
                    existing_mhi_fcst=ex_fcst,
                    has_fatal_event_25yr=has_fatal,
                )

                snapshot_rows.append({
                    "h3": h_int,
                    "valid_at": ts,
                    "mhi_static": round(eval_cell.mhi_static, 4),
                    "mhi_live": round(eval_cell.mhi_live, 4),
                    "mhi_fcst": round(eval_cell.mhi_fcst, 4) if eval_cell.mhi_fcst is not None else None,
                    "dominant_hazard": eval_cell.dominant_hazard.value,
                    "zone_class": eval_cell.zone_class.value,
                    "pipeline_run_id": pipeline_run_id,
                    "has_live": h_int in live_triggers_by_h3,
                    "has_fcst": h_int in fcst_triggers_by_h3,
                })
                all_processed_cells.add(h_int)

            if not snapshot_rows:
                continue

            # 7. Idempotent Upsert into mhi_snapshot
            # Uses ON CONFLICT (h3, valid_at) DO UPDATE with conditional column updates.
            # This guarantees database-level atomic preservation: a run with only live triggers
            # cannot erase an existing forecast value, and a run with only forecast triggers
            # cannot erase an existing live value (preventing concurrent lost updates).
            upsert_sql = text("""
                INSERT INTO mhi_snapshot (
                    h3, valid_at, mhi_static, mhi_live, mhi_fcst, dominant_hazard, zone_class, pipeline_run_id
                ) VALUES (
                    :h3, :valid_at, :mhi_static, :mhi_live, :mhi_fcst, :dominant_hazard, :zone_class, :pipeline_run_id
                ) ON CONFLICT (h3, valid_at) DO UPDATE SET
                    mhi_static = EXCLUDED.mhi_static,
                    mhi_live = CASE 
                        WHEN :has_live THEN EXCLUDED.mhi_live 
                        ELSE mhi_snapshot.mhi_live 
                    END,
                    mhi_fcst = CASE 
                        WHEN :has_fcst THEN EXCLUDED.mhi_fcst 
                        ELSE mhi_snapshot.mhi_fcst 
                    END,
                    dominant_hazard = CASE 
                        WHEN :has_live THEN EXCLUDED.dominant_hazard 
                        ELSE COALESCE(mhi_snapshot.dominant_hazard, EXCLUDED.dominant_hazard) 
                    END,
                    zone_class = EXCLUDED.zone_class,
                    pipeline_run_id = COALESCE(EXCLUDED.pipeline_run_id, mhi_snapshot.pipeline_run_id);
            """)

            for chunk in _chunker(snapshot_rows, size=500):
                session.execute(upsert_sql, chunk)

            total_persisted += len(snapshot_rows)
            successful_timestamps.append(ts)

        session.commit()
        logger.info(
            f"Successfully evaluated and persisted {total_persisted} mhi_snapshot records "
            f"across {len(successful_timestamps)} timestamps for {len(all_processed_cells)} H3 cells."
        )

        return DynamicProcessingResult(
            status="SUCCESS",
            snapshots_persisted=total_persisted,
            valid_timestamps=successful_timestamps,
            h3_cells_processed=len(all_processed_cells),
            pipeline_run_id=pipeline_run_id,
        )

    except Exception as e:
        session.rollback()
        logger.error(f"Failed dynamic hazard snapshot evaluation: {e}", exc_info=True)
        return DynamicProcessingResult(
            status="FAILED",
            snapshots_persisted=0,
            valid_timestamps=[],
            h3_cells_processed=0,
            pipeline_run_id=pipeline_run_id,
            error=str(e),
        )
    finally:
        if session_managed:
            session.close()


def ingest_and_compute_triggers(
    db: Session | Engine | Connection,
    records: Sequence[CanonicalTriggerRecord],
    pipeline_run_id: Optional[uuid.UUID] = None,
) -> DynamicProcessingResult:
    """Persists a sequence of canonical trigger records into hazard_dynamic and computes snapshots.
    
    Generic entrypoint for external trigger ingestion feeds (IMERG, ECMWF, IMD, etc.)
    parsed into CanonicalTriggerRecords.
    """
    if not records:
        return DynamicProcessingResult(
            status="NO_DATA",
            snapshots_persisted=0,
            valid_timestamps=[],
            h3_cells_processed=0,
            pipeline_run_id=pipeline_run_id,
        )

    session_managed = False
    if isinstance(db, Session):
        session = db
    elif isinstance(db, Engine):
        session = Session(db)
        session_managed = True
    elif isinstance(db, Connection):
        session = Session(bind=db)
        session_managed = True
    else:
        raise ValueError(f"Unsupported db type: {type(db)}")

    now_utc = datetime.now(timezone.utc)
    distinct_timestamps: set[datetime] = set()

    try:
        dynamic_rows = []
        for r in records:
            distinct_timestamps.add(r.valid_at)
            dynamic_rows.append({
                "h3": r.h3_int,
                "hazard_type": r.hazard_type.lower().strip(),
                "valid_at": r.valid_at,
                "ingested_at": now_utc,
                "forecast_cycle_at": r.forecast_cycle_at,
                "trigger_value": max(0.0, float(r.trigger_value)),
                "source": r.source,
                "pipeline_run_id": pipeline_run_id,
            })

        insert_sql = text("""
            INSERT INTO hazard_dynamic (
                h3, hazard_type, valid_at, ingested_at, forecast_cycle_at, trigger_value, source, pipeline_run_id
            ) VALUES (
                :h3, :hazard_type, :valid_at, :ingested_at, :forecast_cycle_at, :trigger_value, :source, :pipeline_run_id
            );
        """)

        for chunk in _chunker(dynamic_rows, size=1000):
            session.execute(insert_sql, chunk)

        session.commit()

        # Compute dynamic snapshots for the ingested timestamps
        return compute_and_persist_dynamic_snapshots(
            db=session,
            pipeline_run_id=pipeline_run_id,
        )

    except Exception as e:
        session.rollback()
        logger.error(f"Failed to ingest and compute triggers: {e}", exc_info=True)
        return DynamicProcessingResult(
            status="FAILED",
            snapshots_persisted=0,
            valid_timestamps=[],
            h3_cells_processed=0,
            pipeline_run_id=pipeline_run_id,
            error=str(e),
        )
    finally:
        if session_managed:
            session.close()
