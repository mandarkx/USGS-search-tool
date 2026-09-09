import { useMemo, useRef, useState, useCallback } from 'react';
import { loadCustomFile, loadCustomLocations, type GeoRecord } from './lib/geonames';
import { DATA_SETS, DATA_SOURCES, getSourceById, type DataSet, type DataSource } from './lib/sources';
import GlobeMap from './components/GlobeMap';
import RecordDetails from './components/RecordDetails';
import ResultsList from './components/ResultsList';
import useWindowSize from './hooks/useWindowSize';
import type { GlobeMethods } from 'react-globe.gl';

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
  const [activeTab, setActiveTab] = useState<'filter' | 'datasets'>('datasets');
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      globeRef.current?.pointOfView({ lat: record.latitude, lng: record.longitude, altitude: 0.35 }, 1000);
    }
  }, []);

  const handleLayerClick = useCallback((record: GeoRecord, coords: { lat: number; lng: number; altitude?: number }) => {
    setSelected(record);
    setPopup(null);
    if (record.latitude !== undefined && record.longitude !== undefined) {
      globeRef.current?.pointOfView({ lat: record.latitude, lng: record.longitude, altitude: 0.35 }, 1000);
    }
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

  async function runSearch(searchSource: DataSource, searchQuery: string): Promise<GeoRecord[]> {
    if (searchSource.needsQuery && !searchQuery.trim()) {
      setResults([]);
      setSelected(null);
      setError(null);
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);
    try {
      const data = await searchSource.fetch(searchQuery, 100);
      setResults(data);
      setSelected(null);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(overrideQuery = query) {
    runSearch(source, overrideQuery);
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

  async function handleLoadFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const data = await loadCustomFile(file);
      setActiveTab('filter');
      setCustomResults(data);
      setSelected(data[0] ?? null);
      if (data[0] && data[0].latitude !== undefined && data[0].longitude !== undefined) {
        globeRef.current?.pointOfView({ lat: data[0].latitude, lng: data[0].longitude, altitude: 0.35 }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDataSetClick(dataSet: DataSet) {
    const nextSource = getSourceById(dataSet.sourceId);
    if (!nextSource) return;
    setActiveTab('filter');
    setSource(nextSource);
    setQuery(dataSet.query);
    setStateFilter('');
    setTypeFilter('');
    setSelected(null);
    setPopup(null);
    setError(null);
    setShowCustomUrl(false);
    const data = await runSearch(nextSource, dataSet.query);
    if (data[0]) {
      setSelected(data[0]);
      if (data[0].latitude !== undefined && data[0].longitude !== undefined) {
        globeRef.current?.pointOfView(
          { lat: data[0].latitude, lng: data[0].longitude, altitude: 0.35 },
          1000
        );
      }
    }
  }

  function handleReset() {
    const defaultSource = DATA_SOURCES[0];
    setSource(defaultSource);
    setQuery('');
    setStateFilter('');
    setTypeFilter('');
    setActiveTab('datasets');
    setResults([]);
    setCustomResults([]);
    setCustomUrl('');
    setShowCustomUrl(false);
    setSelected(null);
    setPopup(null);
    setError(null);
    setLoading(false);
    globeRef.current?.pointOfView(CONTINENTAL_US_VIEW, 1000);
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <aside className="sidebar">
        <div className="tab-bar">
          <button
            type="button"
            className={activeTab === 'filter' ? 'active' : ''}
            onClick={() => setActiveTab('filter')}
          >
            Filter
          </button>
          <button
            type="button"
            className={activeTab === 'datasets' ? 'active' : ''}
            onClick={() => setActiveTab('datasets')}
          >
            Data Sets
          </button>
        </div>
        {activeTab === 'filter' && (
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
              <button onClick={() => fileInputRef.current?.click()} disabled={loading}>
                Load File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".geojson,.json,.csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleLoadFile(file);
                    e.target.value = '';
                  }
                }}
              />
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
        )}
        {activeTab === 'filter' ? (
          <ResultsList data={filtered} selectedId={selected?.gazId} onSelect={handleSelect} />
        ) : (
          <div className="data-sets-list">
            {DATA_SETS.map((dataSet) => (
              <div
                key={dataSet.id}
                className="result-item"
                onClick={() => handleDataSetClick(dataSet)}
              >
                <div className="result-name">{dataSet.name}</div>
                <div className="result-meta">{dataSet.description}</div>
              </div>
            ))}
          </div>
        )}
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

      {selected && (
        <div className="detail-panel">
          <RecordDetails record={selected} />
        </div>
      )}

      <div className="status">
        {activeTab === 'datasets'
          ? 'Select a data set to load'
          : error
            ? `Error: ${error}`
            : `${filtered.length} of ${allResults.length} results${stateFilter ? ` in ${stateFilter}` : ''}${typeFilter ? `, type ${typeFilter}` : ''}`}
      </div>
    </div>
  );
}

export default App;
