/**
 * /api/bookings: thin HTTP adapters over services/bookings.
 * Routes run the auth middleware, delegate, and map results/typed errors onto the response
 * contract the marketplace, owner dashboard and garage dashboard already use ({ msg } bodies).
 * Every status change goes through the booking state machine (illegal/concurrent moves are 409s).
 */
const express = require('express');

const { requireAuth, requireRole } = require('../middleware/auth');
const { AppError } = require('../core/errors');
const { setPaginationHeaders } = require('../core/pagination');
const { createRepositories } = require('../repositories');
const { createBookingServices } = require('../services/bookings');

const router = express.Router();

const owner = [requireAuth, requireRole('USER')];
const garageOwner = [requireAuth, requireRole('GARAGE')];

/** Typed client errors become `{ msg, code }` with their status; anything else is a masked 500. */
function handle(failureMsg, handler) {
  return async (req, res) => {
    try {
      return await handler(req, res, createBookingServices({ repos: createRepositories() }).bookings);
    } catch (err) {
      if (err instanceof AppError && err.expose) return res.status(err.status).json({ msg: err.message, code: err.code });
      console.error(`${failureMsg}:`, err && err.message ? err.message : err);
      return res.status(500).json({ msg: failureMsg });
    }
  };
}

router.post('/', ...owner, handle('Error creating booking', async (req, res, bookings) => {
  const { id } = await bookings.createBooking(req.user, req.body || {});
  return res.status(201).json({ msg: 'Booking requested', id });
}));

router.get('/my', ...owner, handle('Error loading bookings', async (req, res, bookings) => {
  const { body, pagination } = await bookings.listMine(req.user.id, req.query);
  setPaginationHeaders(res, pagination);
  return res.status(200).json(body);
}));

router.get('/garage', ...garageOwner, handle('Error loading garage bookings', async (req, res, bookings) => {
  const { body, pagination } = await bookings.listForGarage(req.user.id, req.query);
  setPaginationHeaders(res, pagination);
  return res.status(200).json(body);
}));

// Accept / reject / start / complete / ask for info, by the booking's own garage only.
router.patch('/:bookingId/status', ...garageOwner, handle('Error updating booking', async (req, res, bookings) => {
  await bookings.updateStatusByGarage(req.user.id, req.params.bookingId, (req.body || {}).status);
  return res.status(200).json({ msg: 'Booking updated' });
}));

router.patch('/:bookingId/request-info', ...garageOwner, handle('Error requesting info', async (req, res, bookings) => {
  await bookings.requestInfo(req.user.id, req.params.bookingId, (req.body || {}).message);
  return res.status(200).json({ msg: 'Request for info sent' });
}));

router.patch('/:bookingId/provide-info', ...owner, handle('Error providing info', async (req, res, bookings) => {
  await bookings.provideInfo(req.user.id, req.params.bookingId, (req.body || {}).message);
  return res.status(200).json({ msg: 'Info provided' });
}));

// New: the owner withdraws a booking before work starts (REQUESTED / MORE_INFO_REQUIRED / ACCEPTED).
router.patch('/:bookingId/cancel', ...owner, handle('Error cancelling booking', async (req, res, bookings) => {
  await bookings.cancelByOwner(req.user.id, req.params.bookingId, (req.body || {}).reason);
  return res.status(200).json({ msg: 'Booking cancelled' });
}));

module.exports = router;
