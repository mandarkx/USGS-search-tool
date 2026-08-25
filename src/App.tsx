import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { loadCustomLocations, type GeoRecord } from './lib/geonames';
import { DATA_SOURCES, getSourceById, type DataSource } from './lib/sources';
import GlobeMap from './components/GlobeMap';
import ResultsList from './components/ResultsList';
import useWindowSize from './hooks/useWindowSize';
import type { GlobeMethods } from 'react-globe.gl';
import TopAppBar from './components/TopAppBar';

const CONTINENTAL_US_VIEW = { lat: 39.5, lng: -98.5, altitude: 2.0 };

interface PopupState {
  lat: number;
  lng: number;
  x: number;
  y: number;
  copied: boolean;
}

function App() {
  const [source, setSource] = useState<DataSource>(DATA_SOURCES[0]);
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [results, setResults] = useState<GeoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GeoRecord | null>(null);
  const [customResults, setCustomResults] = useState<GeoRecord[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [showCustomUrl, setShowCustomUrl] = useState(false);
  const [popup, setPopup] = useState<PopupState | null>(null);

  const { width, height } = useWindowSize();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  const allResults = useMemo(() => [...results, ...customResults], [results, customResults]);

  const stateOptions = useMemo(() => {
    const states = new Set<string>();
    allResults.forEach((r) => {
      if (r.state) states.add(r.state);
    });
    return Array.from(states).sort();
  }, [allResults]);

  const typeOptions = useMemo(() => {
    const types = new Set<string>();
    allResults.forEach((r) => {
      if (r.featureType) types.add(r.featureType);
    });
    return Array.from(types).sort();
  }, [allResults]);

  const filtered = useMemo(() => {
    let r = allResults;
    if (stateFilter) r = r.filter((x) => x.state === stateFilter);
    if (typeFilter) r = r.filter((x) => x.featureType === typeFilter);
    return r;
  }, [allResults, stateFilter, typeFilter]);

  const handleSelect = useCallback((record: GeoRecord) => {
    setSelected(record);
    if (record.latitude !== undefined && record.longitude !== undefined) {
      let altitude = 0.35;
      if (record.featureType === 'Raster Layer' || record.featureType === 'Layer') {
        altitude = 1.0; 
      }
      globeRef.current?.pointOfView({ lat: record.latitude, lng: record.longitude, altitude }, 1000);
    }
  }, []);

  const handleLayerClick = useCallback((record: GeoRecord, coords: { lat: number; lng: number; altitude?: number }) => {
    setSelected(record);
    setPopup(null);
    const screen = globeRef.current?.getScreenCoords(coords.lat, coords.lng, coords.altitude ?? 0);
    if (screen) {
      setPopup({ lat: coords.lat, lng: coords.lng, x: screen.x, y: screen.y, copied: false });
    }
  }, []);

  const handleGlobeClick = useCallback(() => {
    setPopup(null);
  }, []);

  const handleClosePopup = useCallback(() => {
    setPopup(null);
  }, []);

  const handleCopyCoordinates = useCallback(async () => {
    if (!popup) return;
    const text = `${popup.lat.toFixed(6)}, ${popup.lng.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setPopup((p) => (p ? { ...p, copied: true } : null));
    } catch {
      // ignore
    }
  }, [popup]);

  const handleGlobeReady = useCallback(() => {
    globeRef.current?.pointOfView(CONTINENTAL_US_VIEW, 1000);
  }, []);

  async function handleSearch(overrideQuery?: string) {
    const searchText = overrideQuery ?? query;
    setLoading(true);
    setError(null);
    try {
      const data = await source.fetch(searchText, 100);
      setResults(data);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadCustomUrl() {
    if (!customUrl) return;
    setLoading(true);
    setError(null);
    try {
      const data = await loadCustomLocations(customUrl);
      setCustomResults(data);
      setShowCustomUrl(false);
      setCustomUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    const defaultSource = DATA_SOURCES[0];
    setSource(defaultSource);
    setQuery('');
    setStateFilter('');
    setTypeFilter('');
    setCustomResults([]);
    setCustomUrl('');
    setShowCustomUrl(false);
    setSelected(null);
    setPopup(null);
    setError(null);
    setLoading(true);
    globeRef.current?.pointOfView(CONTINENTAL_US_VIEW, 1000);
    defaultSource
      .fetch('', 100)
      .then((data) => setResults(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopAppBar />
      <div style={{ flex: 1, position: 'relative' }}>
      <aside className="sidebar">
        <div className="controls">
          <div className="controls-row">
            <select
              value={source.id}
              onChange={(e) => {
                const next = getSourceById(e.target.value);
                if (next) {
                  setSource(next);
                  setQuery('');
                  setSelected(null);
                }
              }}
            >
              {DATA_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button onClick={() => handleSearch()} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button onClick={handleReset} disabled={loading}>
              Reset
            </button>
            <button onClick={() => setShowCustomUrl((s) => !s)} disabled={loading}>
              {showCustomUrl ? 'Cancel' : 'Add API URL'}
            </button>
          </div>
          <div className="controls-row">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={source.placeholder || 'Search...'}
            />
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="">All states</option>
              {stateOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          {showCustomUrl && (
            <div className="controls-row url-row">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoadCustomUrl()}
                placeholder="https://..."
              />
              <button onClick={handleLoadCustomUrl} disabled={loading}>
                Load
              </button>
            </div>
          )}
        </div>
        <ResultsList data={filtered} selectedId={selected?.gazId} onSelect={handleSelect} />
      </aside>

      <GlobeMap
        globeRef={globeRef}
        data={filtered}
        width={width}
        height={height}
        selectedId={selected?.gazId}
        onLayerClick={handleLayerClick}
        onGlobeClick={handleGlobeClick}
        onGlobeReady={handleGlobeReady}
      />

      {popup && (
        <div className="coordinate-popup" style={{ left: popup.x, top: popup.y }}>
          <button className="popup-close" onClick={handleClosePopup}>×</button>
          <div className="popup-coords">
            {popup.lat.toFixed(6)}, {popup.lng.toFixed(6)}
          </div>
          <button className="popup-copy" onClick={handleCopyCoordinates}>
            {popup.copied ? 'Copied!' : 'Copy coordinates'}
          </button>
        </div>
      )}

      <div className="status">
        {error ? `Error: ${error}` : `${filtered.length} of ${allResults.length} results${stateFilter ? ` in ${stateFilter}` : ''}${typeFilter ? `, type ${typeFilter}` : ''}`}
      </div>
      </div>
    </div>
  );
}

export default App;
