const LAKE_URL =
  'https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/find?searchText=Yellowstone%20Lake&contains=true&searchFields=gaz_name&layers=1,2,3,5,6,7,8,10,12,13,14&sr=4326&returnGeometry=true&maxRecords=25&f=json';

const YELLOWSTONE_URL =
  'https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/find?searchText=Yellowstone&contains=true&searchFields=gaz_name&layers=1,2,3,5,6,7,8,10,12,13,14&sr=4326&returnGeometry=true&maxRecords=100&f=json';

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function computeCentroid(geometry) {
  if (!geometry) return null;

  if (typeof geometry.x === 'number' && typeof geometry.y === 'number') {
    return { latitude: geometry.y, longitude: geometry.x, coordinateCount: 1 };
  }

  let sumX = 0;
  let sumY = 0;
  let count = 0;

  const addPoint = (pt) => {
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
  return { latitude: sumY / count, longitude: sumX / count, coordinateCount: count };
}

function extractRecords(data, searchLabel) {
  if (!data.results || !Array.isArray(data.results)) {
    return [];
  }

  return data.results.map((result, index) => {
    const attrs = result.attributes || {};
    const centroid = computeCentroid(result.geometry);

    return {
      search: searchLabel,
      rank: index + 1,
      gazId: attrs.gaz_id,
      name: attrs.gaz_name,
      featureType: attrs.gaz_featureclass,
      fcode: attrs.fcode,
      layerName: result.layerName,
      state: attrs.state_alpha,
      county: attrs.county_name,
      geometryType: result.geometryType,
      coordinateCount: centroid ? centroid.coordinateCount : 0,
      latitude: centroid ? centroid.latitude : undefined,
      longitude: centroid ? centroid.longitude : undefined,
    };
  });
}

function toCsv(records) {
  const headers = [
    'search',
    'rank',
    'gazId',
    'name',
    'featureType',
    'fcode',
    'layerName',
    'state',
    'county',
    'geometryType',
    'coordinateCount',
    'latitude',
    'longitude',
  ];

  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  };

  const lines = [headers.join(','), ...records.map((r) => headers.map((h) => escape(r[h])).join(','))];
  return lines.join('\n');
}

async function main() {
  console.log('Fetching "Yellowstone Lake"...');
  const lakeData = await fetchJson(LAKE_URL);
  const lakeRecords = extractRecords(lakeData, 'Yellowstone Lake');

  console.log('Fetching "Yellowstone"...');
  const yellowstoneData = await fetchJson(YELLOWSTONE_URL);
  const yellowstoneRecords = extractRecords(yellowstoneData, 'Yellowstone');

  const allRecords = [...lakeRecords, ...yellowstoneRecords];

  const lakeJson = JSON.stringify(lakeRecords, null, 2);
  const yellowstoneJson = JSON.stringify(yellowstoneRecords, null, 2);
  const allJson = JSON.stringify(allRecords, null, 2);
  const csv = toCsv(allRecords);

  const fs = await import('node:fs/promises');
  await fs.mkdir('data', { recursive: true });
  await Promise.all([
    fs.writeFile('data/yellowstone-lake.json', lakeJson),
    fs.writeFile('data/yellowstone.json', yellowstoneJson),
    fs.writeFile('data/all-yellowstone-locations.json', allJson),
    fs.writeFile('data/all-yellowstone-locations.csv', csv),
  ]);

  console.log(`Saved ${lakeRecords.length} "Yellowstone Lake" records.`);
  console.log(`Saved ${yellowstoneRecords.length} "Yellowstone" records.`);
  console.log(`Saved combined CSV with ${allRecords.length} records to data/all-yellowstone-locations.csv`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
