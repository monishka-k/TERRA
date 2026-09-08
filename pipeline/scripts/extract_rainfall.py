# /// script
# dependencies = [
#     "xarray",
#     "netCDF4",
#     "pandas",
#     "numpy",
#     "geopandas",
#     "shapely",
# ]
# ///
"""
Rainfall NetCDF Data Extractor
Interactive CLI tool to extract, filter, and export CHIRPS / NetCDF precipitation data to CSV.
"""

import sys
import os
import glob
from pathlib import Path
import xarray as xr
import pandas as pd
import numpy as np


def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')


# Repo-root-relative raw data drop (data/raw is gitignored).
DATA_RAW = Path(__file__).resolve().parents[2] / "data" / "raw"


def find_nc_files():
    files = sorted(str(p) for p in DATA_RAW.glob("*.nc"))
    return files or glob.glob("*.nc")


def prompt_select_file():
    nc_files = find_nc_files()
    if not nc_files:
        print("❌ No .nc files found in the current directory.")
        custom_path = input("Enter path to NetCDF file: ").strip()
        if os.path.exists(custom_path):
            return custom_path
        else:
            print("❌ File does not exist.")
            return None

    if len(nc_files) == 1:
        print(f"📁 Auto-detected file: {nc_files[0]}")
        use_default = input(f"Use '{nc_files[0]}'? [Y/n]: ").strip().lower()
        if use_default in ('', 'y', 'yes'):
            return nc_files[0]

    print("\nAvailable NetCDF files:")
    for i, f in enumerate(nc_files, 1):
        print(f"  [{i}] {f}")
    print(f"  [{len(nc_files)+1}] Enter custom file path")

    choice = input("\nSelect file option: ").strip()
    try:
        idx = int(choice) - 1
        if 0 <= idx < len(nc_files):
            return nc_files[idx]
        elif idx == len(nc_files):
            custom_path = input("Enter custom file path: ").strip()
            if os.path.exists(custom_path):
                return custom_path
            print("❌ File does not exist.")
    except ValueError:
        pass
    return None


def get_precip_var_name(ds):
    for candidate in ['precip', 'precipitation', 'pr', 'tp', 'rain']:
        if candidate in ds.data_vars:
            return candidate
    return list(ds.data_vars.keys())[0] if ds.data_vars else None


def get_coord_names(ds):
    lat_name = None
    lon_name = None
    time_name = None

    for name in ds.coords:
        lower = name.lower()
        if 'lat' in lower and lat_name is None:
            lat_name = name
        elif ('lon' in lower or 'long' in lower) and lon_name is None:
            lon_name = name
        elif 'time' in lower and time_name is None:
            time_name = name

    return lat_name, lon_name, time_name


def show_dataset_info(ds, filepath):
    lat_name, lon_name, time_name = get_coord_names(ds)
    var_name = get_precip_var_name(ds)

    print("\n" + "=" * 60)
    print(f"📊 DATASET SUMMARY: {os.path.basename(filepath)}")
    print("=" * 60)
    print(f"Variables       : {list(ds.data_vars.keys())} (Active variable: '{var_name}')")
    if time_name:
        times = ds[time_name].values
        print(f"Time Range      : {pd.to_datetime(times[0]).strftime('%Y-%m-%d')} to {pd.to_datetime(times[-1]).strftime('%Y-%m-%d')} ({len(times)} time steps)")
    if lat_name:
        lats = ds[lat_name].values
        print(f"Latitude Range  : {lats.min():.4f}° to {lats.max():.4f}° ({len(lats)} points, res ~{abs(lats[1]-lats[0]):.4f}°)")
    if lon_name:
        lons = ds[lon_name].values
        print(f"Longitude Range : {lons.min():.4f}° to {lons.max():.4f}° ({len(lons)} points, res ~{abs(lons[1]-lons[0]):.4f}°)")

    total_cells = np.prod([ds.dims[d] for d in ds.dims])
    print(f"Total Grid Cells: {total_cells:,}")
    print("=" * 60)


