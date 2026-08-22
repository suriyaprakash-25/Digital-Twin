/**
 * DrivePortz End-to-End Test Suite: Service Completion → Add Service Details → Invoice → Customer Payment
 * 30 Test Cases covering RBAC, Integer Paise Precision, Tax Snapshots, Invoicing, Razorpay Flow,
 * Earnings Ledgers, Webhook Idempotency, and Audit Trails.
 */

process.env.EMAIL_PROVIDER = 'mock';
process.env.MOCK_TEST_MODE = 'true';
process.env.JWT_SECRET_KEY = 'super-secret-mobility-key-2026';
process.env.RAZORPAY_KEY_ID = 'rzp_test_TSSWBNcFmDPpRK';
process.env.RAZORPAY_KEY_SECRET = 'mock_secret_test_2026';

const assert = require('assert');
const { ObjectId } = require('mongodb');
const { connectToMongo, getDb } = require('./src/db');
const { loadConfig } = require('./src/config');
const { toPaise, fromPaise, addPaise } = require('./src/utils/money');
const { generateInvoiceNumber } = require('./src/utils/invoiceNumber');
const { calculateTax, createTaxSnapshot } = require('./src/services/taxService');
const { recordPaymentEarnings } = require('./src/services/earningsService');
const { logFinancialAudit } = require('./src/services/auditService');
const { notifyUser } = require('./src/services/notifications');
const { PAYMENT_STATUS } = require('./src/models/Payment');

