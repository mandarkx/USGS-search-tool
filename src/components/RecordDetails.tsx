import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import type { GeoRecord, GeoJSONGeometry } from '../lib/geonames';

interface RecordDetailsProps {
  record: GeoRecord;
}

function countGeoJsonCoords(geometry: GeoJSONGeometry): number {
  const walk = (value: unknown): number => {
    if (Array.isArray(value)) {
      if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
        return 1;
      }
      return value.reduce((sum, child) => sum + walk(child), 0);
    }
    return 0;
  };
  return walk(geometry.coordinates);
}

function formatValue(key: string, value: unknown, record: GeoRecord): string {
  if (value === undefined || value === null) return '-';
  if (key === 'geojson' && typeof value === 'object') {
    const geometry = value as GeoJSONGeometry;
    const count = record.coordinateCount ?? countGeoJsonCoords(geometry);
    return `${geometry.type} (${count} coordinates)`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function RecordDetails({ record }: RecordDetailsProps) {
  const rows = Object.entries(record)
    .filter(([key]) => key !== 'isCustom')
    .map(([key, value]) => ({
      key,
      value: formatValue(key, value, record),
    }));

  return (
    <Paper
      elevation={4}
      sx={{
        backgroundColor: 'rgba(20, 24, 39, 0.95)',
        color: '#e8eaed',
        borderTop: '1px solid #3c4043',
      }}
    >
      <TableContainer sx={{ maxHeight: 180 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  color: '#e8eaed',
                  backgroundColor: '#1f2937',
                  borderBottom: '1px solid #3c4043',
                  fontWeight: 500,
                }}
              >
                Field
              </TableCell>
              <TableCell
                sx={{
                  color: '#e8eaed',
                  backgroundColor: '#1f2937',
                  borderBottom: '1px solid #3c4043',
                  fontWeight: 500,
                }}
              >
                Value
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell
                  sx={{ color: '#9ca3af', borderBottom: '1px solid #3c4043' }}
                >
                  {row.key}
                </TableCell>
                <TableCell
                  sx={{ color: '#e8eaed', borderBottom: '1px solid #3c4043' }}
                >
                  {row.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
