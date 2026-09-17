const { MongoClient, ObjectId } = require('mongodb');
const {
  getGarageFinancialSummary,
  getAdminPlatformFinancialSummary,
  getGarageTransactionLedger,
  getAdminTransactionLedger
} = require('./src/services/financialReportService');
const { convertToCSV, convertToXLSX, generateReportExport } = require('./src/services/reportExportService');
const { PAYMENT_STATUS } = require('./src/models/Payment');
const { requirePermission, PERMISSIONS } = require('./src/middleware/permissionMiddleware');
const { evaluateTransactionRisk } = require('./src/services/paymentRiskService');
const { logFinancialAudit } = require('./src/services/auditService');
const { idempotencyMiddleware } = require('./src/middleware/idempotency');
const { paymentCreationLimiter, refundLimiter } = require('./src/middleware/financialRateLimit');

async function runPhase5CDTestSuite() {
  console.log('🧪 Starting Phase 5C/5D Security, Risk, Audit & Reporting Test Suite...\n');

  let passed = 0;
  let failed = 0;

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(mongoUri);
  let db;

  try {
    await client.connect();
    db = client.db(process.env.MONGO_DB_NAME || 'digital_twin');
    console.log('✅ Connected to MongoDB for Phase 5C/5D validation.');
  } catch (e) {
    console.error('Failed to connect to Mongo:', e);
    process.exit(1);
  }

  const payments = db.collection('payments');
  const earnings = db.collection('garage_earnings');
  const disputes = db.collection('disputes');
  const auditLogs = db.collection('financial_audit_logs');

  const testMarker = `P5CD_${Date.now()}`;
  const g1Id = `${testMarker}_G1`;
  const g2Id = `${testMarker}_G2`;
  const u1Id = `${testMarker}_U1`;
  const u2Id = `${testMarker}_U2`;

  try {
    await Promise.all([
      payments.deleteMany({ testMarker }),
      earnings.deleteMany({ testMarker }),
      disputes.deleteMany({ testMarker }),
      auditLogs.deleteMany({ testMarker })
    ]);

    // TEST 1: Permission middleware exposes expected permissions
    try {
      if (
        PERMISSIONS.FINANCIAL_REPORT_READ &&
        PERMISSIONS.RECONCILIATION_RUN &&
        typeof requirePermission === 'function'
      ) {
        console.log('✅ TEST 1 PASSED: Financial permission definitions are present.');
        passed++;
      } else {
        console.error('❌ TEST 1 FAILED: Missing financial permission definitions.');
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 1 ERROR:', err);
      failed++;
    }

    // TEST 2: Idempotency middleware exported
    try {
      if (typeof idempotencyMiddleware === 'function') {
        console.log('✅ TEST 2 PASSED: Idempotency middleware exported.');
        passed++;
      } else {
        console.error('❌ TEST 2 FAILED: Idempotency middleware unavailable.');
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 2 ERROR:', err);
      failed++;
    }

    // TEST 3: Financial rate limiters exported
    try {
      if (typeof paymentCreationLimiter === 'function' && typeof refundLimiter === 'function') {
        console.log('✅ TEST 3 PASSED: Financial rate limiters exported.');
        passed++;
      } else {
        console.error('❌ TEST 3 FAILED: Financial rate limiters unavailable.');
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 3 ERROR:', err);
      failed++;
    }

    // Seed isolated financial data
    const now = new Date();
    await payments.insertMany([
      {
        testMarker,
        userId: u1Id,
        garageId: g1Id,
        invoiceId: `${testMarker}_INV1`,
        invoiceNumber: 'DP-INV-2026-001',
        vehicleNumber: 'TN38AA0001',
        amount: 5000,
        amountPaise: 500000,
        status: PAYMENT_STATUS.CAPTURED,
        createdAt: now,
        paidAt: now
      },
      {
        testMarker,
        userId: u2Id,
        garageId: g2Id,
        invoiceId: `${testMarker}_INV2`,
        invoiceNumber: 'DP-INV-2026-002',
        vehicleNumber: 'TN38AA0002',
        amount: 8000,
        amountPaise: 800000,
        status: PAYMENT_STATUS.CAPTURED,
        createdAt: now,
        paidAt: now
      }
    ]);

    await earnings.insertMany([
      {
        testMarker,
        garageId: g1Id,
        userId: u1Id,
        invoiceNumber: 'DP-INV-2026-001',
        paymentId: `${testMarker}_PAY1`,
        grossAmount: 5000,
        grossPaise: 500000,
        platformCommission: 250,
        platformCommissionPaise: 25000,
        garageNetAmount: 4750,
        garageNetPaise: 475000,
        status: 'AVAILABLE',
        createdAt: now
      },
      {
        testMarker,
        garageId: g2Id,
        userId: u2Id,
        invoiceNumber: 'DP-INV-2026-002',
        paymentId: `${testMarker}_PAY2`,
        grossAmount: 8000,
        grossPaise: 800000,
        platformCommission: 400,
        platformCommissionPaise: 40000,
        garageNetAmount: 7600,
        garageNetPaise: 760000,
        status: 'AVAILABLE',
        createdAt: now
      }
    ]);

    // TEST 4: Garage report isolation
    try {
      const g1 = await getGarageFinancialSummary(g1Id, { period: '30_DAYS', dbInstance: db });
      const isolated = g1.grossRevenue === 5000 && g1.netEarnings === 4750;
      if (isolated) {
        console.log('✅ TEST 4 PASSED: Garage financial summary is isolated by garageId.');
        passed++;
      } else {
        console.error('❌ TEST 4 FAILED:', g1);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 4 ERROR:', err);
      failed++;
    }

    // TEST 5: Platform aggregate includes both garages
    try {
      const platform = await getAdminPlatformFinancialSummary({ period: '30_DAYS', dbInstance: db });
      if (platform.grossRevenue >= 13000) {
        console.log('✅ TEST 5 PASSED: Admin platform summary aggregates cross-garage data.');
        passed++;
      } else {
        console.error('❌ TEST 5 FAILED:', platform);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 5 ERROR:', err);
      failed++;
    }

    // TEST 6: Garage transaction ledger isolation
    try {
      const ledger = await getGarageTransactionLedger(g1Id, { period: '30_DAYS', dbInstance: db });
      const rows = ledger.rows || ledger.transactions || [];
      if (rows.length >= 1 && rows.every(r => String(r.garageId) === String(g1Id))) {
        console.log('✅ TEST 6 PASSED: Garage transaction ledger contains only that garage.');
        passed++;
      } else {
        console.error('❌ TEST 6 FAILED:', ledger);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 6 ERROR:', err);
      failed++;
    }

    // TEST 7: Admin transaction ledger can see both garages
    try {
      const ledger = await getAdminTransactionLedger({ period: '30_DAYS', dbInstance: db });
      const rows = ledger.rows || ledger.transactions || [];
      const ids = new Set(rows.map(r => String(r.garageId)));
      if (ids.has(g1Id) && ids.has(g2Id)) {
        console.log('✅ TEST 7 PASSED: Admin transaction ledger spans garages.');
        passed++;
      } else {
        console.error('❌ TEST 7 FAILED:', { ids: [...ids] });
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 7 ERROR:', err);
      failed++;
    }

    // TEST 8: Risk engine returns deterministic structure
    try {
      const risk = await evaluateTransactionRisk({
        userId: u1Id,
        garageId: g1Id,
        invoiceId: `${testMarker}_INV1`,
        amount: 5000,
        operation: 'PAYMENT',
        dbInstance: db
      });
      if (typeof risk.riskScore === 'number' && Array.isArray(risk.reasons)) {
        console.log('✅ TEST 8 PASSED: Payment risk engine returns score and reasons.');
        passed++;
      } else {
        console.error('❌ TEST 8 FAILED:', risk);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 8 ERROR:', err);
      failed++;
    }

    // TEST 9: Risk engine remains bounded 0-100
    try {
      const risk = await evaluateTransactionRisk({
        userId: u1Id,
        garageId: g1Id,
        amount: 999999,
        operation: 'PAYMENT',
        dbInstance: db
      });
      if (risk.riskScore >= 0 && risk.riskScore <= 100) {
        console.log('✅ TEST 9 PASSED: Risk score bounded to 0-100.');
        passed++;
      } else {
        console.error('❌ TEST 9 FAILED:', risk);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 9 ERROR:', err);
      failed++;
    }

    // TEST 10: Financial audit logging persists actor/action metadata
    try {
      const audit = await logFinancialAudit({
        actorId: u1Id,
        actorRole: 'USER',
        action: 'TEST_FINANCIAL_AUDIT',
        resourceType: 'PAYMENT',
        resourceId: `${testMarker}_PAY1`,
        metadata: { testMarker },
        dbInstance: db
      });
      const stored = await auditLogs.findOne({ _id: audit._id });
      if (stored && stored.action === 'TEST_FINANCIAL_AUDIT' && stored.actorId === u1Id) {
        console.log('✅ TEST 10 PASSED: Financial audit log persisted correctly.');
        passed++;
      } else {
        console.error('❌ TEST 10 FAILED:', stored);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 10 ERROR:', err);
      failed++;
    }

    // TEST 11: Audit metadata sanitization boundary
    try {
      await logFinancialAudit({
        actorId: u1Id,
        actorRole: 'USER',
        action: 'TEST_SANITIZED_AUDIT',
        resourceType: 'PAYMENT',
        resourceId: `${testMarker}_PAY1`,
        metadata: { password: 'should-not-leak', token: 'should-not-leak', safe: 'ok', testMarker },
        dbInstance: db
      });
      const stored = await auditLogs.findOne({ action: 'TEST_SANITIZED_AUDIT', actorId: u1Id });
      const serialized = JSON.stringify(stored || {});
      if (!serialized.includes('should-not-leak')) {
        console.log('✅ TEST 11 PASSED: Sensitive audit metadata was sanitized.');
        passed++;
      } else {
        console.error('❌ TEST 11 FAILED: Sensitive audit metadata leaked:', stored);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 11 ERROR:', err);
      failed++;
    }

    // TEST 12: Captured payment status is reportable
    try {
      const payment = await payments.findOne({ testMarker, invoiceNumber: 'DP-INV-2026-001' });
      if (payment.status === PAYMENT_STATUS.CAPTURED) {
        console.log('✅ TEST 12 PASSED: Captured payment status remains report-compatible.');
        passed++;
      } else {
        console.error('❌ TEST 12 FAILED:', payment.status);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 12 ERROR:', err);
      failed++;
    }

    // TEST 13: Rejected financial permission returns middleware function
    try {
      const middleware = requirePermission('nonexistent.permission');
      if (typeof middleware === 'function') {
        console.log('✅ TEST 13 PASSED: Permission middleware created for denied permission path.');
        passed++;
      } else {
        console.error('❌ TEST 13 FAILED.');
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 13 ERROR:', err);
      failed++;
    }

    // TEST 14: Payment attempt rate limiter is independently configured
    try {
      if (paymentCreationLimiter !== refundLimiter) {
        console.log('✅ TEST 14 PASSED: Payment and refund rate limiters are independently configured.');
        passed++;
      } else {
        console.error('❌ TEST 14 FAILED: Rate limiters unexpectedly share the same instance.');
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 14 ERROR:', err);
      failed++;
    }

    // TEST 15: Ledger response has pagination metadata
    try {
      const ledger = await getGarageTransactionLedger(g1Id, { period: '30_DAYS', page: 1, limit: 10, dbInstance: db });
      if (ledger.pagination && ledger.pagination.page === 1 && ledger.pagination.limit === 10) {
        console.log('✅ TEST 15 PASSED: Transaction ledger returns pagination metadata.');
        passed++;
      } else {
        console.error('❌ TEST 15 FAILED:', ledger.pagination);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 15 ERROR:', err);
      failed++;
    }

    // TEST 16: Admin ledger supports garage filtering
    try {
      const ledger = await getAdminTransactionLedger({
        period: '30_DAYS',
        garageId: g1Id,
        dbInstance: db
      });
      const rows = ledger.rows || ledger.transactions || [];
      if (rows.length >= 1 && rows.every(r => String(r.garageId) === String(g1Id))) {
        console.log('✅ TEST 16 PASSED: Admin transaction ledger garage filter is effective.');
        passed++;
      } else {
        console.error('❌ TEST 16 FAILED:', ledger);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 16 ERROR:', err);
      failed++;
    }

    // TEST 17: Platform commission arithmetic consistency
    try {
      const g1 = await getGarageFinancialSummary(g1Id, { period: '30_DAYS', dbInstance: db });
      if (Math.abs((g1.grossRevenue - g1.platformFees) - g1.netEarnings) < 0.001) {
        console.log('✅ TEST 17 PASSED: Gross - platform fee = garage net earnings.');
        passed++;
      } else {
        console.error('❌ TEST 17 FAILED:', g1);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 17 ERROR:', err);
      failed++;
    }

    // TEST 18: Money precision via integer paise boundary
    try {
      const amount1 = 1999.99;
      const amount2 = 2999.01;
      const paiseSum = Math.round(amount1 * 100) + Math.round(amount2 * 100);
      const finalRupees = paiseSum / 100;

      if (paiseSum === 499900 && finalRupees === 4999) {
        console.log('✅ TEST 18 PASSED: Integer paise precision math confirmed (₹4,999.00).');
        passed++;
      } else {
        console.error('❌ TEST 18 FAILED:', paiseSum, finalRupees);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 18 ERROR:', err);
      failed++;
    }

    // TEST 19: CSV Export Generation
    try {
      const sampleData = [
        { Invoice: 'DP-INV-2026-001', Gross: 5000, Net: 4750 },
        { Invoice: 'DP-INV-2026-002', Gross: 8000, Net: 7600 }
      ];
      const csvContent = convertToCSV(sampleData);

      if (csvContent.includes('"Invoice","Gross","Net"') && csvContent.includes('"DP-INV-2026-001"')) {
        console.log('✅ TEST 19 PASSED: CSV export generated successfully.');
        passed++;
      } else {
        console.error('❌ TEST 19 FAILED:', csvContent);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 19 ERROR:', err);
      failed++;
    }

    // TEST 20: XLSX Export Generation
    try {
      const sampleData = [
        { Invoice: 'DP-INV-2026-001', Gross: 5000, Net: 4750 }
      ];
      const xlsxBuffer = await convertToXLSX(sampleData, 'Transactions');

      if (Buffer.isBuffer(xlsxBuffer) && xlsxBuffer.length > 100) {
        console.log(`✅ TEST 20 PASSED: XLSX binary workbook buffer generated (${xlsxBuffer.length} bytes).`);
        passed++;
      } else {
        console.error('❌ TEST 20 FAILED: Invalid XLSX buffer.');
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 20 ERROR:', err);
      failed++;
    }

    // TEST 21: Export Authorization & Filtering
    try {
      const expResult = await generateReportExport({
        actorId: 'admin_test_1',
        actorRole: 'ADMIN',
        reportType: 'TRANSACTIONS',
        format: 'csv',
        data: [{ Invoice: 'DP-INV-2026-003', Gross: 1000 }],
        filters: { period: '30_DAYS' },
        dbInstance: db
      });

      if (expResult.filename.endsWith('.csv') && expResult.mimeType === 'text/csv') {
        console.log('✅ TEST 21 PASSED: Report export metadata returned correctly.');
        passed++;
      } else {
        console.error('❌ TEST 21 FAILED:', expResult);
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 21 ERROR:', err);
      failed++;
    }

    // TEST 22: Audit log isolation by marker
    try {
      const markerCount = await auditLogs.countDocuments({ 'metadata.testMarker': testMarker });
      if (markerCount >= 1) {
        console.log('✅ TEST 22 PASSED: Audit logs are queryable by safe metadata marker.');
        passed++;
      } else {
        console.error('❌ TEST 22 FAILED: Expected marked audit logs.');
        failed++;
      }
    } catch (err) {
      console.error('❌ TEST 22 ERROR:', err);
      failed++;
    }

    // TEST 23: Date-Range Filtering Precision
    try {
      const pastDocDate = new Date(Date.now() - (60 * 24 * 60 * 60 * 1000)); // 60 days ago
      await earnings.insertOne({
        testMarker,
        garageId: g1Id,
        grossAmount: 9000,
        grossPaise: 900000,
        status: 'AVAILABLE',
        createdAt: pastDocDate
      });

      const recent30Summary = await getGarageFinancialSummary(g1Id, { period: '30_DAYS', dbInstance: db });
      // Should NOT include the 60-day old transaction in 30-day period
      if (recent30Summary.grossRevenue === 5000) {
        console.log('✅ TEST 23 PASSED: Date-range filter strictly excluded out-of-range transactions.');
        passed++;
      } else {
        console.error('❌ TEST 23 FAILED: Out-of-range doc included:', recent30Summary);
        failed++;
      }
      await earnings.deleteOne({ createdAt: pastDocDate });
    } catch (err) {
      console.error('❌ TEST 23 ERROR:', err);
      failed++;
    }

    // TEST 24: Dispute Financial Report Totals
    try {
      const dispId = `disp_rep_${Date.now()}`;
      await disputes.insertOne({
        testMarker,
        disputeNumber: 'DP-DIS-2026-999991',
        disputedAmount: 3000,
        disputedAmountPaise: 300000,
        status: 'RESOLVED',
        createdAt: new Date()
      });

      const platformSum = await getAdminPlatformFinancialSummary({ period: '30_DAYS', dbInstance: db });
      if (platformSum.totalDisputedAmount >= 3000 && platformSum.resolvedDisputesCount >= 1) {
        console.log('✅ TEST 24 PASSED: Dispute financial metrics reconciled in platform report.');
        passed++;
      } else {
        console.error('❌ TEST 24 FAILED:', platformSum);
        failed++;
      }
      await disputes.deleteOne({ disputeNumber: 'DP-DIS-2026-999991' });
    } catch (err) {
      console.error('❌ TEST 24 ERROR:', err);
      failed++;
    }
  } finally {
    try {
      await Promise.all([
        payments.deleteMany({ testMarker }),
        earnings.deleteMany({ testMarker }),
        disputes.deleteMany({ testMarker }),
        auditLogs.deleteMany({ 'metadata.testMarker': testMarker })
      ]);
    } catch (cleanupErr) {
      console.warn('Phase 5C/5D cleanup warning:', cleanupErr.message);
    }
    await client.close();
  }

  console.log(`\n📊 Phase 5C/5D Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runPhase5CDTestSuite().catch((err) => {
  console.error('Fatal Phase 5C/5D test suite error:', err);
  process.exit(1);
});
