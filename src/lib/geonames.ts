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

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return isNaN(n) ? undefined : n;
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
    gazId: props.id !== undefined ? String(props.id) : `custom-${index}`,
    name: props.name !== undefined ? String(props.name) : 'Unknown',
    featureType: props.featureType !== undefined ? String(props.featureType) : 'Custom',
    fcode: props.fcode !== undefined ? String(props.fcode) : '',
    layerName: props.layerName !== undefined ? String(props.layerName) : 'Custom API',
    state: props.state !== undefined ? String(props.state) : '',
    county: props.county !== undefined ? String(props.county) : '',
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

  return {
    search,
    rank: index + 1,
    gazId: input.gazId !== undefined ? String(input.gazId) : `custom-${index}`,
    name: input.name !== undefined ? String(input.name) : 'Unknown',
    featureType: input.featureType !== undefined ? String(input.featureType) : 'Custom',
    fcode: input.fcode !== undefined ? String(input.fcode) : '',
    layerName: input.layerName !== undefined ? String(input.layerName) : 'Custom API',
    state: input.state !== undefined ? String(input.state) : '',
    county: input.county !== undefined ? String(input.county) : '',
    geometryType: input.geometryType !== undefined ? String(input.geometryType) : (geojson ? geojson.type : 'Point'),
    coordinateCount: 1,
    latitude: toNumber(input.latitude),
    longitude: toNumber(input.longitude),
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

export async function loadCustomLocations(url: string): Promise<GeoRecord[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Custom API request failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as unknown;

  if (data !== null && typeof data === 'object' && 'results' in data && Array.isArray((data as ArcGisFindResponse).results)) {
    const records = extractRecords(data as ArcGisFindResponse, 'Custom');
    return records.map((record) => ({ ...record, isCustom: true }));
  }

  if (data !== null && typeof data === 'object' && (data as { type?: unknown }).type === 'FeatureCollection' && Array.isArray((data as { features?: unknown[] }).features)) {
    const features = (data as { features: unknown[] }).features;
    return features
      .map((feature, index) => geoJsonFeatureToRecord(feature, index, 'Custom'))
      .filter((r): r is GeoRecord => r !== null)
      .map((record) => ({ ...record, isCustom: true }));
  }

  if (Array.isArray(data)) {
    return data.map((item, index) => normalizeCustomRecord(item as CustomRecordInput, index));
  }

  throw new Error('Custom API response must be an array of records, a GeoJSON FeatureCollection, or an object with a "results" array.');
}

export function buildFindUrl(
  searchText: string,
  maxRecords = 100,
  baseUrl = 'https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/find',
  layers = '1,2,3,5,6,7,8,10,12,13,14',
  searchFields = 'gaz_name'
): string {
  const params = new URLSearchParams({
    searchText,
    contains: 'true',
    sr: '4326',
    returnGeometry: 'true',
    maxRecords: String(maxRecords),
    f: 'json',
  });
  if (layers) params.set('layers', layers);
  if (searchFields) params.set('searchFields', searchFields);
  return `${baseUrl}?${params.toString()}`;
}

export async function findLocations(
  searchText: string,
  maxRecords = 100,
  baseUrl?: string,
  layers?: string,
  searchFields?: string
): Promise<GeoRecord[]> {
  const url = buildFindUrl(searchText, maxRecords, baseUrl, layers, searchFields);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ArcGIS request failed: ${response.status} ${response.statusText}`);
  }
  const data: ArcGisFindResponse = await response.json();
  return extractRecords(data, searchText);
}

export async function fetchMapServerLayers(baseUrl: string): Promise<GeoRecord[]> {
  const url = `${baseUrl}/layers?f=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MapServer layers request failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!data.layers || !Array.isArray(data.layers)) return [];

  return data.layers.map((layer: any, index: number) => {
    let xmin = layer.extent?.xmin ?? -180;
    let ymin = layer.extent?.ymin ?? -90;
    let xmax = layer.extent?.xmax ?? 180;
    let ymax = layer.extent?.ymax ?? 90;

    const wkid = layer.extent?.spatialReference?.wkid;
    if (wkid === 102100 || wkid === 3857) {
      // Valid Web Mercator bounds are approximately ±20,037,508.34 meters.
      // Cached raster services often report overly large bounds that will fail geographic conversion.
      const WEB_MERCATOR_HALF_WORLD = 20037508.342789244;
      const clamp = (val: number) => Math.max(-WEB_MERCATOR_HALF_WORLD, Math.min(WEB_MERCATOR_HALF_WORLD, val));

      xmin = clamp(xmin);
      xmax = clamp(xmax);
      ymin = clamp(ymin);
      ymax = clamp(ymax);

      const toLng = (x: number) => (x / WEB_MERCATOR_HALF_WORLD) * 180;
      const toLat = (y: number) => {
        const lat = (y / WEB_MERCATOR_HALF_WORLD) * 180;
        return (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
      };
      
      xmin = toLng(xmin);
      xmax = toLng(xmax);
      ymin = toLat(ymin);
      ymax = toLat(ymax);
    }

    const coords = [
      [xmin, ymin],
      [xmax, ymin],
      [xmax, ymax],
      [xmin, ymax],
      [xmin, ymin],
    ];

    const lat = (ymin + ymax) / 2;
    const lng = (xmin + xmax) / 2;

    return {
      search: baseUrl,
      rank: index + 1,
      gazId: `layer-${layer.id}`,
      name: layer.name || `Layer ${layer.id}`,
      featureType: layer.type || 'Layer',
      fcode: '',
      layerName: layer.name,
      state: '',
      county: '',
      geometryType: 'Polygon',
      coordinateCount: 5,
      latitude: lat,
      longitude: lng,
      geojson: { type: 'Polygon', coordinates: [coords] },
      isCustom: true
    } as GeoRecord;
  });
}