def extract_single_point(ds):
    lat_name, lon_name, time_name = get_coord_names(ds)
    var_name = get_precip_var_name(ds)

    print("\n📍 SINGLE POINT / LOCATION TIME SERIES EXTRACTION")
    print("-" * 50)
    try:
        lat = float(input(f"Enter target Latitude ({ds[lat_name].min().item():.2f} to {ds[lat_name].max().item():.2f}): ").strip())
        lon = float(input(f"Enter target Longitude ({ds[lon_name].min().item():.2f} to {ds[lon_name].max().item():.2f}): ").strip())
    except ValueError:
        print("❌ Invalid coordinate input.")
        return

    print(f"\nExtracting nearest point to Lat: {lat}, Lon: {lon}...")
    sel_kwargs = {lat_name: lat, lon_name: lon, "method": "nearest"}
    point_ds = ds[var_name].sel(**sel_kwargs)

    actual_lat = float(point_ds[lat_name].values)
    actual_lon = float(point_ds[lon_name].values)
    print(f"✔ Nearest grid cell found at Lat: {actual_lat:.4f}°, Lon: {actual_lon:.4f}°")

    df = point_ds.to_dataframe().reset_index()
    if time_name and np.issubdtype(df[time_name].dtype, np.datetime64):
        df[time_name] = pd.to_datetime(df[time_name]).dt.strftime('%Y-%m-%d')

    print("\nPreview of extracted data:")
    print(df.head())

    default_out = f"rainfall_point_{actual_lat:.2f}_{actual_lon:.2f}.csv"
    out_file = input(f"\nEnter output CSV filename [default: {default_out}]: ").strip() or default_out

    df.to_csv(out_file, index=False)
    print(f"✅ Successfully saved {len(df)} rows to '{out_file}'\n")


def extract_bounding_box(ds):
    lat_name, lon_name, time_name = get_coord_names(ds)
    var_name = get_precip_var_name(ds)

    print("\n🗺️ BOUNDING BOX / REGIONAL EXTRACTION")
    print("-" * 50)
    try:
        min_lat = float(input("Enter Min Latitude (South): ").strip())
        max_lat = float(input("Enter Max Latitude (North): ").strip())
        min_lon = float(input("Enter Min Longitude (West): ").strip())
        max_lon = float(input("Enter Max Longitude (East): ").strip())
    except ValueError:
        print("❌ Invalid coordinate input.")
        return

    # CHIRPS latitude could be ascending or descending
    lats = ds[lat_name].values
    if lats[0] > lats[-1]:
        lat_slice = slice(max_lat, min_lat)
    else:
        lat_slice = slice(min_lat, max_lat)

    lons = ds[lon_name].values
    if lons[0] > lons[-1]:
        lon_slice = slice(max_lon, min_lon)
    else:
        lon_slice = slice(min_lon, max_lon)

    sel_kwargs = {lat_name: lat_slice, lon_name: lon_slice}
    subset = ds[var_name].sel(**sel_kwargs)

    subset_lat_len = subset.sizes[lat_name]
    subset_lon_len = subset.sizes[lon_name]

    if subset_lat_len == 0 or subset_lon_len == 0:
        print("❌ Selected bounding box resulted in 0 grid cells. Check coordinate order and ranges.")
        return

    print(f"\n✔ Selected region grid: {subset_lat_len} lat × {subset_lon_len} lon ({subset_lat_len * subset_lon_len} grid points per day)")
    
    drop_nans = input("Drop missing/ocean values (NaNs)? [Y/n]: ").strip().lower() in ('', 'y', 'yes')
    
    print("Converting slice to DataFrame (this may take a few seconds)...")
    df = subset.to_dataframe().reset_index()

    if drop_nans:
        initial_len = len(df)
        df = df.dropna(subset=[var_name])
        print(f"Filtered out {initial_len - len(df):,} NaN/ocean rows. Remaining: {len(df):,} valid data rows.")

    if time_name and np.issubdtype(df[time_name].dtype, np.datetime64):
        df[time_name] = pd.to_datetime(df[time_name]).dt.strftime('%Y-%m-%d')

    print("\nPreview of extracted data:")
    print(df.head())

    default_out = f"rainfall_region_{min_lat}_{max_lat}_{min_lon}_{max_lon}.csv"
    out_file = input(f"\nEnter output CSV filename [default: {default_out}]: ").strip() or default_out

    # Support .csv.gz if user specifies
    df.to_csv(out_file, index=False)
    print(f"✅ Successfully saved {len(df):,} rows to '{out_file}'\n")


