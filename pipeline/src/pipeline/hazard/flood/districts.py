"""Pilot district registry for the flood-susceptibility pipeline.

The Milestone A–E runners (`run_milestone_*.py`) are hardcoded to Barpeta. This
registry parameterises the same workflow for additional districts so
`run_district_flood.py` can execute Steps 5–10 end-to-end for any entry here.

Every field that the Barpeta runners baked in as a literal (bounding box,
processing CRS, LGD code, admin name, Census 2011 population anchor) is declared
here instead. Bounding boxes are the Census-2011 district polygon envelopes from
`data/raw/boundaries/2011_Dist.shp`; the geometry itself is loaded at runtime to
clip the H3 grid to the real district shape.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DistrictConfig:
    """Immutable configuration for one flood-susceptibility pilot district."""

    key: str
    """Lowercase slug used for CLI selection, file prefixes and output folders."""

    name: str
    """Human-readable district name (matches `DISTRICT` in the Census 2011 shapefile)."""

    state: str
    lgd_code: int
    """Local Government Directory district code (unique key in `admin_boundary`)."""

    census_code_2011: int
    bbox_wgs84: list[float]
    """[min_lon, min_lat, max_lon, max_lat] — the district polygon envelope."""

    processing_crs: str
    """Projected CRS for the 10 m master grid (metric, area-local UTM zone)."""

    census_2011_population: int
    river_basin: str

    # Sentinel-1 temporal query window. Must span the local flood season — for the
    # Chambal/Yamuna belt that is the SW monsoon, mid-June to end-October (peak
    # Jul–Sep). Scenes are evenly subsampled across this window to `s1_scene_target`
    # so the inundation-frequency stack is not biased toward one part of the season.
    s1_datetime_range: str = "2023-06-15/2023-10-31"
    s1_scene_target: int = 24

    shapefile_district_name: str = ""
    """`DISTRICT` attribute value if it differs from `name` (e.g. 'Dhaulpur')."""

    def __post_init__(self) -> None:
        if not self.shapefile_district_name:
            object.__setattr__(self, "shapefile_district_name", self.name)

    @property
    def file_prefix(self) -> str:
        return self.key


# --- Registry -------------------------------------------------------------------
#
# Dholpur (Rajasthan) and Morena (Madhya Pradesh) face each other across the
# Chambal river and its ravine country; both flood from the Chambal/Yamuna system
# during the SW monsoon. They sit around 77.1–78.5° E, so UTM Zone 43N
# (EPSG:32643, central meridian 75° E) is the closest single metric zone.

DISTRICTS: dict[str, DistrictConfig] = {
    "dholpur": DistrictConfig(
        key="dholpur",
        name="Dholpur",
        shapefile_district_name="Dhaulpur",
        state="Rajasthan",
        lgd_code=98,
        census_code_2011=106,
        bbox_wgs84=[77.2272, 26.3569, 78.2708, 26.9513],
        processing_crs="EPSG:32643",  # WGS 84 / UTM Zone 43N
        census_2011_population=1206516,
        river_basin="Chambal (Yamuna)",
    ),
    "morena": DistrictConfig(
        key="morena",
        name="Morena",
        state="Madhya Pradesh",
        lgd_code=417,
        census_code_2011=419,
        bbox_wgs84=[77.1160, 25.9019, 78.5436, 26.8685],
        processing_crs="EPSG:32643",  # WGS 84 / UTM Zone 43N
        census_2011_population=1965970,
        river_basin="Chambal (Yamuna)",
    ),
}


def get_district(key: str) -> DistrictConfig:
    """Resolve a district config by slug (case-insensitive)."""
    normalised = key.strip().lower()
    if normalised not in DISTRICTS:
        available = ", ".join(sorted(DISTRICTS))
        raise KeyError(f"Unknown district '{key}'. Registered districts: {available}")
    return DISTRICTS[normalised]
