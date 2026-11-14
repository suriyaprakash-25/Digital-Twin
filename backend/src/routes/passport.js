/**
 * /api/passport: thin HTTP adapters for the vehicle digital passport (JSON + PDF).
 *
 * These routes are public (the QR code and the frontend /passport/:vehicleId page). optionalAuth
 * only decides the audience: the vehicle's owner (or an admin) gets the full view, everyone else
 * the buyer-safe allow-list built in services/passport/presenters.js. Anonymous traffic is rate
 * limited per IP so the public view cannot be scraped at speed.
 */
const express = require('express');

const { optionalAuth } = require('../middleware/auth');
const { AppError } = require('../core/errors');
const { createLimiter } = require('../infrastructure/rateLimit/rateLimiters');
const { getPassportService, writePassportPdf } = require('../services/passport');
const { MSG, PUBLIC_RATE_LIMIT } = require('../services/passport/constants');

const router = express.Router();

const publicPassportLimiter = createLimiter({
  name: 'passport-public',
  windowMs: PUBLIC_RATE_LIMIT.WINDOW_MS,
  max: PUBLIC_RATE_LIMIT.MAX,
  message: MSG.RATE_LIMITED,
});

const isClientError = (err) => err instanceof AppError && err.expose;

/** Legacy `{ msg }` error shape. 5xx details are logged, never returned. */
function sendMsgError(res, err, fallbackMsg) {
  if (isClientError(err)) return res.status(err.status).json({ msg: err.message });
  console.error(`${fallbackMsg}:`, err);
  return res.status(500).json({ msg: fallbackMsg });
}

function passportHandler({ forcePublic }) {
  return async function getPassport(req, res) {
    try {
      const view = await getPassportService().getPassport(req.user, req.params.vehicleId, { forcePublic });
      return res.status(200).json(view);
    } catch (err) {
      return sendMsgError(res, err, 'Server error fetching vehicle passport');
    }
  };
}

const safeFilePart = (value) => String(value || 'vehicle').replace(/[^A-Za-z0-9_-]/g, '');

// GET /api/passport/pdf/:vehicleId (two segments, so it never collides with '/:vehicleId').
router.get('/pdf/:vehicleId', publicPassportLimiter, optionalAuth, async (req, res) => {
  let model;
  try {
    model = await getPassportService().getPdfModel(req.user, req.params.vehicleId);
  } catch (err) {
    return sendMsgError(res, err, 'Server error generating PDF passport');
  }
  try {
    res.setHeader('Content-Type', 'application/pdf');
    // Sanitised: a raw plate value with CR/LF or quotes used to make setHeader throw.
    res.setHeader('Content-Disposition', `attachment; filename=passport_${safeFilePart(model.vehicle.vehicleNumber) || 'vehicle'}.pdf`);
    return writePassportPdf(model, res);
  } catch (err) {
    console.error('Error rendering PDF passport:', err);
    if (!res.headersSent) return res.status(500).json({ msg: 'Server error generating PDF passport' });
    return res.destroy(err);
  }
});

// The owner (or an admin) sees full detail here; everyone else gets the public view.
router.get('/:vehicleId', publicPassportLimiter, optionalAuth, passportHandler({ forcePublic: false }));
// Always the buyer-facing view, even for the owner (lets an owner preview what buyers see).
router.get('/public/:vehicleId', publicPassportLimiter, passportHandler({ forcePublic: true }));

module.exports = router;
