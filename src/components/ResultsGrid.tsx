import type { GeoRecord } from '../lib/geonames';

interface ResultsGridProps {
  data: GeoRecord[];
  selectedId?: string;
  onSelect: (record: GeoRecord) => void;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

export default function ResultsGrid({ data, selectedId, onSelect }: ResultsGridProps) {
  if (data.length === 0) return null;

  const fixedColumns = ['gazId', 'name', 'featureType', 'layerName', 'state', 'county', 'latitude', 'longitude'];
  const attributeKeys = new Set<string>();
  data.forEach((record) => {
    if (record.attributes) {
      Object.keys(record.attributes).forEach((key) => attributeKeys.add(key));
    }
  });
  fixedColumns.forEach((key) => attributeKeys.delete(key));
  const columns = [...fixedColumns, ...Array.from(attributeKeys).sort()];

  return (
    <div className="results-grid-container">
      <table className="results-grid">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} title={col}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((record, index) => {
            const valueFor = (key: string): string => {
              if (record.attributes && key in record.attributes) {
                return formatValue(record.attributes[key]);
              }
              if (key === 'latitude') return record.latitude !== undefined ? record.latitude.toFixed(6) : '';
              if (key === 'longitude') return record.longitude !== undefined ? record.longitude.toFixed(6) : '';
              if (key in record) return formatValue(record[key as keyof GeoRecord]);
              return '';
            };

            return (
              <tr
                key={record.gazId ? `${record.gazId}-${index}` : `row-${index}`}
                className={record.gazId === selectedId ? 'selected' : ''}
                onClick={() => onSelect(record)}
              >
                {columns.map((col) => (
                  <td key={col} title={valueFor(col)}>
                    {valueFor(col)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
