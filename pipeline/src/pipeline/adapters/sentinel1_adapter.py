"""Sentinel-1 Ingestion Adapter & Parser Strategy (Day 3).

Provides an isolated ingestion boundary that parses and validates upstream
Sentinel-1 flood artifacts (.txt, .csv, .tsv) into canonical flood records.

Design Principles:
1. Upstream processing implementation independence: Changes in upstream scripts
   or column order do not affect core domain/hazard layers.
2. Versioned format handling via Strategy Pattern (BaseSentinel1Parser -> V1).
3. Strict deterministic validation (H3 format, resolution, bounds, UTC timestamps).
4. No arbitrary guessing: Fails clearly with structured error reports.
"""

import io
import re
import csv
import math
import logging
from abc import ABC, abstractmethod
from typing import Optional, TextIO
from datetime import datetime, timezone
from pathlib import Path

from core.h3_utils import is_valid_h3, h3_to_int, h3_to_str, h3_get_resolution
from core.schemas.flood import (
    FloodSemanticType,
    CanonicalFloodRecord,
    ValidationReport,
    RowValidationError,
)

logger = logging.getLogger("setu_pipeline.sentinel1_adapter")


class BaseSentinel1Parser(ABC):
    """Abstract strategy for parsing versioned Sentinel-1 artifacts."""

    @abstractmethod
    def parse(
        self,
        content: str | TextIO,
        aoi_lgd: Optional[int] = None,
        expected_res: int = 8,
        dataset_version_override: Optional[str] = None,
    ) -> tuple[list[CanonicalFloodRecord], ValidationReport]:
        """Parses raw artifact content and returns canonical records with a validation report."""
        pass


