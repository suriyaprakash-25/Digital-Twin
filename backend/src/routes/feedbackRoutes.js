const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../utils/uploads');
const feedbackController = require('../controllers/feedbackController');

const router = express.Router();

// Rate limiter: maximum 20 feedback submissions per 15 minutes per IP
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    msg: 'Too many feedback submissions from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// POST /api/feedback
router.post(
  '/',
  feedbackLimiter,
  requireAuth,
  upload.single('screenshot'),
  feedbackController.submitFeedback
);

module.exports = router;
