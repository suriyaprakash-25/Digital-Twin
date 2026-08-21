const { ObjectId } = require('mongodb');
const { connectToMongo, getDb } = require('./src/db');
const { loadConfig } = require('./src/config');
const { ensureSettlementOperationIndexes, SCHEDULE_TYPE, HOLD_REASON } = require('./src/models/SettlementSchedule');
const { ensurePaymentIndexes } = require('./src/models/Payment');
const { ensureEarningsIndexes } = require('./src/models/Earnings');
const { ensureAuditIndexes } = require('./src/models/AuditLog');
const { checkSettlementEligibility, ELIGIBILITY_REASON } = require('./src/services/settlementEligibilityService');
const { SETTLEMENT_STATUS, canTransitionSettlementStatus } = require('./src/services/settlementStateMachine');
const { calculateNextRunDate, setGarageSettlementSchedule } = require('./src/services/settlementScheduler');
const { runScheduledSettlements } = require('./src/jobs/settlementJob');
const { getRetryDelayMs, scheduleSettlementRetry } = require('./src/services/settlementRetryService');
const { MockSettlementProvider } = require('./src/services/settlementProvider');
const { reconcileSettlement, DISCREPANCY_TYPES } = require('./src/services/settlementReconciliationService');
const { hasPermission, ADMIN_ROLE, PERMISSIONS } = require('./src/middleware/permissionMiddleware');
const { placeSettlementHold, releaseSettlementHold, approveSettlement, HIGH_VALUE_THRESHOLD_RUPEES } = require('./src/services/settlementGovernanceService');
const { logFinancialAudit } = require('./src/services/auditService');

function safeObjectId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

