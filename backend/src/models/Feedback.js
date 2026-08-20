const { ObjectId } = require('mongodb');

const FEEDBACK_STATUS = {
  NEW: 'NEW',
  REVIEWED: 'REVIEWED',
  RESOLVED: 'RESOLVED',
  ARCHIVED: 'ARCHIVED'
};

const FEEDBACK_CATEGORIES = [
  'General Feedback',
  'Bug Report',
  'Feature Request',
  'UI / Design',
  'Performance Issue',
  'Garage Experience',
  'Vehicle Management',
  'Vehicle Passport',
  'Marketplace',
  'Service Experience',
  'Other'
];

function validateFeedbackInput({ rating, category, message }) {
  const errors = [];

  const numRating = Number(rating);
  if (!numRating || isNaN(numRating) || numRating < 1 || numRating > 5) {
    errors.push('Rating is required and must be an integer between 1 and 5.');
  }

  if (!category || typeof category !== 'string' || !FEEDBACK_CATEGORIES.includes(category.trim())) {
    errors.push(`Category must be one of: ${FEEDBACK_CATEGORIES.join(', ')}`);
  }

  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    errors.push('Feedback message must be at least 10 characters long.');
  } else if (message.trim().length > 1000) {
    errors.push('Feedback message cannot exceed 1000 characters.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  FEEDBACK_STATUS,
  FEEDBACK_CATEGORIES,
  validateFeedbackInput
};
