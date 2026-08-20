const express = require('express');
const { requireAdmin } = require('../middleware/adminMiddleware');
const adminFeedbackController = require('../controllers/adminFeedbackController');

const router = express.Router();

// Apply requireAdmin middleware to all endpoints
router.use(requireAdmin);

// GET /api/admin/feedback/metrics
router.get('/metrics', adminFeedbackController.getMetrics);

// GET /api/admin/feedback
router.get('/', adminFeedbackController.getFeedbacks);

// GET /api/admin/feedback/:id
router.get('/:id', adminFeedbackController.getFeedback);

// PATCH /api/admin/feedback/:id/status
router.patch('/:id/status', adminFeedbackController.updateStatus);

// DELETE /api/admin/feedback/:id
router.delete('/:id', adminFeedbackController.deleteFeedback);

module.exports = router;
