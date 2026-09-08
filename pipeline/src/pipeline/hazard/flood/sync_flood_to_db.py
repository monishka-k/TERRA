"""Push an already-computed district flood layer into an arbitrary PostgreSQL/PostGIS database.

`run_district_flood.py` writes the canonical GeoParquet
(`data/processed/flood/<district>/flood_susceptibility_h3_res8.parquet`) *and* loads
the local database. This script replays only the database-load half against a
different target (e.g. the shared Neon instance) straight from that Parquet — no
raster recomputation, no network fetches.

It upserts the same five tables as Milestone E, all idempotent:
  admin_boundary (by lgd_code)   pipeline_run (new uuid per run)
  grid_cell (by h3)   hazard_static (by h3+hazard_type)   hazard_static_flood (by h3)

Usage:
    uv run python -m pipeline.hazard.flood.sync_flood_to_db dholpur morena \
        --db-url "postgresql://user:pass@host/neondb?sslmode=require"

    # or read the target from an env var (DImportURL avoids shell history):
    TARGET_DB_URL=... uv run python -m pipeline.hazard.flood.sync_flood_to_db dholpur morena
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import geopandas as gpd

try:
    from .districts import get_district
    from .run_district_flood import load_database, load_district_geometry, _processed_dir
except ImportError:  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from districts import get_district  # type: ignore
    from run_district_flood import load_database, load_district_geometry, _processed_dir  # type: ignore


def sync_district(key: str, conninfo: str) -> dict:
    cfg = get_district(key)
    parquet = _processed_dir(cfg) / "flood_susceptibility_h3_res8.parquet"
    if not parquet.exists():
        raise FileNotFoundError(
            f"{parquet} not found — run `run_district_flood.py {key}` first to build it."
        )
    stats_gdf = gpd.read_parquet(parquet)
    print(f"\n=== {cfg.name} ({cfg.state}, LGD {cfg.lgd_code}) — {len(stats_gdf):,} H3 cells from {parquet.name}")

    try:
        admin_wkt = load_district_geometry(cfg).wkt
    except Exception as exc:  # pragma: no cover
        print(f"  [!] district polygon unavailable ({exc}); writing bbox only")
        admin_wkt = None

    return load_database(cfg, stats_gdf, conninfo=conninfo, admin_geom_wkt=admin_wkt)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync district flood GeoParquet into a target PostGIS DB")
    parser.add_argument("districts", nargs="+", help="District slugs (e.g. dholpur morena)")
    parser.add_argument("--db-url", default=os.environ.get("TARGET_DB_URL"),
                        help="Target connection string (or set TARGET_DB_URL)")
    args = parser.parse_args()

    if not args.db_url:
        parser.error("provide --db-url or set TARGET_DB_URL")

    host = args.db_url.split("@")[-1].split("/")[0]
    print(f"Target database: {host}")

    results = []
    for key in args.districts:
        results.append((key, sync_district(key, args.db_url)))

    print("\n" + "=" * 70)
    print("SYNC COMPLETE")
    for key, r in results:
        print(f"  {key}: {r['rows']:,} rows in target | S_f avg {r['susc_avg']:.3f} "
              f"| high-risk {r['high_risk_cells']:,} | run {r['pipeline_run_id']}")
    print("=" * 70)


if __name__ == "__main__":
    main()
