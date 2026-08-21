const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { requirePermission, PERMISSIONS } = require('../middleware/permissionMiddleware');
const { getTaxReportSummary } = require('../services/creditNoteService');
const { setTaxConfiguration } = require('../services/taxService');
const { generateReportExport } = require('../services/reportExportService');
const { parseDateRange } = require('../services/financialReportService');
const { getDb } = require('../db');

/**
 * ==========================================
 * GARAGE TAX ROUTES (/api/garage/tax)
 * ==========================================
 */
const garageTaxRouter = express.Router();

garageTaxRouter.get('/summary', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { period = '30_DAYS', dateFrom, dateTo } = req.query;
  try {
    const summary = await getTaxReportSummary({
      garageId: req.user.id,
      period,
      dateFrom,
      dateTo,
      dbInstance: getDb()
    });
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    console.error('Error loading garage tax summary:', err);
    return res.status(500).json({ success: false, message: 'Failed to load tax summary' });
  }
});

garageTaxRouter.get('/transactions', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { period = '30_DAYS', dateFrom, dateTo, page = 1, limit = 20 } = req.query;
  const db = getDb();
  const invoices = db.collection('invoices');
  const { from, to } = parseDateRange(period, dateFrom, dateTo);

  try {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      garageId: String(req.user.id),
      status: { $in: ['PAID', 'FINALIZED', 'COMPLETED'] },
      createdAt: { $gte: from, $lte: to }
    };

    const [transactions, totalCount] = await Promise.all([
      invoices.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).toArray(),
      invoices.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      transactions,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load tax transactions' });
  }
});

garageTaxRouter.get('/export', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { period = '30_DAYS', dateFrom, dateTo, format = 'csv' } = req.query;
  const db = getDb();
  const invoices = db.collection('invoices');
  const { from, to } = parseDateRange(period, dateFrom, dateTo);

  try {
    const invoiceDocs = await invoices
      .find({
        garageId: String(req.user.id),
        status: { $in: ['PAID', 'FINALIZED', 'COMPLETED'] },
        createdAt: { $gte: from, $lte: to }
      })
      .sort({ createdAt: -1 })
      .toArray();

    const exportRows = invoiceDocs.map(inv => ({
      InvoiceNumber: inv.invoiceNumber || '—',
      Date: inv.createdAt ? new Date(inv.createdAt).toISOString().split('T')[0] : '—',
      TaxableValue: inv.taxSnapshot ? inv.taxSnapshot.taxableAmount : (parseFloat(inv.grandTotal || inv.amount || 0) / 1.18).toFixed(2),
      CGST: inv.taxSnapshot ? inv.taxSnapshot.cgstAmount : '—',
      SGST: inv.taxSnapshot ? inv.taxSnapshot.sgstAmount : '—',
      IGST: inv.taxSnapshot ? inv.taxSnapshot.igstAmount : '—',
      TotalTax: inv.taxSnapshot ? inv.taxSnapshot.totalTaxAmount : '—',
      GrandTotal: inv.grandTotal || inv.amount || 0,
      Status: inv.status
    }));

    const result = await generateReportExport({
      actorId: String(req.user.id),
      actorRole: 'GARAGE',
      reportType: 'TAX_TRANSACTIONS',
      format,
      data: exportRows,
      dbInstance: db
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.data);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Tax export failed' });
  }
});

/**
 * ==========================================
 * ADMIN TAX COMPLIANCE ROUTES (/api/admin/tax)
 * ==========================================
 */
const adminTaxRouter = express.Router();

adminTaxRouter.get('/summary', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  const { period = '30_DAYS', dateFrom, dateTo } = req.query;
  try {
    const summary = await getTaxReportSummary({
      garageId: null, // Platform-wide
      period,
      dateFrom,
      dateTo,
      dbInstance: getDb()
    });
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    console.error('Error loading admin tax summary:', err);
    return res.status(500).json({ success: false, message: 'Failed to load tax summary' });
  }
});

adminTaxRouter.get('/transactions', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  const { period = '30_DAYS', dateFrom, dateTo, page = 1, limit = 20, garageId } = req.query;
  const db = getDb();
  const invoices = db.collection('invoices');
  const { from, to } = parseDateRange(period, dateFrom, dateTo);

  try {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      status: { $in: ['PAID', 'FINALIZED', 'COMPLETED'] },
      createdAt: { $gte: from, $lte: to }
    };
    if (garageId) query.garageId = String(garageId);

    const [transactions, totalCount] = await Promise.all([
      invoices.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).toArray(),
      invoices.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      transactions,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load admin tax transactions' });
  }
});

adminTaxRouter.get('/export', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  const { period = '30_DAYS', dateFrom, dateTo, format = 'csv', garageId } = req.query;
  const db = getDb();
  const invoices = db.collection('invoices');
  const { from, to } = parseDateRange(period, dateFrom, dateTo);

  try {
    const query = {
      status: { $in: ['PAID', 'FINALIZED', 'COMPLETED'] },
      createdAt: { $gte: from, $lte: to }
    };
    if (garageId) query.garageId = String(garageId);

    const invoiceDocs = await invoices.find(query).sort({ createdAt: -1 }).toArray();

    const exportRows = invoiceDocs.map(inv => ({
      InvoiceNumber: inv.invoiceNumber || '—',
      GarageId: inv.garageId || '—',
      Date: inv.createdAt ? new Date(inv.createdAt).toISOString().split('T')[0] : '—',
      TaxableValue: inv.taxSnapshot ? inv.taxSnapshot.taxableAmount : (parseFloat(inv.grandTotal || inv.amount || 0) / 1.18).toFixed(2),
      CGST: inv.taxSnapshot ? inv.taxSnapshot.cgstAmount : '—',
      SGST: inv.taxSnapshot ? inv.taxSnapshot.sgstAmount : '—',
      IGST: inv.taxSnapshot ? inv.taxSnapshot.igstAmount : '—',
      TotalTax: inv.taxSnapshot ? inv.taxSnapshot.totalTaxAmount : '—',
      GrandTotal: inv.grandTotal || inv.amount || 0,
      Status: inv.status
    }));

    const result = await generateReportExport({
      actorId: String(req.user.id),
      actorRole: 'ADMIN',
      reportType: 'PLATFORM_TAX_REPORT',
      format,
      data: exportRows,
      dbInstance: db
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.data);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Platform tax export failed' });
  }
});

adminTaxRouter.post('/configurations', requireAuth, requirePermission(PERMISSIONS.COMMISSION_MANAGE), async (req, res) => {
  const { taxType, rate, stateCode, serviceCategory, effectiveFrom, effectiveTo, active } = req.body;
  try {
    const result = await setTaxConfiguration({
      taxType,
      rate,
      stateCode,
      serviceCategory,
      effectiveFrom,
      effectiveTo,
      active,
      dbInstance: getDb()
    });
    return res.status(200).json({ success: true, message: 'Tax configuration saved', result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = {
  garageTaxRouter,
  adminTaxRouter
};
