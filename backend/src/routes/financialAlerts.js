const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission, PERMISSIONS } = require('../middleware/permissionMiddleware');
const {
  getAlerts,
  getAlertsSummary,
  acknowledgeAlert,
  resolveAlert
} = require('../services/financialAlertService');

// Summary of alerts
router.get('/summary', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  try {
    const summary = await getAlertsSummary();
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load alerts summary' });
  }
});

// List paginated alerts
router.get('/', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  const { status, severity, alertType, page = 1, limit = 20 } = req.query;
  try {
    const result = await getAlerts({ status, severity, alertType, page, limit });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load alerts' });
  }
});

// Acknowledge alert
router.post('/:id/acknowledge', requireAuth, requirePermission(PERMISSIONS.RISK_MANAGE), async (req, res) => {
  try {
    const alert = await acknowledgeAlert(req.params.id, { adminId: req.user.id });
    return res.status(200).json({ success: true, alert });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// Resolve alert
router.post('/:id/resolve', requireAuth, requirePermission(PERMISSIONS.RISK_MANAGE), async (req, res) => {
  const { resolutionNote } = req.body;
  try {
    const alert = await resolveAlert(req.params.id, { adminId: req.user.id, resolutionNote });
    return res.status(200).json({ success: true, alert });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
