const crypto = require('crypto');
const { getDb } = require('../db');
const { PAYMENTS } = require('../core/constants');
const { logger } = require('../services/logger');

const COLLECTION = 'idempotency_keys';
const RECORD_STATUS = Object.freeze({ IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED' });

function readKey(req) {
  const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  return typeof key === 'string' && key.trim() ? key.trim().slice(0, 200) : null;
}

function hashRequest(req) {
  return crypto.createHash('sha256').update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body || {})}`).digest('hex');
}

function sendJson(res, status, message, code) {
  return res.status(status).json({ success: false, msg: message, message, code });
}

/**
 * Guarantees at-most-once execution of a mutation per (Idempotency-Key, user).
 *
 * The key is RESERVED with an atomic insert (unique index on key+userId) before the handler runs,
 * so two concurrent duplicates can no longer both execute. The response is stored on completion and
 * replayed for retries; 5xx responses release the reservation so the client can retry safely.
 */
function createIdempotencyMiddleware({ required = false } = {}) {
  return async function idempotencyMiddleware(req, res, next) {
    const key = readKey(req);
    if (!key) {
      if (required) return sendJson(res, 400, 'Idempotency-Key header is required for this operation', 'IDEMPOTENCY_KEY_REQUIRED');
      return next();
    }

    let db;
    try { db = getDb(); } catch { return next(); }
    const records = db.collection(COLLECTION);
    const userId = req.user ? String(req.user.id || req.user._id) : 'anonymous';
    const requestHash = hashRequest(req);
    const now = new Date();

    try {
      await records.insertOne({
        key,
        userId,
        requestHash,
        status: RECORD_STATUS.IN_PROGRESS,
        lockedUntil: new Date(now.getTime() + PAYMENTS.IDEMPOTENCY_LOCK_MS),
        createdAt: now,
        expiresAt: new Date(now.getTime() + PAYMENTS.IDEMPOTENCY_TTL_MS),
      });
    } catch (err) {
      if (!err || err.code !== 11000) {
        logger.warn('Idempotency reservation failed; proceeding without it', { error: err && err.message });
        return next();
      }
      const existing = await records.findOne({ key, userId });
      if (!existing) return sendJson(res, 409, 'Request with this Idempotency-Key is being retried; please retry', 'IDEMPOTENCY_RETRY');
      if (existing.requestHash !== requestHash) {
        return sendJson(res, 422, 'Idempotency key reuse with different request payload is not allowed', 'IDEMPOTENCY_KEY_MISMATCH');
      }
      if (existing.status === RECORD_STATUS.COMPLETED || existing.responseBody !== undefined) {
        res.set('Idempotent-Replayed', 'true');
        return res.status(existing.responseStatus || 200).json(existing.responseBody);
      }
      return sendJson(res, 409, 'A request with this Idempotency-Key is already in progress', 'IDEMPOTENCY_IN_PROGRESS');
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const finished = res.statusCode >= 500
        ? records.deleteOne({ key, userId, status: RECORD_STATUS.IN_PROGRESS })
        : records.updateOne(
          { key, userId },
          { $set: { status: RECORD_STATUS.COMPLETED, responseStatus: res.statusCode, responseBody: body, completedAt: new Date() }, $unset: { lockedUntil: '' } }
        );
      finished.catch((persistErr) => logger.warn('Error persisting idempotency record', { error: persistErr.message }));
      return originalJson(body);
    };
    return next();
  };
}

const idempotencyMiddleware = createIdempotencyMiddleware();
const requireIdempotency = createIdempotencyMiddleware({ required: true });

module.exports = { idempotencyMiddleware, requireIdempotency, createIdempotencyMiddleware };
