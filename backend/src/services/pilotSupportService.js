const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

const SUPPORT_QUEUE = Object.freeze({
  PILOT_OPERATIONS: 'PILOT_OPERATIONS',
  PAYMENTS_AND_RECONCILIATION: 'PAYMENTS_AND_RECONCILIATION',
  GARAGE_SUCCESS: 'GARAGE_SUCCESS',
  ACCOUNT_AND_ACCESS: 'ACCOUNT_AND_ACCESS',
  TECHNICAL_ON_CALL: 'TECHNICAL_ON_CALL',
  PRODUCT_FEEDBACK: 'PRODUCT_FEEDBACK'
});

const SUPPORT_PRIORITY = Object.freeze({
  URGENT: 'URGENT',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
});

const ROUTING_RULES = Object.freeze({
  'Payment Issue': {
    supportQueue: SUPPORT_QUEUE.PAYMENTS_AND_RECONCILIATION,
    supportPriority: SUPPORT_PRIORITY.URGENT,
    supportSlaHours: 2
  },
  'Booking Issue': {
    supportQueue: SUPPORT_QUEUE.PILOT_OPERATIONS,
    supportPriority: SUPPORT_PRIORITY.HIGH,
    supportSlaHours: 4
  },
  'Garage Complaint': {
    supportQueue: SUPPORT_QUEUE.GARAGE_SUCCESS,
    supportPriority: SUPPORT_PRIORITY.HIGH,
    supportSlaHours: 8
  },
  'Garage Experience': {
    supportQueue: SUPPORT_QUEUE.GARAGE_SUCCESS,
    supportPriority: SUPPORT_PRIORITY.MEDIUM,
    supportSlaHours: 12
  },
  'Account Issue': {
    supportQueue: SUPPORT_QUEUE.ACCOUNT_AND_ACCESS,
    supportPriority: SUPPORT_PRIORITY.HIGH,
    supportSlaHours: 8
  },
  'Bug Report': {
    supportQueue: SUPPORT_QUEUE.TECHNICAL_ON_CALL,
    supportPriority: SUPPORT_PRIORITY.HIGH,
    supportSlaHours: 8
  },
  'Performance Issue': {
    supportQueue: SUPPORT_QUEUE.TECHNICAL_ON_CALL,
    supportPriority: SUPPORT_PRIORITY.MEDIUM,
    supportSlaHours: 12
  }
});

function safeObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

function getSupportDefaults(category) {
  return ROUTING_RULES[String(category || '').trim()] || {
    supportQueue: SUPPORT_QUEUE.PRODUCT_FEEDBACK,
    supportPriority: SUPPORT_PRIORITY.LOW,
    supportSlaHours: 48
  };
}

function isOperationalSupportCategory(category) {
  return Object.prototype.hasOwnProperty.call(ROUTING_RULES, String(category || '').trim());
}

function calculateSlaDeadline(createdAt, supportSlaHours) {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt || Date.now());
  const hours = Number(supportSlaHours) || 24;
  return new Date(created.getTime() + hours * 60 * 60 * 1000);
}

function serializeSupportItem(doc) {
  const deadline = calculateSlaDeadline(doc.createdAt, doc.supportSlaHours);
  const isOpen = !['RESOLVED', 'ARCHIVED'].includes(String(doc.status || '').toUpperCase());

  return {
    ...doc,
    _id: String(doc._id),
    userId: doc.userId ? String(doc.userId) : null,
    slaDeadline: deadline,
    slaBreached: isOpen && Date.now() > deadline.getTime()
  };
}

