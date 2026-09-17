const ExcelJS = require('exceljs');
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
 * Converts array of JSON objects to an XLSX binary buffer using ExcelJS.
 * Keeping workbook generation server-side avoids exposing raw report data to
 * third-party spreadsheet services and replaces the unpatched SheetJS package.
 */
async function convertToXLSX(data = [], sheetName = 'Report') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DrivePortz';
  workbook.created = new Date();

  const safeSheetName = String(sheetName || 'Report').replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || 'Report';
  const worksheet = workbook.addWorksheet(safeSheetName);

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.min(40, Math.max(12, String(header).length + 2))
    }));

    for (const row of data) {
      const normalized = {};
      for (const header of headers) {
        const value = row[header];
        normalized[header] = value !== null && typeof value === 'object'
          ? JSON.stringify(value)
          : value;
      }
      worksheet.addRow(normalized);
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length }
    };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
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
    bufferOrString = await convertToXLSX(data, reportType);
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
    data: bufferOrString,
    mimeType,
    filename
  };
}

module.exports = {
  convertToCSV,
  convertToXLSX,
  generateReportExport
};
