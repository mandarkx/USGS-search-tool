import { describe, expect, it } from 'vitest';
import { loadCustomFile, parseCsv } from './geonames';

const sampleGeoJson = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'p1',
        name: 'Old Faithful',
        featureType: 'Geyser',
        state: 'WY',
        county: 'Teton',
      },
      geometry: {
        type: 'Point',
        coordinates: [-110.8313, 44.4605],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'p2',
        name: 'Grand Prismatic',
        featureType: 'Spring',
        state: 'WY',
        county: 'Teton',
      },
      geometry: {
        type: 'Point',
        coordinates: [-110.8363, 44.525],
      },
    },
  ],
});

const sampleCsv = `gazId,name,featureType,state,county,latitude,longitude
1,Town of West Yellowstone,Civil,MT,Gallatin,44.662189,-111.107034
2,Township of Yellowstone,Civil,OK,Woods,36.891703,-99.012885`;

describe('loadCustomFile', () => {
  it('parses a GeoJSON FeatureCollection file', async () => {
    const file = new File([sampleGeoJson], 'sample.geojson', { type: 'application/geo+json' });
    const records = await loadCustomFile(file);

    expect(records).toHaveLength(2);
    expect(records[0].gazId).toBe('p1');
    expect(records[0].name).toBe('Old Faithful');
    expect(records[0].featureType).toBe('Geyser');
    expect(records[0].state).toBe('WY');
    expect(records[0].county).toBe('Teton');
    expect(records[0].latitude).toBeCloseTo(44.4605);
    expect(records[0].longitude).toBeCloseTo(-110.8313);
    expect(records[0].geojson).toEqual({ type: 'Point', coordinates: [-110.8313, 44.4605] });
  });

  it('parses a CSV file', async () => {
    const file = new File([sampleCsv], 'sample.csv', { type: 'text/csv' });
    const records = await loadCustomFile(file);

    expect(records).toHaveLength(2);
    expect(records[0].gazId).toBe('1');
    expect(records[0].name).toBe('Town of West Yellowstone');
    expect(records[0].featureType).toBe('Civil');
    expect(records[0].state).toBe('MT');
    expect(records[0].county).toBe('Gallatin');
    expect(records[0].latitude).toBeCloseTo(44.662189);
    expect(records[0].longitude).toBeCloseTo(-111.107034);
  });
});

describe('parseCsv', () => {
  it('parses quoted fields containing commas', () => {
    const csv = `id,name,state
1,"Yellowstone, MT",WY
2,"Grand, Teton",WY`;
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Yellowstone, MT');
  });
});
