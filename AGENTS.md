# Agent Notes

## Build and test commands

```bash
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint
npm run test      # Vitest
```

## Loading GeoDatabase (.gdb) data

The web app cannot read the binary `.gdb` format directly. Use the provided
helper to convert `.gdb` (or an individual `.gdbtable`) to GeoJSON, then load it
with the in-app **Load File** button.

```bash
pip install -r requirements.txt
python scripts/convert-gdb.py "path/to/data.gdb" "output.geojson"
```

Then in the app:
1. Go to **Data Sets** tab and click **GeoDatabase**, or click **Select .gdb Dataset** in the Filter tab.
2. Choose `output.geojson` (or any `.geojson`, `.json`, or `.csv` file).
3. The records appear on the map, in the sidebar list, and in the bottom attribute grid.
4. Type in the search box to filter the loaded dataset; use state and type filters too.
5. Click any row in the bottom grid to zoom to that record.

## Supported custom file formats

- `.geojson` — GeoJSON FeatureCollection
- `.json` — array of records, ArcGIS `find` response, or FeatureCollection
- `.csv` — header row; columns are matched case-insensitively to common names
  such as `id`, `name`, `featureType`, `state`, `county`, `latitude`, `longitude`
