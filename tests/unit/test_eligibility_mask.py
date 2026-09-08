"""Tests for Step 12 — the habitable-land eligibility mask and its polygonisation.

The gates encode the platform's central promise: a relocation destination must not be tomorrow's
disaster source. So the tests assert not just that the mask filters, but that it filters in the
strict direction — unknown terrain is never treated as flat and safe, and a value sitting on a
threshold is not quietly admitted.
"""

from __future__ import annotations

import numpy as np
import pytest
import rasterio

from pipeline.relocation.eligibility_mask import (
    EligibilityMaskConfig,
    build_eligibility_mask,
    polygonize_mask,
)

CFG = EligibilityMaskConfig()
#: 10 m pixels on a metric grid, matching the district flood stacks.
TRANSFORM = rasterio.Affine(10.0, 0.0, 500_000.0, 0.0, -10.0, 3_000_000.0)
PIXEL_AREA = 100.0


def surface(shape=(20, 20), **overrides) -> dict[str, np.ndarray]:
    """An all-eligible surface; each test spoils exactly one input."""
    base = {
        "susceptibility": np.full(shape, 0.05, dtype=np.float32),
        "slope": np.full(shape, 2.0, dtype=np.float32),
        "tree_cover_fraction": np.zeros(shape, dtype=np.float32),
        "built_up_fraction": np.zeros(shape, dtype=np.float32),
        "permanent_water": np.zeros(shape, dtype=np.float32),
    }
    base.update(overrides)
    return base


class TestGates:
    def test_clean_surface_is_fully_eligible(self):
        mask, stats = build_eligibility_mask(**surface(), config=CFG)
        assert mask.all()
        assert stats.eligible_pixels == 400 and stats.eligible_fraction == 1.0

    def test_susceptibility_gate_rejects_at_and_above_threshold(self):
        """`< 0.25` is strict: a cell exactly at the threshold is not habitable land."""
        s = surface()
        s["susceptibility"][0, 0] = CFG.max_susceptibility
        s["susceptibility"][0, 1] = CFG.max_susceptibility + 0.01
        s["susceptibility"][0, 2] = CFG.max_susceptibility - 0.001
        mask, stats = build_eligibility_mask(**s, config=CFG)
        assert not mask[0, 0] and not mask[0, 1] and mask[0, 2]
        assert stats.rejected["susceptibility"] == 2

    def test_slope_gate_rejects_at_and_above_threshold(self):
        s = surface()
        s["slope"][1, 1] = CFG.max_slope_deg
        s["slope"][1, 2] = 30.0
        mask, stats = build_eligibility_mask(**s, config=CFG)
        assert not mask[1, 1] and not mask[1, 2]
        assert stats.rejected["slope"] == 2

    def test_built_up_is_excluded(self):
        """Without this the mask offers existing settlements as empty relocation land."""
        s = surface()
        s["built_up_fraction"][2, 2] = 0.9
        mask, stats = build_eligibility_mask(**s, config=CFG)
        assert not mask[2, 2] and stats.rejected["built_up"] == 1

    def test_tree_cover_is_excluded(self):
        s = surface()
        s["tree_cover_fraction"][3, 3] = 0.8
        mask, stats = build_eligibility_mask(**s, config=CFG)
        assert not mask[3, 3] and stats.rejected["tree_cover"] == 1

    def test_permanent_water_is_excluded(self):
        s = surface()
        s["permanent_water"][4, 4] = 1.0
        mask, stats = build_eligibility_mask(**s, config=CFG)
        assert not mask[4, 4] and stats.rejected["permanent_water"] == 1

    def test_cropland_is_not_a_gate(self):
        """Cropland is a flagged penalty, never a hard exclusion — some conversion is legitimate."""
        mask, _ = build_eligibility_mask(**surface(), config=CFG)
        assert mask.all(), "cropland must not be part of the mask"

    @pytest.mark.parametrize("layer", ["susceptibility", "slope", "tree_cover_fraction",
                                       "built_up_fraction", "permanent_water"])
    def test_missing_data_is_never_eligible(self, layer):
        """Unknown terrain must not read as flat and safe — the invariant the audit enforces."""
        s = surface()
        s[layer] = s[layer].copy()
        s[layer][5, 5] = np.nan
        mask, stats = build_eligibility_mask(**s, config=CFG)
        assert not mask[5, 5]
        assert stats.rejected["no_data"] == 1
        assert stats.valid_pixels == 399

    def test_gate_counts_are_independent(self):
        """A pixel failing two gates is counted under both, so the audit shows every cause."""
        s = surface()
        s["slope"][6, 6] = 40.0
        s["susceptibility"][6, 6] = 0.9
        _, stats = build_eligibility_mask(**s, config=CFG)
        assert stats.rejected["slope"] == 1 and stats.rejected["susceptibility"] == 1


