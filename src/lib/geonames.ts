export interface ArcGisGeometry {
  x?: number;
  y?: number;
  points?: number[][];
  paths?: number[][][];
  rings?: number[][][];
  spatialReference?: { wkid: number; latestWkid?: number };
}

export interface ArcGisFindResult {
  layerId: number;
  layerName: string;
  displayFieldName: string;
  foundFieldName: string;
  value: string;
  attributes: Record<string, string | number | undefined>;
  geometryType?: string;
  geometry?: ArcGisGeometry;
}

export interface ArcGisFindResponse {
  results?: ArcGisFindResult[];
}

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: number[];
}
export interface GeoJSONMultiPoint {
  type: 'MultiPoint';
  coordinates: number[][];
}
export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: number[][];
}
export interface GeoJSONMultiLineString {
  type: 'MultiLineString';
  coordinates: number[][][];
}
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}
export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export type GeoJSONGeometry =
  | GeoJSONPoint
  | GeoJSONMultiPoint
  | GeoJSONLineString
  | GeoJSONMultiLineString
  | GeoJSONPolygon
  | GeoJSONMultiPolygon;

export interface GeoRecord {
  search: string;
  rank: number;
  gazId: string;
  name: string;
  featureType: string;
  fcode: string;
  layerName: string;
  state: string;
  county: string;
  geometryType: string;
  coordinateCount: number;
  latitude: number | undefined;
  longitude: number | undefined;
  geojson?: GeoJSONGeometry;
  isCustom?: boolean;
}

export interface CustomRecordInput {
  gazId?: unknown;
  name?: unknown;
  featureType?: unknown;
  fcode?: unknown;
  layerName?: unknown;
  state?: unknown;
  county?: unknown;
  geometryType?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  geojson?: unknown;
  geometry?: unknown;
  [key: string]: unknown;
}

