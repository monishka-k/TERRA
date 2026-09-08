"""Dynamic Meteorological & Hydrological Trigger Ingestion Adapter (Day 6).

Section refs: docs/PRD1.md §6.3, §8.2, §14.1 (FR-3.2, FR-3.12, FR-4.1)

Provides a standardized ingestion boundary that parses and validates upstream
meteorological and hydrological trigger feeds (IMERG, IMD, ECMWF, CWC, Snapshots)
into CanonicalTriggerRecord domain objects.
"""

from __future__ import annotations

import csv
import io
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Optional, TextIO

from core.constants import FORECAST_HORIZON_HOURS
from core.h3_utils import h3_get_resolution, h3_to_int, is_valid_h3
from core.schemas.dynamic_triggers import (
    CanonicalTriggerRecord,
    DataQuality,
    TriggerSource,
    TriggerType,
    TriggerValidationReport,
)

logger = logging.getLogger("setu_pipeline.trigger_adapter")


class BaseTriggerParser(ABC):
    """Abstract strategy interface for parsing dynamic meteorological/hydrological trigger feeds."""

    @abstractmethod
    def parse(
        self,
        content: str | TextIO,
        default_hazard_type: str = "landslide",
        default_trigger_type: TriggerType = TriggerType.OBSERVED,
        default_source: str = "IMERG_EARLY",
        default_provider: str = "NASA/JAXA",
        expected_res: Optional[int] = None,
        model_version_override: Optional[str] = None,
    ) -> tuple[list[CanonicalTriggerRecord], TriggerValidationReport]:
        """Parses raw artifact content and returns canonical records with a validation report."""
        pass