def extract_regional_daily_timeseries(ds):
    lat_name, lon_name, time_name = get_coord_names(ds)
    var_name = get_precip_var_name(ds)

    print("\n📈 REGIONAL AGGREGATED DAILY SUMMARY (Area Average/Total)")
    print("-" * 50)
    try:
        min_lat = float(input("Enter Min Latitude (South): ").strip())
        max_lat = float(input("Enter Max Latitude (North): ").strip())
        min_lon = float(input("Enter Min Longitude (West): ").strip())
        max_lon = float(input("Enter Max Longitude (East): ").strip())
    except ValueError:
        print("❌ Invalid coordinate input.")
        return

    lats = ds[lat_name].values
    lat_slice = slice(max_lat, min_lat) if lats[0] > lats[-1] else slice(min_lat, max_lat)
    lons = ds[lon_name].values
    lon_slice = slice(max_lon, min_lon) if lons[0] > lons[-1] else slice(min_lon, max_lon)

    sel_kwargs = {lat_name: lat_slice, lon_name: lon_slice}
    subset = ds[var_name].sel(**sel_kwargs)

    print("Computing regional spatial mean, min, and max for each day...")
    mean_ts = subset.mean(dim=[lat_name, lon_name], skipna=True).to_series()
    max_ts = subset.max(dim=[lat_name, lon_name], skipna=True).to_series()
    min_ts = subset.min(dim=[lat_name, lon_name], skipna=True).to_series()

    summary_df = pd.DataFrame({
        'mean_precip_mm': mean_ts,
        'min_precip_mm': min_ts,
        'max_precip_mm': max_ts
    }).reset_index()

    if time_name and np.issubdtype(summary_df[time_name].dtype, np.datetime64):
        summary_df[time_name] = pd.to_datetime(summary_df[time_name]).dt.strftime('%Y-%m-%d')

    print("\nPreview of regional daily summary:")
    print(summary_df.head(10))

    default_out = f"rainfall_daily_summary_{min_lat}_{max_lat}.csv"
    out_file = input(f"\nEnter output CSV filename [default: {default_out}]: ").strip() or default_out

    summary_df.to_csv(out_file, index=False)
    print(f"✅ Successfully saved {len(summary_df)} daily summaries to '{out_file}'\n")


def extract_single_day_grid(ds):
    lat_name, lon_name, time_name = get_coord_names(ds)
    var_name = get_precip_var_name(ds)

    print("\n📅 SINGLE DATE 2D SPATIAL GRID EXPORT")
    print("-" * 50)
    times = ds[time_name].values
    dates_str = [pd.to_datetime(t).strftime('%Y-%m-%d') for t in times]
    print(f"Available dates: {dates_str[0]} to {dates_str[-1]} (Total {len(dates_str)} days)")
    
    target_date = input(f"Enter target date (YYYY-MM-DD) [default: {dates_str[0]}]: ").strip() or dates_str[0]

    try:
        day_slice = ds[var_name].sel({time_name: target_date})
    except Exception as e:
        print(f"❌ Error selecting date '{target_date}': {e}")
        return

    fmt = input("Format: [1] Long format (lat, lon, precip)  [2] Wide Matrix (lat as rows, lon as columns) [default: 1]: ").strip()

    if fmt == '2':
        df = day_slice.to_pandas()
    else:
        df = day_slice.to_dataframe().reset_index()
        drop_nans = input("Drop NaN/ocean values? [Y/n]: ").strip().lower() in ('', 'y', 'yes')
        if drop_nans:
            df = df.dropna(subset=[var_name])

    default_out = f"rainfall_grid_{target_date}.csv"
    out_file = input(f"\nEnter output CSV filename [default: {default_out}]: ").strip() or default_out

    df.to_csv(out_file)
    print(f"✅ Successfully saved {target_date} grid to '{out_file}'\n")


