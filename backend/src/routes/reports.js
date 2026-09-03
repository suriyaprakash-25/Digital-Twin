const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminMiddleware');
const {
  getGarageFinancialSummary,
  getGarageTransactionsReport,
  getGarageStatement,
  getAdminPlatformFinancialSummary,
  parseDateRange
} = require('../services/financialReportService');
const { generateReportExport } = require('../services/reportExportService');

// ──────────────────────── GARAGE REPORT ROUTES ────────────────────────
const garageReportsRouter = express.Router();

/**
 * GET /api/garage/reports/summary
 */
garageReportsRouter.get('/summary', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { period = '30_DAYS', dateFrom, dateTo } = req.query;

  try {
    const summary = await getGarageFinancialSummary(req.user.id, { period, dateFrom, dateTo });
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    console.error('Error loading garage report summary:', err);
    return res.status(500).json({ success: false, message: 'Error loading financial summary' });
  }
});

/**
 * GET /api/garage/reports/transactions
 */
garageReportsRouter.get('/transactions', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { page = 1, limit = 20, search = '', dateFrom, dateTo, period = 'ALL' } = req.query;

  try {
    const report = await getGarageTransactionsReport(req.user.id, { page, limit, search, dateFrom, dateTo, period });
    return res.status(200).json({ success: true, ...report });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading transactions report' });
  }
});

/**
 * GET /api/garage/reports/statement
 */
garageReportsRouter.get('/statement', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { period = '30_DAYS', dateFrom, dateTo } = req.query;

  try {
    const statement = await getGarageStatement(req.user.id, { period, dateFrom, dateTo });
    return res.status(200).json({ success: true, statement });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error generating earnings statement' });
  }
});

/**
 * GET /api/garage/reports/export
 */
garageReportsRouter.get('/export', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { reportType = 'TRANSACTIONS', format = 'csv', period = '30_DAYS', dateFrom, dateTo } = req.query;

  try {
    const db = getDb();
    const earnings = db.collection('garage_earnings');
    const { resolveGarageIds } = require('../utils/garageResolver');
    const { from, to } = parseDateRange(period, dateFrom, dateTo);

    const garageIds = await resolveGarageIds(req.user.id, db);
    const docs = await earnings
      .find({
        garageId: { $in: garageIds },
        createdAt: { $gte: from, $lte: to }
      })
      .sort({ createdAt: -1 })
      .toArray();

    const sanitizedData = docs.map(d => ({
      Invoice_Number: d.invoiceNumber || '—',
      Payment_ID: d.paymentId || '—',
      Vehicle_Number: d.vehicleNumber || '—',
      Service_Type: d.serviceType || '—',
      Gross_Amount_INR: d.grossAmount || 0,
      Platform_Fee_INR: d.platformCommission || 0,
      Garage_Net_INR: d.garageNetAmount || 0,
      Refund_Deduction_INR: d.refundAmount || 0,
      Final_Net_INR: d.netAfterRefund !== undefined ? d.netAfterRefund : d.garageNetAmount,
      Settlement_Status: d.status || 'AVAILABLE',
      Date: d.createdAt ? new Date(d.createdAt).toISOString() : '—'
    }));

    const result = await generateReportExport({
      actorId: req.user.id,
      actorRole: 'GARAGE',
      reportType: String(reportType).toUpperCase(),
      format,
      data: sanitizedData,
      filters: { period, dateFrom, dateTo }
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.content);
  } catch (err) {
    console.error('Error exporting garage report:', err);
    return res.status(500).json({ success: false, message: 'Error exporting report' });
  }
});

// ──────────────────────── ADMIN REPORT ROUTES ────────────────────────
const adminReportsRouter = express.Router();

/**
 * GET /api/admin/reports/summary
 */
adminReportsRouter.get('/summary', requireAdmin, async (req, res) => {
  const { period = '30_DAYS', dateFrom, dateTo } = req.query;

  try {
    const summary = await getAdminPlatformFinancialSummary({ period, dateFrom, dateTo });
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    console.error('Error loading admin platform financial summary:', err);
    return res.status(500).json({ success: false, message: 'Error loading financial summary' });
  }
});

/**
 * GET /api/admin/reports/transactions
 */
