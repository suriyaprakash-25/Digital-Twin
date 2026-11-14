/**
 * /api/ownership: thin HTTP adapters for vehicle ownership transfer and history.
 * Business rules (state machine, atomic accept, authorization) live in services/ownership; this
 * file only parses requests, delegates and maps results/typed errors onto the `{ msg }` shapes the
 * React pages (TransferOwnership, UserDashboard) already depend on.
 */
const express = require('express');

const { requireAuth, optionalAuth } = require('../middleware/auth');
const { AppError } = require('../core/errors');
const { getOwnershipModule } = require('../services/ownership');
const { MSG } = require('../services/ownership/constants');

const router = express.Router();

const isClientError = (err) => err instanceof AppError && err.expose;

/** Legacy `{ msg }` error shape. 5xx details are logged, never returned. */
function sendMsgError(res, err, fallbackMsg) {
  if (isClientError(err)) return res.status(err.status).json({ msg: err.message, code: err.code });
  console.error(`${fallbackMsg}:`, err);
  return res.status(500).json({ msg: fallbackMsg });
}

router.post('/transfer', requireAuth, async (req, res) => {
  try {
    const { transferId } = await getOwnershipModule().transfers.initiateTransfer(req.user, req.body || {});
    return res.status(201).json({ msg: MSG.INITIATED, transferId });
  } catch (err) {
    return sendMsgError(res, err, 'Server error initiating transfer');
  }
});

router.post('/transfer/accept', requireAuth, async (req, res) => {
  try {
    await getOwnershipModule().transfers.acceptTransfer(req.user, req.body || {});
    return res.status(200).json({ msg: MSG.ACCEPTED });
  } catch (err) {
    return sendMsgError(res, err, 'Server error accepting transfer');
  }
});

router.post('/transfer/reject', requireAuth, async (req, res) => {
  try {
    await getOwnershipModule().transfers.rejectTransfer(req.user, req.body || {});
    return res.status(200).json({ msg: MSG.REJECTED });
  } catch (err) {
    return sendMsgError(res, err, 'Server error rejecting transfer');
  }
});

// Seller withdraws a request the buyer has not answered yet (pending -> cancelled).
router.post('/transfer/cancel', requireAuth, async (req, res) => {
  try {
    await getOwnershipModule().transfers.cancelTransfer(req.user, req.body || {});
    return res.status(200).json({ msg: MSG.CANCELLED });
  } catch (err) {
    return sendMsgError(res, err, 'Server error cancelling transfer');
  }
});

router.get('/pending', requireAuth, async (req, res) => {
  try {
    return res.status(200).json(await getOwnershipModule().transfers.listPendingForBuyer(req.user));
  } catch (err) {
    return sendMsgError(res, err, 'Server error loading pending transfers');
  }
});

// Public; optionalAuth only decides whether the caller is the owner/admin (full ids and names).
router.get('/history/:vehicleId', optionalAuth, async (req, res) => {
  try {
    return res.status(200).json(await getOwnershipModule().history.getHistory(req.user, req.params.vehicleId));
  } catch (err) {
    return sendMsgError(res, err, 'Server error fetching history');
  }
});

module.exports = router;
