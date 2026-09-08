"""Canonical Pydantic v2 schemas for Dynamic Observed & Forecast Triggers.

Section refs: docs/PRD1.md §6.3, §8.2, §14.1 (FR-3.2, FR-3.12, FR-4.1)
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Optional
from typing_extensions import Self
from pydantic import Field, model_validator

from core.constants import FORECAST_HORIZON_HOURS, SCREENING_GRADE_NOTICE
from core.schemas.common import BaseSchema
from core.enums import DataQuality


class TriggerType(StrEnum):
    """Classification of trigger data product."""
    OBSERVED = "observed"
    FORECAST = "forecast"


class TriggerSource(StrEnum):
    """Recognized upstream meteorological and hydrological trigger sources."""
    IMERG_EARLY = "IMERG_EARLY"
    IMD_QPF = "IMD_QPF"
    ECMWF_OPEN = "ECMWF_OPEN"
    CWC_FLOOD = "CWC_FLOOD"
    DEMO_SNAPSHOT = "DEMO_SNAPSHOT"
    FALLBACK = "FALLBACK"
    UNKNOWN = "UNKNOWN"


class CanonicalTriggerRecord(BaseSchema):
    """Canonical representation of an observed or forecast trigger value at an H3 cell.
    
    Decouples raw external meteorological feeds (GPM IMERG, IMD, ECMWF)
    from core domain hazard scoring.
    """
    h3: str = Field(description="Hexadecimal H3 index (res 6-9).")
    h3_int: int = Field(description="64-bit integer H3 index.")
    hazard_type: str = Field(description="Hazard type (landslide, flash_flood, riverine_flood, etc.).")
    trigger_type: TriggerType = Field(description="Whether the trigger is observed or forecast.")
    trigger_value: float = Field(description="Trigger metric value (dimensionless amplification, physical measurement, or standardized anomaly).")
    units: str = Field(default="dimensionless_index", description="Units or semantic definition of the trigger metric.")
    valid_at: datetime = Field(description="UTC timestamp at which the trigger applies.")
    forecast_cycle_at: Optional[datetime] = Field(
        default=None,
        description="UTC model initialization cycle timestamp (for forecast triggers only).",
    )
    horizon_hours: Optional[int] = Field(
        default=None,
        ge=1,
        le=FORECAST_HORIZON_HOURS,
        description="Forecast horizon in hours (max 72h). Null for observed triggers.",
    )
    source: str = Field(description="Source identifier (e.g. IMERG_EARLY, ECMWF_OPEN, DEMO_SNAPSHOT).")
    provider: str = Field(default="NASA/JAXA", description="Upstream agency or data provider.")
    data_quality: DataQuality = Field(default=DataQuality.VALID, description="Data quality classification.")
    fallback_source: Optional[str] = Field(default=None, description="Declared fallback source if primary feed failed.")
    model_version: str = Field(default="trigger-v1.0", description="Model/pipeline version that produced this trigger.")
    calculation_version: str = Field(default="calc-v1.0", description="Calculation implementation version.")
    parameter_set_version: str = Field(default="param-v1.0", description="Parameter set version.")
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when this record was parsed/generated.",
    )
    screening_grade: str = Field(default=SCREENING_GRADE_NOTICE, description="Screening grade notice.")

    @model_validator(mode="after")
    def validate_demo_data_honesty(self) -> Self:
        is_synthetic = (
            self.source == "SYNTHETIC_DEMO"
            or self.source.startswith("SYNTHETIC")
            or "DEMO" in self.source
        )
        if is_synthetic:
            # Synthetic data must never be presented as real observed/provider data (M3)
            if self.data_quality == DataQuality.VALID:
                self.data_quality = DataQuality.SYNTHETIC
            # Must not claim a real external provider unless genuine
            real_providers = ("NASA/JAXA", "NASA", "ECMWF", "IMD", "CWC", "Sentinel")
            if self.provider in real_providers or not self.provider:
                self.provider = "SYNTHETIC"
        return self


class TriggerValidationReport(BaseSchema):
    """Report generated during batch trigger ingestion and schema validation."""
    total_records: int = 0
    valid_records: int = 0
    invalid_records: int = 0
    errors: list[str] = Field(default_factory=list)
    data_quality: DataQuality = DataQuality.VALID
    source: str = "UNKNOWN"
    processed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def validate_report_honesty(self) -> Self:
        is_synthetic = (
            self.source == "SYNTHETIC_DEMO"
            or self.source.startswith("SYNTHETIC")
            or "DEMO" in self.source
        )
        if is_synthetic and self.data_quality == DataQuality.VALID:
            self.data_quality = DataQuality.SYNTHETIC
        return self