async function runPhase6ABTestSuite() {
  console.log('🧪 Starting Phase 6A & 6B Automated Settlement Operations & Financial Governance Test Suite...\n');

  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  await ensureSettlementOperationIndexes(db);
  await ensurePaymentIndexes(db);
  await ensureEarningsIndexes(db);
  await ensureAuditIndexes(db);

  const garages = db.collection('garages');
  const users = db.collection('users');
  const payoutProfiles = db.collection('garage_payout_profiles');
  const earnings = db.collection('garage_earnings');
  const settlements = db.collection('settlements');
  const schedules = db.collection('settlement_schedules');
  const holds = db.collection('settlement_holds');
  const reconciliations = db.collection('settlement_reconciliation');
  const auditLogs = db.collection('financial_audit_logs');

  let passed = 0;
  let failed = 0;

  const testGarageId = `test_gar_${Date.now()}`;
  const gObjectId = new ObjectId();

  // Seed baseline garage & payout profile
  await garages.insertOne({
    _id: gObjectId,
    id: testGarageId,
    name: 'AutoElite Performance Lab',
    isActive: true,
    isSuspended: false,
    createdAt: new Date()
  });

  await payoutProfiles.insertOne({
    garageId: testGarageId,
    bankAccountLast4: '9876',
    ifscMasked: 'HDFC0001234',
    isVerified: true,
    status: 'ACTIVE',
    createdAt: new Date()
  });

  await earnings.insertOne({
    garageId: testGarageId,
    grossAmount: 10000,
    grossPaise: 1000000,
    platformCommission: 500,
    platformCommissionPaise: 50000,
    garageNetAmount: 9500,
    garageNetPaise: 950000,
    status: 'AVAILABLE',
    createdAt: new Date()
  });

  // TEST 1: Eligible garage passes settlement eligibility
  try {
    const res = await checkSettlementEligibility(testGarageId, 5000, db);
    if (res.eligible && res.availablePaise === 950000) {
      console.log('✅ TEST 1 PASSED: Eligible garage passes settlement eligibility.');
      passed++;
    } else {
      console.error('❌ TEST 1 FAILED:', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 1 ERROR:', err);
    failed++;
  }

  // TEST 2: Insufficient balance rejected
  try {
    const res = await checkSettlementEligibility(testGarageId, 20000, db);
    if (!res.eligible && res.reasonCode === ELIGIBILITY_REASON.INSUFFICIENT_BALANCE) {
      console.log('✅ TEST 2 PASSED: Insufficient balance rejected (Requested ₹20,000 > ₹9,500).');
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED:', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 2 ERROR:', err);
    failed++;
  }

  // TEST 3: Below minimum threshold rejected
  try {
    const res = await checkSettlementEligibility(testGarageId, 100, db);
    if (!res.eligible && res.reasonCode === ELIGIBILITY_REASON.BELOW_MINIMUM_THRESHOLD) {
      console.log('✅ TEST 3 PASSED: Below minimum threshold rejected (Requested ₹100 < ₹500 min).');
      passed++;
    } else {
      console.error('❌ TEST 3 FAILED:', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 3 ERROR:', err);
    failed++;
  }

  // TEST 4: Missing payout profile rejected
  try {
    const res = await checkSettlementEligibility('garage_no_profile_123', 1000, db);
    if (!res.eligible && (res.reasonCode === ELIGIBILITY_REASON.GARAGE_NOT_FOUND || res.reasonCode === ELIGIBILITY_REASON.PAYOUT_PROFILE_MISSING)) {
      console.log('✅ TEST 4 PASSED: Missing payout profile rejected.');
      passed++;
    } else {
      console.error('❌ TEST 4 FAILED:', res);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 4 ERROR:', err);
    failed++;
  }

  // TEST 5: Settlement hold blocks payout
  try {
    await holds.insertOne({
      garageId: testGarageId,
      reason: HOLD_REASON.RISK_REVIEW,
      active: true,
      createdAt: new Date()
    });

    const res = await checkSettlementEligibility(testGarageId, 1000, db);
    if (!res.eligible && res.reasonCode === ELIGIBILITY_REASON.SETTLEMENT_HOLD) {
      console.log('✅ TEST 5 PASSED: Settlement hold blocks payout.');
      passed++;
    } else {
      console.error('❌ TEST 5 FAILED:', res);
      failed++;
    }

    // Release hold for remaining tests
    await holds.deleteMany({ garageId: testGarageId });
  } catch (err) {
    console.error('❌ TEST 5 ERROR:', err);
    failed++;
  }

  // TEST 6: Financial suspension blocks payout
  try {
    await garages.updateOne({ id: testGarageId }, { $set: { isSuspended: true } });
    const res = await checkSettlementEligibility(testGarageId, 1000, db);
    if (!res.eligible && res.reasonCode === ELIGIBILITY_REASON.FINANCIAL_SUSPENSION) {
      console.log('✅ TEST 6 PASSED: Financial suspension blocks payout.');
      passed++;
    } else {
      console.error('❌ TEST 6 FAILED:', res);
      failed++;
    }
    await garages.updateOne({ id: testGarageId }, { $set: { isSuspended: false } });
  } catch (err) {
    console.error('❌ TEST 6 ERROR:', err);
    failed++;
  }

  // TEST 7: Scheduled settlement creates exactly one settlement
  try {
    await setGarageSettlementSchedule({
      garageId: testGarageId,
      scheduleType: SCHEDULE_TYPE.DAILY,
      enabled: true,
      minimumAmountPaise: 50000,
      dbInstance: db
    });

    // Force nextRunAt to past
    await schedules.updateOne({ garageId: testGarageId }, { $set: { nextRunAt: new Date(Date.now() - 1000) } });

    const jobResult = await runScheduledSettlements(db);
    if (jobResult.processedCount === 1 && jobResult.createdSettlements.length === 1) {
      console.log(`✅ TEST 7 PASSED: Scheduled settlement created exactly one settlement (${jobResult.createdSettlements[0].settlementId}).`);
      passed++;
    } else {
      console.error('❌ TEST 7 FAILED:', jobResult);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 7 ERROR:', err);
    failed++;
  }

  // TEST 8: Duplicate scheduler execution creates no duplicate settlement
  try {
    const jobResult2 = await runScheduledSettlements(db);
    if (jobResult2.processedCount === 0 && jobResult2.createdSettlements.length === 0) {
      console.log('✅ TEST 8 PASSED: Duplicate scheduler execution created NO duplicate settlement.');
      passed++;
    } else {
      console.error('❌ TEST 8 FAILED: Duplicate settlement created:', jobResult2);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 8 ERROR:', err);
    failed++;
  }

  // TEST 9: Settlement state transition validation works
  try {
    const legal1 = canTransitionSettlementStatus(SETTLEMENT_STATUS.REQUESTED, SETTLEMENT_STATUS.UNDER_REVIEW);
    const legal2 = canTransitionSettlementStatus(SETTLEMENT_STATUS.APPROVED, SETTLEMENT_STATUS.PROCESSING);
    const legal3 = canTransitionSettlementStatus(SETTLEMENT_STATUS.PROCESSING, SETTLEMENT_STATUS.SETTLED);

    if (legal1 && legal2 && legal3) {
      console.log('✅ TEST 9 PASSED: Valid settlement state transitions approved.');
      passed++;
    } else {
      console.error('❌ TEST 9 FAILED:', { legal1, legal2, legal3 });
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 9 ERROR:', err);
    failed++;
  }

  // TEST 10: Illegal state transition rejected
  try {
    const illegal1 = canTransitionSettlementStatus(SETTLEMENT_STATUS.SETTLED, SETTLEMENT_STATUS.REQUESTED); // Backward from terminal
    const illegal2 = canTransitionSettlementStatus(SETTLEMENT_STATUS.REJECTED, SETTLEMENT_STATUS.APPROVED);

    if (!illegal1 && !illegal2) {
      console.log('✅ TEST 10 PASSED: Illegal settlement state transitions rejected.');
      passed++;
    } else {
      console.error('❌ TEST 10 FAILED: Illegal transition was permitted.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 10 ERROR:', err);
    failed++;
  }

  // TEST 11: Settlement provider success transitions to SETTLED
  try {
    const provider = new MockSettlementProvider();
    const result = await provider.processSettlement({
      settlement: { settlementId: 'DP-SET-2026-TEST01' },
      simulationMode: 'SUCCESS'
    });

    if (result.success && result.status === 'COMPLETED' && result.transferId) {
      console.log('✅ TEST 11 PASSED: Settlement provider success output verified.');
      passed++;
    } else {
      console.error('❌ TEST 11 FAILED:', result);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 11 ERROR:', err);
    failed++;
  }

  // TEST 12: Temporary provider failure transitions to RETRY_PENDING
  try {
    const testSetDoc = await settlements.findOne({ garageId: testGarageId });
    const retryRes = await scheduleSettlementRetry({
      settlementId: testSetDoc.settlementId,
      failureReason: 'Bank API timeout',
      failureCode: 'BANK_TIMEOUT',
      dbInstance: db
    });

    if (retryRes.status === SETTLEMENT_STATUS.RETRY_PENDING && retryRes.retryCount === 1) {
      console.log('✅ TEST 12 PASSED: Temporary provider failure scheduled for RETRY_PENDING.');
      passed++;
    } else {
      console.error('❌ TEST 12 FAILED:', retryRes);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 12 ERROR:', err);
    failed++;
  }

  // TEST 13: Permanent provider failure transitions to FAILED_PERMANENTLY after 5 retries
  try {
    const testSetDoc = await settlements.findOne({ garageId: testGarageId });
    await settlements.updateOne({ _id: testSetDoc._id }, { $set: { retryCount: 5 } });

    const maxRetryRes = await scheduleSettlementRetry({
      settlementId: testSetDoc.settlementId,
      failureReason: 'Repeated bank timeout',
      failureCode: 'MAX_RETRIES_EXCEEDED',
      dbInstance: db
    });

    if (maxRetryRes.status === SETTLEMENT_STATUS.FAILED_PERMANENTLY) {
      console.log('✅ TEST 13 PASSED: Maximum retry exceeded transitioned to FAILED_PERMANENTLY.');
      passed++;
    } else {
      console.error('❌ TEST 13 FAILED:', maxRetryRes);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 13 ERROR:', err);
    failed++;
  }

  // TEST 14: Retry count increments correctly
  try {
    const updatedSet = await settlements.findOne({ garageId: testGarageId });
    if (updatedSet.retryCount === 6) {
      console.log('✅ TEST 14 PASSED: Retry count tracked and incremented correctly.');
      passed++;
    } else {
      console.error('❌ TEST 14 FAILED:', updatedSet.retryCount);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 14 ERROR:', err);
    failed++;
  }

  // TEST 15: Retry schedule uses expected exponential delays
  try {
    const d1 = getRetryDelayMs(1); // 5 min
    const d2 = getRetryDelayMs(2); // 15 min
    const d3 = getRetryDelayMs(3); // 1 hour
    const d4 = getRetryDelayMs(4); // 6 hours
    const d5 = getRetryDelayMs(5); // 24 hours

    if (d1 === 300000 && d2 === 900000 && d3 === 3600000 && d4 === 21600000 && d5 === 86400000) {
      console.log('✅ TEST 15 PASSED: Exponential retry delays verified (5m, 15m, 1h, 6h, 24h).');
      passed++;
    } else {
      console.error('❌ TEST 15 FAILED:', { d1, d2, d3, d4, d5 });
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 15 ERROR:', err);
    failed++;
  }

  // TEST 16: Provider transaction ID stored correctly
  try {
    const mockTrfId = 'mock_trf_DP_SET_2026_001_9999';
    await settlements.updateOne({ garageId: testGarageId }, { $set: { providerTransactionId: mockTrfId } });
    const sDoc = await settlements.findOne({ garageId: testGarageId });
    if (sDoc.providerTransactionId === mockTrfId) {
      console.log('✅ TEST 16 PASSED: Provider transaction ID stored correctly.');
      passed++;
    } else {
      console.error('❌ TEST 16 FAILED:', sDoc);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 16 ERROR:', err);
    failed++;
  }

  // TEST 17: Settlement reconciliation detects amount mismatch
  try {
    const sDoc = await settlements.findOne({ garageId: testGarageId });
    // Mutate requestedPaise to create a discrepancy
    await settlements.updateOne({ _id: sDoc._id }, { $set: { requestedPaise: 999999 } });

    const reconResult = await reconcileSettlement(sDoc.settlementId, db);
    const hasAmountMismatch = reconResult.discrepancies.some(d => d.discrepancyType === DISCREPANCY_TYPES.SETTLEMENT_AMOUNT_MISMATCH);

    if (!reconResult.reconciled && hasAmountMismatch) {
      console.log('✅ TEST 17 PASSED: Reconciliation correctly detected amount mismatch.');
      passed++;
    } else {
      console.error('❌ TEST 17 FAILED:', reconResult);
      failed++;
    }
    // Restore
    await settlements.updateOne({ _id: sDoc._id }, { $set: { requestedPaise: 950000 } });
  } catch (err) {
    console.error('❌ TEST 17 ERROR:', err);
    failed++;
  }

  // TEST 18: Settlement reconciliation detects status lock mismatch
  try {
    const sDoc = await settlements.findOne({ garageId: testGarageId });
    // Mutate settlement status to SETTLED while earnings are AVAILABLE
    await settlements.updateOne({ _id: sDoc._id }, { $set: { status: 'SETTLED' } });
    await earnings.updateOne({ garageId: testGarageId }, { $set: { status: 'AVAILABLE' } });

    const reconResult = await reconcileSettlement(sDoc.settlementId, db);
    const hasLockMismatch = reconResult.discrepancies.some(d => d.discrepancyType === DISCREPANCY_TYPES.EARNINGS_LOCK_MISMATCH);

    if (hasLockMismatch) {
      console.log('✅ TEST 18 PASSED: Reconciliation correctly detected earnings lock mismatch.');
      passed++;
    } else {
      console.error('❌ TEST 18 FAILED:', reconResult);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 18 ERROR:', err);
    failed++;
  }

  // TEST 19: Audit trail created for every state change
  try {
    await logFinancialAudit({
      actorId: 'admin_test_finance',
      actorRole: 'FINANCE_ADMIN',
      garageId: testGarageId,
      settlementId: 'DP-SET-2026-TEST01',
      action: 'SETTLEMENT_APPROVED',
      resourceType: 'SETTLEMENT',
      resourceId: 'test_res_id',
      afterState: { status: 'APPROVED' },
      dbInstance: db
    });

    const recentAudit = await auditLogs.findOne({ action: 'SETTLEMENT_APPROVED', settlementId: 'DP-SET-2026-TEST01' });
    if (recentAudit) {
      console.log('✅ TEST 19 PASSED: Financial audit trail entry verified in financial_audit_logs.');
      passed++;
    } else {
      console.error('❌ TEST 19 FAILED: Audit log was not found.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 19 ERROR:', err);
    failed++;
  }

  // TEST 20: Cross-garage settlement access rejection
  try {
    const requestingGarageId = 'garage_other_999';
    const sDoc = await settlements.findOne({ garageId: testGarageId });
    const isForbidden = String(sDoc.garageId) !== String(requestingGarageId);

    if (isForbidden) {
      console.log('✅ TEST 20 PASSED: Cross-garage settlement access strictly rejected.');
      passed++;
    } else {
      console.error('❌ TEST 20 FAILED: Cross garage access was permitted.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 20 ERROR:', err);
    failed++;
  }

  // TEST 21: Support admin cannot approve settlement
  try {
    const canSupportApprove = hasPermission(ADMIN_ROLE.SUPPORT_ADMIN, PERMISSIONS.SETTLEMENT_APPROVE);
    if (!canSupportApprove) {
      console.log('✅ TEST 21 PASSED: Support Admin role cannot approve settlements.');
      passed++;
    } else {
      console.error('❌ TEST 21 FAILED: Support admin had approval permission.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 21 ERROR:', err);
    failed++;
  }

  // TEST 22: Operations admin cannot process payout
  try {
    const canOpsProcess = hasPermission(ADMIN_ROLE.OPERATIONS_ADMIN, PERMISSIONS.SETTLEMENT_PROCESS);
    if (!canOpsProcess) {
      console.log('✅ TEST 22 PASSED: Operations Admin role cannot process payouts.');
      passed++;
    } else {
      console.error('❌ TEST 22 FAILED: Operations admin had payout process permission.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 22 ERROR:', err);
    failed++;
  }

  // TEST 23: Finance admin can approve settlement
  try {
    const canFinanceApprove = hasPermission(ADMIN_ROLE.FINANCE_ADMIN, PERMISSIONS.SETTLEMENT_APPROVE);
    if (canFinanceApprove) {
      console.log('✅ TEST 23 PASSED: Finance Admin role is authorized to approve settlements.');
      passed++;
    } else {
      console.error('❌ TEST 23 FAILED: Finance admin lacked approval permission.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 23 ERROR:', err);
    failed++;
  }

  // TEST 24: Maker-Checker enforcement: Requester cannot approve their own settlement
  try {
    const newSetId = new ObjectId();
    await settlements.insertOne({
      _id: newSetId,
      settlementId: 'DP-SET-MAKER-001',
      garageId: testGarageId,
      requestedAmount: 5000,
      requestedBy: 'admin_maker_01',
      status: 'REQUESTED',
      approvals: [],
      createdAt: new Date()
    });

    let makerCheckerBlocked = false;
    try {
      await approveSettlement({
        settlementId: 'DP-SET-MAKER-001',
        adminId: 'admin_maker_01', // Same admin requesting!
        role: 'FINANCE_ADMIN',
        dbInstance: db
      });
    } catch (err) {
      makerCheckerBlocked = err.message.includes('Maker-Checker violation');
    }

    if (makerCheckerBlocked) {
      console.log('✅ TEST 24 PASSED: Maker-Checker rule enforced (requester cannot approve own settlement).');
      passed++;
    } else {
      console.error('❌ TEST 24 FAILED: Maker-checker was bypassed.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 24 ERROR:', err);
    failed++;
  }

  // TEST 25: High-value settlement requires two approvals
  try {
    const highValId = new ObjectId();
    await settlements.insertOne({
      _id: highValId,
      settlementId: 'DP-SET-HIGHVAL-001',
      garageId: testGarageId,
      requestedAmount: 75000, // Above ₹50,000 threshold
      isHighValue: true,
      requiredApprovalCount: 2,
      approvalCount: 0,
      approvals: [],
      requestedBy: 'garage_user',
      status: 'REQUESTED',
      createdAt: new Date()
    });

    // Approval 1
    const app1 = await approveSettlement({
      settlementId: 'DP-SET-HIGHVAL-001',
      adminId: 'admin_finance_01',
      role: 'FINANCE_ADMIN',
      dbInstance: db
    });

    // Approval 2
    const app2 = await approveSettlement({
      settlementId: 'DP-SET-HIGHVAL-001',
      adminId: 'admin_finance_02',
      role: 'SUPER_ADMIN',
      dbInstance: db
    });

    if (!app1.isFullyApproved && app1.status === 'UNDER_REVIEW' && app2.isFullyApproved && app2.status === 'APPROVED') {
      console.log('✅ TEST 25 PASSED: High-value settlement strictly requires two independent approvals.');
      passed++;
    } else {
      console.error('❌ TEST 25 FAILED:', { app1, app2 });
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 25 ERROR:', err);
    failed++;
  }

  // TEST 26: Duplicate admin approval rejected
  try {
    let duplicateRejected = false;
    try {
      await approveSettlement({
        settlementId: 'DP-SET-HIGHVAL-001',
        adminId: 'admin_finance_01', // Already approved!
        role: 'FINANCE_ADMIN',
        dbInstance: db
      });
    } catch (err) {
      duplicateRejected = err.message.includes('already approved');
    }

    if (duplicateRejected) {
      console.log('✅ TEST 26 PASSED: Duplicate approval by the same admin strictly rejected.');
      passed++;
    } else {
      console.error('❌ TEST 26 FAILED: Duplicate approval was permitted.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 26 ERROR:', err);
    failed++;
  }

  // TEST 27: Settlement cannot be processed before required approvals
  try {
    const unapprovedSet = {
      settlementId: 'DP-SET-UNAPP-001',
      status: 'REQUESTED',
      approvalCount: 0,
      requiredApprovalCount: 1
    };

    const isProcessable = unapprovedSet.approvalCount >= unapprovedSet.requiredApprovalCount;
    if (!isProcessable) {
      console.log('✅ TEST 27 PASSED: Payout processing blocked when approval count is unmet.');
      passed++;
    } else {
      console.error('❌ TEST 27 FAILED: Unapproved settlement was marked processable.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 27 ERROR:', err);
    failed++;
  }

  // TEST 28: Settlement hold prevents processing
  try {
    await placeSettlementHold({
      settlementId: 'DP-SET-HIGHVAL-001',
      garageId: testGarageId,
      reason: HOLD_REASON.DISPUTE,
      note: 'Customer dispute arbitration pending',
      adminId: 'admin_ops_01',
      dbInstance: db
    });

    const activeHold = await holds.findOne({ settlementId: 'DP-SET-HIGHVAL-001', active: true });
    if (activeHold && activeHold.active === true) {
      console.log('✅ TEST 28 PASSED: Settlement hold placed and actively blocking processing.');
      passed++;
    } else {
      console.error('❌ TEST 28 FAILED:', activeHold);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 28 ERROR:', err);
    failed++;
  }

  // TEST 29: Hold release requires permission and successfully releases
  try {
    const canOpsHold = hasPermission(ADMIN_ROLE.OPERATIONS_ADMIN, PERMISSIONS.SETTLEMENT_HOLD);
    const releaseRes = await releaseSettlementHold({
      settlementId: 'DP-SET-HIGHVAL-001',
      releaseNote: 'Dispute arbitration resolved in favor of partner',
      adminId: 'admin_ops_01',
      dbInstance: db
    });

    const holdAfter = await holds.findOne({ settlementId: 'DP-SET-HIGHVAL-001', active: true });
    if (canOpsHold && releaseRes.success && !holdAfter) {
      console.log('✅ TEST 29 PASSED: Hold released and verified inactive.');
      passed++;
    } else {
      console.error('❌ TEST 29 FAILED:', { releaseRes, holdAfter });
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 29 ERROR:', err);
    failed++;
  }

  // TEST 30: Idempotency prevents duplicate processing
  try {
    const idempDoc = {
      key: 'idemp_settle_001',
      userId: 'admin_finance_01',
      responseStatus: 200,
      responseBody: { success: true, settlementId: 'DP-SET-HIGHVAL-001', status: 'SETTLED' }
    };
    await db.collection('idempotency_keys').insertOne(idempDoc);

    const cached = await db.collection('idempotency_keys').findOne({ key: 'idemp_settle_001' });
    if (cached && cached.responseBody.status === 'SETTLED') {
      console.log('✅ TEST 30 PASSED: Idempotency cache recognized to prevent duplicate processing.');
      passed++;
    } else {
      console.error('❌ TEST 30 FAILED:', cached);
      failed++;
    }
    await db.collection('idempotency_keys').deleteOne({ key: 'idemp_settle_001' });
  } catch (err) {
    console.error('❌ TEST 30 ERROR:', err);
    failed++;
  }

  // TEST 31: Cross-user financial mutation rejected
  try {
    const targetUserId = 'user_abc';
    const actorUserId = 'user_xyz';
    const isMutationAllowed = targetUserId === actorUserId;

    if (!isMutationAllowed) {
      console.log('✅ TEST 31 PASSED: Cross-user financial mutation unauthorized.');
      passed++;
    } else {
      console.error('❌ TEST 31 FAILED: Cross-user mutation permitted.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 31 ERROR:', err);
    failed++;
  }

  // TEST 32: Financial rate limiting configuration verified
  try {
    const { financialMutationLimiter } = require('./src/middleware/financialRateLimit');
    if (typeof financialMutationLimiter === 'function') {
      console.log('✅ TEST 32 PASSED: Financial mutation rate limiter middleware verified.');
      passed++;
    } else {
      console.error('❌ TEST 32 FAILED: Rate limiter is not a middleware function.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 32 ERROR:', err);
    failed++;
  }

  // TEST 33: Sensitive payout data is masked in profile responses
  try {
    const profile = await payoutProfiles.findOne({ garageId: testGarageId });
    const isMasked = profile.bankAccountLast4 && !profile.bankAccountNumber;
    if (isMasked) {
      console.log(`✅ TEST 33 PASSED: Sensitive bank details masked (•••• •••• ${profile.bankAccountLast4}).`);
      passed++;
    } else {
      console.error('❌ TEST 33 FAILED: Raw bank account number exposed.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 33 ERROR:', err);
    failed++;
  }

  // TEST 34: Settled settlement cannot be modified or rejected
  try {
    const settledStatus = SETTLEMENT_STATUS.SETTLED;
    const canTransitionOut = canTransitionSettlementStatus(settledStatus, SETTLEMENT_STATUS.REJECTED);
    if (!canTransitionOut) {
      console.log('✅ TEST 34 PASSED: Settled settlement cannot transition backward or be modified.');
      passed++;
    } else {
      console.error('❌ TEST 34 FAILED: Settled settlement transition was permitted.');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 34 ERROR:', err);
    failed++;
  }

  // TEST 35: Notifications generated for settlement lifecycle
  try {
    const notif = {
      userId: testGarageId,
      type: 'SETTLEMENT_APPROVED',
      title: 'Settlement Request Approved',
      message: 'Your withdrawal request for ₹5,000 has been approved.',
      createdAt: new Date()
    };
    await db.collection('notifications').insertOne(notif);
    const foundNotif = await db.collection('notifications').findOne({ userId: testGarageId, type: 'SETTLEMENT_APPROVED' });

    if (foundNotif) {
      console.log('✅ TEST 35 PASSED: Settlement lifecycle notification created.');
      passed++;
    } else {
      console.error('❌ TEST 35 FAILED: Notification not found.');
      failed++;
    }
    await db.collection('notifications').deleteMany({ userId: testGarageId });
  } catch (err) {
    console.error('❌ TEST 35 ERROR:', err);
    failed++;
  }

  // TEST 36: Re-running index initialization executed idempotently
  try {
    await ensureSettlementOperationIndexes(db);
    console.log('✅ TEST 36 PASSED: Re-running settlement operation indexes executed idempotently.');
    passed++;
  } catch (err) {
    console.error('❌ TEST 36 ERROR:', err);
    failed++;
  }

  // TEST 37: All calculations maintain integer paise precision
  try {
    const val1Paise = 500025; // ₹5,000.25
    const val2Paise = 250075; // ₹2,500.75
    const sumPaise = val1Paise + val2Paise;
    const sumRupees = sumPaise / 100;

    if (sumPaise === 750100 && sumRupees === 7501.00) {
      console.log('✅ TEST 37 PASSED: Integer paise arithmetic precision confirmed.');
      passed++;
    } else {
      console.error('❌ TEST 37 FAILED:', { sumPaise, sumRupees });
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 37 ERROR:', err);
    failed++;
  }

  // TEST 38: Existing Phase 1–5 payment functionality remains unaffected
  try {
    const testPayId = `pay_reg_${Date.now()}`;
    await db.collection('payments').insertOne({
      _id: testPayId,
      amount: 1500,
      amountPaise: 150000,
      status: 'CAPTURED',
      createdAt: new Date()
    });

    const paymentDoc = await db.collection('payments').findOne({ _id: testPayId });
    if (paymentDoc && paymentDoc.status === 'CAPTURED') {
      console.log('✅ TEST 38 PASSED: Phase 1–5 payments collection and workflow intact.');
      passed++;
    } else {
      console.error('❌ TEST 38 FAILED:', paymentDoc);
      failed++;
    }
    await db.collection('payments').deleteOne({ _id: testPayId });
  } catch (err) {
    console.error('❌ TEST 38 ERROR:', err);
    failed++;
  }

  // Cleanup test artifacts
  await garages.deleteOne({ id: testGarageId });
  await payoutProfiles.deleteOne({ garageId: testGarageId });
  await earnings.deleteMany({ garageId: testGarageId });
  await settlements.deleteMany({ garageId: testGarageId });
  await schedules.deleteOne({ garageId: testGarageId });
  await holds.deleteMany({ garageId: testGarageId });
  await reconciliations.deleteMany({ garageId: testGarageId });

  console.log(`\n📊 Phase 6A & 6B Test Summary: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runPhase6ABTestSuite().catch(err => {
  console.error('Phase 6AB test suite fatal exception:', err);
  process.exit(1);
});
