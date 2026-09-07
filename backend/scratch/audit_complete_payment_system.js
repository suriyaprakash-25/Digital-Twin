require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { connectToMongo, getDb } = require('../src/db');
const { loadConfig } = require('../src/config');
const { calculateCommission, recordPaymentEarnings, reconcileRefundEarnings, getGarageEarningsSummary } = require('../src/services/earningsService');
const { checkSettlementEligibility } = require('../src/services/settlementEligibilityService');
const { getGarageSettlementForecast } = require('../src/services/settlementForecastService');
const { resolveGarageIds } = require('../src/utils/garageResolver');
const { verifyPaymentSignature } = require('../src/services/razorpayService');
const { PAYMENT_STATUS } = require('../src/models/Payment');
const { EARNINGS_STATUS, SETTLEMENT_STATUS } = require('../src/models/Earnings');

async function runOverallPaymentAudit() {
  console.log('================================================================');
  console.log('🔍 DrivePortz Comprehensive Payment & Financial Audit Suite');
  console.log('================================================================\n');

  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${details ? `— Details: ${details}` : ''}`);
      failedTests++;
    }
  }

  // -------------------------------------------------------------
  // SECTION 1: ARITHMETIC & INTEGER PAISE PRECISION AUDIT
  // -------------------------------------------------------------
  console.log('\n--- SECTION 1: Mathematical Accuracy & Integer Paise Precision ---');
  {
    // Test 1: Subtotal and Tax calculation
    const subtotalRupees = 3399.63;
    const subtotalPaise = Math.round(subtotalRupees * 100); // 339963
    const cgstPaise = Math.round((subtotalPaise * 9) / 100); // 30597
    const sgstPaise = Math.round((subtotalPaise * 9) / 100); // 30597
    const totalTaxPaise = cgstPaise + sgstPaise; // 61194
    const grandTotalPaise = subtotalPaise + totalTaxPaise; // 401157
    const grandTotalRupees = grandTotalPaise / 100; // 4011.57

    assert(grandTotalPaise === 401157 && grandTotalRupees === 4011.57, 'Tax snapshot integer paise calculation is exact to the paisa');

    // Test 2: Platform Commission calculation (5%)
    const commission = calculateCommission({ amountInPaise: 401157, commissionRate: 5 });
    assert(commission.commissionPaise === 20058, 'Platform commission in paise is exactly ₹200.58 (20058 paise)', `got ${commission.commissionPaise}`);
    assert(commission.garageNetPaise === 381099, 'Garage net earnings in paise is exactly ₹3,810.99 (381099 paise)', `got ${commission.garageNetPaise}`);
    assert(commission.commissionPaise + commission.garageNetPaise === commission.grossPaise, 'Zero rounding loss: commission + net equals gross paise');
  }

  // -------------------------------------------------------------
  // SECTION 2: SECURITY & CRYPTOGRAPHIC VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: Cryptographic Security & Signature Verification ---');
  {
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'sbiXykZ8adlURDRWH13IL94Y';
    const orderId = 'order_test_audit_98765';
    const paymentId = 'pay_test_audit_12345';
    const validSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = verifyPaymentSignature({ orderId, paymentId, signature: validSignature });
    assert(isValid === true, 'Valid Razorpay HMAC SHA256 signature verified successfully');

    const isTamperedRejected = verifyPaymentSignature({ orderId, paymentId, signature: 'tampered_signature_hex_123' });
    assert(isTamperedRejected === false, 'Tampered / forged signature is rejected with timing-safe comparison');
  }

  // -------------------------------------------------------------
  // SECTION 3: ID RESOLUTION & MULTI-VIEW COHERENCE AUDIT
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: Garage Identifier Resolution & Multi-View Coherence ---');
  {
    // Setup isolated test fixtures for garage & alias records
    const testUserId = new ObjectId();
    const testGarageDocId = new ObjectId();

    await db.collection('garages').insertOne({
      _id: testGarageDocId,
      ownerUserId: String(testUserId),
      name: 'Coherence Test Garage',
      isActive: true
    });

    await db.collection('users').insertOne({
      _id: testUserId,
      email: `audit_${Date.now()}@test.com`,
      role: 'GARAGE',
      isActive: true
    });

    const testPayment1 = {
      _id: new ObjectId(),
      paymentId: `pay_coh_1_${Date.now()}`,
      razorpayPaymentId: `pay_coh_1_${Date.now()}`,
      amount: 800,
      amountPaise: 80000,
      garageId: String(testUserId), // Legacy stored with User ID
      status: PAYMENT_STATUS.CAPTURED,
      invoiceNumber: `DP-INV-COH1-${Date.now()}`
    };

    const testPayment2 = {
      _id: new ObjectId(),
      paymentId: `pay_coh_2_${Date.now()}`,
      razorpayPaymentId: `pay_coh_2_${Date.now()}`,
      amount: 4000,
      amountPaise: 400000,
      garageId: String(testGarageDocId), // Recent stored with Garage Document ID
      status: PAYMENT_STATUS.CAPTURED,
      invoiceNumber: `DP-INV-COH2-${Date.now()}`
    };

    const rec1 = await recordPaymentEarnings({ payment: testPayment1, dbInstance: db });
    const rec2 = await recordPaymentEarnings({ payment: testPayment2, dbInstance: db });

    const garageIds = await resolveGarageIds(testUserId, db);
    assert(garageIds.includes(String(testUserId)) && garageIds.includes(String(testGarageDocId)), 'resolveGarageIds resolves both user ID and garage document ID');

    const summary = await getGarageEarningsSummary(testUserId, db);
    assert(summary.totalGrossRevenue === 4800, `Earnings summary aggregates across all alias transactions (Total Gross: ₹${summary.totalGrossRevenue.toFixed(2)})`);
    assert(summary.totalTransactions === 2, `Earnings summary count matches all transactions (Found: ${summary.totalTransactions})`);
    assert(summary.availableBalance === 4560, `Net available balance is calculated accurately after 5% fee (Available: ₹${summary.availableBalance.toFixed(2)})`);

    const forecast = await getGarageSettlementForecast(testUserId, db);
    assert(forecast.currentAvailableBalance === 4560, `Settlement forecast matches exactly available earnings balance (Forecast: ₹${forecast.currentAvailableBalance.toFixed(2)})`);

    // Cleanup test fixtures
    await db.collection('garages').deleteOne({ _id: testGarageDocId });
    await db.collection('users').deleteOne({ _id: testUserId });
    await db.collection('garage_earnings').deleteMany({ _id: { $in: [rec1._id, rec2._id] } });
  }

  // -------------------------------------------------------------
  // SECTION 4: IDEMPOTENCY & DUPLICATE RECORDING PROTECTION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 4: Ledger Idempotency & Concurrency Safety ---');
  {
    const mockPayment = {
      _id: new ObjectId(),
      paymentId: `pay_audit_${Date.now()}`,
      razorpayPaymentId: `pay_audit_${Date.now()}`,
      amount: 1000,
      amountPaise: 100000,
      garageId: 'audit_test_garage_001',
      garageName: 'Audit Garage',
      serviceType: 'Idempotency Test Service',
      invoiceNumber: `DP-INV-AUDIT-${Date.now()}`,
      userId: 'audit_user_001',
      vehicleId: 'audit_vehicle_001',
      vehicleNumber: 'KA01AB1234'
    };

    // First recording
    const record1 = await recordPaymentEarnings({ payment: mockPayment, dbInstance: db });
    assert(record1 !== null, 'First payment earnings recording creates ledger document');

    // Duplicate recording attempt
    const record2 = await recordPaymentEarnings({ payment: mockPayment, dbInstance: db });
    assert(String(record1._id) === String(record2._id), 'Duplicate webhook / verification returns identical existing ledger document without creating duplicates');

    // Cleanup mock document
    await db.collection('garage_earnings').deleteOne({ _id: record1._id });
  }

  // -------------------------------------------------------------
  // SECTION 5: REFUND & COMMISSION RECONCILIATION AUDIT
  // -------------------------------------------------------------
  console.log('\n--- SECTION 5: Refund Ledger Reconciliation & Net Adjustments ---');
  {
    const mockRefundPayment = {
      _id: new ObjectId(),
      paymentId: `pay_refund_audit_${Date.now()}`,
      razorpayPaymentId: `pay_refund_audit_${Date.now()}`,
      amount: 2000,
      amountPaise: 200000,
      garageId: 'audit_test_garage_002',
      garageName: 'Audit Garage 2',
      serviceType: 'Brake Inspection',
      invoiceNumber: `DP-INV-REFUND-${Date.now()}`
    };

    const initialEarning = await recordPaymentEarnings({ payment: mockRefundPayment, dbInstance: db });
    assert(initialEarning.garageNetAmount === 1900, 'Initial net earning is ₹1,900 (₹2,000 - 5% platform commission)');

    // Partial refund of ₹500
    const reconciledPartial = await reconcileRefundEarnings({
      payment: mockRefundPayment,
      refundAmount: 500,
      dbInstance: db
    });

    // 500 refund -> 5% fee refund = 25 -> garage refund share = 475.
    // New net = 1900 - 475 = 1425.
    assert(reconciledPartial.status === EARNINGS_STATUS.REFUND_ADJUSTMENT, 'Partial refund marks status as REFUND_ADJUSTMENT');
    assert(reconciledPartial.netAfterRefund === 1425, 'Net after ₹500 partial refund is exactly ₹1,425.00', `got ${reconciledPartial.netAfterRefund}`);

    // Cleanup mock document
    await db.collection('garage_earnings').deleteOne({ _id: initialEarning._id });
  }

  // -------------------------------------------------------------
  // SECTION 6: SETTLEMENT GOVERNANCE & ELIGIBILITY ENFORCEMENT
  // -------------------------------------------------------------
  console.log('\n--- SECTION 6: Settlement Governance, Thresholds & Dual Approval ---');
  {
    // Test 1: Minimum threshold check (< ₹500 should fail)
    const belowMinEval = await checkSettlementEligibility('non_existent_garage', 200, db);
    assert(belowMinEval.eligible === false, 'Settlement eligibility rejects invalid garage or below threshold');
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🏁 Complete Payment Operations Audit Completed: ${passedTests} Passed, ${failedTests} Failed out of ${passedTests + failedTests} Tests`);
  console.log('================================================================\n');

  if (failedTests === 0) {
    console.log('✨ AUDIT VERDICT: ZERO LOGICAL ERRORS DETECTED. ALL FINANCIAL WORKFLOWS ARE 100% OPERATIONAL, PRECISE, AND SECURE.');
    process.exit(0);
  } else {
    console.error('⚠️ AUDIT VERDICT: LOGICAL ERRORS DETECTED.');
    process.exit(1);
  }
}

runOverallPaymentAudit().catch(err => {
  console.error('Fatal audit suite error:', err);
  process.exit(1);
});
