const XLSX = require('xlsx');
const { getDb } = require('../db');
const { generateExportNumber } = require('../utils/exportNumber');

/**
 * Converts array of JSON objects to CSV string with standard quoting
 */
function convertToCSV(data = []) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Header row
  csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));

  // Data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\r\n');
}

/**
 * Converts array of JSON objects to XLSX binary buffer
 */
function convertToXLSX(data = [], sheetName = 'Report') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generates export output (CSV or XLSX) and records an audit log
 * @param {Object} params
 * @param {string} params.actorId
 * @param {string} params.actorRole
 * @param {string} params.reportType - 'TRANSACTIONS' | 'COMMISSIONS' | 'SETTLEMENTS' | 'DISPUTES' | 'EARNINGS'
 * @param {string} [params.format='csv'] - 'csv' | 'xlsx'
 * @param {Array<Object>} params.data - Clean sanitized records
 * @param {Object} [params.filters]
 * @param {Object} [params.dbInstance]
 */
async function generateReportExport({
  actorId,
  actorRole,
  reportType,
  format = 'csv',
  data = [],
  filters = {},
  dbInstance
}) {
  const db = dbInstance || getDb();
  const exportLogs = db.collection('report_export_logs');

  const exportId = await generateExportNumber(db);
  const cleanFormat = String(format).toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';

  let bufferOrString = null;
  let mimeType = 'text/csv';
  let fileExtension = 'csv';

  if (cleanFormat === 'xlsx') {
    bufferOrString = convertToXLSX(data, reportType);
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    fileExtension = 'xlsx';
  } else {
    bufferOrString = convertToCSV(data);
    mimeType = 'text/csv';
    fileExtension = 'csv';
  }

  // Audit log
  try {
    await exportLogs.insertOne({
      exportId,
      actorId: String(actorId),
      actorRole: String(actorRole),
      reportType,
      format: cleanFormat,
      filters,
      recordCount: data.length,
      createdAt: new Date()
    });
  } catch (err) {
    console.warn('Error saving report export audit log:', err.message);
  }

  const filename = `DrivePortz_${reportType}_${new Date().toISOString().split('T')[0]}_${exportId}.${fileExtension}`;

  return {
    exportId,
    content: bufferOrString,
    mimeType,
    filename
  };
}

module.exports = {
  convertToCSV,
  convertToXLSX,
  generateReportExport
};
