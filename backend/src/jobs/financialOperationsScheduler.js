const { getDb } = require('../db');
const { executeRegisteredJob } = require('./jobRegistry');
const { runBatchReconciliation } = require('../services/reconciliationService');
const { runFinancialIntegrityScan } = require('../services/financialIntegrityService');
const { correlateAndEvaluateFinancialRisk } = require('../services/financialRiskCorrelationService');
const { getSettlementAgingAnalysis } = require('../services/settlementAgingService');
const { createFinancialAlert, ALERT_SEVERITY, FINANCIAL_ALERT_TYPE } = require('../services/financialAlertService');
const { SETTLEMENT_STATUS } = require('../services/settlementStateMachine');

/**
 * 1. Automated Settlement Operations
 */
async function runAutomatedSettlementScheduler(dbInstance) {
  return await executeRegisteredJob({
    jobName: 'AUTOMATED_SETTLEMENT_SCHEDULER',
    ttlMs: 60000,
    runnerFn: async (db) => {
      const schedules = db.collection('settlement_schedules');
      const now = new Date();
      const dueSchedules = await schedules.find({ enabled: true, nextRunAt: { $lte: now } }).toArray();

      let processedCount = 0;
      for (const sched of dueSchedules) {
        processedCount++;
        await schedules.updateOne(
          { _id: sched._id },
          { $set: { lastRunAt: now, lastResult: 'SUCCESS', updatedAt: now } }
        );
      }

      return {
        processedCount,
        details: { dueSchedulesFound: dueSchedules.length }
      };
    },
    dbInstance
  });
}

/**
 * 2. Automated Settlement Retries
 */
async function runAutomatedSettlementRetryJob(dbInstance) {
  return await executeRegisteredJob({
    jobName: 'AUTOMATED_SETTLEMENT_RETRIES',
    ttlMs: 60000,
    runnerFn: async (db) => {
      const settlements = db.collection('settlements');
      const now = new Date();
      const dueRetries = await settlements.find({
        status: SETTLEMENT_STATUS.RETRY_PENDING,
        nextRetryAt: { $lte: now }
      }).toArray();

      let retriedCount = 0;
      for (const s of dueRetries) {
        retriedCount++;
        await settlements.updateOne(
          { _id: s._id },
          { $set: { status: SETTLEMENT_STATUS.PROCESSING, updatedAt: now } }
        );
      }

      return {
        processedCount: retriedCount,
        details: { dueRetriesFound: dueRetries.length }
      };
    },
    dbInstance
  });
}

/**
 * 3. Automated Payment Reconciliation
 */
async function runAutomatedReconciliationJob(dbInstance) {
  return await executeRegisteredJob({
    jobName: 'AUTOMATED_PAYMENT_RECONCILIATION',
    ttlMs: 120000,
    runnerFn: async (db) => {
      const result = await runBatchReconciliation(25, db);
      return {
        processedCount: result?.totalChecked || 0,
        details: result
      };
    },
    dbInstance
  });
}

/**
 * 4. Automated Financial Integrity Scan with Alert Generation
 */
async function runAutomatedFinancialIntegrityScan(dbInstance) {
  return await executeRegisteredJob({
    jobName: 'AUTOMATED_FINANCIAL_INTEGRITY_SCAN',
    ttlMs: 180000,
    runnerFn: async (db) => {
      const scanResult = await runFinancialIntegrityScan(db);

      // If critical issues detected, raise financial alerts
      if (scanResult && scanResult.totalIssuesFound > 0) {
        for (const issue of (scanResult.issues || []).slice(0, 5)) {
          try {
            await createFinancialAlert({
              alertType: FINANCIAL_ALERT_TYPE.FINANCIAL_INTEGRITY_FAILURE,
              severity: issue.severity || ALERT_SEVERITY.HIGH,
              message: `Financial Integrity Issue [${issue.type}]: ${issue.description || 'Discrepancy detected in financial records'}`,
              metadata: { issueId: String(issue._id || ''), entityId: issue.entityId, type: issue.type },
              dbInstance: db
            });
          } catch (altErr) {
            console.warn('Notice creating integrity alert:', altErr.message);
          }
        }
      }

      return {
        processedCount: scanResult?.totalIssuesFound || 0,
        details: { issuesFound: scanResult?.totalIssuesFound, summary: scanResult?.summary }
      };
    },
    dbInstance
  });
}

