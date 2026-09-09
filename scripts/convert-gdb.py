#!/usr/bin/env python3
"""Convert an ESRI File Geodatabase (.gdb) or .gdbtable to GeoJSON.

Usage:
    python convert-gdb.py path/to/my.gdb [output.geojson]
    python convert-gdb.py path/to/my.gdb/a0000000d.gdbtable [output.geojson]

If the input is a .gdb directory, all vector layers are converted. The default
output is a GeoJSON file named after the input in the current directory.

Dependencies:
    pip install geopandas pyogrio
"""

import json
import math
import os
import sys

import geopandas as gpd


def detect_lat_lng_columns(columns):
    """Find latitude and longitude column names from a list of column names."""
    lat = None
    lng = None
    lower = {c.lower(): c for c in columns}

    for key, original in lower.items():
        if key in ('latitude', 'lat', 'y') and lat is None:
            lat = original
        if key in ('longitude', 'long', 'lng', 'lon', 'x') and lng is None:
            lng = original

    return lat, lng


def convert_layer_to_geojson(gdf, layer_name):
    """Convert a GeoDataFrame to a GeoJSON FeatureCollection.

    If the geometry is empty/missing but lat/lng columns are present,
    build Point geometries from those columns.
    """
    lat_col, lng_col = detect_lat_lng_columns(list(gdf.columns))

    is_geo = isinstance(gdf, gpd.GeoDataFrame)
    has_geometry = is_geo and not (gdf.geometry.is_empty.all() or gdf.geometry.isna().all())

    if not has_geometry and lat_col and lng_col:
        gdf = gdf.copy()
        gdf[lat_col] = gpd.GeoSeries.to_numeric(gdf[lat_col], errors='coerce')
        gdf[lng_col] = gpd.GeoSeries.to_numeric(gdf[lng_col], errors='coerce')
        gdf = gdf[gdf[lat_col].notna() & gdf[lng_col].notna()]
        gdf = gpd.GeoDataFrame(
            gdf,
            geometry=gpd.points_from_xy(gdf[lng_col], gdf[lat_col]),
            crs='EPSG:4326',
        )
        has_geometry = len(gdf) > 0

    if not has_geometry:
        return {'type': 'FeatureCollection', 'features': []}

    if gdf.crs is None:
        gdf = gdf.set_crs(4326, allow_override=True)
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)

    # Convert to WGS84 GeoJSON
    return json.loads(gdf.to_json())


def convert_gdb(input_path, output_path=None):
    input_path = os.path.abspath(input_path)
    base, ext = os.path.splitext(input_path)

    if output_path is None:
        output_name = os.path.basename(base) + '.geojson'
        output_path = os.path.join(os.getcwd(), output_name)
    else:
        output_path = os.path.abspath(output_path)

    if ext == '.gdbtable':
        # Open a single .gdbtable file directly; the layer name is the filename stem
        layers = [os.path.basename(base)]
    elif os.path.isfile(input_path):
        # Generic single-table file
        layers = [os.path.basename(base)]
    else:
        layers = gpd.list_layers(input_path)['name'].tolist()

    if not layers:
        raise RuntimeError(f'No layers found in {input_path}')

    all_features = []
    for layer_name in layers:
        print(f'Converting layer: {layer_name}')
        try:
            gdf = gpd.read_file(input_path, layer=layer_name)
        except Exception as err:
            print(f'  Skipping layer {layer_name}: {err}')
            continue

        if gdf is None or len(gdf) == 0:
            print(f'  Layer {layer_name} is empty.')
            continue

        geojson = convert_layer_to_geojson(gdf, layer_name)
        for feature in geojson.get('features', []):
            # Inject a source/layer name so the app can use it
            feature.setdefault('properties', {})['layerName'] = layer_name
            all_features.append(feature)

    if not all_features:
        print('Warning: no mappable features found. The table may have no geometry or no latitude/longitude columns.')

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': all_features}, f, indent=2, default=str)

    print(f'Wrote {len(all_features)} features to {output_path}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    in_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else None
    convert_gdb(in_path, out_path)
