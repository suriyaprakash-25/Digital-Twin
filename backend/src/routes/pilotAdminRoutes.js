const express = require('express');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { getPilotAnalytics } = require('../services/pilotAnalyticsService');
const { listSupportItems, triageSupportItem } = require('../services/pilotSupportService');

const router = express.Router();

router.use(requireAdmin);

router.get('/analytics', async (req, res) => {
  try {
    const analytics = await getPilotAnalytics({ days: req.query.days });
    return res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error('Pilot analytics error:', error);
    return res.status(500).json({ success: false, msg: 'Failed to load pilot analytics' });
  }
});

router.get('/support', async (req, res) => {
  try {
    const data = await listSupportItems({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      queue: req.query.queue,
      priority: req.query.priority
    });
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('Pilot support list error:', error);
    return res.status(500).json({ success: false, msg: 'Failed to load pilot support queue' });
  }
});

router.patch('/support/:id', async (req, res) => {
  try {
    const item = await triageSupportItem(req.params.id, req.body || {}, req.user);
    return res.status(200).json({
      success: true,
      msg: 'Pilot support item updated',
      item
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      msg: error.message || 'Failed to update pilot support item'
    });
  }
});

module.exports = router;
