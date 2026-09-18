const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { FEEDBACK_STATUS, validateFeedbackInput } = require('../models/Feedback');
const {
  persistUploadedFile,
  deletePersistedFile,
  removeTemporaryFile
} = require('./persistentFileStorage');
const { getSupportDefaults } = require('./pilotSupportService');

function safeObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

async function processScreenshotUpload(file) {
  if (!file) {
    return {
      screenshotUrl: null,
      screenshotStorageProvider: null,
      screenshotStorageKey: null,
      screenshotResourceType: null
    };
  }

  const asset = await persistUploadedFile(file, {
    folder: 'driveportz/feedback',
    resourceType: 'image'
  });

  return {
    screenshotUrl: asset?.url || null,
    screenshotStorageProvider: asset?.storageProvider || null,
    screenshotStorageKey: asset?.storageKey || null,
    screenshotResourceType: asset?.resourceType || 'image'
  };
}

async function createFeedback({ user, rating, category, message, pageUrl, pageName, file }) {
  const db = getDb();

  const validation = validateFeedbackInput({ rating, category, message });
  if (!validation.isValid) {
    removeTemporaryFile(file);
    const error = new Error(validation.errors.join(' '));
    error.statusCode = 400;
    throw error;
  }

  const upload = await processScreenshotUpload(file);
  const support = getSupportDefaults(category);

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
    ...upload,
    status: FEEDBACK_STATUS.NEW,
    supportQueue: support.supportQueue,
    supportPriority: support.supportPriority,
    supportSlaHours: support.supportSlaHours,
    assignedTo: null,
    acknowledgedAt: null,
    resolvedAt: null,
    resolutionNote: '',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('feedbacks').insertOne(doc);
  return {
    _id: result.insertedId,
    ...doc
  };
}

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
    if (!Number.isNaN(r) && r >= 1 && r <= 5) {
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
      { pageUrl: { $regex: s, $options: 'i' } },
      { supportQueue: { $regex: s, $options: 'i' } },
      { assignedTo: { $regex: s, $options: 'i' } }
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

async function getFeedbackById(id) {
  const db = getDb();
  const objectId = safeObjectId(id);
  if (!objectId) return null;

  return db.collection('feedbacks').findOne({ _id: objectId });
}

async function updateFeedbackStatus(id, newStatus) {
  const db = getDb();
  const objectId = safeObjectId(id);
  if (!objectId) {
    const error = new Error('Invalid feedback ID');
    error.statusCode = 400;
    throw error;
  }

  const validStatuses = Object.values(FEEDBACK_STATUS);
  if (!validStatuses.includes(newStatus)) {
    const error = new Error(`Status must be one of: ${validStatuses.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const set = {
    status: newStatus,
    updatedAt: new Date()
  };
  if (newStatus === FEEDBACK_STATUS.REVIEWED) set.acknowledgedAt = new Date();
  if (newStatus === FEEDBACK_STATUS.RESOLVED) set.resolvedAt = new Date();

  const result = await db.collection('feedbacks').findOneAndUpdate(
    { _id: objectId },
    { $set: set },
    { returnDocument: 'after' }
  );

  return result?.value || result;
}

async function deleteFeedback(id) {
  const db = getDb();
  const objectId = safeObjectId(id);
  if (!objectId) {
    const error = new Error('Invalid feedback ID');
    error.statusCode = 400;
    throw error;
  }

  const doc = await db.collection('feedbacks').findOne({ _id: objectId });
  if (!doc) {
    const error = new Error('Feedback not found');
    error.statusCode = 404;
    throw error;
  }

  await deletePersistedFile({
    url: doc.screenshotUrl,
    storageProvider: doc.screenshotStorageProvider,
    storageKey: doc.screenshotStorageKey,
    resourceType: doc.screenshotResourceType || 'image'
  });

  await db.collection('feedbacks').deleteOne({ _id: objectId });
  return { success: true };
}

module.exports = {
  createFeedback,
  getFeedbackList,
  getFeedbackById,
  updateFeedbackStatus,
  deleteFeedback,
  getFeedbackMetrics,
  processScreenshotUpload
};
