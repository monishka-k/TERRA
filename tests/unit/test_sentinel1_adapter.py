"""Unit tests for Sentinel-1 Ingestion Adapter & Parser Strategy (Day 3)."""

from pathlib import Path
from datetime import datetime, timezone
import pytest

from core.schemas.flood import FloodSemanticType
from pipeline.adapters.sentinel1_adapter import (
    Sentinel1Adapter,
    sentinel1_adapter,
    Sentinel1TextParserV1,
)

FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "sentinel1"


class TestSentinel1Adapter:
    def test_parse_valid_static_v1_file(self):
        """Verify parsing a valid static flood inundation frequency artifact."""
        file_path = FIXTURES_DIR / "sample_static_v1.txt"
        records, report = sentinel1_adapter.parse_artifact_file(file_path, expected_res=8)

        assert report.is_valid is True
        assert report.total_rows == 5
        assert report.accepted_rows == 5
        assert report.rejected_rows == 0
        assert report.format_version == "1.0"
        assert report.semantic_type == FloodSemanticType.STATIC_FREQUENCY
        assert report.dataset_version == "s1-wayanad-2024-v1"
        assert report.source == "sentinel1_rtc_water_mask"
        assert len(records) == 5

        # Check first canonical record
        first = records[0]
        assert first.h3_str == "8860064989fffff"
        assert first.res == 8
        assert first.value == 0.42
        assert first.confidence == 0.95
        assert first.observation_count == 24
        assert first.semantic_type == FloodSemanticType.STATIC_FREQUENCY
        assert first.raw_flags == "VALID"

    def test_parse_valid_dynamic_v1_file(self):
        """Verify parsing a valid dynamic flood trigger artifact with timestamps."""
        file_path = FIXTURES_DIR / "sample_dynamic_v1.txt"
        records, report = sentinel1_adapter.parse_artifact_file(file_path, expected_res=8)

        assert report.is_valid is True
        assert report.total_rows == 3
        assert report.accepted_rows == 3
        assert report.rejected_rows == 0
        assert report.semantic_type == FloodSemanticType.DYNAMIC_TRIGGER
        assert report.dataset_version == "s1-monsoon-2026-live"
        assert len(records) == 3

        # Check timestamp
        first = records[0]
        assert first.h3_str == "8860064989fffff"
        assert first.value == 1.25
        assert first.valid_at == datetime(2026, 8, 31, 5, 30, 0, tzinfo=timezone.utc)
        assert first.semantic_type == FloodSemanticType.DYNAMIC_TRIGGER

    def test_reject_malformed_rows(self):
        """Verify malformed rows (invalid H3, NaN, out of bounds) are rejected with detailed errors."""
        file_path = FIXTURES_DIR / "sample_malformed.txt"
        records, report = sentinel1_adapter.parse_artifact_file(file_path, expected_res=8)

        assert report.total_rows == 5
        assert report.accepted_rows == 1  # only first row is valid
        assert report.rejected_rows == 4
        assert len(report.errors) == 4

        error_types = {e.error_type for e in report.errors}
        assert "INVALID_H3" in error_types
        assert "INVALID_NUMERIC_VALUE" in error_types
        assert "VALUE_OUT_OF_BOUNDS" in error_types

    def test_reject_wrong_resolution(self):
        """Verify that H3 cells with resolution different from target resolution are rejected."""
        file_path = FIXTURES_DIR / "sample_wrong_resolution.txt"
        records, report = sentinel1_adapter.parse_artifact_file(file_path, expected_res=8)

        assert report.total_rows == 2
        assert report.accepted_rows == 0
        assert report.rejected_rows == 2
        for err in report.errors:
            assert err.error_type == "RESOLUTION_MISMATCH"

    def test_reject_missing_columns(self):
        """Verify that artifacts missing essential columns are rejected at header validation."""
        file_path = FIXTURES_DIR / "sample_missing_columns.txt"
        records, report = sentinel1_adapter.parse_artifact_file(file_path, expected_res=8)

        assert report.is_valid is False
        assert len(report.errors) >= 1
        assert report.errors[0].error_type == "MISSING_REQUIRED_COLUMNS"

    def test_duplicate_row_rejection(self):
        """Verify that duplicate H3 observations within the same file are detected and rejected."""
        content = """# format_version: 1.0
# semantic_type: static_frequency
h3,inundation_frequency
8860064989fffff,0.40
8860064989fffff,0.50
"""
        records, report = sentinel1_adapter.parse_artifact_string(content, expected_res=8)
        assert report.total_rows == 2
        assert report.accepted_rows == 1
        assert report.rejected_rows == 1
        assert report.errors[0].error_type == "DUPLICATE_RECORD"

    def test_delimiter_and_column_reordering(self):
        """Verify parser handles tab-separated, pipe-separated, and reordered columns cleanly."""
        # Pipe-delimited with reordered columns: confidence | value | h3
        pipe_content = """# format_version: 1.0
# semantic_type: static_frequency
confidence|water_prob|h3_hex
0.98|0.35|8860064989fffff
0.85|0.12|886006498bfffff
"""
        records, report = sentinel1_adapter.parse_artifact_string(pipe_content, expected_res=8)
        assert report.is_valid is True
        assert report.accepted_rows == 2
        assert records[0].h3_str == "8860064989fffff"
        assert records[0].value == 0.35
        assert records[0].confidence == 0.98
