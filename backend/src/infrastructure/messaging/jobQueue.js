/**
 * Durable, MongoDB-backed job queue (transactional-outbox style async messaging).
 *
 * - `enqueue()` persists the job; the HTTP request returns without waiting for the side effect.
 * - Any number of app instances can run `JobWorker`: jobs are claimed with an atomic
 *   findOneAndUpdate + lease (`lockedUntil`), so each job runs on exactly one instance at a time and
 *   a crashed instance's lease simply expires and the job is retried.
 * - Failures retry with exponential backoff; after MAX_ATTEMPTS the job is moved to DEAD (dead-letter).
 *
 * Chosen over Kafka/RabbitMQ/SQS for the pilot: zero new infrastructure, same durability guarantees
 * as the primary DB, and the `JobQueue` interface can be re-implemented on SQS later without
 * touching producers (see ARCHITECTURE.md, "Trade-offs").
 */
const os = require('os');
const crypto = require('crypto');
const { getDb } = require('../../db');
const { JOB_QUEUE } = require('../../core/constants');
const { logger } = require('../../services/logger');

const COLLECTION = 'job_queue';
const JOB_STATUS = Object.freeze({ PENDING: 'PENDING', PROCESSING: 'PROCESSING', COMPLETED: 'COMPLETED', DEAD: 'DEAD' });

function collection(db) {
  return (db || getDb()).collection(COLLECTION);
}

async function ensureJobQueueIndexes(db) {
  const jobs = collection(db);
  await jobs.createIndex({ status: 1, runAt: 1 });
  await jobs.createIndex({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });
  await jobs.createIndex({ completedAt: 1 }, { expireAfterSeconds: Math.floor(JOB_QUEUE.COMPLETED_RETENTION_MS / 1000), partialFilterExpression: { status: JOB_STATUS.COMPLETED } });
}

/**
 * @param {string} type      registered handler name
 * @param {object} payload   JSON-serialisable data
 * @param {{ dedupeKey?: string, runAt?: Date, db?: import('mongodb').Db, session?: any }} [options]
 */
async function enqueue(type, payload, { dedupeKey, runAt, db, session } = {}) {
  const now = new Date();
  const job = {
    type,
    payload,
    status: JOB_STATUS.PENDING,
    attempts: 0,
    runAt: runAt || now,
    lockedUntil: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
  if (dedupeKey) job.dedupeKey = dedupeKey;
  try {
    const result = await collection(db).insertOne(job, session ? { session } : undefined);
    return { enqueued: true, id: String(result.insertedId) };
  } catch (err) {
    if (err && err.code === 11000) return { enqueued: false, duplicate: true };
    throw err;
  }
}

function backoffMs(attempts) {
  return Math.min(JOB_QUEUE.MAX_BACKOFF_MS, JOB_QUEUE.BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

class JobWorker {
  constructor({ handlers = {}, db, pollIntervalMs = JOB_QUEUE.POLL_INTERVAL_MS, workerId } = {}) {
    this.handlers = new Map(Object.entries(handlers));
    this.db = db;
    this.pollIntervalMs = pollIntervalMs;
    this.workerId = workerId || `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString('hex')}`;
    this.timer = null;
    this.running = false;
    this.inFlight = Promise.resolve();
  }

  register(type, handler) { this.handlers.set(type, handler); return this; }

  async claimNext() {
    const now = new Date();
    return collection(this.db).findOneAndUpdate(
      {
        type: { $in: [...this.handlers.keys()] },
        runAt: { $lte: now },
        $or: [
          { status: JOB_STATUS.PENDING },
          { status: JOB_STATUS.PROCESSING, lockedUntil: { $lt: now } }, // expired lease => retry
        ],
      },
      {
        $set: { status: JOB_STATUS.PROCESSING, lockedBy: this.workerId, lockedUntil: new Date(now.getTime() + JOB_QUEUE.LOCK_MS), updatedAt: now },
        $inc: { attempts: 1 },
      },
      { sort: { runAt: 1 }, returnDocument: 'after' }
    );
  }

  async runJob(job) {
    const jobs = collection(this.db);
    const handler = this.handlers.get(job.type);
    try {
      await handler(job.payload, job);
      await jobs.updateOne({ _id: job._id, lockedBy: this.workerId }, { $set: { status: JOB_STATUS.COMPLETED, completedAt: new Date(), lockedUntil: null, updatedAt: new Date() } });
    } catch (err) {
      const dead = job.attempts >= JOB_QUEUE.MAX_ATTEMPTS;
      await jobs.updateOne(
        { _id: job._id, lockedBy: this.workerId },
        {
          $set: {
            status: dead ? JOB_STATUS.DEAD : JOB_STATUS.PENDING,
            runAt: new Date(Date.now() + backoffMs(job.attempts)),
            lastError: String(err && err.message || err).slice(0, 500),
            lockedUntil: null,
            updatedAt: new Date(),
          },
        }
      );
      logger.warn(`Job ${job.type} failed (attempt ${job.attempts})${dead ? ' -> DEAD' : ''}`, { jobId: String(job._id), error: String(err && err.message || err) });
    }
  }

  /** Drains up to BATCH_SIZE due jobs. Exposed for tests and for one-shot draining. */
  async drain(max = JOB_QUEUE.BATCH_SIZE) {
    let processed = 0;
    while (processed < max) {
      const job = await this.claimNext();
      if (!job) break;
      await this.runJob(job);
      processed += 1;
    }
    return processed;
  }

  start() {
    if (this.running) return this;
    this.running = true;
    const tick = async () => {
      if (!this.running) return;
      this.inFlight = this.drain().catch((err) => logger.error('Job worker tick failed', { error: err.message }));
      await this.inFlight;
      if (this.running) this.timer = setTimeout(tick, this.pollIntervalMs);
    };
    this.timer = setTimeout(tick, this.pollIntervalMs);
    if (this.timer.unref) this.timer.unref();
    return this;
  }

  /** Graceful stop: no new claims, waits for the in-flight batch. */
  async stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    await this.inFlight;
  }
}

module.exports = { enqueue, JobWorker, ensureJobQueueIndexes, JOB_STATUS, COLLECTION, backoffMs };
