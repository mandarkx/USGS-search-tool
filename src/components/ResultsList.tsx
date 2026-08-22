import type { GeoRecord } from '../lib/geonames';

interface ResultsListProps {
  data: GeoRecord[];
  selectedId?: string;
  onSelect?: (record: GeoRecord) => void;
}

export default function ResultsList({ data, selectedId, onSelect }: ResultsListProps) {
  return (
    <div className="results-panel">
      <div className="results-header">
        {data.length} result{data.length === 1 ? '' : 's'}
      </div>
      <ul className="results-list">
        {data.map((record) => (
          <li
            key={`${record.gazId}-${record.rank}`}
            className={[
              record.gazId === selectedId ? 'selected' : '',
              record.isCustom ? 'custom' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect?.(record)}
          >
            <div className="result-name">{record.name}</div>
            <div className="result-meta">
              {record.featureType} • {record.state}
              {record.county ? ` • ${record.county}` : ''}
            </div>
            <div className="result-coords">
              {record.latitude !== undefined && record.longitude !== undefined
                ? `${record.latitude.toFixed(3)}°, ${record.longitude.toFixed(3)}°`
                : 'No coordinates'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
