const crypto = require('crypto');
const { getDb } = require('../db');

/**
 * Express middleware to guarantee idempotent execution for financial mutations
 */
function idempotencyMiddleware(req, res, next) {
  const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

  // If no idempotency key provided, proceed normally
  if (!key || typeof key !== 'string' || key.trim() === '') {
    return next();
  }

  const cleanKey = key.trim();
  const userId = req.user ? String(req.user.id || req.user._id) : 'anonymous';
  const requestHash = crypto
    .createHash('sha256')
    .update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body || {})}`)
    .digest('hex');

  const db = getDb();
  if (!db) return next();

  const idempotency = db.collection('idempotency_keys');

  (async () => {
    try {
      const existing = await idempotency.findOne({ key: cleanKey, userId });

      if (existing) {
        // If the request payload matches the recorded hash
        if (existing.requestHash === requestHash) {
          return res.status(existing.responseStatus || 200).json(existing.responseBody);
        } else {
          return res.status(422).json({
            success: false,
            message: 'Idempotency key reuse with different request payload is not allowed',
            code: 'IDEMPOTENCY_KEY_MISMATCH'
          });
        }
      }

      // Intercept res.json to capture response
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Record only successful or business responses (avoid caching 500 server crashes)
        if (res.statusCode < 500) {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24hr TTL

          idempotency.updateOne(
            { key: cleanKey, userId },
            {
              $set: {
                key: cleanKey,
                userId,
                requestHash,
                responseStatus: res.statusCode,
                responseBody: body,
                createdAt: now,
                expiresAt
              }
            },
            { upsert: true }
          ).catch((err) => console.warn('Error persisting idempotency key:', err.message));
        }

        return originalJson(body);
      };

      next();
    } catch (err) {
      console.warn('Idempotency middleware error, proceeding with request:', err.message);
      next();
    }
  })();
}

module.exports = {
  idempotencyMiddleware
};
