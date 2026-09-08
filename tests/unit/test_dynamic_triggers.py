"""Unit tests for Dynamic Trigger Ingestion, Schemas, Validation & Safety (Day 6).

Section refs: docs/PRD1.md §6.3, §8.2, §14.1 (FR-3.2, FR-3.12, FR-4.1)
"""

import pytest
from datetime import datetime, timezone
from pipeline.adapters.trigger_adapter import TriggerParserV1
from core.schemas.dynamic_triggers import (
    CanonicalTriggerRecord,
    TriggerType,
    DataQuality,
)


class TestDynamicTriggerAdapter:
    """Tests for trigger parser strategy, normalization, validation, and error reporting."""

    def test_parse_valid_observed_trigger_csv(self):
        csv_data = """# source: IMERG_EARLY
# provider: NASA/JAXA
# model_version: imerg-v07b
h3,trigger_value,hazard_type,valid_at
8860064989fffff,0.85,landslide,2026-08-30T06:00:00Z
886006498bfffff,0.42,flash_flood,2026-08-30T06:00:00Z
"""
        parser = TriggerParserV1()
        records, report = parser.parse(csv_data)

        assert report.valid_records == 2
        assert report.invalid_records == 0
        assert len(records) == 2

        r1 = records[0]
        assert r1.h3 == "8860064989fffff"
        assert r1.trigger_value == 0.85
        assert r1.hazard_type == "landslide"
        assert r1.trigger_type == TriggerType.OBSERVED
        assert r1.source == "IMERG_EARLY"
        assert r1.provider == "NASA/JAXA"
        assert r1.data_quality == DataQuality.VALID
        assert r1.horizon_hours is None

    def test_parse_valid_forecast_trigger_csv_with_horizon(self):
        csv_data = """h3,value,type,forecast_cycle_at,valid_at,horizon_hours,source
8860064989fffff,0.92,forecast,2026-08-30T00:00:00Z,2026-09-01T00:00:00Z,48,ECMWF_OPEN
"""
        parser = TriggerParserV1()
        records, report = parser.parse(csv_data)

        assert report.valid_records == 1
        assert report.invalid_records == 0
        r = records[0]
        assert r.trigger_type == TriggerType.FORECAST
        assert r.trigger_value == 0.92
        assert r.horizon_hours == 48
        assert r.source == "ECMWF_OPEN"

    def test_reject_horizon_exceeding_72_hours(self):
        """FR-3.12: Forecast horizons > 72 hours must be rejected."""
        csv_data = """h3,trigger_value,trigger_type,valid_at,horizon_hours
8860064989fffff,0.80,forecast,2026-08-30T00:00:00Z,96
"""
        parser = TriggerParserV1()
        records, report = parser.parse(csv_data)

        assert report.valid_records == 0
        assert report.invalid_records == 1
        assert any("Horizon 96h out of allowed bounds" in err for err in report.errors)

    def test_allow_negative_anomaly_triggers_when_no_bound_declared(self):
        """Standardized anomaly indices (e.g. SPI = -1.8) are preserved when no non-negative bound is declared."""
        csv_data = """# source: IMD_SPI
# units: standardized_precipitation_index
h3,trigger_value
8860064989fffff,-1.85
"""
        parser = TriggerParserV1()
        records, report = parser.parse(csv_data)

        assert report.valid_records == 1
        assert report.invalid_records == 0
        assert len(records) == 1
        assert records[0].trigger_value == -1.85
        assert records[0].units == "standardized_precipitation_index"

    def test_reject_out_of_bounds_when_range_declared(self):
        """When provider declares min_value / max_value in contract metadata, bounds are validated."""
        csv_data = """# source: IMERG_EARLY
# min_value: 0.0
# max_value: 1000.0
h3,trigger_value
8860064989fffff,-5.0
8860064989fffff,1200.0
8860064989fffff,45.5
"""
        parser = TriggerParserV1()
        records, report = parser.parse(csv_data)

        assert report.valid_records == 1
        assert report.invalid_records == 2
        assert len(records) == 1
        assert records[0].trigger_value == 45.5

    def test_reject_invalid_h3_and_nan(self):
        csv_data = """h3,trigger_value
invalid_h3_hex,0.75
8860064989fffff,NaN
8860064989fffff,1.2
"""
        parser = TriggerParserV1()
        records, report = parser.parse(csv_data)

        assert report.valid_records == 1
        assert report.invalid_records == 2
        assert len(records) == 1
        assert records[0].trigger_value == 1.2

    def test_empty_content_failure_safety(self):
        parser = TriggerParserV1()
        records, report = parser.parse("")
        assert report.valid_records == 0
        assert report.data_quality == DataQuality.MISSING
        assert len(records) == 0

    def test_stale_and_fallback_data_quality_tagging(self):
        csv_data = """h3,trigger_value,data_quality,source
8860064989fffff,0.60,fallback,DEMO_SNAPSHOT
"""
        parser = TriggerParserV1()
        records, report = parser.parse(csv_data)

        assert len(records) == 1
        assert records[0].data_quality == DataQuality.FALLBACK
        assert records[0].source == "DEMO_SNAPSHOT"
