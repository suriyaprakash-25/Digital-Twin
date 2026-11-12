/**
 * Payment disputes: thin HTTP adapters over services/disputes.
 *   userDisputeRouter   → /api/disputes          (customer: raise, list, view, respond, cancel)
 *   garageDisputeRouter → /api/garage/disputes   (garage: list, respond)
 *   adminDisputeRouter  → /api/admin/disputes    (admin: summary, list, view, resolve, reject)
 * Errors keep the `{ success: false, message }` contract; 5xx bodies carry no internals.
 */
const express = require('express');

const { requireAuth, requireRole } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { idempotencyMiddleware } = require('../middleware/idempotency');
const { disputeLimiter } = require('../middleware/financialRateLimit');
const { createUploader } = require('../utils/uploads');
const { AppError } = require('../core/errors');
const { setPaginationHeaders } = require('../core/pagination');
const { getDisputeModule } = require('../services/disputes');
const { EVIDENCE } = require('../services/disputes/constants');

// Evidence uploads: type-allowlisted, signature-verified, random server-side filenames.
const evidenceUpload = createUploader([...EVIDENCE.MIME_TYPES], EVIDENCE.MAX_BYTES);

/** Typed client errors keep their status and message; anything else is a masked 500. */
function handle(failureMessage, handler) {
  return async (req, res) => {
    try {
      return await handler(req, res, getDisputeModule());
    } catch (err) {
      if (err instanceof AppError && err.expose) {
        return res.status(err.status).json({ success: false, message: err.message, code: err.code });
      }
      console.error(`${failureMessage}:`, err && err.message ? err.message : err);
      return res.status(500).json({ success: false, message: failureMessage });
    }
  };
}

function sendPage(res, { body, pagination }) {
  setPaginationHeaders(res, pagination);
  return res.status(200).json(body);
}

// ──────────────────────── USER DISPUTE ENDPOINTS ────────────────────────
const userDisputeRouter = express.Router();

// POST /api/disputes: raise a dispute on one of the caller's own payments (optional evidence file)
userDisputeRouter.post('/', requireAuth, disputeLimiter, idempotencyMiddleware, evidenceUpload.single(EVIDENCE.FIELD), handle('Error submitting dispute', async (req, res, { commands }) => {
  const dispute = await commands.create({ userId: req.user.id, input: req.body || {}, file: req.file || null });
  return res.status(201).json({ success: true, message: `Dispute ${dispute.disputeNumber} submitted successfully`, dispute });
}));

// GET /api/disputes: the caller's disputes
userDisputeRouter.get('/', requireAuth, handle('Error loading disputes', async (req, res, { queries }) => {
  return sendPage(res, await queries.listForUser(req.user.id, req.query));
}));

// GET /api/disputes/:id: the raising customer, the garage concerned, or an admin
userDisputeRouter.get('/:id', requireAuth, handle('Error loading dispute details', async (req, res, { queries }) => {
  return res.status(200).json(await queries.getForParticipant(req.user, req.params.id));
}));

userDisputeRouter.post('/:id/respond', requireAuth, handle('Error submitting response', async (req, res, { commands }) => {
  await commands.respondAsUser(req.user, req.params.id, (req.body || {}).message);
  return res.status(200).json({ success: true, message: 'Response submitted successfully' });
}));

userDisputeRouter.post('/:id/cancel', requireAuth, handle('Error cancelling dispute', async (req, res, { commands }) => {
  await commands.cancelByUser(req.user, req.params.id);
  return res.status(200).json({ success: true, message: 'Dispute cancelled successfully' });
}));

// ──────────────────────── GARAGE DISPUTE ENDPOINTS ────────────────────────
const garageDisputeRouter = express.Router();
const garageOnly = [requireAuth, requireRole('GARAGE')];

garageDisputeRouter.get('/', ...garageOnly, handle('Error loading garage disputes', async (req, res, { queries }) => {
  return sendPage(res, await queries.listForGarage(req.user.id, req.query));
}));

garageDisputeRouter.post('/:id/respond', ...garageOnly, handle('Error recording garage response', async (req, res, { commands }) => {
  await commands.respondAsGarage(req.user, req.params.id, (req.body || {}).response);
  return res.status(200).json({ success: true, message: 'Garage response recorded successfully' });
}));

// ──────────────────────── ADMIN DISPUTE ENDPOINTS ────────────────────────
const adminDisputeRouter = express.Router();

adminDisputeRouter.get('/summary', requireAdmin, handle('Error loading admin dispute summary', async (req, res, { queries }) => {
  return res.status(200).json({ success: true, summary: await queries.summary() });
}));

adminDisputeRouter.get('/', requireAdmin, handle('Error loading admin disputes', async (req, res, { queries }) => {
  return sendPage(res, await queries.listForAdmin(req.query));
}));

adminDisputeRouter.get('/:id', requireAdmin, handle('Error loading dispute details', async (req, res, { queries }) => {
  return res.status(200).json(await queries.getForAdmin(req.params.id));
}));

// POST /api/admin/disputes/:id/resolve: optional full/partial refund through the owning gateway
adminDisputeRouter.post('/:id/resolve', requireAdmin, handle('Error resolving dispute', async (req, res, { commands }) => {
  const { resolution, resolutionNote, refundAmount } = req.body || {};
  const resolved = await commands.resolve({ disputeId: req.params.id, adminId: req.user.id, resolution, resolutionNote, refundAmount });
  return res.status(200).json({ success: true, message: `Dispute ${resolved.disputeNumber} resolved successfully`, dispute: resolved });
}));

adminDisputeRouter.post('/:id/reject', requireAdmin, handle('Error rejecting dispute', async (req, res, { commands }) => {
  const rejected = await commands.reject({ disputeId: req.params.id, adminId: req.user.id, resolutionNote: (req.body || {}).resolutionNote });
  return res.status(200).json({ success: true, message: `Dispute ${rejected.disputeNumber} rejected`, dispute: rejected });
}));

module.exports = {
  userDisputeRouter,
  garageDisputeRouter,
  adminDisputeRouter
};
