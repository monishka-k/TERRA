"""Pilot Area of Interest (AOI) definitions for flood susceptibility modeling.

Defines spatial boundaries, bounding boxes, and CRS reprojection helpers for the
Barpeta (Brahmaputra Floodplain, Assam) pilot district.
"""

from typing import Any
import json
from pathlib import Path
from pyproj import Transformer

# Default Barpeta Bounding Box [min_lon, min_lat, max_lon, max_lat] in WGS84
BARPETA_BBOX_WGS84 = [90.70, 26.05, 91.45, 26.75]
BARPETA_CRS_PROJECTED = "EPSG:32646"  # WGS 84 / UTM Zone 46N


def get_barpeta_bbox_wgs84() -> list[float]:
    """Return Barpeta bounding box in WGS84 [min_lon, min_lat, max_lon, max_lat]."""
    return list(BARPETA_BBOX_WGS84)


def get_barpeta_bounds_projected(target_crs: str = BARPETA_CRS_PROJECTED) -> tuple[float, float, float, float]:
    """Convert Barpeta WGS84 bbox to projected coordinates (minx, miny, maxx, maxy)."""
    transformer = Transformer.from_crs("EPSG:4326", target_crs, always_xy=True)
    min_lon, min_lat, max_lon, max_lat = BARPETA_BBOX_WGS84
    minx, miny = transformer.transform(min_lon, min_lat)
    maxx, maxy = transformer.transform(max_lon, max_lat)
    return (minx, miny, maxx, maxy)


def get_barpeta_geojson_polygon() -> dict[str, Any]:
    """Return GeoJSON polygon dictionary for Barpeta bounding box."""
    min_lon, min_lat, max_lon, max_lat = BARPETA_BBOX_WGS84
    coordinates = [
        [
            [min_lon, min_lat],
            [max_lon, min_lat],
            [max_lon, max_lat],
            [min_lon, max_lat],
            [min_lon, min_lat],
        ]
    ]
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Barpeta Pilot AOI",
                    "district": "Barpeta",
                    "state": "Assam",
                    "basin": "Brahmaputra",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": coordinates,
                },
            }
        ],
    }


def save_barpeta_boundary(filepath: str | Path) -> Path:
    """Save Barpeta boundary to a GeoJSON file."""
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)
    geojson_data = get_barpeta_geojson_polygon()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, indent=2)
    return path