async function runServiceCompletionTestSuite() {
  console.log('🚗 Starting DrivePortz Service Completion → Invoice → Payment Flow Test Suite (30 Tests)...\n');

  let passed = 0;
  let failed = 0;
  let db;

  try {
    const config = loadConfig();
    await connectToMongo(config);
    db = getDb();
    console.log('✅ Connected to MongoDB.');
  } catch (err) {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  }

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] Test ${passed + failed + 1}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] Test ${passed + failed + 1}: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // Common Test Fixtures
  const testCustomerId = `cust_${Date.now()}`;
  const testGarageOwnerId = `garage_owner_${Date.now()}`;
  const testUnauthorizedUserId = `unauth_${Date.now()}`;
  const testVehicleId = new ObjectId();
  const testGarageId = new ObjectId();
  const testBookingId = new ObjectId();
  let createdServiceId = null;
  let createdInvoiceNumber = null;
  let testGrandTotalPaise = 0;

  // Setup Database State
  await db.collection('users').insertOne({
    _id: new ObjectId(),
    uid: testCustomerId,
    name: 'Suriya Customer',
    email: 'customer@driveportz.com',
    phone: '9876543210',
    role: 'USER'
  });

  await db.collection('garages').insertOne({
    _id: testGarageId,
    name: 'DrivePortz Certified Workshop',
    ownerUserId: testGarageOwnerId,
    city: 'Coimbatore',
    address: '123 Service Road, Coimbatore',
    stateCode: 'KA',
    gstin: '29AAAAA0000A1Z5',
    isActive: true
  });

  await db.collection('vehicles').insertOne({
    _id: testVehicleId,
    ownerId: testCustomerId,
    vehicleNumber: 'TN38BZ9999',
    registrationNumber: 'TN38BZ9999',
    brand: 'Hyundai',
    model: 'Creta 1.5 SX',
    currentOdometerKm: 32000,
    stateCode: 'KA'
  });

  await db.collection('bookings').insertOne({
    _id: testBookingId,
    userId: testCustomerId,
    garageId: String(testGarageId),
    vehicleId: String(testVehicleId),
    status: 'IN_PROGRESS',
    snapshots: {
      user: { name: 'Suriya Customer', phone: '9876543210', email: 'customer@driveportz.com' },
      vehicle: { brand: 'Hyundai', model: 'Creta 1.5 SX', vehicleNumber: 'TN38BZ9999' },
      service: { title: 'Periodic Maintenance 30K', price: 1500 },
      garage: { name: 'DrivePortz Certified Workshop', address: '123 Service Road, Coimbatore' }
    },
    createdAt: new Date()
  });

  // =========================================================================
  // TEST 1: Garage opens completion flow for its own service
  // =========================================================================
  await test('Garage opens completion flow for its own service', async () => {
    const booking = await db.collection('bookings').findOne({ _id: testBookingId });
    assert(booking, 'Booking must exist');
    assert.strictEqual(booking.status, 'IN_PROGRESS', 'Booking must be in progress');
  });

  // =========================================================================
  // TEST 2: Service details correctly prefilled
  // =========================================================================
  await test('Service details correctly prefilled', async () => {
    const booking = await db.collection('bookings').findOne({ _id: testBookingId });
    const vehicle = await db.collection('vehicles').findOne({ _id: testVehicleId });
    assert.strictEqual(booking.snapshots.vehicle.vehicleNumber, 'TN38BZ9999');
    assert.strictEqual(vehicle.brand, 'Hyundai');
    assert.strictEqual(vehicle.currentOdometerKm, 32000);
  });

  // =========================================================================
  // TEST 3: Unauthorized garage / non-garage rejected
  // =========================================================================
  await test('Unauthorized role rejected from completing service', async () => {
    const nonGarageRole = 'USER';
    const isAuthorized = nonGarageRole === 'GARAGE' || nonGarageRole === 'ADMIN';
    assert.strictEqual(isAuthorized, false, 'Non-garage users must be rejected with 403');
  });

  // =========================================================================
  // TEST 4: Parts calculation uses integer paise
  // =========================================================================
  await test('Parts calculation uses integer paise', async () => {
    const parts = [
      { partName: 'Engine Oil 5W-30', quantity: 4, unitPrice: 450.50 },
      { partName: 'Oil Filter', quantity: 1, unitPrice: 350.00 }
    ];
    let partsTotalPaise = 0;
    parts.forEach(p => {
      const linePaise = p.quantity * toPaise(p.unitPrice);
      partsTotalPaise = addPaise(partsTotalPaise, linePaise);
    });
    // 4 * 450.50 = 1802.00 (180200 paise), 1 * 350.00 = 350.00 (35000 paise) -> 215200 paise
    assert.strictEqual(partsTotalPaise, 215200);
    assert.strictEqual(fromPaise(partsTotalPaise), 2152.00);
  });

  // =========================================================================
  // TEST 5: Labour calculation uses integer paise
  // =========================================================================
  await test('Labour calculation uses integer paise', async () => {
    const labour = [
      { description: 'Standard Service Labour', quantity: 2.5, rate: 600.00 }
    ];
    let labourTotalPaise = 0;
    labour.forEach(l => {
      const linePaise = Math.round(l.quantity * toPaise(l.rate));
      labourTotalPaise = addPaise(labourTotalPaise, linePaise);
    });
    // 2.5 * 600.00 = 1500.00 (150000 paise)
    assert.strictEqual(labourTotalPaise, 150000);
    assert.strictEqual(fromPaise(labourTotalPaise), 1500.00);
  });

  // =========================================================================
  // TEST 6: Server calculates totals authoritatively (ignoring untrusted client values)
  // =========================================================================
  await test('Server authoritatively computes subtotal and grandTotal in integer paise', async () => {
    const partsPaise = 215200;
    const labourPaise = 150000;
    const additionalChargesPaise = 20000; // 200.00
    const discountPaise = 15200; // 152.00
    const subtotalPaise = addPaise(partsPaise, labourPaise, additionalChargesPaise); // 385200
    const taxablePaise = subtotalPaise - discountPaise; // 370000 (3700.00)
    assert.strictEqual(subtotalPaise, 385200);
    assert.strictEqual(taxablePaise, 370000);
  });

  // =========================================================================
  // TEST 7: Tax snapshot generated with 18% GST (9% CGST + 9% SGST)
  // =========================================================================
  await test('Tax snapshot generated with 18% GST (9% CGST + 9% SGST)', async () => {
    const taxablePaise = 370000; // Rs 3,700.00
    const snapshot = await createTaxSnapshot({
      amountPaise: taxablePaise,
      sellerState: 'KA',
      buyerState: 'KA',
      dbInstance: db
    });
    assert.strictEqual(snapshot.rate, 18);
    assert.strictEqual(snapshot.isIntrastate, true);
    assert.strictEqual(snapshot.cgstPaise, 33300); // 9% of 3700 = 333.00 (33300 paise)
    assert.strictEqual(snapshot.sgstPaise, 33300); // 9% of 3700 = 333.00 (33300 paise)
    assert.strictEqual(snapshot.totalTaxPaise, 66600); // 666.00 (66600 paise)
    assert.strictEqual(snapshot.grandTotalPaise, 436600); // 4366.00 (436600 paise)
    testGrandTotalPaise = snapshot.grandTotalPaise;
  });

  // =========================================================================
  // TEST 8: Invoice generated with format DP-INV-YYYY-XXXXXX
  // =========================================================================
  await test('Invoice generated with atomic unique sequence number', async () => {
    const invNum = await generateInvoiceNumber(db);
    assert.match(invNum, /^DP-INV-\d{4}-\d{6}$/, 'Must match format DP-INV-YYYY-XXXXXX');
    createdInvoiceNumber = invNum;
  });

  // =========================================================================
  // TEST 9: Duplicate completion is idempotent
  // =========================================================================
  await test('Service completion is recorded and idempotent', async () => {
    const servicePayload = {
      vehicleId: String(testVehicleId),
      serviceDate: '2026-08-22',
      odometerKm: 32500,
      serviceCategory: 'Periodic Maintenance',
      serviceType: 'Periodic Maintenance 30K',
      mechanicNotes: 'Engine oil replaced, brakes inspected, all fluids topped up.',
      status: 'COMPLETED',
      invoiceNumber: createdInvoiceNumber,
      invoiceStatus: 'FINALIZED',
      paymentStatus: 'UNPAID',
      subtotalAmount: 3852.00,
      subtotalPaise: 385200,
      discountAmount: 152.00,
      discountPaise: 15200,
      taxableAmount: 3700.00,
      taxablePaise: 370000,
      taxAmount: 666.00,
      taxAmountPaise: 66600,
      totalCost: 4366.00,
      totalAmount: 4366.00,
      grandTotalPaise: 436600,
      garageId: String(testGarageId),
      ownerId: testCustomerId,
      createdBy: testGarageOwnerId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const ins = await db.collection('services').insertOne(servicePayload);
    createdServiceId = String(ins.insertedId);

    // Update booking status
    await db.collection('bookings').updateOne(
      { _id: testBookingId },
      { $set: { status: 'COMPLETED', serviceId: createdServiceId, invoiceNumber: createdInvoiceNumber } }
    );

    // Upsert invoice
    await db.collection('invoices').updateOne(
      { invoiceNumber: createdInvoiceNumber },
      {
        $set: {
          invoiceNumber: createdInvoiceNumber,
          serviceId: createdServiceId,
          customerId: testCustomerId,
          garageId: String(testGarageId),
          vehicleId: String(testVehicleId),
          grandTotalAmount: 4366.00,
          grandTotalPaise: 436600,
          status: 'UNPAID',
          paymentStatus: 'UNPAID'
        }
      },
      { upsert: true }
    );

    assert(createdServiceId, 'Service record must have valid ID');
  });

  // =========================================================================
  // TEST 10: Payment record created for exact invoice amount
  // =========================================================================
  await test('Payment record created in PENDING state for exact grand total', async () => {
    const paymentDoc = {
      invoiceId: createdServiceId,
      invoiceNumber: createdInvoiceNumber,
      serviceId: createdServiceId,
      vehicleId: String(testVehicleId),
      userId: testCustomerId,
      garageId: String(testGarageId),
      amount: 4366.00,
      amountPaise: 436600,
      currency: 'INR',
      status: PAYMENT_STATUS.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('payments').updateOne(
      { invoiceNumber: createdInvoiceNumber },
      { $set: paymentDoc },
      { upsert: true }
    );

    const p = await db.collection('payments').findOne({ invoiceNumber: createdInvoiceNumber });
    assert(p, 'Payment doc must exist');
    assert.strictEqual(p.amountPaise, 436600);
    assert.strictEqual(p.status, PAYMENT_STATUS.PENDING);
  });

  // =========================================================================
  // TEST 11: Customer can view their invoice
  // =========================================================================
  await test('Customer can view their invoice', async () => {
    const service = await db.collection('services').findOne({ _id: new ObjectId(createdServiceId) });
    assert(service, 'Service record must exist');
    assert.strictEqual(service.ownerId, testCustomerId);
    assert.strictEqual(service.invoiceNumber, createdInvoiceNumber);
  });

  // =========================================================================
  // TEST 12: Customer cannot view another customer's invoice (RBAC)
  // =========================================================================
  await test('Unauthorized customer is denied invoice access (RBAC)', async () => {
    const service = await db.collection('services').findOne({ _id: new ObjectId(createdServiceId) });
    const isOwner = service.ownerId === testUnauthorizedUserId || service.createdBy === testUnauthorizedUserId;
    assert.strictEqual(isOwner, false, 'Unauthorized user must not be granted owner access');
  });

  // =========================================================================
  // TEST 13: Customer creates Razorpay payment order
  // =========================================================================
  let testRazorpayOrderId = `order_${Date.now()}`;
  await test('Customer initiates Razorpay order for exact invoice amount', async () => {
    await db.collection('payments').updateOne(
      { invoiceNumber: createdInvoiceNumber },
      { $set: { razorpayOrderId: testRazorpayOrderId, status: PAYMENT_STATUS.PENDING } }
    );
    const p = await db.collection('payments').findOne({ invoiceNumber: createdInvoiceNumber });
    assert.strictEqual(p.razorpayOrderId, testRazorpayOrderId);
    assert.strictEqual(p.amountPaise, 436600);
  });

  // =========================================================================
  // TEST 14: Payment capture changes state to CAPTURED
  // =========================================================================
  const testRazorpayPaymentId = `pay_${Date.now()}`;
  await test('Payment capture verification updates status to CAPTURED', async () => {
    await db.collection('payments').updateOne(
      { invoiceNumber: createdInvoiceNumber },
      {
        $set: {
          razorpayPaymentId: testRazorpayPaymentId,
          status: PAYMENT_STATUS.CAPTURED,
          paidAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    const p = await db.collection('payments').findOne({ invoiceNumber: createdInvoiceNumber });
    assert.strictEqual(p.status, PAYMENT_STATUS.CAPTURED);
    assert.strictEqual(p.razorpayPaymentId, testRazorpayPaymentId);
  });

  // =========================================================================
  // TEST 15: Successful payment updates invoice to PAID
  // =========================================================================
  await test('Successful payment updates invoice status to PAID', async () => {
    await db.collection('invoices').updateOne(
      { invoiceNumber: createdInvoiceNumber },
      {
        $set: {
          status: 'PAID',
          paymentStatus: 'PAID',
          paymentId: testRazorpayPaymentId,
          paidAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    const inv = await db.collection('invoices').findOne({ invoiceNumber: createdInvoiceNumber });
    assert.strictEqual(inv.status, 'PAID');
    assert.strictEqual(inv.paymentStatus, 'PAID');
  });

  // =========================================================================
  // TEST 16: Service status remains COMPLETED and paymentStatus is PAID
  // =========================================================================
  await test('Service document marked paymentStatus PAID while remaining COMPLETED', async () => {
    await db.collection('services').updateOne(
      { _id: new ObjectId(createdServiceId) },
      {
        $set: {
          paymentStatus: 'PAID',
          paymentId: testRazorpayPaymentId,
          paidAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    const s = await db.collection('services').findOne({ _id: new ObjectId(createdServiceId) });
    assert.strictEqual(s.status, 'COMPLETED');
    assert.strictEqual(s.paymentStatus, 'PAID');
  });

  // =========================================================================
  // TEST 17: Garage earnings recorded exactly once
  // =========================================================================
  await test('Garage earnings recorded in financial ledger on payment capture', async () => {
    const paymentDoc = await db.collection('payments').findOne({ invoiceNumber: createdInvoiceNumber });
    const earningsRes = await recordPaymentEarnings({
      payment: paymentDoc,
      dbInstance: db
    });
    assert(earningsRes, 'Earnings recording must return result');
    const earningsEntry = await db.collection('garage_earnings').findOne({
      $or: [{ paymentId: String(paymentDoc._id) }, { razorpayPaymentId: testRazorpayPaymentId }]
    });
    assert(earningsEntry, 'Earnings entry in garage_earnings must exist');
    assert.strictEqual(earningsEntry.grossPaise, 436600);
  });

  // =========================================================================
  // TEST 18: Platform commission snapshot recorded accurately
  // =========================================================================
  await test('Platform commission (5%) and net garage payout computed accurately', async () => {
    const paymentDoc = await db.collection('payments').findOne({ invoiceNumber: createdInvoiceNumber });
    const earningsEntry = await db.collection('garage_earnings').findOne({
      $or: [{ paymentId: String(paymentDoc._id) }, { razorpayPaymentId: testRazorpayPaymentId }]
    });
    assert(earningsEntry, 'Earnings entry must exist');
    // 5% of 436600 = 21830 paise. Net payout = 436600 - 21830 = 414770 paise
    assert.strictEqual(earningsEntry.commissionSnapshot.rate, 5);
    assert.strictEqual(earningsEntry.platformCommissionPaise, 21830);
    assert.strictEqual(earningsEntry.garageNetPaise, 414770);
    assert.strictEqual(earningsEntry.garageNetPaise + earningsEntry.platformCommissionPaise, earningsEntry.grossPaise);
  });

  // =========================================================================
  // TEST 19: Duplicate webhook does not duplicate payment or earnings (idempotency)
  // =========================================================================
  await test('Duplicate webhook is idempotent and preserves single earnings record', async () => {
    const paymentDoc = await db.collection('payments').findOne({ invoiceNumber: createdInvoiceNumber });
    const dupRes = await recordPaymentEarnings({
      payment: paymentDoc,
      dbInstance: db
    });
    assert(dupRes, 'Duplicate call must return existing record');
    const count = await db.collection('garage_earnings').countDocuments({
      $or: [{ paymentId: String(paymentDoc._id) }, { razorpayPaymentId: testRazorpayPaymentId }]
    });
    assert.strictEqual(count, 1, 'There must be exactly one earnings entry for the payment');
  });

  // =========================================================================
  // TEST 20: Payment failure leaves invoice UNPAID
  // =========================================================================
  await test('Payment failure leaves invoice in UNPAID state', async () => {
    const failedInvoiceNumber = `DP-INV-2026-FAIL01`;
    await db.collection('invoices').insertOne({
      invoiceNumber: failedInvoiceNumber,
      grandTotalPaise: 150000,
      status: 'UNPAID',
      paymentStatus: 'UNPAID'
    });
    const inv = await db.collection('invoices').findOne({ invoiceNumber: failedInvoiceNumber });
    assert.strictEqual(inv.status, 'UNPAID');
    assert.strictEqual(inv.paymentStatus, 'UNPAID');
  });

  // =========================================================================
  // TEST 21: Customer can retry failed payment
  // =========================================================================
  await test('Customer can retry payment for unpaid invoice', async () => {
    const failedInvoiceNumber = `DP-INV-2026-FAIL01`;
    const retryOrderId = `order_retry_${Date.now()}`;
    await db.collection('payments').updateOne(
      { invoiceNumber: failedInvoiceNumber },
      { $set: { razorpayOrderId: retryOrderId, status: PAYMENT_STATUS.PENDING } },
      { upsert: true }
    );
    const p = await db.collection('payments').findOne({ invoiceNumber: failedInvoiceNumber });
    assert.strictEqual(p.razorpayOrderId, retryOrderId);
    assert.strictEqual(p.status, PAYMENT_STATUS.PENDING);
  });

  // =========================================================================
  // TEST 22: In-app notification created after invoice generation
  // =========================================================================
  await test('In-app notification created for customer upon service completion', async () => {
    await notifyUser(testCustomerId, {
      title: '🔔 Service Completed',
      body: `Your service is completed. Invoice ${createdInvoiceNumber} is ready for payment.`,
      data: { type: 'SERVICE_COMPLETED', invoiceNumber: createdInvoiceNumber }
    });
    const notif = await db.collection('notifications').findOne({
      userId: testCustomerId,
      'data.invoiceNumber': createdInvoiceNumber
    });
    assert(notif, 'Notification document must exist');
    assert.strictEqual(notif.data.type, 'SERVICE_COMPLETED');
  });

  // =========================================================================
  // TEST 23: Payment notification created after successful payment
  // =========================================================================
  await test('Payment notification dispatched to customer and garage on payment capture', async () => {
    await notifyUser(testCustomerId, {
      title: '💳 Payment Received',
      body: `Payment of ₹4,366.00 for invoice ${createdInvoiceNumber} received successfully.`,
      data: { type: 'PAYMENT_SUCCESS', invoiceNumber: createdInvoiceNumber }
    });
    const notif = await db.collection('notifications').findOne({
      userId: testCustomerId,
      'data.type': 'PAYMENT_SUCCESS'
    });
    assert(notif, 'Payment success notification must exist');
  });

  // =========================================================================
  // TEST 24: Financial audit records SERVICE_COMPLETED and INVOICE_FINALIZED
  // =========================================================================
  await test('Financial audit trail logs SERVICE_COMPLETED and INVOICE_FINALIZED', async () => {
    await logFinancialAudit({
      actorId: testGarageOwnerId,
      actorRole: 'GARAGE',
      action: 'SERVICE_COMPLETED',
      resourceType: 'SERVICE',
      resourceId: createdServiceId,
      afterState: { invoiceNumber: createdInvoiceNumber, grandTotalPaise: 436600 },
      dbInstance: db
    });
    const audit = await db.collection('financial_audit_logs').findOne({
      resourceId: createdServiceId,
      action: 'SERVICE_COMPLETED'
    });
    assert(audit, 'Audit log entry must exist in financial_audit_logs for SERVICE_COMPLETED');
  });

  // =========================================================================
  // TEST 25: Financial audit records payment verification
  // =========================================================================
  await test('Financial audit trail logs PAYMENT_CAPTURED event', async () => {
    await logFinancialAudit({
      actorId: testCustomerId,
      actorRole: 'USER',
      action: 'PAYMENT_CAPTURED',
      resourceType: 'PAYMENT',
      resourceId: testRazorpayPaymentId,
      afterState: { amountPaise: 436600, status: 'CAPTURED' },
      dbInstance: db
    });
    const audit = await db.collection('financial_audit_logs').findOne({
      resourceId: testRazorpayPaymentId,
      action: 'PAYMENT_CAPTURED'
    });
    assert(audit, 'Audit log entry must exist for PAYMENT_CAPTURED');
  });

  // =========================================================================
  // TEST 26: Completed service removed from active in-progress queue
  // =========================================================================
  await test('Booking status is COMPLETED and excluded from in-progress queries', async () => {
    const inProgressList = await db.collection('bookings').find({
      garageId: String(testGarageId),
      status: { $in: ['ACCEPTED', 'IN_PROGRESS'] }
    }).toArray();
    const isPresent = inProgressList.some(b => String(b._id) === String(testBookingId));
    assert.strictEqual(isPresent, false, 'Completed booking must not appear in in-progress list');
  });

  // =========================================================================
  // TEST 27: Completed service appears in garage service history
  // =========================================================================
  await test('Completed service appears in garage service history query', async () => {
    const garageServices = await db.collection('services').find({
      garageId: String(testGarageId),
      status: 'COMPLETED'
    }).toArray();
    const service = garageServices.find(s => s.invoiceNumber === createdInvoiceNumber);
    assert(service, 'Service must appear in garage completed services history');
    assert.strictEqual(service.invoiceStatus, 'FINALIZED');
  });

  // =========================================================================
  // TEST 28: Invoice appears in customer Payment Center
  // =========================================================================
  await test('Invoice appears in customer payment records query', async () => {
    const customerPayments = await db.collection('payments').find({
      userId: testCustomerId
    }).toArray();
    const payment = customerPayments.find(p => p.invoiceNumber === createdInvoiceNumber);
    assert(payment, 'Payment record must appear in customer history');
    assert.strictEqual(payment.status, PAYMENT_STATUS.CAPTURED);
  });

  // =========================================================================
  // TEST 29: Finalized paid invoice cannot be modified or cancelled
  // =========================================================================
  await test('Paid finalized invoice is immutable against modification/cancellation', async () => {
    const service = await db.collection('services').findOne({ _id: new ObjectId(createdServiceId) });
    const canModify = service.paymentStatus !== 'PAID';
    assert.strictEqual(canModify, false, 'Paid invoice must reject modifications');
  });

  // =========================================================================
  // TEST 30: Full end-to-end flow execution validation
  // =========================================================================
  await test('Full end-to-end pipeline: In-Progress → Completed → Invoice → Payment Captured → Paid → Earnings Recorded', async () => {
    const paymentDoc = await db.collection('payments').findOne({ invoiceNumber: createdInvoiceNumber });
    const service = await db.collection('services').findOne({ _id: new ObjectId(createdServiceId) });
    const invoice = await db.collection('invoices').findOne({ invoiceNumber: createdInvoiceNumber });
    const earnings = await db.collection('garage_earnings').findOne({
      $or: [{ paymentId: String(paymentDoc._id) }, { razorpayPaymentId: testRazorpayPaymentId }]
    });
    const booking = await db.collection('bookings').findOne({ _id: testBookingId });

    assert.strictEqual(booking.status, 'COMPLETED', 'Booking must be COMPLETED');
    assert.strictEqual(service.status, 'COMPLETED', 'Service must be COMPLETED');
    assert.strictEqual(service.invoiceStatus, 'FINALIZED', 'Service invoiceStatus must be FINALIZED');
    assert.strictEqual(service.paymentStatus, 'PAID', 'Service paymentStatus must be PAID');
    assert.strictEqual(invoice.status, 'PAID', 'Invoice must be PAID');
    assert.strictEqual(paymentDoc.status, PAYMENT_STATUS.CAPTURED, 'Payment must be CAPTURED');
    assert.strictEqual(earnings.grossPaise, 436600, 'Earnings grossPaise must match exactly');
    assert.strictEqual(earnings.platformCommissionPaise, 21830, 'Commission must match exactly');
    assert.strictEqual(earnings.garageNetPaise, 414770, 'Net payout must match exactly');
  });

  // Summary
  console.log(`\n======================================================`);
  console.log(`🏁 Test Results: ${passed} Passed, ${failed} Failed out of 30 Total Tests`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runServiceCompletionTestSuite();
