/**
 * Garage earnings, settlements and payout profile: thin HTTP adapters. Mounted at /api/garage AND
 * /api/garage/earnings (server.js). Business rules live in services/earnings; this file parses
 * requests, delegates, and maps results/typed errors onto the shapes the garage pages consume.
 */
const express = require('express');

const { requireAuth, requireRole } = require('../middleware/auth');
const { idempotencyMiddleware } = require('../middleware/idempotency');
const { settlementLimiter } = require('../middleware/financialRateLimit');
const { AppError } = require('../core/errors');
const { setPaginationHeaders } = require('../core/pagination');
const { getEarningsModule } = require('../services/earnings');

const router = express.Router();
const garageOnly = [requireAuth, requireRole('GARAGE')];

/** Client errors: `{ success:false, message, code }` (+ reasonCode for eligibility); 5xx masked. */
function sendError(res, err, fallbackMessage) {
  if (err instanceof AppError && err.expose) {
    const body = { success: false, code: err.code, message: err.message };
    if (err.details && err.details.reasonCode) body.reasonCode = err.details.reasonCode;
    return res.status(err.status).json(body);
  }
  console.error(`${fallbackMessage}:`, err);
  return res.status(500).json({ success: false, message: fallbackMessage });
}

function sendPage(res, { body, pagination }) {
  setPaginationHeaders(res, pagination);
  return res.status(200).json(body);
}

router.get('/earnings/summary', ...garageOnly, async (req, res) => {
  try {
    return res.status(200).json({ success: true, summary: await getEarningsModule().queries.getSummary(req.user) });
  } catch (err) {
    return sendError(res, err, 'Error fetching earnings summary');
  }
});

router.get('/settlements/forecast', ...garageOnly, async (req, res) => {
  try {
    return res.status(200).json({ success: true, forecast: await getEarningsModule().queries.getForecast(req.user) });
  } catch (err) {
    return sendError(res, err, 'Failed to fetch settlement forecast');
  }
});

router.get('/earnings', ...garageOnly, async (req, res) => {
  try {
    return sendPage(res, await getEarningsModule().queries.listEarnings(req.user, req.query));
  } catch (err) {
    return sendError(res, err, 'Error fetching earnings list');
  }
});

router.get('/earnings/:id', ...garageOnly, async (req, res) => {
  try {
    return res.status(200).json({ success: true, earning: await getEarningsModule().queries.getEarning(req.user, req.params.id) });
  } catch (err) {
    return sendError(res, err, 'Error loading earning details');
  }
});

router.get('/settlements', ...garageOnly, async (req, res) => {
  try {
    return sendPage(res, await getEarningsModule().queries.listSettlements(req.user, req.query));
  } catch (err) {
    return sendError(res, err, 'Error loading settlements');
  }
});

/** Creates a REQUESTED settlement. 409 while another request for the same garage is in flight. */
router.post('/settlements/request', ...garageOnly, settlementLimiter, idempotencyMiddleware, async (req, res) => {
  try {
    const { settlement, message } = await getEarningsModule().settlements.requestSettlement({ user: req.user, body: req.body || {}, req });
    return res.status(201).json({ success: true, message, settlement });
  } catch (err) {
    return sendError(res, err, 'Error submitting settlement request');
  }
});

// Garage owner or admin (ownership enforced in the service).
router.get('/settlements/:id', requireAuth, async (req, res) => {
  try {
    return res.status(200).json({ success: true, settlement: await getEarningsModule().queries.getSettlement(req.user, req.params.id) });
  } catch (err) {
    return sendError(res, err, 'Error loading settlement details');
  }
});

router.get('/payout-profile', ...garageOnly, async (req, res) => {
  try {
    return res.status(200).json({ success: true, profile: await getEarningsModule().payoutProfile.getProfile(req.user) });
  } catch (err) {
    return sendError(res, err, 'Error loading payout profile');
  }
});

router.put('/payout-profile', ...garageOnly, async (req, res) => {
  try {
    const profile = await getEarningsModule().payoutProfile.saveProfile(req.user, req.body || {});
    return res.status(200).json({ success: true, message: 'Payout profile updated successfully', profile });
  } catch (err) {
    return sendError(res, err, 'Error saving payout profile');
  }
});

module.exports = router;
