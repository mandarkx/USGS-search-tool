import { useMemo, useRef } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import type { GeoRecord, GeoJSONGeometry } from '../lib/geonames';

interface GlobeMapProps {
  data: GeoRecord[];
  width: number;
  height: number;
  selectedId?: string;
  onLayerClick?: (record: GeoRecord, coords: { lat: number; lng: number; altitude?: number }) => void;
  onGlobeClick?: (coords: { lat: number; lng: number }) => void;
  onGlobeReady?: () => void;
  globeRef?: React.MutableRefObject<GlobeMethods | undefined>;
}

const FEATURE_COLORS: Record<string, string> = {
  Lake: '#22aaff',
  Reservoir: '#1177cc',
  Stream: '#44ccff',
  Canal: '#88bbff',
  Spring: '#66ddff',
  Valley: '#d4a373',
  Cliff: '#888888',
  Summit: '#ffffff',
  Crater: '#cc5533',
  Arch: '#ccaa66',
  Area: '#88cc88',
  Ridge: '#aaaaaa',
  Cape: '#ffcc66',
  Falls: '#00ffff',
  'Populated Place': '#ffaa00',
  Civil: '#ff8800',
  Census: '#ff66aa',
};

const CUSTOM_COLOR = '#87CEFA';
const SELECTED_COLOR = '#ffdd00';

function getColor(record: GeoRecord): string {
  if (record.isCustom) return CUSTOM_COLOR;
  return FEATURE_COLORS[record.featureType] ?? '#ff5555';
}

function layerColor(record: GeoRecord, selected: boolean): string {
  if (selected) return SELECTED_COLOR;
  return getColor(record);
}

function makeLabelElement(record: GeoRecord): HTMLElement {
  const color = getColor(record);
  const el = document.createElement('div');
  el.className = `globe-label ${record.isCustom ? 'custom' : ''}`;
  el.style.color = color;
  el.innerHTML = `<span class="globe-dot" style="background-color:${color}"></span><span class="globe-name">${record.name}</span>`;
  return el;
}

function recordFromLayer(d: object): GeoRecord {
  return d as unknown as GeoRecord;
}

export default function GlobeMap({
  data,
  width,
  height,
  selectedId,
  onLayerClick,
  onGlobeClick,
  onGlobeReady,
  globeRef: externalGlobeRef,
}: GlobeMapProps) {
  const localGlobeRef = useRef<GlobeMethods | undefined>(undefined);
  const globeRef = externalGlobeRef ?? localGlobeRef;

  const { points, paths, polygons, htmlElements } = useMemo(() => {
    type PointItem = GeoRecord & { lat: number; lng: number; color: string; size: number };
    type PathItem = GeoRecord & { points: number[][]; color: string };
    type PolygonItem = GeoRecord & { geojson: GeoJSONGeometry; color: string };
    type LabelItem = GeoRecord & { lat: number; lng: number };

    const p: PointItem[] = [];
    const lines: PathItem[] = [];
    const polys: PolygonItem[] = [];
    const labels: LabelItem[] = [];

    for (const record of data) {
      const selected = record.gazId === selectedId;
      const color = layerColor(record, selected);

      p.push({
        ...record,
        lat: record.latitude ?? 0,
        lng: record.longitude ?? 0,
        color,
        size: selected ? 1.0 : record.isCustom ? 0.6 : 0.4,
      });

      labels.push({
        ...record,
        lat: record.latitude ?? 0,
        lng: record.longitude ?? 0,
      });

      const geojson = record.geojson;
      if (geojson) {
        if (geojson.type === 'LineString') {
          const line = (geojson as { coordinates: number[][] }).coordinates;
          lines.push({ ...record, points: line.map(([lng, lat]) => [lat, lng]), color });
        } else if (geojson.type === 'MultiLineString') {
          const lineStrings = (geojson as { coordinates: number[][][] }).coordinates;
          for (const line of lineStrings) {
            lines.push({ ...record, points: line.map(([lng, lat]) => [lat, lng]), color });
          }
        } else if (geojson.type === 'Polygon') {
          polys.push({ ...record, geojson, color });
        } else if (geojson.type === 'MultiPolygon') {
          const mp = (geojson as { coordinates: number[][][][] }).coordinates;
          for (const rings of mp) {
            polys.push({ ...record, geojson: { type: 'Polygon', coordinates: rings } as GeoJSONGeometry, color });
          }
        }
      }
    }

    return { points: p, paths: lines, polygons: polys, htmlElements: labels };
  }, [data, selectedId]);

  const handleLayerClick = (
    d: object,
    event: MouseEvent,
    coords: { lat: number; lng: number; altitude?: number }
  ) => {
    event.stopPropagation();
    const record = recordFromLayer(d);
    onLayerClick?.(record, coords);
  };

  const handleGlobeClick = (coords: { lat: number; lng: number }) => {
    onGlobeClick?.(coords);
  };

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
      backgroundColor="rgba(0,0,0,0)"
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointColor="color"
      pointRadius="size"
      pointAltitude={0.01}
      pointLabel={(d: object) => {
        const r = d as GeoRecord;
        return `${r.name} - ${r.featureType} (${r.state})`;
      }}
      onPointClick={handleLayerClick}
      pathsData={paths}
      pathPoints="points"
      pathColor="color"
      pathStroke={0.15}
      pathPointAlt={0.01}
      onPathClick={handleLayerClick}
      polygonsData={polygons}
      polygonGeoJsonGeometry="geojson"
      polygonCapColor="color"
      polygonSideColor="color"
      polygonStrokeColor="color"
      polygonAltitude={0.02}
      onPolygonClick={handleLayerClick}
      onGlobeClick={handleGlobeClick}
      htmlElementsData={htmlElements}
      htmlLat="lat"
      htmlLng="lng"
      htmlAltitude={0.02}
      htmlElement={(d: object) => makeLabelElement(d as GeoRecord)}
      onGlobeReady={onGlobeReady}
    />
  );
}
