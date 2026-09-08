"""Common Pydantic v2 schemas, pagination wrappers, and screening grade metadata."""

from typing import Generic, TypeVar, Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict

from core.enums import DataQuality

T = TypeVar("T")

SCREENING_GRADE_NOTICE: str = "Screening Grade: Cell-level screening and prioritisation tool. Geotechnical investigation, hydraulic study, and community consultation required before executing relocation orders."


class BaseSchema(BaseModel):
    """Base schema configuration with strict validation and camelCase/snake_case flexibility."""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class ProvenanceMetadataDTO(BaseSchema):
    """Extensible provenance and data quality metadata (PRD FR-1.5, Day 7)."""
    source_provider: Optional[str] = Field(default=None, description="Primary data source or sensor feed.")
    dataset_version: str = Field(default="v1.0", description="Dataset or snapshot version.")
    model_version: Optional[str] = Field(default=None, description="ML model or heuristic engine version.")
    policy_version: Optional[str] = Field(default=None, description="Applied normative policy version.")
    calculated_at: Optional[str] = Field(default=None, description="Timestamp when calculation was executed.")
    observed_at: Optional[str] = Field(default=None, description="Original observation/forecast timestamp.")
    data_quality: DataQuality = Field(default=DataQuality.VALID, description="Data quality classification.")
    is_fallback: bool = Field(default=False, description="Whether fallback source was substituted.")
    is_synthetic: bool = Field(default=False, description="Whether record is synthetic demo fixture.")



class PaginationParams(BaseSchema):
    limit: int = Field(default=50, ge=1, le=500, description="Max records to return.")
    offset: int = Field(default=0, ge=0, description="Offset for pagination.")


class PaginatedResponse(BaseSchema, Generic[T]):
    items: List[T] = Field(description="Page of records.")
    total: int = Field(ge=0, description="Total matching records count.")
    limit: int = Field(ge=1, description="Page limit.")
    offset: int = Field(ge=0, description="Page offset.")
    has_more: bool = Field(description="Whether subsequent records exist.")


class BBoxQuery(BaseSchema):
    min_lon: float = Field(ge=-180.0, le=180.0)
    min_lat: float = Field(ge=-90.0, le=90.0)
    max_lon: float = Field(ge=-180.0, le=180.0)
    max_lat: float = Field(ge=-90.0, le=90.0)


class PointGeometryDTO(BaseSchema):
    type: str = "Point"
    coordinates: list[float] = Field(description="[longitude, latitude]")


class PolygonGeometryDTO(BaseSchema):
    type: str = "Polygon"
    coordinates: list[list[list[float]]] = Field(description="Polygon linear rings")


class MultiPolygonGeometryDTO(BaseSchema):
    type: str = "MultiPolygon"
    coordinates: list[list[list[list[float]]]] = Field(description="MultiPolygon linear rings")


class ErrorDetail(BaseSchema):
    """Standardized error details conforming to SETU-DRR API error envelope."""
    code: str = Field(description="Standardized machine-readable error code string.")
    message: str = Field(description="Human-readable explanation of the error.")
    request_id: Optional[str] = Field(default=None, description="Unique request tracing identifier.")
    details: dict[str, Any] = Field(default_factory=dict, description="Contextual error details or validation breakdown.")


class ErrorEnvelope(BaseSchema):
    """Canonical API error response envelope."""
    error: ErrorDetail = Field(description="Error details payload.")


ErrorResponse = ErrorEnvelope
