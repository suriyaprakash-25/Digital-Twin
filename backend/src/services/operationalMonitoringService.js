const { getDb } = require('../db');
const { sanitizeForLogging } = require('../security/sanitizeLog');

const COLLECTION = 'operational_error_events';

function clampLimit(value, fallback = 50, max = 200) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

async function ensureOperationalMonitoringIndexes(dbInstance) {
  const db = dbInstance || getDb();
  const events = db.collection(COLLECTION);

  await events.createIndex({ timestamp: -1 });
  await events.createIndex({ kind: 1, timestamp: -1 });
  await events.createIndex({ severity: 1, timestamp: -1 });
  await events.createIndex({ statusCode: 1, timestamp: -1 }, { sparse: true });
  await events.createIndex({ requestId: 1 }, { sparse: true });
}

async function recordOperationalEvent(event = {}, dbInstance) {
  const db = dbInstance || getDb();
  const events = db.collection(COLLECTION);
  const clean = sanitizeForLogging(event);

  const doc = {
    timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
    severity: String(event.severity || 'ERROR').toUpperCase(),
    kind: String(event.kind || 'APPLICATION_ERROR'),
    message: String(event.message || 'Operational error'),
    requestId: event.requestId || null,
    method: event.method || null,
    path: event.path || null,
    statusCode: Number.isFinite(event.statusCode) ? event.statusCode : null,
    durationMs: Number.isFinite(event.durationMs) ? event.durationMs : null,
    actorId: event.actorId || null,
    actorRole: event.actorRole || null,
    ...clean
  };

  await events.insertOne(doc);
  return doc;
}

async function listOperationalEvents({ limit = 50, sinceMinutes = 1440, kind = null, severity = null } = {}, dbInstance) {
  const db = dbInstance || getDb();
  const events = db.collection(COLLECTION);
  const query = {};

  const minutes = Math.max(1, Number.parseInt(sinceMinutes, 10) || 1440);
  query.timestamp = { $gte: new Date(Date.now() - minutes * 60 * 1000) };

  if (kind) query.kind = String(kind);
  if (severity) query.severity = String(severity).toUpperCase();

  return events
    .find(query)
    .sort({ timestamp: -1 })
    .limit(clampLimit(limit))
    .toArray();
}

async function getOperationalSummary(dbInstance) {
  const db = dbInstance || getDb();
  const events = db.collection(COLLECTION);
  const now = Date.now();
  const oneHour = new Date(now - 60 * 60 * 1000);
  const twentyFourHours = new Date(now - 24 * 60 * 60 * 1000);

  const [errorsLastHour, errorsLast24h, http5xxLastHour, recent] = await Promise.all([
    events.countDocuments({ timestamp: { $gte: oneHour }, severity: 'ERROR' }),
    events.countDocuments({ timestamp: { $gte: twentyFourHours }, severity: 'ERROR' }),
    events.countDocuments({ timestamp: { $gte: oneHour }, kind: 'HTTP_5XX' }),
    events.find({ timestamp: { $gte: twentyFourHours } }).sort({ timestamp: -1 }).limit(10).toArray()
  ]);

  return {
    errorsLastHour,
    errorsLast24h,
    http5xxLastHour,
    recent
  };
}

module.exports = {
  COLLECTION,
  ensureOperationalMonitoringIndexes,
  recordOperationalEvent,
  listOperationalEvents,
  getOperationalSummary
};