adminReportsRouter.get('/transactions', requireAdmin, async (req, res) => {
  const { page = 1, limit = 20, search = '', dateFrom, dateTo, period = '30_DAYS', status = 'ALL' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const earnings = db.collection('garage_earnings');

  try {
    const { from, to } = parseDateRange(period, dateFrom, dateTo);
    const query = { createdAt: { $gte: from, $lte: to } };

    if (status && status !== 'ALL') query.status = status;

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { invoiceNumber: regex },
        { paymentId: regex },
        { razorpayPaymentId: regex },
        { garageName: regex },
        { vehicleNumber: regex }
      ];
    }

    const totalCount = await earnings.countDocuments(query);
    const rawList = await earnings
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const formatted = rawList.map(e => ({
      id: String(e._id),
      invoiceNumber: e.invoiceNumber,
      paymentId: e.paymentId,
      razorpayPaymentId: e.razorpayPaymentId,
      garageName: e.garageName || 'Authorized Garage',
      vehicleNumber: e.vehicleNumber,
      serviceType: e.serviceType,
      grossAmount: e.grossAmount,
      platformCommission: e.platformCommission,
      garageNetAmount: e.garageNetAmount,
      refundAmount: e.refundAmount || 0,
      finalNetAmount: e.netAfterRefund !== undefined ? e.netAfterRefund : e.garageNetAmount,
      status: e.status,
      date: e.createdAt
    }));

    return res.status(200).json({
      success: true,
      transactions: formatted,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading admin transactions' });
  }
});

/**
 * GET /api/admin/reports/commissions
 */
adminReportsRouter.get('/commissions', requireAdmin, async (req, res) => {
  const { period = '30_DAYS', dateFrom, dateTo } = req.query;
  const db = getDb();
  const earnings = db.collection('garage_earnings');

  try {
    const { from, to } = parseDateRange(period, dateFrom, dateTo);
    const docs = await earnings
      .find({ createdAt: { $gte: from, $lte: to } })
      .sort({ createdAt: -1 })
      .toArray();

    let totalGrossPaise = 0;
    let totalCommissionPaise = 0;
    let totalGarageNetPaise = 0;

    const list = docs.map(d => {
      totalGrossPaise += d.grossPaise || Math.round(d.grossAmount * 100);
      totalCommissionPaise += d.platformCommissionPaise || Math.round(d.platformCommission * 100);
      totalGarageNetPaise += d.garageNetPaise || Math.round(d.garageNetAmount * 100);

      return {
        id: String(d._id),
        invoiceNumber: d.invoiceNumber,
        paymentId: d.paymentId,
        garageName: d.garageName,
        grossAmount: d.grossAmount,
        commissionRate: d.commissionSnapshot?.rate || d.commissionRate || 5,
        platformCommission: d.platformCommission,
        garageNetAmount: d.garageNetAmount,
        date: d.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalGrossVolume: totalGrossPaise / 100,
        totalCommissionEarned: totalCommissionPaise / 100,
        totalGaragePayouts: totalGarageNetPaise / 100,
        transactionCount: docs.length
      },
      commissions: list
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading commission report' });
  }
});

/**
 * GET /api/admin/reports/export
 */
adminReportsRouter.get('/export', requireAdmin, async (req, res) => {
  const { reportType = 'TRANSACTIONS', format = 'csv', period = '30_DAYS', dateFrom, dateTo } = req.query;

  try {
    const db = getDb();
    const earnings = db.collection('garage_earnings');
    const { from, to } = parseDateRange(period, dateFrom, dateTo);

    const docs = await earnings
      .find({ createdAt: { $gte: from, $lte: to } })
      .sort({ createdAt: -1 })
      .toArray();

    const sanitizedData = docs.map(d => ({
      Invoice_Number: d.invoiceNumber || '—',
      Payment_ID: d.paymentId || '—',
      Garage_Name: d.garageName || 'Authorized Service Center',
      Vehicle_Number: d.vehicleNumber || '—',
      Service_Type: d.serviceType || '—',
      Gross_Amount_INR: d.grossAmount || 0,
      Commission_Rate_Percent: d.commissionSnapshot?.rate || d.commissionRate || 5,
      Platform_Commission_INR: d.platformCommission || 0,
      Garage_Net_Earnings_INR: d.garageNetAmount || 0,
      Refund_Deduction_INR: d.refundAmount || 0,
      Net_After_Refund_INR: d.netAfterRefund !== undefined ? d.netAfterRefund : d.garageNetAmount,
      Settlement_Status: d.status || 'AVAILABLE',
      Transaction_Date: d.createdAt ? new Date(d.createdAt).toISOString() : '—'
    }));

    const result = await generateReportExport({
      actorId: req.user.id,
      actorRole: 'ADMIN',
      reportType: String(reportType).toUpperCase(),
      format,
      data: sanitizedData,
      filters: { period, dateFrom, dateTo }
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.content);
  } catch (err) {
    console.error('Error exporting admin report:', err);
    return res.status(500).json({ success: false, message: 'Error exporting platform report' });
  }
});

module.exports = {
  garageReportsRouter,
  adminReportsRouter
};
