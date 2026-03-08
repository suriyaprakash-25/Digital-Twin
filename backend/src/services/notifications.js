const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { loadConfig } = require('../config');
const { initFirebase, sendToTokens } = require('../firebase');

const config = loadConfig();

function getCollections() {
  const db = getDb();
  return {
    deviceTokens: db.collection('deviceTokens'),
    notifications: db.collection('notifications')
  };
}

async function ensureIndexes() {
  const { deviceTokens, notifications } = getCollections();
  await Promise.allSettled([
    deviceTokens.createIndex({ userId: 1, token: 1 }, { unique: true }),
    notifications.createIndex({ userId: 1, createdAt: -1 })
  ]);
}

async function upsertDeviceToken({ userId, role, token, platform }) {
  if (!userId || !token) {
    throw new Error('Missing userId or token');
  }

  await ensureIndexes();
  const { deviceTokens } = getCollections();

  await deviceTokens.updateOne(
    { userId: String(userId), token: String(token) },
    {
      $set: {
        userId: String(userId),
        role: String(role || ''),
        token: String(token),
        platform: platform ? String(platform) : 'web',
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
}

async function createNotification({ userId, title, body, data, channel }) {
  if (!userId) throw new Error('Missing userId');

  await ensureIndexes();
  const { notifications } = getCollections();

  const doc = {
    userId: String(userId),
    title: String(title || ''),
    body: String(body || ''),
    data: data && typeof data === 'object' ? data : {},
    channel: channel ? String(channel) : 'push',
    read: false,
    createdAt: new Date()
  };

  const result = await notifications.insertOne(doc);
  return { id: String(result.insertedId), ...doc };
}

async function notifyUser(userId, { title, body, data }) {
  const notification = await createNotification({ userId, title, body, data, channel: 'push' });

  // Attempt Firebase send if initialized
  const firebaseApp = initFirebase(config);
  if (!firebaseApp) {
    return { ok: true, stored: true, pushed: false, reason: 'firebase_not_initialized', notification };
  }

  const { deviceTokens } = getCollections();
  const tokens = await deviceTokens
    .find({ userId: String(userId) })
    .project({ token: 1, _id: 0 })
    .toArray();

  const tokenList = tokens.map((t) => t.token).filter(Boolean);

  const pushResult = await sendToTokens(tokenList, {
    notification: {
      title: String(title || 'Mobility DT'),
      body: String(body || '')
    },
    data: {
      ...(data && typeof data === 'object' ? Object.fromEntries(Object.entries(data).map(([k, v]) => [String(k), String(v)])) : {}),
      notificationId: String(notification.id)
    }
  });

  return { ok: true, stored: true, pushed: pushResult.ok, pushResult, notification };
}

async function listNotifications(userId, limit = 50) {
  const { notifications } = getCollections();
  const docs = await notifications
    .find({ userId: String(userId) })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 50, 200)))
    .toArray();

  return docs.map((n) => ({
    id: String(n._id),
    title: n.title,
    body: n.body,
    data: n.data,
    channel: n.channel,
    read: Boolean(n.read),
    createdAt: n.createdAt
  }));
}

async function markNotificationRead(userId, notificationId) {
  const { notifications } = getCollections();
  await notifications.updateOne(
    { _id: new ObjectId(String(notificationId)), userId: String(userId) },
    { $set: { read: true, readAt: new Date() } }
  );
}

module.exports = {
  upsertDeviceToken,
  notifyUser,
  listNotifications,
  markNotificationRead
};
