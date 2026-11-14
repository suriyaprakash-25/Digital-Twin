/**
 * Invoices: thin HTTP adapters. Mounted at BOTH /api/invoices and /api/garage/invoices (server.js),
 * so the React billing pages call e.g. /api/garage/invoices/garage/:serviceId/finalize.
 * Business rules live in services/invoices; this file parses requests, delegates, and maps results
 * and typed errors onto the `{ success, ... }` shapes the pages already depend on.
 */
const express = require('express');

const { requireAuth, requireRole } = require('../middleware/auth');
const { AppError } = require('../core/errors');
const { setPaginationHeaders } = require('../core/pagination');
const { getInvoiceModule } = require('../services/invoices');

const router = express.Router();
const garageOnly = [requireAuth, requireRole('GARAGE')];

/** Client errors keep `{ success:false, message }` (+ code); 5xx details are never exposed. */
function sendError(res, err, fallbackMessage) {
  if (err instanceof AppError && err.expose) {
    return res.status(err.status).json({ success: false, code: err.code, message: err.message });
  }
  console.error(`${fallbackMessage}:`, err);
  return res.status(500).json({ success: false, message: fallbackMessage });
}

router.get('/:serviceId', requireAuth, async (req, res) => {
  try {
    const invoice = await getInvoiceModule().queries.getInvoice(req.user, req.params.serviceId);
    return res.status(200).json({ success: true, invoice });
  } catch (err) {
    return sendError(res, err, 'Server error loading invoice details');
  }
});

router.get('/:serviceId/receipt', requireAuth, async (req, res) => {
  try {
    const receipt = await getInvoiceModule().queries.getReceipt(req.user, req.params.serviceId);
    return res.status(200).json({ success: true, receipt });
  } catch (err) {
    return sendError(res, err, 'Server error loading receipt');
  }
});

/** GET /api/garage/invoices/garage/all: paged list (body shape kept, X-Total-Count headers added). */
router.get('/garage/all', ...garageOnly, async (req, res) => {
  try {
    const { body, pagination } = await getInvoiceModule().queries.listGarageInvoices(req.user, req.query);
    setPaginationHeaders(res, pagination);
    return res.status(200).json(body);
  } catch (err) {
    return sendError(res, err, 'Error loading garage invoices');
  }
});

/** PUT: edit bill line items. 409 CHECKOUT_IN_PROGRESS while the customer is paying. */
router.put('/garage/:serviceId', ...garageOnly, async (req, res) => {
  try {
    const { invoice } = await getInvoiceModule().commands.updateDraft(req.user, req.params.serviceId, req.body || {});
    return res.status(200).json({ success: true, message: 'Invoice bill items updated successfully', invoice });
  } catch (err) {
    return sendError(res, err, 'Server error updating invoice');
  }
});

router.post('/garage/:serviceId/finalize', ...garageOnly, async (req, res) => {
  try {
    const result = await getInvoiceModule().commands.finalize(req.user, req.params.serviceId, req.body || {});
    return res.status(200).json({
      success: true,
      message: `Invoice finalized successfully with Invoice Number: ${result.invoiceNumber}`,
      ...result,
    });
  } catch (err) {
    return sendError(res, err, 'Server error finalizing invoice');
  }
});

router.post('/garage/:serviceId/cancel', ...garageOnly, async (req, res) => {
  try {
    await getInvoiceModule().commands.cancel(req.user, req.params.serviceId);
    return res.status(200).json({ success: true, message: 'Invoice cancelled successfully' });
  } catch (err) {
    return sendError(res, err, 'Server error cancelling invoice');
  }
});

router.get('/garage/payments/all', ...garageOnly, async (req, res) => {
  try {
    const { body, pagination } = await getInvoiceModule().revenue.listPayments(req.user, req.query);
    setPaginationHeaders(res, pagination);
    return res.status(200).json(body);
  } catch (err) {
    return sendError(res, err, 'Error loading garage payments');
  }
});

router.get('/garage/revenue/summary', ...garageOnly, async (req, res) => {
  try {
    const summary = await getInvoiceModule().revenue.getRevenueSummary(req.user);
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    return sendError(res, err, 'Error loading revenue summary');
  }
});

router.get('/garage/payments/analytics', ...garageOnly, async (req, res) => {
  try {
    const { period, trends } = await getInvoiceModule().revenue.getPaymentAnalytics(req.user, req.query);
    return res.status(200).json({ success: true, period, trends });
  } catch (err) {
    return sendError(res, err, 'Error loading analytics');
  }
});

module.exports = router;