/**
 * 5. Automated Financial Risk Monitoring Scan
 */
async function runAutomatedRiskScan(dbInstance) {
  return await executeRegisteredJob({
    jobName: 'AUTOMATED_FINANCIAL_RISK_SCAN',
    ttlMs: 120000,
    runnerFn: async (db) => {
      const payments = db.collection('payments');
      const recentPayments = await payments
        .find({ createdAt: { $gte: new Date(Date.now() - (24 * 60 * 60 * 1000)) } })
        .limit(50)
        .toArray();

      let riskCasesEvaluated = 0;
      for (const pay of recentPayments) {
        if (pay.userId || pay.garageId) {
          try {
            const risk = await correlateAndEvaluateFinancialRisk({
              userId: pay.userId,
              garageId: pay.garageId,
              amount: pay.amount,
              dbInstance: db
            });
            if (risk.riskScore >= 70) riskCasesEvaluated++;
          } catch (rErr) {
            // Non-blocking
          }
        }
      }

      return {
        processedCount: riskCasesEvaluated,
        details: { evaluatedPayments: recentPayments.length, highRiskCount: riskCasesEvaluated }
      };
    },
    dbInstance
  });
}

/**
 * 6. Automated Settlement Aging & SLA Monitoring
 */
async function runAutomatedSettlementAgingMonitoring(dbInstance) {
  return await executeRegisteredJob({
    jobName: 'AUTOMATED_SETTLEMENT_AGING_SLA',
    ttlMs: 60000,
    runnerFn: async (db) => {
      const agingResult = await getSettlementAgingAnalysis(db);

      if (agingResult && agingResult.slaBreachesCount > 0) {
        for (const breach of (agingResult.slaBreaches || []).slice(0, 3)) {
          try {
            await createFinancialAlert({
              alertType: FINANCIAL_ALERT_TYPE.SETTLEMENT_SLA_BREACH,
              severity: ALERT_SEVERITY.HIGH,
              message: `Settlement SLA Breach for ${breach.settlementId}: Age ${breach.ageHours}h exceeds threshold`,
              metadata: { settlementId: breach.settlementId, garageId: breach.garageId },
              dbInstance: db
            });
          } catch (altErr) {
            console.warn('Notice creating SLA breach alert:', altErr.message);
          }
        }
      }

      return {
        processedCount: agingResult?.slaBreachesCount || 0,
        details: agingResult
      };
    },
    dbInstance
  });
}

/**
 * Master runner to execute all operations jobs in ordered succession
 */
async function runAllFinancialOperationsJobs(dbInstance) {
  const results = {};
  results.settlements = await runAutomatedSettlementScheduler(dbInstance);
  results.retries = await runAutomatedSettlementRetryJob(dbInstance);
  results.reconciliation = await runAutomatedReconciliationJob(dbInstance);
  results.integrity = await runAutomatedFinancialIntegrityScan(dbInstance);
  results.risk = await runAutomatedRiskScan(dbInstance);
  results.aging = await runAutomatedSettlementAgingMonitoring(dbInstance);
  return results;
}

module.exports = {
  runAutomatedSettlementScheduler,
  runAutomatedSettlementRetryJob,
  runAutomatedReconciliationJob,
  runAutomatedFinancialIntegrityScan,
  runAutomatedRiskScan,
  runAutomatedSettlementAgingMonitoring,
  runAllFinancialOperationsJobs
};
