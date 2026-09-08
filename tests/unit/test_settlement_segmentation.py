"""Tests for deriving settlement units from a settlement-constrained population surface.

The property that matters is that segmentation *separates*. Connected-component clustering does
not: on Barpeta's real surface it returns one component holding 99.6% of the district, because at
res-8 the settlements physically touch. These tests pin the peak-growth behaviour that does
separate, and the honesty rules around what it leaves out.
"""

from __future__ import annotations

import h3
import pytest

from pipeline.exposure.settlements import (
    SettlementSegmentationConfig,
    find_population_peaks,
    segment_settlements,
    summarize,
)

RES = 8
ORIGIN = h3.latlng_to_cell(26.32, 90.99, RES)


def ring(cell: str, k: int) -> list[str]:
    return sorted(h3.grid_disk(cell, k))


class TestPeakDetection:
    def test_single_peak_in_a_gradient(self):
        """One maximum surrounded by lower neighbours yields exactly one seed."""
        cells = {ORIGIN: 500.0}
        for c in h3.grid_disk(ORIGIN, 1):
            if c != ORIGIN:
                cells[c] = 100.0
        assert find_population_peaks(cells, 1.0) == [ORIGIN]

    def test_plateau_elects_exactly_one_seed(self):
        """Equal-population neighbours must not each become a peak, or units fragment endlessly."""
        cells = {c: 300.0 for c in h3.grid_disk(ORIGIN, 1)}
        assert len(find_population_peaks(cells, 1.0)) == 1

    def test_two_separated_peaks_both_found(self):
        far = h3.grid_ring(ORIGIN, 6)[0] if hasattr(h3, "grid_ring") else list(h3.grid_disk(ORIGIN, 6))[-1]
        cells = {ORIGIN: 900.0, far: 800.0}
        for c in h3.grid_disk(ORIGIN, 1):
            cells.setdefault(c, 50.0)
        for c in h3.grid_disk(far, 1):
            cells.setdefault(c, 40.0)
        peaks = find_population_peaks(cells, 1.0)
        assert ORIGIN in peaks and far in peaks

    def test_cells_below_minimum_never_seed(self):
        cells = {ORIGIN: 0.4}
        assert find_population_peaks(cells, 1.0) == []


class TestSegmentation:
    def test_empty_surface_yields_nothing(self):
        assert segment_settlements({}, SettlementSegmentationConfig()) == []

    def test_budget_caps_settlement_population(self):
        """A settlement stops absorbing neighbours once it meets its budget.

        This is the mechanism that prevents the single-blob outcome on a continuous surface.
        """
        cells = {c: 400.0 for c in h3.grid_disk(ORIGIN, 3)}
        cells[ORIGIN] = 900.0
        cfg = SettlementSegmentationConfig(population_budget=2000.0, min_population=100.0)
        settlements = segment_settlements(cells, cfg)
        assert settlements
        for s in settlements:
            # It may overshoot by the last cell absorbed, never by more.
            assert s.population <= cfg.population_budget + max(cells.values())

    def test_larger_budget_absorbs_more_population(self):
        cells = {c: 300.0 for c in h3.grid_disk(ORIGIN, 4)}
        cells[ORIGIN] = 1200.0
        small = segment_settlements(cells, SettlementSegmentationConfig(population_budget=1500.0, min_population=1.0))
        large = segment_settlements(cells, SettlementSegmentationConfig(population_budget=100000.0, min_population=1.0))
        assert sum(s.population for s in large) >= sum(s.population for s in small)

    def test_settlements_never_share_a_cell(self):
        """Each cell belongs to at most one settlement; double-counting would inflate demand."""
        cells = {c: 250.0 for c in h3.grid_disk(ORIGIN, 4)}
        cells[ORIGIN] = 1500.0
        settlements = segment_settlements(cells, SettlementSegmentationConfig(population_budget=2000.0, min_population=1.0))
        seen: set[str] = set()
        for s in settlements:
            assert not (seen & set(s.cells)), "a cell was assigned to two settlements"
            seen |= set(s.cells)

    def test_population_never_exceeds_the_surface_total(self):
        cells = {c: 200.0 for c in h3.grid_disk(ORIGIN, 3)}
        settlements = segment_settlements(cells, SettlementSegmentationConfig(min_population=1.0))
        assert sum(s.population for s in settlements) <= sum(cells.values()) + 1e-6

    def test_settlements_below_minimum_are_dropped(self):
        cells = {ORIGIN: 50.0}
        assert segment_settlements(cells, SettlementSegmentationConfig(min_population=250.0)) == []

    def test_output_is_deterministic(self):
        """Re-running must reproduce identical seeds, or the upsert key is not stable."""
        cells = {c: 300.0 + (i % 7) * 40 for i, c in enumerate(sorted(h3.grid_disk(ORIGIN, 3)))}
        cfg = SettlementSegmentationConfig(population_budget=1500.0, min_population=1.0)
        a = [(s.seed_h3, round(s.population, 3)) for s in segment_settlements(cells, cfg)]
        b = [(s.seed_h3, round(s.population, 3)) for s in segment_settlements(cells, cfg)]
        assert a == b

    def test_sorted_by_descending_population(self):
        cells = {c: 200.0 + i * 90 for i, c in enumerate(sorted(h3.grid_disk(ORIGIN, 3)))}
        settlements = segment_settlements(cells, SettlementSegmentationConfig(population_budget=900.0, min_population=1.0))
        pops = [s.population for s in settlements]
        assert pops == sorted(pops, reverse=True)


class TestCentroid:
    def test_centroid_is_population_weighted(self):
        """The point must sit where the people are — it is what site distance is measured from."""
        neighbours = [c for c in h3.grid_disk(ORIGIN, 1) if c != ORIGIN]
        heavy = neighbours[0]
        cells = {ORIGIN: 10.0, heavy: 5000.0}
        settlements = segment_settlements(cells, SettlementSegmentationConfig(population_budget=1e9, min_population=1.0))
        s = settlements[0]
        lon, lat = s.centroid(cells)
        heavy_lat, heavy_lon = h3.cell_to_latlng(heavy)
        origin_lat, origin_lon = h3.cell_to_latlng(ORIGIN)
        assert abs(lat - heavy_lat) < abs(lat - origin_lat)
        assert abs(lon - heavy_lon) < abs(lon - origin_lon)

    def test_centroid_falls_back_to_seed_when_unweighted(self):
        from pipeline.exposure.settlements import DerivedSettlement
        s = DerivedSettlement(seed_h3=ORIGIN, cells=[ORIGIN], population=0.0)
        lon, lat = s.centroid({})
        seed_lat, seed_lon = h3.cell_to_latlng(ORIGIN)
        assert (round(lon, 9), round(lat, 9)) == (round(seed_lon, 9), round(seed_lat, 9))


class TestSummary:
    def test_coverage_reports_the_unassigned_remainder(self):
        cells = {c: 300.0 for c in h3.grid_disk(ORIGIN, 4)}
        settlements = segment_settlements(cells, SettlementSegmentationConfig(population_budget=900.0, min_population=1.0))
        stats = summarize(settlements, sum(cells.values()))
        assert stats["settlements"] == len(settlements)
        assert 0.0 <= stats["coverage_pct"] <= 100.0
        assert stats["covered_population"] <= stats["district_population"]

    def test_summary_handles_no_settlements(self):
        stats = summarize([], 1000.0)
        assert stats["settlements"] == 0 and stats["coverage_pct"] == 0.0
