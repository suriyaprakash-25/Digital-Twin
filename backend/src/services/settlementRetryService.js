const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { SETTLEMENT_STATUS } = require('./settlementStateMachine');
const { logFinancialAudit } = require('./auditService');

const RETRY_DELAYS_MS = [
  5 * 60 * 1000,       // 1st retry: 5 minutes
  15 * 60 * 1000,      // 2nd retry: 15 minutes
  60 * 60 * 1000,      // 3rd retry: 1 hour
  6 * 60 * 60 * 1000,  // 4th retry: 6 hours
  24 * 60 * 60 * 1000  // 5th retry: 24 hours
];

const MAX_SETTLEMENT_RETRIES = 5;

function safeObjectId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

/**
 * Get delay in ms for a given 1-indexed retry attempt
 */
function getRetryDelayMs(attemptNumber) {
  const index = Math.min(Math.max(1, attemptNumber) - 1, RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

/**
 * Schedules a retry for a failed settlement or marks it permanently failed
 */
async function scheduleSettlementRetry({ settlementId, failureReason, failureCode, dbInstance }) {
  const db = dbInstance || getDb();
  const settlements = db.collection('settlements');
  const earnings = db.collection('garage_earnings');
  const now = new Date();

  const sId = safeObjectId(settlementId);
  const settlement = sId
    ? await settlements.findOne({ _id: sId })
    : await settlements.findOne({ settlementId });

  if (!settlement) {
    throw new Error(`Settlement ${settlementId} not found for retry scheduling`);
  }

  const currentRetries = settlement.retryCount || 0;
  const newRetryCount = currentRetries + 1;

  if (newRetryCount > MAX_SETTLEMENT_RETRIES) {
    // Exceeded maximum retries -> FAILED_PERMANENTLY
    await settlements.updateOne(
      { _id: settlement._id },
      {
        $set: {
          status: SETTLEMENT_STATUS.FAILED_PERMANENTLY,
          retryCount: newRetryCount,
          failureReason: `Exceeded max retry attempts (${MAX_SETTLEMENT_RETRIES}): ${failureReason || 'Permanent provider failure'}`,
          failureCode: failureCode || 'MAX_RETRIES_EXCEEDED',
          nextRetryAt: null,
          updatedAt: now
        }
      }
    );

    // Safely unlock locked earnings back to AVAILABLE
    if (settlement.earningsIds && settlement.earningsIds.length > 0) {
      const eObjectIds = settlement.earningsIds.map(eid => safeObjectId(eid)).filter(Boolean);
      await earnings.updateMany(
        { _id: { $in: eObjectIds } },
        {
          $set: {
            status: 'AVAILABLE',
            settlementId: null,
            settlementObjectId: null,
            updatedAt: now
          }
        }
      );
    }

    await logFinancialAudit({
      actorId: 'SETTLEMENT_RETRY_ENGINE',
      actorRole: 'SYSTEM',
      garageId: settlement.garageId,
      settlementId: settlement.settlementId,
      action: 'SETTLEMENT_FUNDS_UNLOCKED',
      resourceType: 'SETTLEMENT',
      resourceId: String(settlement._id),
      afterState: { status: SETTLEMENT_STATUS.FAILED_PERMANENTLY, retryCount: newRetryCount },
      dbInstance: db
    });

    return {
      status: SETTLEMENT_STATUS.FAILED_PERMANENTLY,
      retryCount: newRetryCount,
      message: 'Settlement permanently failed after maximum retries. Funds unlocked.'
    };
  }

  // Schedule next retry
  const delayMs = getRetryDelayMs(newRetryCount);
  const nextRetryAt = new Date(now.getTime() + delayMs);

  await settlements.updateOne(
    { _id: settlement._id },
    {
      $set: {
        status: SETTLEMENT_STATUS.RETRY_PENDING,
        retryCount: newRetryCount,
        nextRetryAt,
        lastFailureReason: failureReason || 'Temporary payout gateway error',
        lastFailureCode: failureCode || 'TEMPORARY_ERROR',
        updatedAt: now
      }
    }
  );

  await logFinancialAudit({
    actorId: 'SETTLEMENT_RETRY_ENGINE',
    actorRole: 'SYSTEM',
    garageId: settlement.garageId,
    settlementId: settlement.settlementId,
    action: 'SETTLEMENT_RETRY_SCHEDULED',
    resourceType: 'SETTLEMENT',
    resourceId: String(settlement._id),
    afterState: {
      status: SETTLEMENT_STATUS.RETRY_PENDING,
      retryCount: newRetryCount,
      nextRetryAt
    },
    dbInstance: db
  });

  return {
    status: SETTLEMENT_STATUS.RETRY_PENDING,
    retryCount: newRetryCount,
    nextRetryAt,
    delayMinutes: Math.round(delayMs / 60000)
  };
}

module.exports = {
  RETRY_DELAYS_MS,
  MAX_SETTLEMENT_RETRIES,
  getRetryDelayMs,
  scheduleSettlementRetry
};
