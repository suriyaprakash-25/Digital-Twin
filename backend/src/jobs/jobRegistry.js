const crypto = require('crypto');
const { getDb } = require('../db');
const { logger } = require('../services/logger');

/**
 * Ensures indexes for job execution tracking and distributed locking
 */
async function ensureJobRegistryIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const jobLogs = db.collection('job_execution_logs');
    const jobLocks = db.collection('job_locks');

    await jobLogs.createIndex({ jobName: 1, startedAt: -1 });
    await jobLogs.createIndex({ executionId: 1 }, { unique: true });
    await jobLogs.createIndex({ status: 1 });

    await jobLocks.createIndex({ jobName: 1 }, { unique: true });
    await jobLocks.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    console.log('✅ Job Registry & Execution tracking indexes verified.');
  } catch (err) {
    console.error('Error ensuring job registry indexes:', err.message);
  }
}

/**
 * Acquires a distributed lock for a job with a TTL
 */
async function acquireJobLock(jobName, ttlMs = 60000, dbInstance) {
  const db = dbInstance || getDb();
  const jobLocks = db.collection('job_locks');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const executionId = `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  try {
    const existing = await jobLocks.findOne({ jobName });
    if (existing && existing.expiresAt && new Date(existing.expiresAt) > now) {
      return { acquired: false, executionId: null };
    }

    const result = await jobLocks.updateOne(
      {
        jobName,
        $or: [
          { expiresAt: { $lt: now } },
          { expiresAt: { $exists: false } }
        ]
      },
      {
        $set: {
          jobName,
          executionId,
          acquiredAt: now,
          expiresAt
        }
      },
      { upsert: true }
    );

    if (result.matchedCount === 0 && result.upsertedCount === 0) {
      return { acquired: false, executionId: null };
    }

    return { acquired: true, executionId };
  } catch (err) {
    // If unique index collision on jobName occurred and lock hasn't expired
    return { acquired: false, executionId: null };
  }
}

/**
 * Releases a job lock
 */
async function releaseJobLock(jobName, executionId, dbInstance) {
  const db = dbInstance || getDb();
  const jobLocks = db.collection('job_locks');
  await jobLocks.deleteOne({ jobName, executionId });
}

/**
 * Wraps any financial background job with execution logging, timing, and overlapping run prevention
 */
async function executeRegisteredJob({
  jobName,
  ttlMs = 60000,
  runnerFn,
  dbInstance
}) {
  const db = dbInstance || getDb();
  const jobLogs = db.collection('job_execution_logs');

  const { acquired, executionId } = await acquireJobLock(jobName, ttlMs, db);
  if (!acquired) {
    logger.warn(`Job [${jobName}] execution skipped: Prior execution still running or locked.`);
    return { skipped: true, reason: 'CONCURRENT_EXECUTION_LOCKED' };
  }

  const startTime = Date.now();
  const startedAt = new Date();

  await jobLogs.insertOne({
    jobName,
    executionId,
    startedAt,
    completedAt: null,
    status: 'RUNNING',
    recordsProcessed: 0,
    recordsFailed: 0,
    durationMs: null,
    error: null
  });

  try {
    const result = await runnerFn(db);
    const completedAt = new Date();
    const durationMs = Date.now() - startTime;

    await jobLogs.updateOne(
      { executionId },
      {
        $set: {
          completedAt,
          status: 'SUCCESS',
          recordsProcessed: result?.recordsProcessed || result?.processedCount || 0,
          recordsFailed: result?.recordsFailed || 0,
          durationMs
        }
      }
    );

    await releaseJobLock(jobName, executionId, db);
    return { success: true, executionId, durationMs, result };
  } catch (err) {
    const completedAt = new Date();
    const durationMs = Date.now() - startTime;

    await jobLogs.updateOne(
      { executionId },
      {
        $set: {
          completedAt,
          status: 'FAILED',
          durationMs,
          error: err.message
        }
      }
    );

    await releaseJobLock(jobName, executionId, db);
    logger.error(`Job [${jobName}] failed during execution: ${err.message}`, { executionId, error: err.message });
    throw err;
  }
}

module.exports = {
  ensureJobRegistryIndexes,
  acquireJobLock,
  releaseJobLock,
  executeRegisteredJob
};