export interface CsvOptions {
  delimiter?: string;
  quoteChar?: string;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

const ID_FIELDS = ['permanent_identifier', 'globalid', 'objectid', 'id', 'gaz_id', 'gid', 'fid', 'feature_id', 'featureid'];
const NAME_FIELDS = ['name', 'gaz_name', 'feature_name', 'featurename', 'title', 'label', 'display_name'];
const TYPE_FIELDS = ['featuretype', 'featureclass', 'gaz_featureclass', 'fclass', 'type', 'category', 'kind'];
const LAYER_FIELDS = ['layername', 'layer_name', 'layer', 'source', 'dataset'];
const STATE_FIELDS = ['state', 'state_alpha', 'state_name', 'st', 'province', 'region'];
const COUNTY_FIELDS = ['county', 'county_name', 'cnty', 'parish', 'district'];
const LAT_FIELDS = ['latitude', 'lat', 'y', 'ycoord'];
const LNG_FIELDS = ['longitude', 'lng', 'lon', 'x', 'xcoord'];

function findProperty(props: Record<string, unknown>, candidates: string[]): unknown {
  const keys = Object.keys(props);
  for (const candidate of candidates) {
    const lowerCandidate = candidate.toLowerCase();
    const key = keys.find((k) => k.toLowerCase() === lowerCandidate);
    if (key !== undefined) return props[key];
  }
  return undefined;
}

function isGeoJSONGeometry(value: unknown): value is GeoJSONGeometry {
  if (!value || typeof value !== 'object') return false;
  const g = value as { type?: unknown; coordinates?: unknown };
  return (
    typeof g.type === 'string' &&
    ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(g.type) &&
    Array.isArray(g.coordinates)
  );
}

function geoJsonFeatureToRecord(feature: unknown, index: number, search = 'Custom'): GeoRecord | null {
  const f = feature as {
    geometry?: unknown;
    properties?: Record<string, unknown>;
  };
  if (!f || !isGeoJSONGeometry(f.geometry)) return null;

  const props = f.properties || {};

  let lat: number | undefined;
  let lng: number | undefined;
  let coordinateCount = 0;

  const gather = (pt: number[]) => {
    if (pt.length >= 2) {
      coordinateCount += 1;
      lat = (lat ?? 0) + pt[1];
      lng = (lng ?? 0) + pt[0];
    }
  };

  const walk = (value: unknown) => {
    if (!Array.isArray(value) || value.length === 0) return;
    if (typeof value[0] === 'number') {
      gather(value as number[]);
    } else {
      value.forEach(walk);
    }
  };

  walk(f.geometry.coordinates as unknown);

  if (coordinateCount > 0) {
    lat = lat! / coordinateCount;
    lng = lng! / coordinateCount;
  }

  return {
    search,
    rank: index + 1,
    gazId: findProperty(props, ID_FIELDS) !== undefined ? String(findProperty(props, ID_FIELDS)) : `custom-${index}`,
    name: findProperty(props, NAME_FIELDS) !== undefined ? String(findProperty(props, NAME_FIELDS)) : 'Unknown',
    featureType: findProperty(props, TYPE_FIELDS) !== undefined ? String(findProperty(props, TYPE_FIELDS)) : 'Custom',
    fcode: findProperty(props, ['fcode', 'fc']) !== undefined ? String(findProperty(props, ['fcode', 'fc'])) : '',
    layerName: findProperty(props, LAYER_FIELDS) !== undefined ? String(findProperty(props, LAYER_FIELDS)) : 'Custom API',
    state: findProperty(props, STATE_FIELDS) !== undefined ? String(findProperty(props, STATE_FIELDS)) : '',
    county: findProperty(props, COUNTY_FIELDS) !== undefined ? String(findProperty(props, COUNTY_FIELDS)) : '',
    geometryType: f.geometry.type,
    coordinateCount,
    latitude: lat,
    longitude: lng,
    geojson: f.geometry as GeoJSONGeometry,
    isCustom: true,
  };
}

export function normalizeCustomRecord(input: CustomRecordInput, index: number, search = 'Custom'): GeoRecord {
  let geojson: GeoJSONGeometry | undefined;
  if (isGeoJSONGeometry(input.geojson)) {
    geojson = input.geojson;
  } else if (isGeoJSONGeometry(input.geometry)) {
    geojson = input.geometry;
  }

  const latValue = findProperty(input, LAT_FIELDS) ?? input.latitude;
  const lngValue = findProperty(input, LNG_FIELDS) ?? input.longitude;

  const gazIdValue = findProperty(input, ['gazId', ...ID_FIELDS]);
  const nameValue = findProperty(input, ['name', ...NAME_FIELDS]);
  const featureTypeValue = findProperty(input, ['featureType', ...TYPE_FIELDS]);
  const fcodeValue = findProperty(input, ['fcode', 'fc']);
  const layerNameValue = findProperty(input, ['layerName', ...LAYER_FIELDS]);
  const stateValue = findProperty(input, ['state', ...STATE_FIELDS]);
  const countyValue = findProperty(input, ['county', ...COUNTY_FIELDS]);

  return {
    search,
    rank: index + 1,
    gazId: gazIdValue !== undefined ? String(gazIdValue) : `custom-${index}`,
    name: nameValue !== undefined ? String(nameValue) : 'Unknown',
    featureType: featureTypeValue !== undefined ? String(featureTypeValue) : 'Custom',
    fcode: fcodeValue !== undefined ? String(fcodeValue) : '',
    layerName: layerNameValue !== undefined ? String(layerNameValue) : 'Custom API',
    state: stateValue !== undefined ? String(stateValue) : '',
    county: countyValue !== undefined ? String(countyValue) : '',
    geometryType: input.geometryType !== undefined ? String(input.geometryType) : (geojson ? geojson.type : 'Point'),
    coordinateCount: 1,
    latitude: toNumber(latValue),
    longitude: toNumber(lngValue),
    geojson,
    isCustom: true,
  };
}

function arcGisToGeoJson(geometry?: ArcGisGeometry): GeoJSONGeometry | undefined {
  if (!geometry) return undefined;

  if (typeof geometry.x === 'number' && typeof geometry.y === 'number') {
    return { type: 'Point', coordinates: [geometry.x, geometry.y] };
  }

  if (Array.isArray(geometry.points)) {
    return { type: 'MultiPoint', coordinates: geometry.points.filter((p) => p.length >= 2) };
  }

  if (Array.isArray(geometry.paths)) {
    const paths = geometry.paths.filter((p) => Array.isArray(p));
    if (paths.length === 1) {
      return { type: 'LineString', coordinates: paths[0] };
    }
    return { type: 'MultiLineString', coordinates: paths };
  }

  if (Array.isArray(geometry.rings)) {
    const rings = geometry.rings
      .filter((r) => Array.isArray(r) && r.length >= 3)
      .map((r) => {
        const ring = r.filter((p) => p.length >= 2);
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
          return [...ring, first];
        }
        return ring;
      });
    if (rings.length === 1) {
      return { type: 'Polygon', coordinates: rings };
    }
    // Multiple rings in ArcGIS = single polygon with possible holes
    return { type: 'Polygon', coordinates: rings };
  }

  return undefined;
}

function computeCentroid(geometry?: ArcGisGeometry): { lat: number; lng: number; count: number } | null {
  if (!geometry) return null;

  if (typeof geometry.x === 'number' && typeof geometry.y === 'number') {
    return { lat: geometry.y, lng: geometry.x, count: 1 };
  }

  let sumX = 0;
  let sumY = 0;
  let count = 0;

  const addPoint = (pt: number[]) => {
    if (Array.isArray(pt) && pt.length >= 2) {
      sumX += pt[0];
      sumY += pt[1];
      count += 1;
    }
  };

  if (Array.isArray(geometry.points)) {
    geometry.points.forEach(addPoint);
  } else if (Array.isArray(geometry.paths)) {
    geometry.paths.flat().forEach(addPoint);
  } else if (Array.isArray(geometry.rings)) {
    geometry.rings.flat().forEach(addPoint);
  }

  if (count === 0) return null;
  return { lat: sumY / count, lng: sumX / count, count };
}

