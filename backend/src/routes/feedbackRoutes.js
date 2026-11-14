const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../utils/uploads');
const { createLimiter } = require('../infrastructure/rateLimit/rateLimiters');
const feedbackController = require('../controllers/feedbackController');

const router = express.Router();

// Max 20 feedback submissions per 15 minutes (shared store across instances)
const feedbackLimiter = createLimiter({ name: 'feedback', max: 20, message: 'Too many feedback submissions, please try again after 15 minutes.' });

// POST /api/feedback
router.post(
  '/',
  feedbackLimiter,
  requireAuth,
  upload.single('screenshot'),
  feedbackController.submitFeedback
);

module.exports = router;