def export_full_dataset(ds):
    lat_name, lon_name, time_name = get_coord_names(ds)
    var_name = get_precip_var_name(ds)

    total_cells = np.prod([ds.dims[d] for d in ds.dims])
    print("\n⚠️ FULL DATASET EXPORT WARNING")
    print("-" * 50)
    print(f"This dataset has {total_cells:,} total potential data points.")
    print("Exporting all points to uncompressed CSV could produce a 10GB - 20GB file.")
    print("We strongly recommend dropping NaN (ocean) values and using compression (.csv.gz).")

    confirm = input("Do you wish to continue? [y/N]: ").strip().lower()
    if confirm not in ('y', 'yes'):
        print("Export cancelled.")
        return

    print("\nConverting dataset to DataFrame (this may take 30-60 seconds depending on RAM)...")
    df = ds[var_name].to_dataframe().reset_index()
    print(f"Raw rows generated: {len(df):,}")

    drop_nans = input("Drop missing/ocean NaN values? [Y/n]: ").strip().lower() in ('', 'y', 'yes')
    if drop_nans:
        df = df.dropna(subset=[var_name])
        print(f"Valid land rows remaining: {len(df):,}")

    default_out = "rainfall_full_land_data.csv.gz"
    out_file = input(f"\nEnter output filename [default: {default_out}]: ").strip() or default_out

    compression = 'gzip' if out_file.endswith('.gz') else None
    print(f"Saving to '{out_file}'...")
    df.to_csv(out_file, index=False, compression=compression)
    print(f"✅ Full export complete! Saved to '{out_file}'\n")


def find_shp_files():
    files = sorted(str(p) for p in DATA_RAW.glob("*.shp"))
    return files or glob.glob("*.shp")


def prompt_select_shapefile():
    shp_files = find_shp_files()
    if not shp_files:
        print("❌ No .shp files found in data/raw.")
        custom_path = input("Enter path to Shapefile (.shp): ").strip()
        if os.path.exists(custom_path):
            return custom_path
        else:
            print("❌ File does not exist.")
            return None

    if len(shp_files) == 1:
        print(f"📁 Auto-detected shapefile: {shp_files[0]}")
        use_default = input(f"Use '{shp_files[0]}'? [Y/n]: ").strip().lower()
        if use_default in ('', 'y', 'yes'):
            return shp_files[0]

    print("\nAvailable Shapefiles:")
    for i, f in enumerate(shp_files, 1):
        print(f"  [{i}] {f}")
    print(f"  [{len(shp_files)+1}] Enter custom shapefile path")

    choice = input("\nSelect shapefile option: ").strip()
    try:
        idx = int(choice) - 1
        if 0 <= idx < len(shp_files):
            return shp_files[idx]
        elif idx == len(shp_files):
            custom_path = input("Enter custom shapefile path: ").strip()
            if os.path.exists(custom_path):
                return custom_path
            print("❌ File does not exist.")
    except ValueError:
        pass
    return None