async function listSupportItems({
  page = 1,
  limit = 20,
  status = 'ALL',
  queue = 'ALL',
  priority = 'ALL'
} = {}, dbInstance) {
  const db = dbInstance || getDb();
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  const categories = Object.keys(ROUTING_RULES);
  const filter = { category: { $in: categories } };

  if (status && status !== 'ALL') filter.status = String(status).toUpperCase();
  if (queue && queue !== 'ALL') filter.supportQueue = String(queue).toUpperCase();
  if (priority && priority !== 'ALL') filter.supportPriority = String(priority).toUpperCase();

  const [items, total] = await Promise.all([
    db.collection('feedbacks')
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    db.collection('feedbacks').countDocuments(filter)
  ]);

  const serialized = items.map(serializeSupportItem);
  const allOpen = await db.collection('feedbacks')
    .find({
      category: { $in: categories },
      status: { $nin: ['RESOLVED', 'ARCHIVED'] }
    })
    .project({
      createdAt: 1,
      supportSlaHours: 1,
      supportPriority: 1,
      status: 1
    })
    .toArray();

  const metrics = {
    open: allOpen.length,
    urgent: allOpen.filter((item) => item.supportPriority === SUPPORT_PRIORITY.URGENT).length,
    slaBreached: allOpen.filter((item) => {
      return Date.now() > calculateSlaDeadline(item.createdAt, item.supportSlaHours).getTime();
    }).length,
    total
  };

  return {
    items: serialized,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    },
    metrics
  };
}

async function triageSupportItem(id, updates = {}, actor = {}, dbInstance) {
  const db = dbInstance || getDb();
  const objectId = safeObjectId(id);
  if (!objectId) {
    const error = new Error('Invalid support item ID');
    error.statusCode = 400;
    throw error;
  }

  const allowedQueues = new Set(Object.values(SUPPORT_QUEUE));
  const allowedPriorities = new Set(Object.values(SUPPORT_PRIORITY));
  const allowedStatuses = new Set(['NEW', 'REVIEWED', 'RESOLVED', 'ARCHIVED']);

  const set = { updatedAt: new Date() };

  if (updates.supportQueue !== undefined) {
    const value = String(updates.supportQueue).toUpperCase();
    if (!allowedQueues.has(value)) {
      const error = new Error('Invalid support queue');
      error.statusCode = 400;
      throw error;
    }
    set.supportQueue = value;
  }

  if (updates.supportPriority !== undefined) {
    const value = String(updates.supportPriority).toUpperCase();
    if (!allowedPriorities.has(value)) {
      const error = new Error('Invalid support priority');
      error.statusCode = 400;
      throw error;
    }
    set.supportPriority = value;
  }

  if (updates.assignedTo !== undefined) {
    const value = String(updates.assignedTo || '').trim().slice(0, 120);
    set.assignedTo = value || null;
    if (value) set.acknowledgedAt = new Date();
  }

  if (updates.status !== undefined) {
    const value = String(updates.status).toUpperCase();
    if (!allowedStatuses.has(value)) {
      const error = new Error('Invalid support status');
      error.statusCode = 400;
      throw error;
    }
    set.status = value;
    if (value === 'REVIEWED') set.acknowledgedAt = new Date();
    if (value === 'RESOLVED') set.resolvedAt = new Date();
  }

  if (updates.resolutionNote !== undefined) {
    set.resolutionNote = String(updates.resolutionNote || '').trim().slice(0, 1000);
  }

  const result = await db.collection('feedbacks').findOneAndUpdate(
    { _id: objectId, category: { $in: Object.keys(ROUTING_RULES) } },
    { $set: set },
    { returnDocument: 'after' }
  );

  const updated = result?.value || result;
  if (!updated) {
    const error = new Error('Support item not found');
    error.statusCode = 404;
    throw error;
  }

  await db.collection('admin_audit_logs').insertOne({
    action: 'PILOT_SUPPORT_TRIAGE_UPDATED',
    actorId: actor?.id ? String(actor.id) : null,
    actorRole: actor?.role || 'ADMIN',
    targetId: String(objectId),
    updates: {
      supportQueue: set.supportQueue,
      supportPriority: set.supportPriority,
      assignedTo: set.assignedTo,
      status: set.status
    },
    createdAt: new Date()
  });

  return serializeSupportItem(updated);
}

module.exports = {
  SUPPORT_QUEUE,
  SUPPORT_PRIORITY,
  ROUTING_RULES,
  getSupportDefaults,
  isOperationalSupportCategory,
  calculateSlaDeadline,
  listSupportItems,
  triageSupportItem
};
