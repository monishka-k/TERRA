"""Unit tests for H3 grid generation, geometry conversions, and dasymetric population allocation."""

import pytest
import h3
from core.h3_utils import (
    is_valid_h3,
    h3_to_str,
    h3_to_int,
    h3_get_resolution,
    h3_to_centroid,
    h3_to_boundary_coords,
    h3_to_wkt_polygon,
    h3_to_wkt_point,
)
from core.errors import InvalidH3IndexError
from pipeline.grid.district_grid import (
    generate_h3_grid_for_bbox,
    dasymetrically_distribute_population,
    create_grid_cell_records,
)


class TestH3Utils:
    def test_valid_h3_string_and_int(self):
        sample_hex = "8860064989fffff"
        assert is_valid_h3(sample_hex) is True
        
        sample_int = h3_to_int(sample_hex)
        assert isinstance(sample_int, int)
        assert is_valid_h3(sample_int) is True
        assert h3_to_str(sample_int) == sample_hex

    def test_invalid_h3_raises_error(self):
        assert is_valid_h3("not_an_h3") is False
        assert is_valid_h3(-999) is False

        with pytest.raises(InvalidH3IndexError):
            h3_to_str("invalid_hex")

        with pytest.raises(InvalidH3IndexError):
            h3_to_int("invalid_hex")

    def test_resolution_and_centroid(self):
        sample_hex = "8860064989fffff"
        assert h3_get_resolution(sample_hex) == 8

        lon, lat = h3_to_centroid(sample_hex)
        assert 70.0 <= lon <= 80.0
        assert 8.0 <= lat <= 15.0

    def test_geometry_wkt_generation(self):
        sample_hex = "8860064989fffff"
        wkt_poly = h3_to_wkt_polygon(sample_hex)
        assert wkt_poly.startswith("POLYGON((")
        assert wkt_poly.endswith("))")

        wkt_pt = h3_to_wkt_point(sample_hex)
        assert wkt_pt.startswith("POINT(")


class TestDistrictGrid:
    def test_generate_h3_grid_for_wayanad_bbox(self):
        # Wayanad pilot bbox
        min_lon, min_lat, max_lon, max_lat = 75.80, 11.50, 76.35, 11.90
        res7_cells = generate_h3_grid_for_bbox(min_lon, min_lat, max_lon, max_lat, resolution=7)
        res8_cells = generate_h3_grid_for_bbox(min_lon, min_lat, max_lon, max_lat, resolution=8)

        assert len(res7_cells) > 0
        assert len(res8_cells) > len(res7_cells)

        for cell in res7_cells:
            assert h3_get_resolution(cell) == 7
        for cell in res8_cells:
            assert h3_get_resolution(cell) == 8

    def test_population_conservation_invariant(self):
        total_pop = 100_000.0
        built_areas = {
            "cell_1": 5000.0,
            "cell_2": 15000.0,
            "cell_3": 30000.0,
            "cell_4": 0.0,
        }

        distributed = dasymetrically_distribute_population(total_pop, built_areas)

        assert len(distributed) == 4
        assert distributed["cell_4"] == 0.0
        assert distributed["cell_3"] > distributed["cell_2"] > distributed["cell_1"]

        # Invariant: sum of cell populations strictly equals total population
        assert round(sum(distributed.values()), 2) == round(total_pop, 2)

    def test_uniform_fallback_when_no_built_area(self):
        total_pop = 50_000.0
        built_areas = {"cell_a": 0.0, "cell_b": 0.0, "cell_c": 0.0}

        distributed = dasymetrically_distribute_population(total_pop, built_areas)

        assert len(distributed) == 3
        for pop in distributed.values():
            assert pop > 0.0
        assert round(sum(distributed.values()), 2) == round(total_pop, 2)