class Sentinel1TextParserV1(BaseSentinel1Parser):
    """Parser for Sentinel-1 Text Artifact Format Version 1.0.
    
    Expected Artifact Structure:
    - Optional metadata headers prefixed by '# ' (e.g. '# format_version: 1.0', '# dataset_version: s1-wayanad-2024-v1')
    - Header line with column names (comma, tab, or pipe separated)
    - Normalized column names recognized:
        * H3: 'h3', 'h3_index', 'h3_hex', 'h3_id'
        * Value: 'inundation_frequency', 'water_prob', 'sar_freq', 'flood_fraction', 'trigger_value', 'value'
        * Confidence: 'confidence', 'conf', 'quality' (optional, default 1.0)
        * Observation Count: 'observation_count', 'obs_count', 'n_scenes' (optional, default 1)
        * Valid Timestamp: 'valid_at', 'timestamp', 'obs_time', 'time' (required for dynamic trigger, optional for static)
        * Flags: 'flags', 'quality_flag', 'raw_flags' (optional)
    """

    FORMAT_VERSION = "1.0"

    # Known column aliases
    H3_ALIASES = {"h3", "h3_index", "h3_hex", "h3_id", "hex_id"}
    VALUE_ALIASES = {"inundation_frequency", "water_prob", "sar_freq", "flood_fraction", "trigger_value", "value", "flood_prob"}
    CONFIDENCE_ALIASES = {"confidence", "conf", "quality"}
    OBS_COUNT_ALIASES = {"observation_count", "obs_count", "n_scenes", "scene_count"}
    TIMESTAMP_ALIASES = {"valid_at", "timestamp", "obs_time", "time", "date"}
    FLAGS_ALIASES = {"flags", "quality_flag", "raw_flags", "flag"}

    def parse(
        self,
        content: str | TextIO,
        aoi_lgd: Optional[int] = None,
        expected_res: int = 8,
        dataset_version_override: Optional[str] = None,
    ) -> tuple[list[CanonicalFloodRecord], ValidationReport]:
        if isinstance(content, str):
            stream = io.StringIO(content)
        else:
            stream = content

        metadata: dict[str, str] = {}
        data_lines: list[str] = []

        # Step 1: Read lines, separate metadata headers from data rows
        for line in stream:
            line_str = line.strip()
            if not line_str:
                continue
            if line_str.startswith("#"):
                # Parse metadata header key: value
                header_match = re.match(r"^#\s*([a-zA-Z0-9_\-]+)\s*:\s*(.+)$", line_str)
                if header_match:
                    k, v = header_match.group(1).lower(), header_match.group(2).strip()
                    metadata[k] = v
            else:
                data_lines.append(line_str)

        # Determine metadata configurations
        format_ver = metadata.get("format_version", self.FORMAT_VERSION)
        dataset_ver = dataset_version_override or metadata.get("dataset_version", "s1-v1.0")
        source_id = metadata.get("source", "sentinel1_rtc")
        
        semantic_type_str = metadata.get("semantic_type", "static_frequency").lower()
        if semantic_type_str in ("dynamic_trigger", "trigger", "dynamic"):
            semantic_type = FloodSemanticType.DYNAMIC_TRIGGER
        else:
            semantic_type = FloodSemanticType.STATIC_FREQUENCY

        target_res = int(metadata.get("target_resolution", expected_res))

        report = ValidationReport(
            format_version=format_ver,
            semantic_type=semantic_type,
            dataset_version=dataset_ver,
            source=source_id,
            total_rows=0,
            accepted_rows=0,
            rejected_rows=0,
            errors=[],
            metadata=metadata,
        )

        if not data_lines:
            report.errors.append(
                RowValidationError(
                    row_number=0,
                    raw_content="",
                    error_type="EMPTY_ARTIFACT",
                    message="Artifact contains no data lines.",
                )
            )
            return [], report

        # Step 2: Determine delimiter & parse CSV header
        first_line = data_lines[0]
        delimiter = self._detect_delimiter(first_line)
        
        reader = csv.reader(data_lines, delimiter=delimiter)
        try:
            header_row = next(reader)
        except StopIteration:
            report.errors.append(
                RowValidationError(
                    row_number=1,
                    raw_content=first_line,
                    error_type="MISSING_HEADER",
                    message="Could not read header row.",
                )
            )
            return [], report

        col_map = self._map_columns(header_row)
        if "h3" not in col_map or "value" not in col_map:
            report.errors.append(
                RowValidationError(
                    row_number=1,
                    raw_content=first_line,
                    error_type="MISSING_REQUIRED_COLUMNS",
                    message=f"Missing required columns 'h3' or 'value'. Mapped columns: {col_map}",
                )
            )
            return [], report

        # Step 3: Iterate through data rows with strict validation
        canonical_records: list[CanonicalFloodRecord] = []
        seen_keys: set[str] = set()

        for idx, row in enumerate(reader, start=2):
            if not row or not any(field.strip() for field in row):
                continue

            report.total_rows += 1
            raw_line = delimiter.join(row)

            # Check column count matches header
            if len(row) < len(col_map):
                report.rejected_rows += 1
                report.errors.append(
                    RowValidationError(
                        row_number=idx,
                        raw_content=raw_line,
                        error_type="COLUMN_COUNT_MISMATCH",
                        message=f"Row has {len(row)} columns, expected at least {len(col_map)}.",
                    )
                )
                continue

            # 3.1 Validate H3
            raw_h3 = row[col_map["h3"]].strip()
            if not is_valid_h3(raw_h3):
                report.rejected_rows += 1
                report.errors.append(
                    RowValidationError(
                        row_number=idx,
                        raw_content=raw_line,
                        error_type="INVALID_H3",
                        message=f"Invalid H3 index: '{raw_h3}'.",
                    )
                )
                continue

            h3_int = h3_to_int(raw_h3)
            h3_res = h3_get_resolution(raw_h3)
            if h3_res != target_res:
                report.rejected_rows += 1
                report.errors.append(
                    RowValidationError(
                        row_number=idx,
                        raw_content=raw_line,
                        error_type="RESOLUTION_MISMATCH",
                        message=f"H3 resolution {h3_res} does not match expected resolution {target_res}.",
                    )
                )
                continue

            # 3.2 Validate Numeric Value
            raw_val_str = row[col_map["value"]].strip()
            try:
                val = float(raw_val_str)
                if math.isnan(val) or math.isinf(val):
                    raise ValueError("Non-finite float")
            except ValueError:
                report.rejected_rows += 1
                report.errors.append(
                    RowValidationError(
                        row_number=idx,
                        raw_content=raw_line,
                        error_type="INVALID_NUMERIC_VALUE",
                        message=f"Value '{raw_val_str}' is not a valid finite float.",
                    )
                )
                continue

            # Bounds validation according to semantic type
            if semantic_type == FloodSemanticType.STATIC_FREQUENCY:
                if not (0.0 <= val <= 1.0):
                    report.rejected_rows += 1
                    report.errors.append(
                        RowValidationError(
                            row_number=idx,
                            raw_content=raw_line,
                            error_type="VALUE_OUT_OF_BOUNDS",
                            message=f"Static inundation frequency {val} must be in [0.0, 1.0].",
                        )
                    )
                    continue
            elif semantic_type == FloodSemanticType.DYNAMIC_TRIGGER:
                if val < 0.0:
                    report.rejected_rows += 1
                    report.errors.append(
                        RowValidationError(
                            row_number=idx,
                            raw_content=raw_line,
                            error_type="VALUE_OUT_OF_BOUNDS",
                            message=f"Dynamic flood trigger {val} must be non-negative (>= 0.0).",
                        )
                    )
                    continue

            # 3.3 Validate Confidence
            confidence = 1.0
            if "confidence" in col_map and col_map["confidence"] < len(row):
                raw_conf_str = row[col_map["confidence"]].strip()
                if raw_conf_str:
                    try:
                        conf_val = float(raw_conf_str)
                        if 0.0 <= conf_val <= 1.0 and not math.isnan(conf_val):
                            confidence = conf_val
                    except ValueError:
                        pass

            # 3.4 Validate Observation Count
            obs_count = 1
            if "obs_count" in col_map and col_map["obs_count"] < len(row):
                raw_obs_str = row[col_map["obs_count"]].strip()
                if raw_obs_str:
                    try:
                        obs_val = int(raw_obs_str)
                        if obs_val >= 1:
                            obs_count = obs_val
                    except ValueError:
                        pass

            # 3.5 Validate Timestamp
            valid_dt: Optional[datetime] = None
            if "timestamp" in col_map and col_map["timestamp"] < len(row):
                raw_ts_str = row[col_map["timestamp"]].strip()
                if raw_ts_str:
                    try:
                        valid_dt = datetime.fromisoformat(raw_ts_str.replace("Z", "+00:00"))
                        if valid_dt.tzinfo is None:
                            valid_dt = valid_dt.replace(tzinfo=timezone.utc)
                    except ValueError:
                        report.rejected_rows += 1
                        report.errors.append(
                            RowValidationError(
                                row_number=idx,
                                raw_content=raw_line,
                                error_type="INVALID_TIMESTAMP",
                                message=f"Timestamp '{raw_ts_str}' is not valid ISO 8601.",
                            )
                        )
                        continue

            if semantic_type == FloodSemanticType.DYNAMIC_TRIGGER and valid_dt is None:
                # Dynamic trigger requires valid timestamp
                report.rejected_rows += 1
                report.errors.append(
                    RowValidationError(
                        row_number=idx,
                        raw_content=raw_line,
                        error_type="MISSING_TIMESTAMP_FOR_DYNAMIC",
                        message="Dynamic trigger observations require a valid timestamp ('valid_at').",
                    )
                )
                continue

            # 3.6 Check Duplicates
            dup_key = f"{h3_int}_{valid_dt.isoformat() if valid_dt else 'static'}"
            if dup_key in seen_keys:
                report.rejected_rows += 1
                report.errors.append(
                    RowValidationError(
                        row_number=idx,
                        raw_content=raw_line,
                        error_type="DUPLICATE_RECORD",
                        message=f"Duplicate observation for H3 '{raw_h3}' (Key: {dup_key}).",
                    )
                )
                continue
            seen_keys.add(dup_key)

            # 3.7 Raw Flags
            raw_flags = None
            if "flags" in col_map and col_map["flags"] < len(row):
                raw_flags = row[col_map["flags"]].strip() or None

            # Create Canonical Record
            rec = CanonicalFloodRecord(
                h3_int=h3_int,
                h3_str=h3_to_str(h3_int),
                res=h3_res,
                value=round(val, 4),
                semantic_type=semantic_type,
                confidence=round(confidence, 4),
                observation_count=obs_count,
                valid_at=valid_dt,
                source=source_id,
                dataset_version=dataset_ver,
                raw_flags=raw_flags,
            )
            canonical_records.append(rec)
            report.accepted_rows += 1

        logger.info(
            f"Parsed Sentinel-1 artifact: {report.accepted_rows} accepted, "
            f"{report.rejected_rows} rejected out of {report.total_rows} total rows."
        )
        return canonical_records, report

    def _detect_delimiter(self, header_line: str) -> str:
        """Detects delimiter (comma, tab, pipe, semicolon)."""
        if "\t" in header_line:
            return "\t"
        if "|" in header_line:
            return "|"
        if ";" in header_line:
            return ";"
        return ","

    def _map_columns(self, header_row: list[str]) -> dict[str, int]:
        """Maps arbitrary alias column names in header row to standard internal fields."""
        col_map: dict[str, int] = {}
        for idx, col in enumerate(header_row):
            clean_col = col.strip().lower().replace(" ", "_")
            if clean_col in self.H3_ALIASES and "h3" not in col_map:
                col_map["h3"] = idx
            elif clean_col in self.VALUE_ALIASES and "value" not in col_map:
                col_map["value"] = idx
            elif clean_col in self.CONFIDENCE_ALIASES and "confidence" not in col_map:
                col_map["confidence"] = idx
            elif clean_col in self.OBS_COUNT_ALIASES and "obs_count" not in col_map:
                col_map["obs_count"] = idx
            elif clean_col in self.TIMESTAMP_ALIASES and "timestamp" not in col_map:
                col_map["timestamp"] = idx
            elif clean_col in self.FLAGS_ALIASES and "flags" not in col_map:
                col_map["flags"] = idx
        return col_map


