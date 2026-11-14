/**
 * Rate limiting (Factory + Strategy for storage).
 *
 * `MongoRateLimitStore` implements the express-rate-limit Store contract so counters are shared by
 * every app instance behind the load balancer (the default MemoryStore multiplies the limit by the
 * number of instances). Until the DB connects (or in DB-less unit tests) it degrades to an
 * in-process window so limits are never silently disabled.
 */
const rateLimit = require('express-rate-limit');
const { getMongoStatus, getDb } = require('../../db');
const { RATE_LIMITS, TIME } = require('../../core/constants');

const COLLECTION = 'rate_limits';

class MongoRateLimitStore {
  constructor({ prefix = 'rl:' } = {}) {
    this.prefix = prefix;
    this.windowMs = RATE_LIMITS.WINDOW_MS;
    this.localKeys = false;
    this.memory = new Map();
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  dbAvailable() {
    try { return getMongoStatus().connected; } catch { return false; }
  }

  memoryIncrement(key) {
    const now = Date.now();
    const entry = this.memory.get(key);
    if (!entry || entry.resetAt <= now) {
      const fresh = { hits: 1, resetAt: now + this.windowMs };
      this.memory.set(key, fresh);
      return { totalHits: 1, resetTime: new Date(fresh.resetAt) };
    }
    entry.hits += 1;
    return { totalHits: entry.hits, resetTime: new Date(entry.resetAt) };
  }

  async increment(key) {
    const id = this.prefix + key;
    if (!this.dbAvailable()) return this.memoryIncrement(id);
    const now = new Date();
    const freshReset = new Date(now.getTime() + this.windowMs);
    const doc = await getDb().collection(COLLECTION).findOneAndUpdate(
      { _id: id },
      [
        { $set: { _expired: { $or: [{ $eq: [{ $ifNull: ['$resetAt', null] }, null] }, { $lte: ['$resetAt', now] }] } } },
        {
          $set: {
            hits: { $cond: ['$_expired', 1, { $add: ['$hits', 1] }] },
            resetAt: { $cond: ['$_expired', freshReset, '$resetAt'] },
          },
        },
        { $unset: '_expired' },
      ],
      { upsert: true, returnDocument: 'after' }
    );
    return { totalHits: doc.hits, resetTime: doc.resetAt };
  }

  async decrement(key) {
    const id = this.prefix + key;
    if (!this.dbAvailable()) {
      const entry = this.memory.get(id);
      if (entry && entry.hits > 0) entry.hits -= 1;
      return;
    }
    await getDb().collection(COLLECTION).updateOne({ _id: id, hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    const id = this.prefix + key;
    this.memory.delete(id);
    if (this.dbAvailable()) await getDb().collection(COLLECTION).deleteOne({ _id: id });
  }
}

async function ensureRateLimitIndexes(db) {
  await (db || getDb()).collection(COLLECTION).createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 });
}

/**
 * @param {{ name: string, windowMs?: number, max: number, message: string, keyByUser?: boolean }} options
 */
function createLimiter({ name, windowMs = RATE_LIMITS.WINDOW_MS, max, message, keyByUser = false }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new MongoRateLimitStore({ prefix: `rl:${name}:` }),
    // Authenticated limiters key by user so one office NAT doesn't share a bucket; anonymous by IP.
    keyGenerator: keyByUser
      ? (req) => (req.user && req.user.id ? `u:${req.user.id}` : `ip:${rateLimit.ipKeyGenerator(req.ip || '')}`)
      : undefined,
    handler: (req, res) => res.status(429).json({
      success: false,
      msg: message,
      message,
      code: 'RATE_LIMIT_EXCEEDED',
      requestId: req.requestId || null,
    }),
  });
}

const limiters = {
  login: createLimiter({ name: 'login', max: RATE_LIMITS.LOGIN_MAX, message: 'Too many login attempts. Please wait 15 minutes and try again.' }),
  signup: createLimiter({ name: 'signup', max: RATE_LIMITS.SIGNUP_MAX, message: 'Too many sign-up attempts. Please try again later.' }),
  otp: createLimiter({ name: 'otp', max: RATE_LIMITS.OTP_MAX, message: 'Too many requests. Please try again after 15 minutes.' }),
  ai: createLimiter({ name: 'ai', windowMs: TIME.MINUTE_MS, max: RATE_LIMITS.AI_PER_MINUTE, keyByUser: true, message: 'AI assistant rate limit reached. Please wait a minute.' }),
  paymentVerify: createLimiter({ name: 'payment-verify', max: RATE_LIMITS.PAYMENT_VERIFY_MAX, message: 'Too many verification attempts. Please wait and retry.' }),
  paymentCreation: createLimiter({ name: 'payment-create', max: RATE_LIMITS.PAYMENT_CREATE_MAX, keyByUser: true, message: 'Payment order creation limit exceeded. Please wait a few moments before trying again.' }),
  refund: createLimiter({ name: 'refund', max: RATE_LIMITS.REFUND_MAX, keyByUser: true, message: 'Refund request limit exceeded. Please try again later.' }),
  dispute: createLimiter({ name: 'dispute', max: RATE_LIMITS.DISPUTE_MAX, keyByUser: true, message: 'Dispute submission limit reached. Please wait before submitting additional disputes.' }),
  settlement: createLimiter({ name: 'settlement', max: RATE_LIMITS.SETTLEMENT_MAX, keyByUser: true, message: 'Settlement request limit exceeded. Please wait before requesting another withdrawal.' }),
  financialMutation: createLimiter({ name: 'financial-mutation', max: RATE_LIMITS.FINANCIAL_MUTATION_MAX, keyByUser: true, message: 'Financial operations rate limit reached. Please wait a few moments before retrying.' }),
};

module.exports = { MongoRateLimitStore, createLimiter, limiters, ensureRateLimitIndexes };
