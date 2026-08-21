const { getDb } = require('../db');
const { SETTLEMENT_STATUS } = require('../services/settlementStateMachine');
const { checkSettlementEligibility } = require('../services/settlementEligibilityService');
const { calculateNextRunDate } = require('../services/settlementScheduler');
const { generateSettlementNumber } = require('../utils/settlementNumber');
const { logFinancialAudit } = require('../services/auditService');

/**
 * Automated Settlement Job
 * Scans schedules and generates idempotent settlement batches
 */
async function runScheduledSettlements(dbInstance) {
  const db = dbInstance || getDb();
  const schedules = db.collection('settlement_schedules');
  const earnings = db.collection('garage_earnings');
  const settlements = db.collection('settlements');
  const now = new Date();

  const highValueThresholdRupees = parseFloat(process.env.HIGH_VALUE_SETTLEMENT_THRESHOLD) || 50000;

  // 1. Find all enabled schedules due for execution
  const dueSchedules = await schedules
    .find({
      enabled: true,
      nextRunAt: { $lte: now }
    })
    .toArray();

  const results = {
    processedCount: 0,
    createdSettlements: [],
    skipped: []
  };

  for (const sched of dueSchedules) {
    try {
      // 2. Check Eligibility
      const eligibility = await checkSettlementEligibility(sched.garageId, undefined, db);
      if (!eligibility.eligible) {
        // Advance schedule so it does not loop continuously
        const nextDate = calculateNextRunDate(sched.scheduleType, now);
        await schedules.updateOne(
          { _id: sched._id },
          {
            $set: {
              lastRunAt: now,
              nextRunAt: nextDate,
              lastResult: { success: false, reason: eligibility.reason }
            }
          }
        );
        results.skipped.push({ garageId: sched.garageId, reason: eligibility.reason });
        continue;
      }

      // Check against schedule minimum amount
      if (sched.minimumAmountPaise && eligibility.availablePaise < sched.minimumAmountPaise) {
        const nextDate = calculateNextRunDate(sched.scheduleType, now);
        await schedules.updateOne(
          { _id: sched._id },
          {
            $set: {
              lastRunAt: now,
              nextRunAt: nextDate,
              lastResult: { success: false, reason: 'BELOW_SCHEDULE_MINIMUM' }
            }
          }
        );
        results.skipped.push({ garageId: sched.garageId, reason: 'BELOW_SCHEDULE_MINIMUM' });
        continue;
      }

      // 3. Atomically Lock Earnings
      const eligibleEarnings = await earnings
        .find({
          garageId: String(sched.garageId),
          status: { $in: ['AVAILABLE', 'REFUND_ADJUSTMENT'] }
        })
        .toArray();

      if (eligibleEarnings.length === 0) {
        continue;
      }

      const earningsIds = eligibleEarnings.map(e => e._id);
      const settlementId = await generateSettlementNumber(db);
      const isHighValue = eligibility.availableRupees >= highValueThresholdRupees;

      const settlementDoc = {
        settlementId,
        garageId: String(sched.garageId),
        requestedAmount: eligibility.availableRupees,
        requestedPaise: eligibility.availablePaise,
        approvedAmount: eligibility.availableRupees,
        approvedPaise: eligibility.availablePaise,
        status: SETTLEMENT_STATUS.REQUESTED,
        type: 'AUTOMATED_SCHEDULED',
        scheduleType: sched.scheduleType,
        earningsIds: earningsIds.map(String),
        earningsCount: earningsIds.length,
        payoutProfile: eligibility.payoutProfile,
        isHighValue,
        requiredApprovalCount: isHighValue ? 2 : 1,
        approvalCount: 0,
        approvals: [],
        requestedBy: 'SYSTEM_SCHEDULER',
        createdAt: now,
        updatedAt: now
      };

      // Insert settlement
      const insertRes = await settlements.insertOne(settlementDoc);

      // Lock earnings
      await earnings.updateMany(
        { _id: { $in: earningsIds } },
        {
          $set: {
            status: 'SETTLEMENT_PENDING',
            settlementId,
            settlementObjectId: insertRes.insertedId,
            updatedAt: now
          }
        }
      );

      // Advance schedule
      const nextDate = calculateNextRunDate(sched.scheduleType, now);
      await schedules.updateOne(
        { _id: sched._id },
        {
          $set: {
            lastRunAt: now,
            nextRunAt: nextDate,
            lastResult: { success: true, settlementId, amount: eligibility.availableRupees }
          }
        }
      );

      // Audit Log
      await logFinancialAudit({
        actorId: 'SYSTEM_SCHEDULER',
        actorRole: 'SYSTEM',
        garageId: String(sched.garageId),
        settlementId,
        action: 'SETTLEMENT_CREATED',
        resourceType: 'SETTLEMENT',
        resourceId: String(insertRes.insertedId),
        afterState: {
          settlementId,
          amount: eligibility.availableRupees,
          status: SETTLEMENT_STATUS.REQUESTED,
          scheduleType: sched.scheduleType
        },
        dbInstance: db
      });

      results.processedCount++;
      results.createdSettlements.push({
        settlementId,
        garageId: sched.garageId,
        amount: eligibility.availableRupees
      });
    } catch (err) {
      console.error(`Error processing schedule for garage ${sched.garageId}:`, err);
      results.skipped.push({ garageId: sched.garageId, error: err.message });
    }
  }

  return results;
}

module.exports = {
  runScheduledSettlements
};