def extract_shapefile_polygon(ds, shp_path=None, summary_only=False, out_file=None):
    try:
        import geopandas as gpd
        from shapely.geometry import Point
    except ImportError:
        print("❌ 'geopandas' and 'shapely' are required for shapefile extraction. Run `uv add geopandas shapely`.")
        return

    if not shp_path:
        shp_path = prompt_select_shapefile()
        if not shp_path:
            return

    print(f"\n🔺 Loading polygon from: {shp_path}")
    gdf = gpd.read_file(shp_path)
    if gdf.empty:
        print("❌ Shapefile contains no features.")
        return

    polygon = gdf.union_all() if hasattr(gdf, "union_all") else gdf.unary_union
    minx, miny, maxx, maxy = gdf.total_bounds
    print(f"✔ Catchment bounds: Lon [{minx:.4f}, {maxx:.4f}], Lat [{miny:.4f}, {maxy:.4f}]")

    lat_name, lon_name, time_name = get_coord_names(ds)
    var_name = get_precip_var_name(ds)

    lats = ds[lat_name].values
    lat_slice = slice(maxy, miny) if lats[0] > lats[-1] else slice(miny, maxy)
    lons = ds[lon_name].values
    lon_slice = slice(maxx, minx) if lons[0] > lons[-1] else slice(minx, maxx)

    sel_kwargs = {lat_name: lat_slice, lon_name: lon_slice}
    subset = ds[var_name].sel(**sel_kwargs)

    print("Clipping raster grid points inside shapefile polygon...")
    df_bbox = subset.to_dataframe().reset_index()
    df_bbox = df_bbox.dropna(subset=[var_name])

    points = [Point(xy) for xy in zip(df_bbox[lon_name], df_bbox[lat_name])]
    mask = [polygon.contains(p) or polygon.touches(p) for p in points]
    df_inside = df_bbox[mask].copy()

    if df_inside.empty:
        print("❌ No raster grid cells fell inside the specified shapefile polygon.")
        return

    if time_name and np.issubdtype(df_inside[time_name].dtype, np.datetime64):
        df_inside[time_name] = pd.to_datetime(df_inside[time_name]).dt.strftime('%Y-%m-%d')

    shp_base = Path(shp_path).stem
    print(f"✔ Extracted {df_inside[lat_name].nunique() * df_inside[lon_name].nunique()} unique grid points ({len(df_inside):,} daily records)")

    if summary_only:
        summary_df = df_inside.groupby(time_name)[var_name].agg(
            mean_precip_mm='mean',
            min_precip_mm='min',
            max_precip_mm='max',
            std_precip_mm='std'
        ).reset_index()
        target_out = out_file or f"rainfall_{shp_base}_daily_summary.csv"
        summary_df.to_csv(target_out, index=False)
        print(f"✅ Saved basin daily summary to '{target_out}'\n")
        return

    if out_file:
        compression = 'gzip' if out_file.endswith('.gz') else None
        df_inside.to_csv(out_file, index=False, compression=compression)
        print(f"✅ Saved gridded catchment points to '{out_file}'\n")
        return

    print("\nExtraction Mode:")
    print(" [1] Daily aggregated summary (Mean / Min / Max rainfall across basin per day)")
    print(" [2] Gridded time series (Every point coordinate inside basin)")
    print(" [3] Export Both")
    mode = input("Select mode [1/2/3, default 1]: ").strip() or "1"

    if mode in ("1", "3"):
        summary_df = df_inside.groupby(time_name)[var_name].agg(
            mean_precip_mm='mean',
            min_precip_mm='min',
            max_precip_mm='max',
            std_precip_mm='std'
        ).reset_index()
        target_out = f"rainfall_{shp_base}_daily_summary.csv"
        summary_df.to_csv(target_out, index=False)
        print(f"✅ Saved basin daily summary to '{target_out}'")

    if mode in ("2", "3"):
        target_gridded = f"rainfall_{shp_base}_gridded.csv"
        df_inside.to_csv(target_gridded, index=False)
        print(f"✅ Saved gridded catchment points to '{target_gridded}'")