class TestPolygonization:
    def test_area_below_minimum_is_dropped(self):
        """A 1 ha parcel cannot take a layout with roads and drainage."""
        mask = np.zeros((20, 20), dtype=bool)
        mask[0:10, 0:10] = True  # 100 px x 100 m2 = 1 ha
        polygons = polygonize_mask(mask, TRANSFORM, PIXEL_AREA, self._attrs(mask.shape), CFG)
        assert polygons == []

    def test_area_at_minimum_survives(self):
        mask = np.zeros((30, 30), dtype=bool)
        mask[0:20, 0:10] = True  # 200 px = 2 ha
        polygons = polygonize_mask(mask, TRANSFORM, PIXEL_AREA, self._attrs(mask.shape), CFG)
        assert len(polygons) == 1
        assert polygons[0].area_ha == pytest.approx(2.0)

    def test_disconnected_parcels_are_separate(self):
        mask = np.zeros((40, 40), dtype=bool)
        mask[0:20, 0:15] = True
        mask[0:20, 25:40] = True
        polygons = polygonize_mask(mask, TRANSFORM, PIXEL_AREA, self._attrs(mask.shape), CFG)
        assert len(polygons) == 2

    def test_area_uses_pixel_count_not_bounding_box(self):
        """An L-shaped parcel is measured as its own footprint, not the rectangle around it."""
        mask = np.zeros((40, 40), dtype=bool)
        mask[0:30, 0:10] = True
        mask[20:30, 10:30] = True
        polygons = polygonize_mask(mask, TRANSFORM, PIXEL_AREA, self._attrs(mask.shape), CFG)
        assert len(polygons) == 1
        expected_ha = (30 * 10 + 10 * 20) * PIXEL_AREA / 10_000.0
        assert polygons[0].area_ha == pytest.approx(expected_ha)
        assert polygons[0].area_ha < (30 * 30) * PIXEL_AREA / 10_000.0

    def test_zonal_statistics_describe_the_parcel(self):
        mask = np.zeros((30, 30), dtype=bool)
        mask[0:20, 0:10] = True
        attrs = self._attrs(mask.shape)
        attrs["slope"][0:20, 0:10] = 4.0
        attrs["slope"][0, 0] = 9.0
        attrs["susceptibility"][0:20, 0:10] = 0.1
        attrs["susceptibility"][1, 1] = 0.2
        polygons = polygonize_mask(mask, TRANSFORM, PIXEL_AREA, attrs, CFG)
        p = polygons[0]
        assert p.slope_max == pytest.approx(9.0)
        assert p.slope_mean == pytest.approx((4.0 * 199 + 9.0) / 200, rel=1e-3)
        assert p.susceptibility_max == pytest.approx(0.2)

    def test_results_are_ranked_by_area(self):
        mask = np.zeros((60, 60), dtype=bool)
        mask[0:20, 0:10] = True     # 2 ha
        mask[0:40, 30:50] = True    # 8 ha
        polygons = polygonize_mask(mask, TRANSFORM, PIXEL_AREA, self._attrs(mask.shape), CFG)
        assert [p.polygon_id for p in polygons] == [1, 2]
        assert polygons[0].area_ha > polygons[1].area_ha

    def test_empty_mask_yields_no_polygons(self):
        mask = np.zeros((20, 20), dtype=bool)
        assert polygonize_mask(mask, TRANSFORM, PIXEL_AREA, self._attrs(mask.shape), CFG) == []

    @staticmethod
    def _attrs(shape):
        return {
            "slope": np.full(shape, 2.0, dtype=np.float32),
            "susceptibility": np.full(shape, 0.05, dtype=np.float32),
            "cropland_fraction": np.full(shape, 0.4, dtype=np.float32),
            "tree_cover_fraction": np.zeros(shape, dtype=np.float32),
            "built_up_fraction": np.zeros(shape, dtype=np.float32),
        }


class TestLandCapacity:
    def test_spec_hand_check(self):
        """Plan §Step 13: 2 ha (20,000 m2) must yield 158 households."""
        from core.domain.capacity import CapacityEngine
        assert CapacityEngine().calculate_land_capacity(20_000.0) == 158

    def test_capacity_floors_rather_than_rounds(self):
        """Half a plot houses nobody: 125 m2 short of the 159th plot still yields 158."""
        from core.domain.capacity import CapacityEngine
        engine = CapacityEngine()
        one_plot_short = 159 * 126.0 - 1.0
        assert engine.calculate_land_capacity(one_plot_short) == 158
        assert engine.calculate_land_capacity(159 * 126.0) == 159

    def test_unmeasured_lifelines_leave_capacity_unknown(self):
        """A screening parcel must not claim a final capacity nobody has measured."""
        from core.domain.capacity import CapacityEngine
        result = CapacityEngine().evaluate_site_capacity(
            area_developable_m2=20_000.0,
            water_yield_liters_per_day=None,
            spare_school_seats=None,
            spare_health_capacity_pop=None,
            livelihood_multiplier=1.0,
        )
        assert result.cc_land == 158
        assert result.cc_final is None
        assert result.cc_water is None and result.cc_school is None and result.cc_health is None
