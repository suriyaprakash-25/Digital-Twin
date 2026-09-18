const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, PERMISSIONS } = require('../middleware/permissionMiddleware');
const {
  listOperationalEvents,
  getOperationalSummary
} = require('../services/operationalMonitoringService');

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ));

router.get('/errors', async (req, res) => {
  try {
    const events = await listOperationalEvents({
      limit: req.query.limit,
      sinceMinutes: req.query.sinceMinutes,
      kind: req.query.kind || null,
      severity: req.query.severity || null
    });

    return res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (err) {
    console.error('Failed to load operational monitoring events:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load operational monitoring events'
    });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const summary = await getOperationalSummary();
    return res.status(200).json({ success: true, ...summary });
  } catch (err) {
    console.error('Failed to load operational monitoring summary:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load operational monitoring summary'
    });
  }
});

module.exports = router;
