const feedbackService = require('../services/feedbackService');

async function submitFeedback(req, res) {
  try {
    const { rating, category, message, pageUrl, pageName } = req.body;
    const file = req.file;

    const feedback = await feedbackService.createFeedback({
      user: req.user,
      rating,
      category,
      message,
      pageUrl,
      pageName,
      file
    });

    return res.status(201).json({
      success: true,
      msg: 'Feedback submitted successfully',
      feedback
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      msg: error.message || 'Failed to submit feedback'
    });
  }
}

module.exports = {
  submitFeedback
};