def main_menu():
    print("=" * 60)
    print(" 🌧️  CHIRPS / NetCDF Rainfall Data Extractor CLI")
    print("=" * 60)

    filepath = prompt_select_file()
    if not filepath:
        print("Exiting.")
        return

    try:
        print(f"\nOpening {filepath}...")
        ds = xr.open_dataset(filepath)
    except Exception as e:
        print(f"❌ Failed to open NetCDF file: {e}")
        return

    while True:
        print("\n" + "=" * 60)
        print("  MAIN MENU")
        print("=" * 60)
        print(" [1] 📊 View Dataset Summary & Coordinates")
        print(" [2] 📍 Extract Single Location Time Series (Specific Lat/Lon)")
        print(" [3] 🗺️ Extract Bounding Box / Region (Lat/Lon Bounds)")
        print(" [4] 📈 Extract Regional Daily Summary (Mean/Min/Max per day)")
        print(" [5] 📅 Extract 2D Spatial Grid for a Single Date")
        print(" [6] 🔺 Extract Masked by Shapefile Polygon (e.g. INDOFLOODS Catchment)")
        print(" [7] 💾 Full Dataset Export (with NaN removal & compression)")
        print(" [8] 📁 Switch / Reload NetCDF File")
        print(" [0] 🚪 Exit")
        print("=" * 60)

        choice = input("Select an option [0-8]: ").strip()

        if choice == '1':
            show_dataset_info(ds, filepath)
        elif choice == '2':
            extract_single_point(ds)
        elif choice == '3':
            extract_bounding_box(ds)
        elif choice == '4':
            extract_regional_daily_timeseries(ds)
        elif choice == '5':
            extract_single_day_grid(ds)
        elif choice == '6':
            extract_shapefile_polygon(ds)
        elif choice == '7':
            export_full_dataset(ds)
        elif choice == '8':
            new_file = prompt_select_file()
            if new_file:
                filepath = new_file
                ds.close()
                ds = xr.open_dataset(filepath)
        elif choice == '0':
            print("Exiting.")
            break


