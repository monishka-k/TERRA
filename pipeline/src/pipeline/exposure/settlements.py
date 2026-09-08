"""Derives discrete settlement units from settlement-constrained population on an H3 grid.

WorldPop's *constrained* product (BSGM) allocates population only to built-settlement pixels,
so a populated cell is evidence of settlement. That tells you where people are; it does not tell
you where one village ends and the next begins.

Connected-component clustering is the obvious approach and it fails on a densely settled
floodplain: run over Barpeta's 3,112 populated res-8 cells it returns a single component holding
1,940,041 people — 99.6% of the district — because at ~460 m resolution the settlements touch.

This module segments by *population density peaks* instead. Every local maximum seeds a
settlement, which then grows outward into its highest-population neighbours until it exhausts a
population budget. That partitions a continuous population surface into units the way a watershed
transform partitions a continuous elevation surface, and it degrades predictably: a tighter budget
yields smaller settlements and leaves more of the fringe unassigned, rather than collapsing.

The result is a settlement *agglomeration*, not a revenue village: it carries no LGD code and no
toponym, because neither is derivable from a population raster.
"""

from __future__ import annotations

import heapq
from dataclasses import dataclass, field
from typing import Iterable, Mapping, Optional

import h3


@dataclass(frozen=True)
class SettlementSegmentationConfig:
    """Tunables for population-peak segmentation."""

    #: Population at which a growing settlement stops absorbing neighbours. Raising it yields
    #: fewer, larger units and assigns more of the district; lowering it does the reverse.
    population_budget: float = 12000.0
    #: Settlements below this are dropped as noise rather than published as habitations.
    min_population: float = 250.0
    #: Cells below this never seed or join a settlement.
    min_cell_population: float = 1.0
    #: Recorded on every derived record so the segmentation can be reproduced or superseded.
    method_version: str = "settlement-peaks-v1.0"


@dataclass
class DerivedSettlement:
    """One settlement agglomeration derived from the population surface."""

    #: Deterministic identity: the seeding peak cell. Stable across re-runs, so imports are idempotent.
    seed_h3: str
    cells: list[str] = field(default_factory=list)
    population: float = 0.0

    @property
    def cell_count(self) -> int:
        return len(self.cells)

    def centroid(self, cell_population: Mapping[str, float]) -> tuple[float, float]:
        """Population-weighted centroid as (lon, lat).

        Weighted rather than geometric: the point should sit where the people are, since it is
        what distance-to-site is measured from.
        """
        total = sum(cell_population.get(c, 0.0) for c in self.cells)
        if total <= 0:
            lat, lon = h3.cell_to_latlng(self.seed_h3)
            return lon, lat
        lat_sum = lon_sum = 0.0
        for c in self.cells:
            weight = cell_population.get(c, 0.0)
            lat, lon = h3.cell_to_latlng(c)
            lat_sum += lat * weight
            lon_sum += lon * weight
        return lon_sum / total, lat_sum / total


def find_population_peaks(cell_population: Mapping[str, float], min_cell_population: float) -> list[str]:
    """Returns one seed cell per local maximum of the population surface.

    A cell qualifies when no neighbour is strictly greater. That admits whole plateaus of equal
    population, so plateaus are then collapsed into connected components and each elects a single
    representative — otherwise a flat-topped settlement would seed once per cell and fragment.
    Representatives are chosen by lowest H3 index, making the result deterministic across runs
    and therefore usable as a stable upsert key.
    """
    populated = {c: p for c, p in cell_population.items() if p >= min_cell_population}

    # Cells with no strictly-greater neighbour: true maxima plus any plateaus at a maximum.
    non_descending = {
        cell for cell, pop in populated.items()
        if all(populated.get(nb, float("-inf")) <= pop
               for nb in h3.grid_disk(cell, 1) if nb != cell)
    }

    seeds: list[str] = []
    unvisited = set(non_descending)
    while unvisited:
        start_cell = min(unvisited)
        pop = populated[start_cell]
        component, queue = [], [start_cell]
        unvisited.discard(start_cell)
        while queue:
            cur = queue.pop()
            component.append(cur)
            for nb in h3.grid_disk(cur, 1):
                # Only equal-population neighbours extend a plateau; a lower one ends it.
                if nb != cur and nb in unvisited and populated[nb] == pop:
                    unvisited.discard(nb)
                    queue.append(nb)
        seeds.append(min(component))

    return sorted(seeds, key=lambda c: (-populated[c], c))


def segment_settlements(
    cell_population: Mapping[str, float],
    config: Optional[SettlementSegmentationConfig] = None,
) -> list[DerivedSettlement]:
    """Partitions populated cells into settlements grown outward from population peaks.

    Cells left unassigned once every settlement has met its budget are simply excluded — they are
    dispersed fringe population that belongs to no settlement centre, and inventing a unit for
    them would overstate what the data supports.
    """
    cfg = config or SettlementSegmentationConfig()

    populated = {c: p for c, p in cell_population.items() if p >= cfg.min_cell_population}
    if not populated:
        return []

    peaks = find_population_peaks(populated, cfg.min_cell_population)
    settlements = {seed: DerivedSettlement(seed_h3=seed, cells=[seed], population=populated[seed])
                   for seed in peaks}
    owner = {seed: seed for seed in peaks}

    # Frontier ordered by descending population, so a settlement claims its densest fringe first.
    frontier: list[tuple[float, str, str]] = []
    for seed in peaks:
        for neighbour in h3.grid_disk(seed, 1):
            if neighbour != seed and neighbour in populated and neighbour not in owner:
                heapq.heappush(frontier, (-populated[neighbour], neighbour, seed))

    while frontier:
        neg_pop, cell, seed = heapq.heappop(frontier)
        if cell in owner:
            continue
        settlement = settlements[seed]
        if settlement.population >= cfg.population_budget:
            continue
        owner[cell] = seed
        settlement.cells.append(cell)
        settlement.population += -neg_pop
        for neighbour in h3.grid_disk(cell, 1):
            if neighbour != cell and neighbour in populated and neighbour not in owner:
                heapq.heappush(frontier, (-populated[neighbour], neighbour, seed))

    kept = [s for s in settlements.values() if s.population >= cfg.min_population]
    return sorted(kept, key=lambda s: (-s.population, s.seed_h3))


def summarize(settlements: Iterable[DerivedSettlement], district_population: float) -> dict[str, float]:
    """Coverage statistics, for logging what a segmentation actually captured."""
    items = list(settlements)
    covered = sum(s.population for s in items)
    return {
        "settlements": len(items),
        "covered_population": round(covered, 1),
        "district_population": round(district_population, 1),
        "coverage_pct": round(covered / district_population * 100, 2) if district_population else 0.0,
        "max_population": round(max((s.population for s in items), default=0.0), 1),
        "min_population": round(min((s.population for s in items), default=0.0), 1),
    }
