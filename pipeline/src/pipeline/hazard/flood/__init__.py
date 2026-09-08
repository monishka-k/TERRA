"""Sentinel-1 Flood Susceptibility & Inundation Processing Pipeline (SETU-DRR).

Exposes canonical SAR flood processing components:
- AOI definitions and bounds reprojection
- Sentinel-1 RTC STAC querying via Planetary Computer
- Direct COG raster streaming, calibration to dB, and binary water masking
- JRC GSW permanent water masking
- Multi-temporal inundation stacking and frequency mapping
"""

from .aoi import (
    get_barpeta_bbox_wgs84,
    get_barpeta_bounds_projected,
    get_barpeta_geojson_polygon,
    save_barpeta_boundary,
)
from .stac import (
    get_stac_client,
    query_sentinel1_rtc,
    extract_scene_metadata,
)
from .water_mask import (
    linear_to_db,
    stream_and_clip_raster,
    detect_water,
    save_raster_geotiff,
    DEFAULT_VV_WATER_THRESHOLD_DB,
)
from .permanent_water import (
    generate_permanent_water_mask,
    filter_permanent_water,
    stream_jrc_occurrence,
)
from .frequency_stack import (
    create_master_grid,
    process_scene_inundation,
    accumulate_inundation_stack,
    calculate_inundation_frequency,
)

__all__ = [
    "get_barpeta_bbox_wgs84",
    "get_barpeta_bounds_projected",
    "get_barpeta_geojson_polygon",
    "save_barpeta_boundary",
    "get_stac_client",
    "query_sentinel1_rtc",
    "extract_scene_metadata",
    "linear_to_db",
    "stream_and_clip_raster",
    "detect_water",
    "save_raster_geotiff",
    "DEFAULT_VV_WATER_THRESHOLD_DB",
    "generate_permanent_water_mask",
    "filter_permanent_water",
    "stream_jrc_occurrence",
    "create_master_grid",
    "process_scene_inundation",
    "accumulate_inundation_stack",
    "calculate_inundation_frequency",
]
