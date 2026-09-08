"""Step 12 — habitable-land eligibility mask, and the polygons that survive it.

Discards land that is unsafe, unbuildable or legally excluded before any capacity arithmetic, so
what remains is "habitable land available" in the PRD sense. Per plan §Step 12 a pixel survives
only if all hold:

    susceptibility < 0.25   (far stricter than the PRZ cut-off: a destination must not become
                             tomorrow's source — the failure mode the platform exists to prevent)
    AND slope < 15 deg      (buildability: a layout needs roads, drains and plots)
    AND NOT permanent water
    AND NOT tree cover      (physical proxy for forest land)
    AND NOT built-up        (without this the mask surfaces existing settlements as empty land)

Cropland is deliberately *not* excluded. Some conversion is legitimate, so its fraction is
recorded per polygon and carried forward as a flagged penalty rather than a hard gate.

Two honest caveats travel with every polygon this produces:

  * Tree cover is land cover, not legal tenure. It excludes physically wooded land; it does not
    establish whether a parcel is notified Reserved or Protected Forest.
  * No protected-area or CRZ dataset exists in this repo, so those statuses are unverified rather
    than clear. The caller decides, through `CandidateSitePolicy`, whether that is acceptable —
    this module never silently assumes land is unencumbered.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import rasterio
from scipy import ndimage
from rasterio import features
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

logger = logging.getLogger("setu_pipeline.eligibility_mask")


@dataclass(frozen=True)
class EligibilityMaskConfig:
    """Screening thresholds for Step 12. Defaults mirror CandidateSitePolicy."""

    max_susceptibility: float = 0.25
    max_slope_deg: float = 15.0
    #: A pixel counts as belonging to a class once this share of it is that class.
    tree_cover_threshold: float = 0.30
    built_up_threshold: float = 0.20
    permanent_water_threshold: float = 0.10
    #: Polygons smaller than this cannot take a layout and are dropped (PRD FR-7.2).
    min_area_ha: float = 2.0
    mask_version: str = "eligibility-mask-v1.0"


@dataclass
class EligiblePolygon:
    """One contiguous parcel that survived the mask, with the attributes Step 13 and R18 need."""

    polygon_id: int
    geometry: BaseGeometry
    area_ha: float
    slope_mean: float
    slope_max: float
    susceptibility_max: float
    cropland_fraction: float
    tree_cover_fraction: float
    built_up_fraction: float
    centroid_xy: tuple[float, float]
    pixel_count: int


@dataclass
class MaskStatistics:
    """How many pixels each gate removed — the audit trail for a screening run."""

    total_pixels: int = 0
    valid_pixels: int = 0
    rejected: dict[str, int] = field(default_factory=dict)
    eligible_pixels: int = 0

    @property
    def eligible_fraction(self) -> float:
        return self.eligible_pixels / self.valid_pixels if self.valid_pixels else 0.0


def build_eligibility_mask(
    susceptibility: np.ndarray,
    slope: np.ndarray,
    tree_cover_fraction: np.ndarray,
    built_up_fraction: np.ndarray,
    permanent_water: np.ndarray,
    aoi_mask: Optional[np.ndarray] = None,
    config: Optional[EligibilityMaskConfig] = None,
) -> tuple[np.ndarray, MaskStatistics]:
    """Returns a boolean eligibility mask plus per-gate rejection counts.

    A pixel with no data in any input is *not* eligible. Treating unknown terrain as flat and safe
    is the precise mistake this screening exists to avoid.

    `aoi_mask` confines screening to the district polygon. The rasters are cut to a bounding box,
    which for any real district overlaps its neighbours; without this gate parcels in the next
    district are attributed to this one, and a relocation order would be issued for land outside
    the issuing authority's jurisdiction.
    """
    cfg = config or EligibilityMaskConfig()
    stats = MaskStatistics(total_pixels=int(susceptibility.size))

    observed = (
        np.isfinite(susceptibility)
        & np.isfinite(slope)
        & np.isfinite(tree_cover_fraction)
        & np.isfinite(built_up_fraction)
        & np.isfinite(permanent_water)
    )
    if aoi_mask is not None:
        outside = int((~aoi_mask).sum())
        observed &= aoi_mask
        stats.rejected["outside_district"] = outside
    stats.valid_pixels = int(observed.sum())

    gates = {
        "susceptibility": susceptibility < cfg.max_susceptibility,
        "slope": slope < cfg.max_slope_deg,
        "tree_cover": tree_cover_fraction < cfg.tree_cover_threshold,
        "built_up": built_up_fraction < cfg.built_up_threshold,
        "permanent_water": permanent_water < cfg.permanent_water_threshold,
    }

    for name, passing in gates.items():
        stats.rejected[name] = int((observed & ~passing).sum())

    eligible = observed.copy()
    for passing in gates.values():
        eligible &= passing

    stats.rejected["no_data"] = stats.total_pixels - stats.valid_pixels
    stats.eligible_pixels = int(eligible.sum())
    return eligible, stats


def polygonize_mask(
    mask: np.ndarray,
    transform: rasterio.Affine,
    pixel_area_m2: float,
    attributes: dict[str, np.ndarray],
    config: Optional[EligibilityMaskConfig] = None,
) -> list[EligiblePolygon]:
    """Vectorises the mask into contiguous parcels, dropping any below the minimum area.

    Connected components are labelled once and every statistic is then computed per label in a
    single pass. Rasterising each polygon back onto the grid instead would cost one full-grid
    pass per parcel — on a district grid of ~150M pixels that is thousands of passes.

    Area comes from a parcel's own pixel count rather than its bounding box, so an L-shaped or
    perforated parcel is measured as what it actually is.
    """
    cfg = config or EligibilityMaskConfig()
    min_pixels = int(np.ceil(cfg.min_area_ha * 10_000.0 / pixel_area_m2))

    # 8-connectivity: parcels meeting at a corner are one buildable block.
    labels, label_count = ndimage.label(mask, structure=np.ones((3, 3), dtype=int))
    if label_count == 0:
        return []

    pixel_counts = np.bincount(labels.ravel())
    keep = {int(lab) for lab in np.nonzero(pixel_counts >= min_pixels)[0] if lab != 0}
    if not keep:
        return []

    index = sorted(keep)

    def zonal(values: np.ndarray, reducer) -> dict[int, float]:
        clean = np.where(np.isfinite(values), values, 0.0)
        result = reducer(clean, labels=labels, index=index)
        return {lab: float(v) for lab, v in zip(index, np.atleast_1d(result))}

    slope_mean = zonal(attributes["slope"], ndimage.mean)
    slope_max = zonal(attributes["slope"], ndimage.maximum)
    susc_max = zonal(attributes["susceptibility"], ndimage.maximum)
    cropland = zonal(attributes["cropland_fraction"], ndimage.mean)
    tree_cover = zonal(attributes["tree_cover_fraction"], ndimage.mean)
    built_up = zonal(attributes["built_up_fraction"], ndimage.mean)

    # One vectorisation pass over the label raster yields exactly one geometry per component.
    geometries: dict[int, BaseGeometry] = {}
    for geom_json, value in features.shapes(
        labels.astype(np.int32), mask=labels > 0, transform=transform, connectivity=8
    ):
        lab = int(value)
        if lab in keep and lab not in geometries:
            geometries[lab] = shape(geom_json)

    polygons: list[EligiblePolygon] = []
    for polygon_id, lab in enumerate(index, start=1):
        geometry = geometries.get(lab)
        if geometry is None:
            continue
        polygons.append(
            EligiblePolygon(
                polygon_id=polygon_id,
                geometry=geometry,
                area_ha=int(pixel_counts[lab]) * pixel_area_m2 / 10_000.0,
                slope_mean=slope_mean[lab],
                slope_max=slope_max[lab],
                susceptibility_max=susc_max[lab],
                cropland_fraction=cropland[lab],
                tree_cover_fraction=tree_cover[lab],
                built_up_fraction=built_up[lab],
                centroid_xy=(geometry.centroid.x, geometry.centroid.y),
                pixel_count=int(pixel_counts[lab]),
            )
        )

    polygons.sort(key=lambda p: -p.area_ha)
    for rank, polygon in enumerate(polygons, start=1):
        polygon.polygon_id = rank
    return polygons
