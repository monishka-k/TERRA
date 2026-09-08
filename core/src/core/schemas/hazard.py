"""Pydantic v2 schemas for the static hazard vector-map layer.

Endpoints: GET /hazard/layers, GET /hazard/cells, GET /hazard/cells/{h3}

Design note — why this is separate from `core.schemas.zones`:
`GET /zones` composes the Multi-Hazard Index from `mhi_snapshot`. The flood pipeline
(pipeline/hazard/flood, Steps 1-10) writes `hazard_static` + `hazard_static_flood` and
never touches `mhi_snapshot`, so a cell can carry a fully-modelled flood susceptibility
while its MHI row does not exist. These schemas serve the raw per-hazard layer directly.
"""

from typing import Optional, List
from pydantic import Field

from core.enums import CoverageFlag
from core.schemas.common import BaseSchema, SCREENING_GRADE_NOTICE


class HazardCellDTO(BaseSchema):
    """One H3 cell of a static hazard layer, sized for bulk viewport transport.

    Geometry is deliberately omitted: the client reconstructs the hexagon from the H3
    index (deck.gl `H3HexagonLayer` derives boundaries on the GPU). Shipping polygons
    inflates the Barpeta res-8 payload from ~0.47 MB to ~3.4 MB for identical pixels.
    """

    h3: str = Field(description="H3 index as lowercase hexadecimal string.")
    susceptibility: float = Field(
        ge=0.0, le=1.0, description="Static susceptibility S_h in [0, 1]."
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Raw model confidence. Normalise against `HazardLayerLegendDTO.confidence_ceiling` "
            "before rendering — an absolute threshold will hide a whole layer."
        ),
    )
    quality_flag: CoverageFlag = Field(
        default=CoverageFlag.FULL,
        description="Coverage class. `no_coverage` means susceptibility 0.0 is a fill, not a measurement.",
    )
    hard_zero_fraction: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Fraction of cell excluded by FR-3.17 (HAND > 30m OR slope > 15deg).",
    )


class HazardLayerLegendDTO(BaseSchema):
    """Quantile class breaks and normalisation ceilings for the active layer.

    Computed server-side over the queried population rather than assumed client-side.
    A linear 0->1 ramp renders the Barpeta flood layer almost uniformly: half its cells
    fall between 0.39 and 0.48 because mean HAND is 1.83 m across the floodplain, which
    saturates the `1 - HAND/P99` term. The signal lives in the top decile.
    """

    method: str = Field(default="quantile", description="Classification method used to derive breaks.")
    quantiles: List[float] = Field(description="Quantile positions the breaks were sampled at.")
    breaks: List[float] = Field(description="Ascending class break values in susceptibility units.")
    domain: List[float] = Field(description="[min, max] observed susceptibility across the layer.")
    confidence_ceiling: float = Field(
        gt=0.0,
        le=1.0,
        description=(
            "Maximum confidence present in the layer. Divide each cell's confidence by this "
            "to obtain a displayable [0, 1] value."
        ),
    )
    prz_susceptibility_threshold: float = Field(
        description="FR-3.9 Permanent Red Zone susceptibility cut (core.constants.PRZ_ANY_SUSCEPTIBILITY).",
    )


class HazardLayerCoverageDTO(BaseSchema):
    """Population counts per coverage class, for the legend and the empty-state copy."""

    full: int = Field(default=0, ge=0)
    low_coverage: int = Field(default=0, ge=0)
    no_coverage: int = Field(default=0, ge=0)


class HazardLayerResponse(BaseSchema):
    """Envelope for GET /hazard/cells — cells plus everything needed to colour them."""

    hazard_type: str = Field(description="Hazard type served, e.g. 'riverine_flood'.")
    res: int = Field(description="H3 resolution of the returned cells.")
    count: int = Field(ge=0, description="Number of cells in this response.")
    truncated: bool = Field(
        default=False, description="True when the limit clipped the result set."
    )
    model_version: str = Field(default="v1.0.0", description="Pipeline model version tag.")
    legend: HazardLayerLegendDTO
    coverage: HazardLayerCoverageDTO
    cells: List[HazardCellDTO] = Field(default_factory=list)
    screening_grade: str = Field(default=SCREENING_GRADE_NOTICE)


class HazardLayerSummaryDTO(BaseSchema):
    """One available static hazard layer (GET /hazard/layers)."""

    hazard_type: str
    res: int
    cell_count: int = Field(ge=0)
    model_version: str
    min_susceptibility: float
    max_susceptibility: float
    mean_susceptibility: float
    confidence_ceiling: float


class FloodDriverDTO(BaseSchema):
    """Physical drivers behind a flood susceptibility score (hazard_static_flood)."""

    mean_inundation_frequency: Optional[float] = Field(
        default=None, description="Empirical Sentinel-1 inundation frequency F in [0, 1]."
    )
    mean_hand_m: Optional[float] = Field(default=None, description="Mean Height Above Nearest Drainage (m).")
    min_hand_m: Optional[float] = Field(default=None, description="Minimum HAND within the cell (m).")
    mean_slope_deg: Optional[float] = Field(default=None, description="Mean terrain slope (degrees).")
    mean_cropland_fraction: Optional[float] = Field(
        default=None, description="ESA WorldCover class-40 cropland fraction in [0, 1]."
    )
    max_susceptibility: Optional[float] = Field(
        default=None, description="Peak pixel susceptibility inside the cell."
    )
    valid_pixel_fraction: Optional[float] = Field(
        default=None, description="Fraction of the cell covered by valid raster pixels."
    )
    hard_zero_fraction: Optional[float] = Field(
        default=None, description="Fraction excluded by FR-3.17 hard-zero screening."
    )
    observation_ceiling: int = Field(
        default=30, description="Denominator in confidence = min(1, n_valid / ceiling)."
    )


class HazardCellDetailDTO(BaseSchema):
    """Full per-cell dossier payload (GET /hazard/cells/{h3})."""

    h3: str
    h3_int: int
    res: int
    hazard_type: str
    susceptibility: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_normalised: float = Field(
        ge=0.0, le=1.0, description="confidence / layer ceiling — the value safe to display."
    )
    quality_flag: CoverageFlag
    model_version: str
    centroid: List[float] = Field(description="[longitude, latitude]")
    admin_name: Optional[str] = None
    population: float = 0.0
    is_permanent_red_candidate: bool = Field(
        default=False, description="susceptibility >= PRZ_ANY_SUSCEPTIBILITY (FR-3.9)."
    )
    drivers: Optional[FloodDriverDTO] = None
    screening_grade: str = Field(default=SCREENING_GRADE_NOTICE)
