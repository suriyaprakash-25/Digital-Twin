import { apiRequest } from '../../utils/api';

const MIME_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

/**
 * Downloads a report export from the API (blob response) and saves it with
 * `filename`. Throws the API error so the caller can show it.
 */
export async function downloadReport(endpoint, params, filename, format = 'csv') {
  const { data } = await apiRequest({ method: 'get', url: endpoint, params, responseType: 'blob' });
  const blob = new Blob([data], { type: MIME_TYPES[format] || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default downloadReport;
