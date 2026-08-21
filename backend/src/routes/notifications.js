const express = require('express');

const { requireAuth } = require('../middleware/auth');
const {
  upsertDeviceToken,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount
} = require('../services/notifications');

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

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id);
    return res.status(200).json({ success: true, count });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error getting unread count' });
  }
});

router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    await markAllNotificationsRead(req.user.id);
    return res.status(200).json({ success: true, msg: 'All notifications marked as read' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error marking all notifications read' });
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

const { getNotificationPreferences, updateNotificationPreferences } = require('../services/financialNotificationService');

/**
 * GET /api/notifications/preferences
 */
router.get('/preferences', requireAuth, async (req, res) => {
  try {
    const recipientType = req.user.role === 'GARAGE' ? 'GARAGE' : 'USER';
    const prefs = await getNotificationPreferences(req.user.id, recipientType);
    return res.status(200).json({ success: true, preferences: prefs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading notification preferences' });
  }
});

/**
 * PUT /api/notifications/preferences
 */
router.put('/preferences', requireAuth, async (req, res) => {
  try {
    const recipientType = req.user.role === 'GARAGE' ? 'GARAGE' : 'USER';
    const updated = await updateNotificationPreferences(req.user.id, req.body || {}, recipientType);
    return res.status(200).json({ success: true, message: 'Preferences updated', preferences: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error saving notification preferences' });
  }
});

module.exports = router;
