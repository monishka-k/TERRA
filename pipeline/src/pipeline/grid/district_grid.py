"""H3 Hexagonal Grid Generation and Spatial Allocation (L1).

Supports generating H3 Res 7 (~5.16 km²) and Res 8 (~0.74 km²) grids
from district boundaries, computing cell centroids, boundaries,
and dasymetric population allocation preserving district totals.
"""

from typing import Any, Sequence, Optional
import math
import h3
from core.h3_utils import (
    h3_to_str,
    h3_to_int,
    h3_to_centroid,
    h3_to_wkt_point,
    h3_to_wkt_polygon,
    h3_get_resolution,
)


def generate_h3_grid_for_bbox(
    min_lon: float,
    min_lat: float,
    max_lon: float,
    max_lat: float,
    resolution: int = 8,
) -> list[str]:
    """Generates H3 cell hex strings covering the given bounding box at the specified resolution."""
    if resolution not in (6, 7, 8, 9):
        raise ValueError(f"Resolution {resolution} outside supported range (6, 7, 8, 9).")

    # In H3 v4 polygon coordinates are [lng, lat] in GeoJSON or (lat, lng) tuples
    # h3.polygon_to_cells takes a LatLngPoly
    lat_lng_ring = [
        (min_lat, min_lon),
        (max_lat, min_lon),
        (max_lat, max_lon),
        (min_lat, max_lon),
    ]
    poly = h3.LatLngPoly(lat_lng_ring)
    cells = h3.polygon_to_cells(poly, res=resolution)
    return sorted(list(cells))


def generate_h3_grid_for_polygon(
    exterior_coords: Sequence[tuple[float, float]],
    holes: Optional[Sequence[Sequence[tuple[float, float]]]] = None,
    resolution: int = 8,
) -> list[str]:
    """Generates H3 cell hex strings filling an arbitrary polygon (exterior_coords in [lat, lon] or [lon, lat]).
    
    Exterior coords expected as list of (lat, lng) tuples.
    """
    if resolution not in (6, 7, 8, 9):
        raise ValueError(f"Resolution {resolution} outside supported range (6, 7, 8, 9).")

    poly = h3.LatLngPoly(exterior_coords, *(holes or []))
    cells = h3.polygon_to_cells(poly, res=resolution)
    return sorted(list(cells))


def dasymetrically_distribute_population(
    total_population: float,
    cell_built_areas: dict[str, float],
) -> dict[str, float]:
    """Distributes total population onto cells proportional to their built-up footprint.
    
    Invariant (FR-2.6, Day 2 Invariant):
    Sum of distributed population exactly equals total_population (within floating point precision).
    If no cell has built area, distributes evenly across all cells.
    """
    if not cell_built_areas:
        return {}

    total_built = sum(cell_built_areas.values())
    cell_count = len(cell_built_areas)

    if total_built <= 0.0:
        # Uniform fallback if no built footprints exist
        pop_per_cell = total_population / cell_count
        distributed = {h3_cell: round(pop_per_cell, 2) for h3_cell in cell_built_areas}
        residual = round(total_population - sum(distributed.values()), 2)
        if abs(residual) > 0.0:
            first_cell = next(iter(distributed))
            distributed[first_cell] = round(distributed[first_cell] + residual, 2)
        return distributed

    distributed: dict[str, float] = {}
    current_sum = 0.0
    cell_keys = list(cell_built_areas.keys())

    for idx, cell in enumerate(cell_keys):
        built = cell_built_areas[cell]
        share = built / total_built
        # Allocate proportional share
        pop = total_population * share
        distributed[cell] = round(pop, 2)
        current_sum += distributed[cell]

    # Reconcile any small rounding residual onto the highest populated cell
    residual = round(total_population - current_sum, 2)
    if abs(residual) > 0.0:
        max_cell = max(distributed, key=lambda c: distributed[c])
        distributed[max_cell] = round(distributed[max_cell] + residual, 2)

    return distributed


def create_grid_cell_records(
    h3_cells: Sequence[str],
    admin_id: Optional[int] = None,
    dataset_version: str = "demo-day2-v1",
    total_population: float = 0.0,
    built_area_generator: Optional[Any] = None,
) -> list[dict[str, Any]]:
    """Constructs dictionary records ready for insertion into the `grid_cell` table."""
    records = []
    
    # Generate or assign built area per cell
    built_areas: dict[str, float] = {}
    for cell in h3_cells:
        if built_area_generator:
            built_areas[cell] = built_area_generator(cell)
        else:
            built_areas[cell] = 0.0

    # Distribute population
    pop_allocation = dasymetrically_distribute_population(total_population, built_areas)

    for cell in h3_cells:
        res = h3_get_resolution(cell)
        h3_int = h3_to_int(cell)
        lon, lat = h3_to_centroid(cell)
        wkt_geom = h3_to_wkt_polygon(cell)
        wkt_centroid = f"POINT({lon} {lat})"

        records.append({
            "h3": h3_int,
            "res": res,
            "admin_id": admin_id,
            "habitation_id": None,
            "centroid": wkt_centroid,
            "geom": wkt_geom,
            "population": pop_allocation.get(cell, 0.0),
            "built_area_m2": built_areas.get(cell, 0.0),
            "dataset_version": dataset_version,
            "h3_str": cell,
        })

    return records
