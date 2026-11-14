const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, PERMISSIONS } = require('../middleware/permissionMiddleware');
const { requireIdempotency } = require('../middleware/idempotency');
const { financialMutationLimiter } = require('../middleware/financialRateLimit');
const { SETTLEMENT_STATUS, transitionSettlement, normalizeSettlementStatus } = require('../services/settlementStateMachine');
const { approveSettlement, placeSettlementHold, releaseSettlementHold, HIGH_VALUE_THRESHOLD_RUPEES } = require('../services/settlementGovernanceService');
const { scheduleSettlementRetry } = require('../services/settlementRetryService');
const { getSettlementProvider } = require('../services/settlementProvider');
const { logFinancialAudit } = require('../services/auditService');
const { aggregateKpis, countWhere, sumWhere, inList, equals } = require('../core/aggregation');

function safeObjectId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

/**
 * GET /api/admin/financial-operations/summary
 */
router.get('/summary', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  const db = getDb();
  const settlements = db.collection('settlements');
  const holds = db.collection('settlement_holds');
  const reconciliations = db.collection('settlement_reconciliation');

  try {
    // Single aggregation instead of loading every settlement into memory.
    const amount = { $ifNull: ['$approvedAmount', '$requestedAmount'] };
    const SETTLED_STATES = [SETTLEMENT_STATUS.SETTLED, 'COMPLETED'];
    const FAILED_STATES = [SETTLEMENT_STATUS.FAILED, SETTLEMENT_STATUS.FAILED_PERMANENTLY];
    const CLOSED_STATES = ['SETTLED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
    const DEFAULT_REQUIRED_APPROVALS = 2;
    const awaitingSecondApproval = {
      $and: [
        { $eq: ['$isHighValue', true] },
        { $lt: [{ $ifNull: ['$approvalCount', 0] }, { $ifNull: ['$requiredApprovalCount', DEFAULT_REQUIRED_APPROVALS] }] },
        { $not: [inList('$status', CLOSED_STATES)] }
      ]
    };
    const [kpi, activeHoldsCount, openReconciliationsCount] = await Promise.all([
      aggregateKpis(settlements, {
        pendingAmount: sumWhere(equals('$status', SETTLEMENT_STATUS.REQUESTED), amount),
        pendingCount: countWhere(equals('$status', SETTLEMENT_STATUS.REQUESTED)),
        underReviewAmount: sumWhere(equals('$status', SETTLEMENT_STATUS.UNDER_REVIEW), amount),
        underReviewCount: countWhere(equals('$status', SETTLEMENT_STATUS.UNDER_REVIEW)),
        processingAmount: sumWhere(equals('$status', SETTLEMENT_STATUS.PROCESSING), amount),
        processingCount: countWhere(equals('$status', SETTLEMENT_STATUS.PROCESSING)),
        settledAmount: sumWhere(inList('$status', SETTLED_STATES), amount),
        settledCount: countWhere(inList('$status', SETTLED_STATES)),
        failedCount: countWhere(inList('$status', FAILED_STATES)),
        retryQueueCount: countWhere(equals('$status', SETTLEMENT_STATUS.RETRY_PENDING)),
        highValuePendingAmount: sumWhere(awaitingSecondApproval, amount),
        highValuePendingCount: countWhere(awaitingSecondApproval)
      }),
      holds.countDocuments({ active: true }),
      reconciliations.countDocuments({ status: 'OPEN' })
    ]);
    const {
      pendingAmount, pendingCount, underReviewAmount, underReviewCount, highValuePendingAmount, highValuePendingCount,
      processingAmount, processingCount, settledAmount, settledCount, failedCount, retryQueueCount
    } = kpi;
    const activeHolds = { length: activeHoldsCount };
    const openReconciliations = { length: openReconciliationsCount };

    return res.status(200).json({
      success: true,
      summary: {
        pendingAmount,
        pendingCount,
        underReviewAmount,
        underReviewCount,
        highValuePendingAmount,
        highValuePendingCount,
        processingAmount,
        processingCount,
        settledAmount,
        settledCount,
        failedCount,
        retryQueueCount,
        activeHoldsCount: activeHolds.length,
        openReconciliationsCount: openReconciliations.length
      }
    });
  } catch (err) {
    console.error('Error fetching financial operations summary:', err);
    return res.status(500).json({ success: false, message: 'Server error loading summary' });
  }
});