export function extractRecords(data: ArcGisFindResponse, searchText: string): GeoRecord[] {
  if (!data.results || !Array.isArray(data.results)) {
    return [];
  }

  return data.results.map((result, index) => {
    const attrs = result.attributes || {};
    const centroid = computeCentroid(result.geometry);
    const geojson = arcGisToGeoJson(result.geometry);

    return {
      search: searchText,
      rank: index + 1,
      gazId: String(attrs.gaz_id ?? ''),
      name: String(attrs.gaz_name ?? ''),
      featureType: String(attrs.gaz_featureclass ?? ''),
      fcode: String(attrs.fcode ?? ''),
      layerName: String(result.layerName ?? ''),
      state: String(attrs.state_alpha ?? ''),
      county: String(attrs.county_name ?? ''),
      geometryType: String(result.geometryType ?? ''),
      coordinateCount: centroid ? centroid.count : 0,
      latitude: centroid ? centroid.lat : undefined,
      longitude: centroid ? centroid.lng : undefined,
      geojson,
    };
  });
}

function parseCsvLine(line: string, delimiter = ',', quoteChar = '"'): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === quoteChar) {
      if (inQuotes && line[i + 1] === quoteChar) {
        current += quoteChar;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  values.push(current);
  return values;
}

function splitCsvLines(text: string, quoteChar = '"'): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === quoteChar) {
      current += c;
      if (inQuotes && text[i + 1] === quoteChar) {
        current += quoteChar;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (current || c === '\n') {
        lines.push(current);
        current = '';
      }
    } else {
      current += c;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function parseCsv(text: string, options?: CsvOptions): CustomRecordInput[] {
  const delimiter = options?.delimiter ?? ',';
  const quoteChar = options?.quoteChar ?? '"';
  const lines = splitCsvLines(text);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0], delimiter, quoteChar).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter, quoteChar);
    const row: CustomRecordInput = {};
    headers.forEach((h, i) => {
      const value = values[i];
      row[h] = value === undefined || value === '' ? undefined : value;
    });
    return row;
  });
}

function parseCustomData(data: unknown, searchLabel = 'Custom'): GeoRecord[] {
  if (data !== null && typeof data === 'object' && 'results' in data && Array.isArray((data as ArcGisFindResponse).results)) {
    const records = extractRecords(data as ArcGisFindResponse, searchLabel);
    return records.map((record) => ({ ...record, isCustom: true }));
  }

  if (data !== null && typeof data === 'object' && (data as { type?: unknown }).type === 'FeatureCollection' && Array.isArray((data as { features?: unknown[] }).features)) {
    const features = (data as { features: unknown[] }).features;
    return features
      .map((feature, index) => geoJsonFeatureToRecord(feature, index, searchLabel))
      .filter((r): r is GeoRecord => r !== null)
      .map((record) => ({ ...record, isCustom: true }));
  }

  if (Array.isArray(data)) {
    return data.map((item, index) => ({ ...normalizeCustomRecord(item as CustomRecordInput, index, searchLabel), isCustom: true }));
  }

  throw new Error('Data must be an array of records, a GeoJSON FeatureCollection, or an object with a "results" array.');
}

export async function loadCustomLocations(url: string): Promise<GeoRecord[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Custom API request failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as unknown;
  return parseCustomData(data, 'Custom');
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export async function loadCustomFile(file: File): Promise<GeoRecord[]> {
  const name = file.name.toLowerCase();
  const searchLabel = file.name.replace(/\.[^.]+$/, '');

  if (name.endsWith('.csv')) {
    const text = await readFileText(file);
    const rows = parseCsv(text);
    return rows.map((row, index) => ({ ...normalizeCustomRecord(row, index, searchLabel), isCustom: true }));
  }

  if (name.endsWith('.geojson') || name.endsWith('.json')) {
    const text = await readFileText(file);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON file');
    }
    return parseCustomData(data, searchLabel);
  }

  throw new Error('Unsupported file type. Please use .geojson, .json, or .csv.');
}

export function buildFindUrl(searchText: string, maxRecords = 100): string {
  const base = 'https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/find';
  const params = new URLSearchParams({
    searchText,
    contains: 'true',
    searchFields: 'gaz_name',
    layers: '1,2,3,5,6,7,8,10,12,13,14',
    sr: '4326',
    returnGeometry: 'true',
    maxRecords: String(maxRecords),
    f: 'json',
  });
  return `${base}?${params.toString()}`;
}

export async function findLocations(searchText: string, maxRecords = 100): Promise<GeoRecord[]> {
  const url = buildFindUrl(searchText, maxRecords);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GeoNames request failed: ${response.status} ${response.statusText}`);
  }
  const data: ArcGisFindResponse = await response.json();
  return extractRecords(data, searchText);
}
