import { findLocations, fetchMapServerLayers, type GeoRecord } from './geonames';

export interface DataSource {
  id: string;
  name: string;
  featureType?: string;
  placeholder?: string;
  fetch: (query: string, maxRecords?: number) => Promise<GeoRecord[]>;
}

function buildPointRecord(
  index: number,
  gazId: string,
  name: string,
  featureType: string,
  layerName: string,
  lat: number,
  lng: number,
  state = '',
  county = ''
): GeoRecord {
  return {
    search: layerName,
    rank: index + 1,
    gazId,
    name,
    featureType,
    fcode: '',
    layerName,
    state,
    county,
    geometryType: 'esriGeometryPoint',
    coordinateCount: 1,
    latitude: lat,
    longitude: lng,
    geojson: { type: 'Point', coordinates: [lng, lat] },
    isCustom: false,
  };
}

function normalizeText(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function filterByQuery(records: GeoRecord[], query: string): GeoRecord[] {
  if (!query.trim()) return records;
  const q = query.toLowerCase();
  return records.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.state.toLowerCase().includes(q) ||
      r.county.toLowerCase().includes(q)
  );
}

export const GEO_NAMES_SOURCE: DataSource = {
  id: 'geonames',
  name: 'GeoNames (National Map)',
  placeholder: 'Search GeoNames...',
  fetch: findLocations,
};

async function fetchEarthquakes(query: string, maxRecords = 100): Promise<GeoRecord[]> {
  const url =
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Earthquake feed failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as {
    features?: {
      properties: {
        ids?: string;
        id?: string;
        mag?: number;
        place?: string;
        time?: number;
      };
      geometry?: { coordinates?: number[] };
    }[];
  };

  const features = data.features ?? [];
  const records = features
    .filter((f) => f.geometry && typeof f.geometry.coordinates?.[0] === 'number')
    .map((f, index) => {
      const [lng, lat] = f.geometry!.coordinates!;
      const props = f.properties;
      const mag = typeof props.mag === 'number' ? props.mag.toFixed(1) : '?';
      const place = normalizeText(props.place) || 'Unknown location';
      const id = normalizeText(props.ids || props.id).replace(/^,/, '') || `eq-${index}`;
      return buildPointRecord(index, id, `M${mag} - ${place}`, 'Earthquake', 'USGS Earthquakes', lat, lng);
    });

  return filterByQuery(records, query).slice(0, maxRecords);
}

export const USGS_EARTHQUAKE_SOURCE: DataSource = {
  id: 'earthquakes',
  name: 'USGS Earthquakes',
  featureType: 'Earthquake',
  placeholder: 'Filter by place (optional)',
  fetch: fetchEarthquakes,
};

async function fetchWater(query: string, maxRecords = 100): Promise<GeoRecord[]> {
  // Use a continental-US bounding box and return active stream sites with instantaneous flow data.
  const url =
    'https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=-125,24,-66,49.5&parameterCd=00060&siteStatus=active&hasDataTypeCd=iv';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`USGS Water service failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as {
    value?: {
      timeSeries?: {
        sourceInfo?: {
          siteName?: string;
          siteCode?: { value: string }[];
          geoLocation?: {
            geogLocation?: { latitude?: number; longitude?: number };
          };
        };
      }[];
    };
  };

  const seen = new Set<string>();
  const records: GeoRecord[] = [];
  const timeSeries = data.value?.timeSeries ?? [];

  for (const ts of timeSeries) {
    const info = ts.sourceInfo;
    if (!info) continue;
    const code = info.siteCode?.[0]?.value;
    if (!code || seen.has(code)) continue;
    const lat = info.geoLocation?.geogLocation?.latitude;
    const lng = info.geoLocation?.geogLocation?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    seen.add(code);
    records.push(
      buildPointRecord(
        records.length,
        code,
        info.siteName || `Site ${code}`,
        'Water',
        'USGS Water',
        lat,
        lng
      )
    );
  }

  return filterByQuery(records, query).slice(0, maxRecords);
}

export const USGS_WATER_SOURCE: DataSource = {
  id: 'water',
  name: 'USGS Water',
  featureType: 'Water',
  placeholder: 'Filter by site name (optional)',
  fetch: fetchWater,
};

async function fetchGbif(query: string, maxRecords = 100): Promise<GeoRecord[]> {
  const params = new URLSearchParams({
    country: 'US',
    limit: String(maxRecords),
    offset: '0',
  });
  if (query.trim()) {
    params.set('q', query.trim());
  }
  const url = `https://api.gbif.org/v1/occurrence/search?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GBIF request failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as {
    results?: {
      key?: number;
      decimalLatitude?: number;
      decimalLongitude?: number;
      species?: string;
      scientificName?: string;
      stateProvince?: string;
      county?: string;
    }[];
  };

  const results = data.results ?? [];
  return results
    .filter(
      (r) => typeof r.decimalLatitude === 'number' && typeof r.decimalLongitude === 'number'
    )
    .map((r, index) =>
      buildPointRecord(
        index,
        r.key !== undefined ? String(r.key) : `gbif-${index}`,
        r.species || r.scientificName || 'Unknown species',
        'Species',
        'GBIF-US',
        r.decimalLatitude!,
        r.decimalLongitude!,
        r.stateProvince || '',
        r.county || ''
      )
    );
}

export const GBIF_SOURCE: DataSource = {
  id: 'gbif',
  name: 'GBIF-US',
  featureType: 'Species',
  placeholder: 'Search species...',
  fetch: fetchGbif,
};

async function fetchHydro(query: string, maxRecords = 100): Promise<GeoRecord[]> {
  const records = await fetchMapServerLayers('https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer');
  if (!query.trim()) return records.slice(0, maxRecords);
  const q = query.toLowerCase();
  return records.filter(r => r.name.toLowerCase().includes(q)).slice(0, maxRecords);
}

export const USGS_HYDRO_SOURCE: DataSource = {
  id: 'hydro',
  name: 'USGS Hydro',
  featureType: 'Layer',
  placeholder: 'Search layers...',
  fetch: fetchHydro,
};

export const DATA_SOURCES: DataSource[] = [
  GEO_NAMES_SOURCE,
  USGS_EARTHQUAKE_SOURCE,
  USGS_WATER_SOURCE,
  GBIF_SOURCE,
  USGS_HYDRO_SOURCE,
];

export function getSourceById(id: string): DataSource | undefined {
  return DATA_SOURCES.find((s) => s.id === id);
}
