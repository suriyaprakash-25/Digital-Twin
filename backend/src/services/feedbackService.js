const path = require('path');
const fs = require('fs');
const { ObjectId } = require('mongodb');
const cloudinary = require('cloudinary').v2;
const { loadConfig } = require('../config');
const { getDb } = require('../db');
const { FEEDBACK_STATUS, validateFeedbackInput } = require('../models/Feedback');

const config = loadConfig();

// Configure Cloudinary if credentials are present
if (config.cloudinary && config.cloudinary.cloudName) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret
  });
}

function safeObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * Handle screenshot upload: uses Cloudinary if available, otherwise local uploads folder.
 */
async function processScreenshotUpload(file) {
  if (!file) return { screenshotUrl: null, cloudinaryPublicId: null };

  // If Cloudinary is configured, upload to Cloudinary
  if (config.cloudinary && config.cloudinary.cloudName) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'driveportz_feedback',
        resource_type: 'image'
      });
      // Remove temporary local file if it was created in a temp dir
      if (fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      return {
        screenshotUrl: result.secure_url,
        cloudinaryPublicId: result.public_id
      };
    } catch (err) {
      console.error('Cloudinary upload error in feedbackService:', err);
    }
  }

  // Fallback: local storage in /uploads/
  const relativeUrl = `/uploads/${path.basename(file.path)}`;
  return {
    screenshotUrl: relativeUrl,
    cloudinaryPublicId: null
  };
}

/**
 * Create a new feedback record.
 */
async function createFeedback({ user, rating, category, message, pageUrl, pageName, file }) {
  const db = getDb();
  
  const validation = validateFeedbackInput({ rating, category, message });
  if (!validation.isValid) {
    throw { statusCode: 400, message: validation.errors.join(' ') };
  }

  const { screenshotUrl, cloudinaryPublicId } = await processScreenshotUpload(file);

  const doc = {
    userId: user?.id ? safeObjectId(user.id) : null,
    name: (user?.name || '').trim() || 'Anonymous User',
    email: (user?.email || '').trim() || '',
    role: (user?.role || 'USER').toUpperCase(),
    rating: Number(rating),
    category: category.trim(),
    message: message.trim(),
    pageUrl: (pageUrl || '').trim() || '/',
    pageName: (pageName || '').trim() || 'DrivePortz App',
    screenshotUrl,
    cloudinaryPublicId,
    status: FEEDBACK_STATUS.NEW,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('feedbacks').insertOne(doc);
  return {
    _id: result.insertedId,
    ...doc
  };
}

/**
 * Get paginated feedbacks with filters, search, and summary metrics.
 */
async function getFeedbackList({
  page = 1,
  limit = 10,
  search = '',
  rating,
  category,
  role,
  status,
  startDate,
  endDate
}) {
  const db = getDb();
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));

  const filter = {};

  if (rating) {
    const r = Number(rating);
    if (!isNaN(r) && r >= 1 && r <= 5) {
      filter.rating = r;
    }
  }

  if (category && category !== 'ALL') {
    filter.category = category;
  }

  if (role && role !== 'ALL') {
    filter.role = role.toUpperCase();
  }

  if (status && status !== 'ALL') {
    filter.status = status.toUpperCase();
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (search && search.trim()) {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { message: { $regex: s, $options: 'i' } },
      { pageName: { $regex: s, $options: 'i' } },
      { pageUrl: { $regex: s, $options: 'i' } }
    ];
  }

  const [feedbacks, totalCount, metrics] = await Promise.all([
    db.collection('feedbacks')
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    db.collection('feedbacks').countDocuments(filter),
    getFeedbackMetrics()
  ]);

  return {
    feedbacks,
    pagination: {
      page: pageNum,
      limit: pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize) || 1
    },
    metrics
  };
}

/**
 * Get aggregate metrics for feedback dashboard cards.
 */
async function getFeedbackMetrics() {
  const db = getDb();
  
  const [
    totalFeedback,
    newFeedback,
    bugReports,
    featureRequests,
    ratingAgg
  ] = await Promise.all([
    db.collection('feedbacks').countDocuments(),
    db.collection('feedbacks').countDocuments({ status: FEEDBACK_STATUS.NEW }),
    db.collection('feedbacks').countDocuments({ category: 'Bug Report' }),
    db.collection('feedbacks').countDocuments({ category: 'Feature Request' }),
    db.collection('feedbacks').aggregate([
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' }
        }
      }
    ]).toArray()
  ]);

  const averageRating = ratingAgg.length > 0 && ratingAgg[0].avgRating !== null
    ? Number(ratingAgg[0].avgRating.toFixed(1))
    : 0;

  return {
    totalFeedback,
    averageRating,
    newFeedback,
    bugReports,
    featureRequests
  };
}

/**
 * Get feedback detail by ID.
 */
async function getFeedbackById(id) {
  const db = getDb();
  const objectId = safeObjectId(id);
  if (!objectId) return null;

  return db.collection('feedbacks').findOne({ _id: objectId });
}

/**
 * Update feedback status.
 */
async function updateFeedbackStatus(id, newStatus) {
  const db = getDb();
  const objectId = safeObjectId(id);
  if (!objectId) {
    throw { statusCode: 400, message: 'Invalid feedback ID' };
  }

  const validStatuses = Object.values(FEEDBACK_STATUS);
  if (!validStatuses.includes(newStatus)) {
    throw { statusCode: 400, message: `Status must be one of: ${validStatuses.join(', ')}` };
  }

  const result = await db.collection('feedbacks').findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        status: newStatus,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  return result.value || result;
}

/**
 * Delete a feedback item.
 */
async function deleteFeedback(id) {
  const db = getDb();
  const objectId = safeObjectId(id);
  if (!objectId) {
    throw { statusCode: 400, message: 'Invalid feedback ID' };
  }

  const doc = await db.collection('feedbacks').findOne({ _id: objectId });
  if (!doc) {
    throw { statusCode: 404, message: 'Feedback not found' };
  }

  // If local file, optionally remove from disk
  if (doc.screenshotUrl && doc.screenshotUrl.startsWith('/uploads/')) {
    const filename = doc.screenshotUrl.replace('/uploads/', '');
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    const localPath = path.join(uploadsDir, filename);
    if (fs.existsSync(localPath)) {
      try { fs.unlinkSync(localPath); } catch {}
    }
  }

  // If Cloudinary, optionally remove from Cloudinary
  if (doc.cloudinaryPublicId && config.cloudinary && config.cloudinary.cloudName) {
    try {
      await cloudinary.uploader.destroy(doc.cloudinaryPublicId);
    } catch {}
  }

  await db.collection('feedbacks').deleteOne({ _id: objectId });
  return { success: true };
}

module.exports = {
  createFeedback,
  getFeedbackList,
  getFeedbackById,
  updateFeedbackStatus,
  deleteFeedback,
  getFeedbackMetrics
};