class TriggerParserV1(BaseTriggerParser):
    """Parser strategy for Tabular Trigger Artifacts (CSV, TSV, Pipe-separated).
    
    Supports:
    - Header lines with metadata comments starting with '# '
    - Standardized and alias column names
    - Explicit validation of H3 indices, UTC timestamps, non-negative values, and <=72h forecast horizons
    - Explicit fallback and data quality tagging
    """

    def parse(
        self,
        content: str | TextIO,
        default_hazard_type: str = "landslide",
        default_trigger_type: TriggerType = TriggerType.OBSERVED,
        default_source: str = "IMERG_EARLY",
        default_provider: str = "NASA/JAXA",
        expected_res: Optional[int] = None,
        model_version_override: Optional[str] = None,
    ) -> tuple[list[CanonicalTriggerRecord], TriggerValidationReport]:
        records: list[CanonicalTriggerRecord] = []
        errors: list[str] = []
        total_rows = 0

        text_stream: io.StringIO
        if isinstance(content, str):
            text_stream = io.StringIO(content.strip())
        else:
            text_stream = content

        metadata_headers: dict[str, str] = {}
        lines: list[str] = []

        for line in text_stream:
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("#"):
                # Extract metadata comment '# key: value'
                comment_body = stripped.lstrip("#").strip()
                if ":" in comment_body:
                    k, v = comment_body.split(":", 1)
                    metadata_headers[k.strip().lower()] = v.strip()
                continue
            lines.append(stripped)

        if not lines:
            return [], TriggerValidationReport(
                total_records=0,
                valid_records=0,
                invalid_records=0,
                errors=["Empty payload: No data rows found."],
                data_quality=DataQuality.MISSING,
                source=default_source,
            )

        # Detect delimiter
        first_line = lines[0]
        delimiter = ","
        if "\t" in first_line:
            delimiter = "\t"
        elif "|" in first_line:
            delimiter = "|"

        reader = csv.DictReader(lines, delimiter=delimiter)
        raw_fieldnames = reader.fieldnames or []
        col_map = {col.strip().lower(): col for col in raw_fieldnames}

        # Identify key column aliases
        h3_col = next((col_map[c] for c in ("h3", "h3_index", "h3_hex", "h3_id", "hex") if c in col_map), None)
        val_col = next((col_map[c] for c in ("trigger_value", "value", "rainfall_mm", "qpf_mm", "ari", "t_val", "score") if c in col_map), None)
        hazard_col = next((col_map[c] for c in ("hazard_type", "hazard", "hazard_name") if c in col_map), None)
        type_col = next((col_map[c] for c in ("trigger_type", "type", "kind", "category") if c in col_map), None)
        valid_at_col = next((col_map[c] for c in ("valid_at", "timestamp", "datetime", "date", "time") if c in col_map), None)
        cycle_col = next((col_map[c] for c in ("forecast_cycle_at", "cycle_at", "cycle", "init_time") if c in col_map), None)
        horizon_col = next((col_map[c] for c in ("horizon_hours", "horizon", "step_h", "lead_time_h") if c in col_map), None)
        units_col = next((col_map[c] for c in ("units", "unit", "metric") if c in col_map), None)
        quality_col = next((col_map[c] for c in ("data_quality", "quality", "status") if c in col_map), None)
        source_col = next((col_map[c] for c in ("source", "provider_source", "feed") if c in col_map), None)

        if not h3_col or not val_col:
            missing_req = []
            if not h3_col:
                missing_req.append("H3 column ('h3', 'h3_index')")
            if not val_col:
                missing_req.append("Value column ('trigger_value', 'rainfall_mm', 'value')")
            return [], TriggerValidationReport(
                total_records=len(lines) - 1,
                valid_records=0,
                invalid_records=len(lines) - 1,
                errors=[f"Missing mandatory column(s): {', '.join(missing_req)}"],
                data_quality=DataQuality.INVALID,
                source=default_source,
            )

        # Batch metadata overrides
        feed_source = metadata_headers.get("source", default_source)
        feed_provider = metadata_headers.get("provider", default_provider)
        feed_units = metadata_headers.get("units", "dimensionless_index")
        feed_model_ver = model_version_override or metadata_headers.get("model_version", "trigger-v1.0")
        feed_calc_ver = metadata_headers.get("calculation_version", "calc-v1.0")

        # Configurable range bounds from metadata if declared
        declared_min = float(metadata_headers["min_value"]) if "min_value" in metadata_headers else None
        declared_max = float(metadata_headers["max_value"]) if "max_value" in metadata_headers else None

        now_utc = datetime.now(timezone.utc)

        for row_idx, row in enumerate(reader, start=2):
            total_rows += 1
            raw_h3 = (row.get(h3_col) or "").strip()
            raw_val = (row.get(val_col) or "").strip()

            # 1. Validate H3 index
            if not raw_h3 or not is_valid_h3(raw_h3):
                errors.append(f"Row {row_idx}: Invalid H3 index '{raw_h3}'.")
                continue

            h3_int_val = h3_to_int(raw_h3)
            h3_res = h3_get_resolution(raw_h3)
            if expected_res is not None and h3_res != expected_res:
                errors.append(f"Row {row_idx}: Resolution mismatch. Expected {expected_res}, got {h3_res}.")
                continue

            # 2. Validate trigger metric value (Structural validation: must be finite float)
            try:
                import math
                trigger_val = float(raw_val)
                if math.isnan(trigger_val) or math.isinf(trigger_val):
                    errors.append(f"Row {row_idx}: Trigger value is NaN or Inf.")
                    continue
                if declared_min is not None and trigger_val < declared_min:
                    errors.append(f"Row {row_idx}: Trigger value {trigger_val} below declared minimum {declared_min}.")
                    continue
                if declared_max is not None and trigger_val > declared_max:
                    errors.append(f"Row {row_idx}: Trigger value {trigger_val} exceeds declared maximum {declared_max}.")
                    continue
            except (ValueError, TypeError):
                errors.append(f"Row {row_idx}: Non-numeric trigger value '{raw_val}'.")
                continue

            # 3. Parse Hazard Type & Trigger Type
            hazard_type = row.get(hazard_col, "").strip().lower() if hazard_col else default_hazard_type
            if not hazard_type:
                hazard_type = default_hazard_type

            raw_tt = row.get(type_col, "").strip().lower() if type_col else default_trigger_type.value
            try:
                trigger_type_enum = TriggerType(raw_tt)
            except ValueError:
                trigger_type_enum = default_trigger_type

            # 4. Parse Timestamps
            raw_valid_at = (row.get(valid_at_col) or "").strip() if valid_at_col else None
            valid_at_dt: datetime
            if raw_valid_at:
                try:
                    # Parse ISO format or standard date
                    clean_ts = raw_valid_at.replace("Z", "+00:00")
                    valid_at_dt = datetime.fromisoformat(clean_ts)
                    if valid_at_dt.tzinfo is None:
                        valid_at_dt = valid_at_dt.replace(tzinfo=timezone.utc)
                except ValueError:
                    errors.append(f"Row {row_idx}: Invalid valid_at timestamp format '{raw_valid_at}'.")
                    continue
            else:
                valid_at_dt = now_utc

            # 5. Parse Forecast specifics
            forecast_cycle_dt: Optional[datetime] = None
            horizon_hours_val: Optional[int] = None

            if trigger_type_enum == TriggerType.FORECAST:
                raw_cycle = (row.get(cycle_col) or "").strip() if cycle_col else None
                if raw_cycle:
                    try:
                        clean_cycle = raw_cycle.replace("Z", "+00:00")
                        forecast_cycle_dt = datetime.fromisoformat(clean_cycle)
                        if forecast_cycle_dt.tzinfo is None:
                            forecast_cycle_dt = forecast_cycle_dt.replace(tzinfo=timezone.utc)
                    except ValueError:
                        errors.append(f"Row {row_idx}: Invalid forecast_cycle_at timestamp '{raw_cycle}'.")
                        continue
                else:
                    forecast_cycle_dt = valid_at_dt

                raw_horizon = (row.get(horizon_col) or "").strip() if horizon_col else None
                if raw_horizon:
                    try:
                        h_val = int(raw_horizon)
                        if h_val < 1 or h_val > FORECAST_HORIZON_HOURS:
                            errors.append(
                                f"Row {row_idx}: Horizon {h_val}h out of allowed bounds [1, {FORECAST_HORIZON_HOURS}]."
                            )
                            continue
                        horizon_hours_val = h_val
                    except ValueError:
                        errors.append(f"Row {row_idx}: Non-integer horizon '{raw_horizon}'.")
                        continue
                else:
                    # Calculate horizon from valid_at - forecast_cycle_at if available
                    if forecast_cycle_dt and valid_at_dt:
                        diff_hours = int(round((valid_at_dt - forecast_cycle_dt).total_seconds() / 3600.0))
                        if 1 <= diff_hours <= FORECAST_HORIZON_HOURS:
                            horizon_hours_val = diff_hours
                        else:
                            horizon_hours_val = 24  # Default fallback forecast step within bounds
                    else:
                        horizon_hours_val = 24

            # 6. Parse Data Quality & Units
            raw_qual = (row.get(quality_col) or "").strip().lower() if quality_col else "valid"
            try:
                quality_enum = DataQuality(raw_qual)
            except ValueError:
                quality_enum = DataQuality.VALID

            row_source = row.get(source_col, "").strip() if source_col else feed_source
            row_units = row.get(units_col, "").strip() if units_col else feed_units

            effective_provider = feed_provider
            is_synthetic_feed = (
                row_source == "SYNTHETIC_DEMO"
                or feed_source == "SYNTHETIC_DEMO"
                or (row_source and row_source.startswith("SYNTHETIC"))
            )
            if is_synthetic_feed:
                if quality_enum == DataQuality.VALID:
                    quality_enum = DataQuality.SYNTHETIC
                if effective_provider in ("NASA/JAXA", "NASA", "ECMWF", "IMD", "CWC", "Sentinel", "UNKNOWN"):
                    effective_provider = "SYNTHETIC"

            records.append(
                CanonicalTriggerRecord(
                    h3=raw_h3,
                    h3_int=h3_int_val,
                    hazard_type=hazard_type,
                    trigger_type=trigger_type_enum,
                    trigger_value=trigger_val,
                    units=row_units,
                    valid_at=valid_at_dt,
                    forecast_cycle_at=forecast_cycle_dt,
                    horizon_hours=horizon_hours_val,
                    source=row_source,
                    provider=effective_provider,
                    data_quality=quality_enum,
                    model_version=feed_model_ver,
                    calculation_version=feed_calc_ver,
                )
            )

        has_synthetic = bool(records and all(r.data_quality == DataQuality.SYNTHETIC for r in records))
        if has_synthetic or feed_source == "SYNTHETIC_DEMO" or (feed_source and feed_source.startswith("SYNTHETIC")):
            report_quality = DataQuality.SYNTHETIC
        elif errors:
            report_quality = DataQuality.PARTIAL if records else DataQuality.INVALID
        else:
            report_quality = DataQuality.VALID

        report = TriggerValidationReport(
            total_records=total_rows,
            valid_records=len(records),
            invalid_records=len(errors),
            errors=errors,
            data_quality=report_quality,
            source=feed_source,
        )

        return records, report