def run_cli_args():
    import argparse
    parser = argparse.ArgumentParser(description="Extract rainfall data from NetCDF (CHIRPS) files to CSV")
    parser.add_argument("file", nargs="?", default=None, help="Path to .nc file (defaults to auto-detection)")
    parser.add_argument("--info", action="store_true", help="Print dataset metadata summary")
    parser.add_argument("--bbox", nargs=4, type=float, metavar=("MIN_LAT", "MAX_LAT", "MIN_LON", "MAX_LON"), help="Extract bounding box [min_lat max_lat min_lon max_lon]")
    parser.add_argument("--point", nargs=2, type=float, metavar=("LAT", "LON"), help="Extract single nearest point time series [lat lon]")
    parser.add_argument("--shapefile", type=str, help="Path to Shapefile (.shp) to clip / mask rainfall")
    parser.add_argument("--summary", action="store_true", help="When using --bbox or --shapefile, compute daily regional summary (mean/min/max)")
    parser.add_argument("--date", type=str, help="Extract 2D spatial grid for a specific date (YYYY-MM-DD)")
    parser.add_argument("--keep-nan", action="store_true", help="Keep NaN / ocean values (default drops NaNs)")
    parser.add_argument("-o", "--output", type=str, default=None, help="Output CSV filename (.csv or .csv.gz)")

    args = parser.parse_args()

    # If no flags provided, fall back to interactive main menu
    if len(sys.argv) == 1:
        main_menu()
        return

    filepath = args.file
    if not filepath:
        nc_files = find_nc_files()
        if nc_files:
            filepath = nc_files[0]
        else:
            print("❌ No .nc files found.")
            sys.exit(1)

    print(f"📂 Loading dataset: {filepath}")
    ds = xr.open_dataset(filepath)
    lat_name, lon_name, time_name = get_coord_names(ds)
    var_name = get_precip_var_name(ds)

    if args.info:
        show_dataset_info(ds, filepath)
        return

    if args.shapefile:
        extract_shapefile_polygon(ds, shp_path=args.shapefile, summary_only=args.summary, out_file=args.output)
        return

    if args.point:
        lat, lon = args.point
        sel_kwargs = {lat_name: lat, lon_name: lon, "method": "nearest"}
        point_ds = ds[var_name].sel(**sel_kwargs)
        df = point_ds.to_dataframe().reset_index()
        if time_name and np.issubdtype(df[time_name].dtype, np.datetime64):
            df[time_name] = pd.to_datetime(df[time_name]).dt.strftime('%Y-%m-%d')
        out_file = args.output or f"rainfall_point_{lat}_{lon}.csv"
        compression = 'gzip' if out_file.endswith('.gz') else None
        df.to_csv(out_file, index=False, compression=compression)
        print(f"✅ Saved point time-series ({len(df)} days) to {out_file}")
        return

    if args.bbox:
        min_lat, max_lat, min_lon, max_lon = args.bbox
        lats = ds[lat_name].values
        lat_slice = slice(max_lat, min_lat) if lats[0] > lats[-1] else slice(min_lat, max_lat)
        lons = ds[lon_name].values
        lon_slice = slice(max_lon, min_lon) if lons[0] > lons[-1] else slice(min_lon, max_lon)
        sel_kwargs = {lat_name: lat_slice, lon_name: lon_slice}
        subset = ds[var_name].sel(**sel_kwargs)

        if args.summary:
            mean_ts = subset.mean(dim=[lat_name, lon_name], skipna=True).to_series()
            max_ts = subset.max(dim=[lat_name, lon_name], skipna=True).to_series()
            min_ts = subset.min(dim=[lat_name, lon_name], skipna=True).to_series()
            summary_df = pd.DataFrame({
                'mean_precip_mm': mean_ts,
                'min_precip_mm': min_ts,
                'max_precip_mm': max_ts
            }).reset_index()
            if time_name and np.issubdtype(summary_df[time_name].dtype, np.datetime64):
                summary_df[time_name] = pd.to_datetime(summary_df[time_name]).dt.strftime('%Y-%m-%d')
            out_file = args.output or f"rainfall_summary_{min_lat}_{max_lat}_{min_lon}_{max_lon}.csv"
            summary_df.to_csv(out_file, index=False)
            print(f"✅ Saved regional daily summary ({len(summary_df)} days) to {out_file}")
            return
        else:
            df = subset.to_dataframe().reset_index()
            if not args.keep_nan:
                df = df.dropna(subset=[var_name])
            if time_name and np.issubdtype(df[time_name].dtype, np.datetime64):
                df[time_name] = pd.to_datetime(df[time_name]).dt.strftime('%Y-%m-%d')
            out_file = args.output or f"rainfall_region_{min_lat}_{max_lat}_{min_lon}_{max_lon}.csv"
            compression = 'gzip' if out_file.endswith('.gz') else None
            df.to_csv(out_file, index=False, compression=compression)
            print(f"✅ Saved region data ({len(df):,} rows) to {out_file}")
            return

    if args.date:
        day_slice = ds[var_name].sel({time_name: args.date})
        df = day_slice.to_dataframe().reset_index()
        if not args.keep_nan:
            df = df.dropna(subset=[var_name])
        out_file = args.output or f"rainfall_grid_{args.date}.csv"
        compression = 'gzip' if out_file.endswith('.gz') else None
        df.to_csv(out_file, index=False, compression=compression)
        print(f"✅ Saved spatial grid for {args.date} ({len(df):,} rows) to {out_file}")
        return

    # Fallback to menu if no specific command matched
    main_menu()


if __name__ == '__main__':
    try:
        run_cli_args()
    except KeyboardInterrupt:
        print("\nInterrupted by user. Exiting.")
        sys.exit(0)