/**
 * GET /api/admin/settlements/pending
 */
router.get('/pending', requireAuth, requirePermission(PERMISSIONS.SETTLEMENT_READ), async (req, res) => {
  const db = getDb();
  const settlements = db.collection('settlements');

  try {
    const list = await settlements
      .find({ status: { $in: [SETTLEMENT_STATUS.REQUESTED, SETTLEMENT_STATUS.UNDER_REVIEW, SETTLEMENT_STATUS.APPROVED] } })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({ success: true, settlements: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error fetching pending settlements' });
  }
});

/**
 * GET /api/admin/settlements/high-value
 */
router.get('/high-value', requireAuth, requirePermission(PERMISSIONS.SETTLEMENT_READ), async (req, res) => {
  const db = getDb();
  const settlements = db.collection('settlements');

  try {
    const list = await settlements
      .find({
        isHighValue: true,
        status: { $in: [SETTLEMENT_STATUS.REQUESTED, SETTLEMENT_STATUS.UNDER_REVIEW, SETTLEMENT_STATUS.APPROVED] }
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({ success: true, settlements: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error fetching high-value settlements' });
  }
});

/**
 * POST /api/admin/settlements/:id/approve
 */
router.post('/:id/approve', requireAuth, requirePermission(PERMISSIONS.SETTLEMENT_APPROVE), financialMutationLimiter, requireIdempotency, async (req, res) => {
  const { id } = req.params;
  const { confirmation } = req.body;

  if (confirmation !== true) {
    return res.status(400).json({ success: false, message: 'Explicit confirmation payload required' });
  }

  try {
    const result = await approveSettlement({
      settlementId: id,
      adminId: req.user.id,
      role: req.user.adminRole || req.user.role || 'FINANCE_ADMIN',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      dbInstance: getDb()
    });

    return res.status(200).json({
      success: true,
      message: result.isFullyApproved
        ? 'Settlement fully approved and ready for processing'
        : 'First approval recorded. Second approval required for high-value settlement',
      result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/settlements/:id/second-approve
 */
router.post('/:id/second-approve', requireAuth, requirePermission(PERMISSIONS.SETTLEMENT_APPROVE), financialMutationLimiter, requireIdempotency, async (req, res) => {
  const { id } = req.params;
  const { confirmation } = req.body;

  if (confirmation !== true) {
    return res.status(400).json({ success: false, message: 'Explicit confirmation payload required' });
  }

  try {
    const result = await approveSettlement({
      settlementId: id,
      adminId: req.user.id,
      role: req.user.adminRole || req.user.role || 'FINANCE_ADMIN',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      dbInstance: getDb()
    });

    return res.status(200).json({
      success: true,
      message: 'Dual-approval completed. Settlement approved for payout processing',
      result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/settlements/:id/reject
 */
router.post('/:id/reject', requireAuth, requirePermission(PERMISSIONS.SETTLEMENT_REJECT), financialMutationLimiter, requireIdempotency, async (req, res) => {
  const { id } = req.params;
  const { reason, confirmation } = req.body;

  if (confirmation !== true) {
    return res.status(400).json({ success: false, message: 'Explicit confirmation payload required' });
  }

  const db = getDb();
  const settlements = db.collection('settlements');
  const earnings = db.collection('garage_earnings');
  const now = new Date();

  try {
    const sId = safeObjectId(id);
    const settlement = sId ? await settlements.findOne({ _id: sId }) : await settlements.findOne({ settlementId: id });

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    if (normalizeSettlementStatus(settlement.status) === SETTLEMENT_STATUS.SETTLED) {
      return res.status(400).json({ success: false, message: 'Cannot reject an already settled settlement' });
    }

    await transitionSettlement({
      collection: settlements,
      settlement,
      to: SETTLEMENT_STATUS.REJECTED,
      set: {
        failureReason: reason || 'Rejected by finance admin',
        rejectedBy: String(req.user.id),
        rejectedAt: now
      }
    });

    // Unlock linked earnings back to AVAILABLE
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
      actorId: String(req.user.id),
      actorRole: req.user.adminRole || req.user.role || 'ADMIN',
      garageId: settlement.garageId,
      settlementId: settlement.settlementId,
      action: 'SETTLEMENT_REJECTED',
      resourceType: 'SETTLEMENT',
      resourceId: String(settlement._id),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterState: { status: SETTLEMENT_STATUS.REJECTED, reason },
      dbInstance: db
    });

    return res.status(200).json({
      success: true,
      message: `Settlement ${settlement.settlementId} rejected and earnings unlocked.`
    });
  } catch (err) {
    if (err.code && err.status) return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    return res.status(500).json({ success: false, message: 'Error rejecting settlement' });
  }
});

/**
 * POST /api/admin/settlements/:id/hold
 */
router.post('/:id/hold', requireAuth, requirePermission(PERMISSIONS.SETTLEMENT_HOLD), financialMutationLimiter, async (req, res) => {
  const { id } = req.params;
  const { reason, note, confirmation } = req.body;

  if (confirmation !== true) {
    return res.status(400).json({ success: false, message: 'Explicit confirmation payload required' });
  }

  try {
    const result = await placeSettlementHold({
      settlementId: id,
      reason,
      note,
      adminId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      dbInstance: getDb()
    });

    return res.status(200).json({ success: true, message: 'Settlement hold placed successfully', result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/settlements/:id/release-hold
 */
router.post('/:id/release-hold', requireAuth, requirePermission(PERMISSIONS.SETTLEMENT_HOLD), financialMutationLimiter, async (req, res) => {
  const { id } = req.params;
  const { holdId, releaseNote, confirmation } = req.body;

  if (confirmation !== true) {
    return res.status(400).json({ success: false, message: 'Explicit confirmation payload required' });
  }

  try {
    const result = await releaseSettlementHold({
      settlementId: id,
      holdId,
      releaseNote,
      adminId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      dbInstance: getDb()
    });

    return res.status(200).json({ success: true, message: 'Settlement hold released successfully', result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/settlements/:id/process
 */
router.post('/:id/process', requireAuth, requirePermission(PERMISSIONS.SETTLEMENT_PROCESS), financialMutationLimiter, requireIdempotency, async (req, res) => {
  const { id } = req.params;
  const { confirmation, simulationMode } = req.body;

  if (confirmation !== true) {
    return res.status(400).json({ success: false, message: 'Explicit confirmation payload required' });
  }

  const db = getDb();
  const settlements = db.collection('settlements');
  const earnings = db.collection('garage_earnings');
  const payoutProfiles = db.collection('garage_payout_profiles');
  const holds = db.collection('settlement_holds');

  try {
    const sId = safeObjectId(id);
    const settlement = sId ? await settlements.findOne({ _id: sId }) : await settlements.findOne({ settlementId: id });

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    if (normalizeSettlementStatus(settlement.status) === SETTLEMENT_STATUS.SETTLED) {
      return res.status(400).json({ success: false, message: 'Settlement has already been settled' });
    }

    // 1. Check Holds
    const activeHold = await holds.findOne({
      $or: [{ settlementId: settlement.settlementId }, { garageId: settlement.garageId }],
      active: true
    });
    if (activeHold) {
      return res.status(400).json({
        success: false,
        message: `Cannot process payout: Active settlement hold present (${activeHold.reason})`
      });
    }

    // 2. Check Approvals
    const reqApprovals = settlement.requiredApprovalCount || 1;
    const currentApprovals = settlement.approvalCount || (settlement.approvals ? settlement.approvals.length : 0);
    if (currentApprovals < reqApprovals && settlement.status !== SETTLEMENT_STATUS.APPROVED) {
      return res.status(400).json({
        success: false,
        message: `Settlement requires ${reqApprovals} approval(s) prior to payout processing (Current: ${currentApprovals})`
      });
    }

    const now = new Date();
    const payoutProfile = await payoutProfiles.findOne({ garageId: String(settlement.garageId) });
    const provider = getSettlementProvider();

    // Claim the settlement (APPROVED|RETRY_PENDING -> PROCESSING) BEFORE calling the provider.
    // The compare-and-swap guarantees only one operator/request can ever trigger this payout.
    const processing = await transitionSettlement({
      collection: settlements,
      settlement,
      to: SETTLEMENT_STATUS.PROCESSING,
      set: { processingStartedBy: String(req.user.id), processingStartedAt: now }
    });

    // Call Provider Abstraction
    let result;
    try {
      result = await provider.processSettlement({
        settlement: processing,
        payoutProfile,
        simulationMode
      });
    } catch (providerErr) {
      result = { success: false, failureReason: providerErr.message, failureCode: 'PROVIDER_EXCEPTION', isTemporary: true };
    }

    if (result.success) {
      await transitionSettlement({
        collection: settlements,
        settlement: processing,
        to: SETTLEMENT_STATUS.SETTLED,
        set: {
          transferId: result.transferId,
          providerTransactionId: result.providerTransactionId,
          providerReference: result.providerReference,
          provider: result.provider,
          providerMessage: result.message,
          processedBy: String(req.user.id),
          processedAt: now,
          settledAt: now,
          completedAt: now
        }
      });

      // Transition linked earnings to SETTLED
      if (settlement.earningsIds && settlement.earningsIds.length > 0) {
        const eObjectIds = settlement.earningsIds.map(eid => safeObjectId(eid)).filter(Boolean);
        await earnings.updateMany(
          { _id: { $in: eObjectIds } },
          {
            $set: {
              status: 'SETTLED',
              settledAt: now,
              updatedAt: now
            }
          }
        );
      }

      await logFinancialAudit({
        actorId: String(req.user.id),
        actorRole: req.user.adminRole || req.user.role || 'ADMIN',
        garageId: settlement.garageId,
        settlementId: settlement.settlementId,
        action: 'SETTLEMENT_SETTLED',
        resourceType: 'SETTLEMENT',
        resourceId: String(settlement._id),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        afterState: {
          status: SETTLEMENT_STATUS.SETTLED,
          transferId: result.transferId
        },
        dbInstance: db
      });

      return res.status(200).json({
        success: true,
        message: 'Settlement payout processed successfully (MOCK_TEST_MODE).',
        settlement: {
          settlementId: settlement.settlementId,
          status: SETTLEMENT_STATUS.SETTLED,
          transferId: result.transferId
        }
      });
    } else {
      // Failure Handling via Retry Engine
      const retryResult = await scheduleSettlementRetry({
        settlementId: settlement.settlementId,
        failureReason: result.failureReason,
        failureCode: result.failureCode,
        dbInstance: db
      });

      return res.status(400).json({
        success: false,
        message: result.failureReason || 'Settlement payout failed at gateway',
        retryResult
      });
    }
  } catch (err) {
    if (err.code && err.status) return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    console.error('Error executing settlement payout:', err);
    return res.status(500).json({ success: false, message: 'Payout execution error' });
  }
});

/**
 * POST /api/admin/settlements/:id/retry
 */
router.post('/:id/retry', requireAuth, requirePermission(PERMISSIONS.SETTLEMENT_RETRY), financialMutationLimiter, async (req, res) => {
  const { id } = req.params;

  try {
    const retryResult = await scheduleSettlementRetry({
      settlementId: id,
      failureReason: 'Manual admin retry initiated',
      failureCode: 'MANUAL_RETRY',
      dbInstance: getDb()
    });

    return res.status(200).json({
      success: true,
      message: 'Settlement retry scheduled successfully',
      retryResult
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/settlements/:id/audit
 */
router.get('/:id/audit', requireAuth, requirePermission(PERMISSIONS.SETTLEMENT_READ), async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const auditLogs = db.collection('financial_audit_logs');
  const settlements = db.collection('settlements');

  try {
    const sId = safeObjectId(id);
    const settlement = sId ? await settlements.findOne({ _id: sId }) : await settlements.findOne({ settlementId: id });

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    const logs = await auditLogs
      .find({
        $or: [
          { settlementId: settlement.settlementId },
          { resourceId: String(settlement._id) }
        ]
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({ success: true, auditLogs: logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error fetching settlement audit' });
  }
});

module.exports = router;
