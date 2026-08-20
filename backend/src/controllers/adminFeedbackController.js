const feedbackService = require('../services/feedbackService');

async function getFeedbacks(req, res) {
  try {
    const {
      page,
      limit,
      search,
      rating,
      category,
      role,
      status,
      startDate,
      endDate
    } = req.query;

    const data = await feedbackService.getFeedbackList({
      page,
      limit,
      search,
      rating,
      category,
      role,
      status,
      startDate,
      endDate
    });

    return res.status(200).json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('Admin get feedbacks error:', error);
    return res.status(500).json({
      success: false,
      msg: 'Failed to fetch feedback records'
    });
  }
}

async function getFeedback(req, res) {
  try {
    const { id } = req.params;
    const feedback = await feedbackService.getFeedbackById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        msg: 'Feedback item not found'
      });
    }

    return res.status(200).json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Admin get feedback by ID error:', error);
    return res.status(500).json({
      success: false,
      msg: 'Failed to fetch feedback details'
    });
  }
}

async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        msg: 'Status is required'
      });
    }

    const updated = await feedbackService.updateFeedbackStatus(id, status);

    return res.status(200).json({
      success: true,
      msg: 'Feedback status updated successfully',
      feedback: updated
    });
  } catch (error) {
    console.error('Admin update feedback status error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      msg: error.message || 'Failed to update feedback status'
    });
  }
}

async function deleteFeedback(req, res) {
  try {
    const { id } = req.params;
    await feedbackService.deleteFeedback(id);

    return res.status(200).json({
      success: true,
      msg: 'Feedback item deleted successfully'
    });
  } catch (error) {
    console.error('Admin delete feedback error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      msg: error.message || 'Failed to delete feedback'
    });
  }
}

async function getMetrics(req, res) {
  try {
    const metrics = await feedbackService.getFeedbackMetrics();
    return res.status(200).json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Admin get feedback metrics error:', error);
    return res.status(500).json({
      success: false,
      msg: 'Failed to fetch feedback metrics'
    });
  }
}

module.exports = {
  getFeedbacks,
  getFeedback,
  updateStatus,
  deleteFeedback,
  getMetrics
};
