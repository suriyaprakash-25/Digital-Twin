const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { upsertDeviceToken, listNotifications, markNotificationRead } = require('../services/notifications');

const router = express.Router();

router.post('/token', requireAuth, async (req, res) => {
  const { token, platform } = req.body || {};
  if (!token) {
    return res.status(400).json({ msg: 'token is required' });
  }

  try {
    await upsertDeviceToken({ userId: req.user.id, role: req.user.role, token, platform: platform || 'web' });
    return res.status(200).json({ msg: 'Token saved' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error saving token', error: String(e && e.message ? e.message : e) });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = req.query.limit;
    const docs = await listNotifications(req.user.id, limit);
    return res.status(200).json(docs);
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading notifications', error: String(e && e.message ? e.message : e) });
  }
});

router.patch('/:notificationId/read', requireAuth, async (req, res) => {
  try {
    await markNotificationRead(req.user.id, req.params.notificationId);
    return res.status(200).json({ msg: 'Marked as read' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error updating notification', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
