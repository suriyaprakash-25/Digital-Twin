/**
 * /api/services: thin HTTP adapters for service records and service completion.
 * Business rules live in services/serviceRecords; this file only parses requests, delegates and
 * maps results/typed errors onto the response shapes the React pages already depend on.
 */
const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { AppError } = require('../core/errors');
const { setPaginationHeaders } = require('../core/pagination');
const { getServiceRecordModule } = require('../services/serviceRecords');

const router = express.Router();

const errorText = (err) => String(err && err.message ? err.message : err);
const isClientError = (err) => err instanceof AppError && err.expose;

/** Legacy `{ msg }` error shape (record endpoints). */
function sendMsgError(res, err, fallbackMsg) {
  if (isClientError(err)) return res.status(err.status).json({ msg: err.message });
  return res.status(500).json({ msg: fallbackMsg, error: errorText(err) });
}

/** Legacy `{ success: false, message }` error shape (completion endpoints). */
function sendSuccessFlagError(res, err, fallbackMessage) {
  if (isClientError(err)) return res.status(err.status).json({ success: false, message: err.message });
  return res.status(500).json({ success: false, message: fallbackMessage(err) });
}

router.post('/add', requireAuth, async (req, res) => {
  try {
    const { serviceId } = await getServiceRecordModule().records.addRecord(req.user, req.body || {});
    return res.status(201).json({ msg: 'Service record added successfully', serviceId });
  } catch (err) {
    return sendMsgError(res, err, 'Error adding service record');
  }
});

router.get('/garage/all', requireAuth, async (req, res) => {
  try {
    const { body, pagination } = await getServiceRecordModule().records.listGarageServices(req.user, req.query);
    setPaginationHeaders(res, pagination);
    return res.status(200).json(body);
  } catch (err) {
    return sendMsgError(res, err, 'Error fetching garage services');
  }
});

// Declared before '/:vehicle_id' so Express does not capture 'completion-details' as a vehicle id.
router.get('/completion-details', requireAuth, async (req, res) => {
  try {
    const details = await getServiceRecordModule().completion.getCompletionDetails(req.user, req.query);
    return res.status(200).json(details);
  } catch (err) {
    if (!isClientError(err)) console.error('Error fetching completion details:', err);
    return sendSuccessFlagError(res, err, () => 'Failed to load service completion details');
  }
});

router.get('/:vehicle_id', requireAuth, async (req, res) => {
  try {
    const history = await getServiceRecordModule().records.getVehicleHistory(req.user, req.params.vehicle_id);
    return res.status(200).json(history);
  } catch (err) {
    return sendMsgError(res, err, 'Error fetching service history');
  }
});

router.delete('/:service_id', requireAuth, async (req, res) => {
  try {
    await getServiceRecordModule().records.deleteRecord(req.user, req.params.service_id);
    return res.status(200).json({ msg: 'Service record deleted successfully' });
  } catch (err) {
    return sendMsgError(res, err, 'Error deleting service record');
  }
});

async function handleCompleteService(req, res) {
  const body = req.body || {};
  const input = { ...body, serviceId: (req.params && req.params.serviceId) || body.serviceId };
  try {
    const result = await getServiceRecordModule().completion.completeService({ user: req.user, input, req });
    return res.status(200).json(result);
  } catch (err) {
    if (!isClientError(err)) console.error('Error completing service:', err);
    return sendSuccessFlagError(res, err, (e) => `Unable to complete service: ${(e && e.message) || 'Internal server error'}`);
  }
}

router.post('/complete', requireAuth, handleCompleteService);
router.post('/:serviceId/complete', requireAuth, handleCompleteService);

module.exports = router;
