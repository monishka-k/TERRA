"""ESA WorldCover class-fraction layers for relocation land screening.

`pipeline/hazard/flood/cropland.py` already streams ESA WorldCover v200 from Planetary Computer
to build a cropland-fraction raster for the flood stack. Step 12 needs two more classes off the
same product — tree cover and built-up — so this generalises that extraction to any class rather
than duplicating it per class.

Fractions, not binary masks: WorldCover is 10 m and the flood grid is 10 m but not pixel-aligned,
so area-averaged reprojection gives each target pixel the share of its footprint in that class.
A threshold is then a policy decision made at screening time, not baked into the layer.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import rasterio
from rasterio.warp import Resampling, reproject

from pipeline.hazard.flood.cropland import query_worldcover_item
from rasterio.windows import from_bounds, transform as window_transform


@dataclass(frozen=True)
class WorldCoverClass:
    """One ESA WorldCover v200 land-cover class."""

    value: int
    key: str
    label: str


# Only the classes Step 12 screens on. WorldCover's full legend is wider.
TREE_COVER = WorldCoverClass(10, "tree_cover", "Tree cover")
CROPLAND = WorldCoverClass(40, "cropland", "Cropland")
BUILT_UP = WorldCoverClass(50, "built_up", "Built-up")
PERMANENT_WATER = WorldCoverClass(80, "permanent_water", "Permanent water bodies")

SCREENING_CLASSES = (TREE_COVER, CROPLAND, BUILT_UP, PERMANENT_WATER)


def stream_worldcover_classes(
    bbox_wgs84: list[float],
    classes: tuple[WorldCoverClass, ...] = SCREENING_CLASSES,
    year: int = 2021,
) -> tuple[dict[str, np.ndarray], rasterio.Affine, rasterio.crs.CRS]:
    """Reads the WorldCover map once and splits it into one binary layer per requested class.

    Reading once matters: the map is a large COG and each class would otherwise re-download it.
    """
    map_url = query_worldcover_item(bbox_wgs84=bbox_wgs84, year=year)
    min_lon, min_lat, max_lon, max_lat = bbox_wgs84

    with rasterio.open(map_url) as src:
        window = from_bounds(min_lon, min_lat, max_lon, max_lat, transform=src.transform)
        raw = src.read(1, window=window, boundless=True, fill_value=src.nodata or 0)
        win_transform = window_transform(window, src.transform)
        crs = src.crs
        nodata = src.nodata or 0

    valid = raw != nodata
    layers: dict[str, np.ndarray] = {}
    for cls in classes:
        binary = np.zeros(raw.shape, dtype=np.float32)
        binary[valid & (raw == cls.value)] = 1.0
        layers[cls.key] = binary

    return layers, win_transform, crs


def class_fractions_on_grid(
    bbox_wgs84: list[float],
    reference_shape: tuple[int, int],
    reference_transform: rasterio.Affine,
    reference_crs: rasterio.crs.CRS | str,
    classes: tuple[WorldCoverClass, ...] = SCREENING_CLASSES,
    year: int = 2021,
    source: Optional[tuple[dict[str, np.ndarray], rasterio.Affine, rasterio.crs.CRS]] = None,
) -> dict[str, np.ndarray]:
    """Area-averages each class onto the district's processing grid, returning fractions in [0, 1].

    `source` lets a caller supply pre-read layers, which keeps this testable without network.
    """
    layers, src_transform, src_crs = source or stream_worldcover_classes(
        bbox_wgs84=bbox_wgs84, classes=classes, year=year
    )

    fractions: dict[str, np.ndarray] = {}
    for key, binary in layers.items():
        out = np.zeros(reference_shape, dtype=np.float32)
        reproject(
            source=binary,
            destination=out,
            src_transform=src_transform,
            src_crs=src_crs,
            dst_transform=reference_transform,
            dst_crs=reference_crs,
            resampling=Resampling.average,
        )
        np.clip(out, 0.0, 1.0, out=out)
        fractions[key] = out

    return fractions