class Sentinel1Adapter:
    """Main Ingestion Adapter orchestrating versioned parser selection and ingestion boundary."""

    def __init__(self) -> None:
        self._parsers: dict[str, BaseSentinel1Parser] = {
            "1.0": Sentinel1TextParserV1(),
            "1": Sentinel1TextParserV1(),
        }

    def register_parser(self, format_version: str, parser: BaseSentinel1Parser) -> None:
        """Allows registering new parser strategies as upstream formats evolve."""
        self._parsers[format_version] = parser
        logger.info(f"Registered Sentinel-1 parser for format version '{format_version}'.")

    def parse_artifact_string(
        self,
        content: str,
        aoi_lgd: Optional[int] = None,
        expected_res: int = 8,
        dataset_version_override: Optional[str] = None,
    ) -> tuple[list[CanonicalFloodRecord], ValidationReport]:
        """Parses artifact content from a string."""
        format_version = self._sniff_format_version(content)
        parser = self._parsers.get(format_version, self._parsers["1.0"])
        return parser.parse(
            content=content,
            aoi_lgd=aoi_lgd,
            expected_res=expected_res,
            dataset_version_override=dataset_version_override,
        )

    def parse_artifact_file(
        self,
        file_path: str | Path,
        aoi_lgd: Optional[int] = None,
        expected_res: int = 8,
        dataset_version_override: Optional[str] = None,
    ) -> tuple[list[CanonicalFloodRecord], ValidationReport]:
        """Parses artifact content from a local file path."""
        p = Path(file_path)
        if not p.exists():
            raise FileNotFoundError(f"Sentinel-1 artifact not found at '{file_path}'.")
        with open(p, "r", encoding="utf-8") as f:
            content = f.read()
        return self.parse_artifact_string(
            content=content,
            aoi_lgd=aoi_lgd,
            expected_res=expected_res,
            dataset_version_override=dataset_version_override,
        )

    def _sniff_format_version(self, content: str) -> str:
        """Inspects metadata comments for format_version."""
        for line in content.splitlines()[:20]:
            line_clean = line.strip().lower()
            if line_clean.startswith("#") and "format_version" in line_clean:
                parts = line_clean.split(":")
                if len(parts) >= 2:
                    return parts[1].strip()
        return "1.0"


# Global singleton adapter instance
sentinel1_adapter = Sentinel1Adapter()
