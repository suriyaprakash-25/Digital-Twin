const assert = require('assert');
const { MongoClient, ObjectId } = require('mongodb');
const {
  isPaymentOrderAuthorized,
  isGarageUserAuthorizedForPayment
} = require('./src/security/paymentAuthorization');
const {
  ensureWebhookEventIndexes,
  beginWebhookEvent,
  markWebhookEventProcessed
} = require('./src/models/PaymentWebhookEvent');

async function run() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return Promise.resolve()
      .then(fn)
      .then(() => {
        passed += 1;
        console.log(`✅ ${name}`);
      })
      .catch((err) => {
        failed += 1;
        console.error(`❌ ${name}:`, err.message);
      });
  }

  await test('payment order rejects records with no ownership signal', () => {
    assert.strictEqual(
      isPaymentOrderAuthorized({
        user: { id: 'user-1', role: 'USER' },
        vehicle: null,
        targetDoc: { invoiceNumber: 'INV-1' }
      }),
      false
    );
  });

  await test('payment order accepts the vehicle owner and rejects another user', () => {
    const vehicle = { ownerId: 'owner-1' };
    const targetDoc = { vehicleId: 'vehicle-1' };
    assert.strictEqual(
      isPaymentOrderAuthorized({ user: { id: 'owner-1', role: 'USER' }, vehicle, targetDoc }),
      true
    );
    assert.strictEqual(
      isPaymentOrderAuthorized({ user: { id: 'other-1', role: 'USER' }, vehicle, targetDoc }),
      false
    );
  });

  await test('administrator may create an order for support operations', () => {
    assert.strictEqual(
      isPaymentOrderAuthorized({
        user: { id: 'admin-1', role: 'ADMIN' },
        vehicle: null,
        targetDoc: { invoiceNumber: 'INV-2' }
      }),
      true
    );
  });

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(process.env.MONGO_DB_NAME || 'driveportz_payment_security');
  await ensureWebhookEventIndexes(db);

  const eventId = `evt_security_${Date.now()}`;
  const garageId = new ObjectId();

  try {
    await db.collection('payment_webhook_events').deleteMany({ eventId });
    await db.collection('garages').deleteMany({ _id: garageId });

    await test('first webhook delivery is claimed exactly once', async () => {
      const first = await beginWebhookEvent({
        eventId,
        eventType: 'payment.captured',
        razorpayPaymentId: 'pay_security_1',
        razorpayOrderId: 'order_security_1',
        dbInstance: db
      });
      assert.strictEqual(first.shouldProcess, true);
      assert.strictEqual(first.isDuplicate, false);

      const duplicate = await beginWebhookEvent({
        eventId,
        eventType: 'payment.captured',
        razorpayPaymentId: 'pay_security_1',
        razorpayOrderId: 'order_security_1',
        dbInstance: db
      });
      assert.strictEqual(duplicate.shouldProcess, false);
      assert.strictEqual(duplicate.isDuplicate, true);
    });

    await test('failed webhook delivery can be atomically reclaimed once', async () => {
      await markWebhookEventProcessed(eventId, {
        status: 'FAILED',
        failureReason: 'simulated failure',
        dbInstance: db
      });

      const retry = await beginWebhookEvent({
        eventId,
        eventType: 'payment.captured',
        razorpayPaymentId: 'pay_security_1',
        razorpayOrderId: 'order_security_1',
        dbInstance: db
      });
      assert.strictEqual(retry.shouldProcess, true);
      assert.strictEqual(retry.eventDoc.retryCount, 1);

      const concurrentDuplicate = await beginWebhookEvent({
        eventId,
        eventType: 'payment.captured',
        razorpayPaymentId: 'pay_security_1',
        razorpayOrderId: 'order_security_1',
        dbInstance: db
      });
      assert.strictEqual(concurrentDuplicate.shouldProcess, false);
    });

    await test('processed webhook delivery remains idempotent', async () => {
      await markWebhookEventProcessed(eventId, { status: 'PROCESSED', dbInstance: db });
      const duplicate = await beginWebhookEvent({
        eventId,
        eventType: 'payment.captured',
        dbInstance: db
      });
      assert.strictEqual(duplicate.shouldProcess, false);
      assert.strictEqual(duplicate.eventDoc.processingStatus, 'PROCESSED');
    });

    await db.collection('garages').insertOne({
      _id: garageId,
      ownerUserId: 'garage-owner-1',
      verified: true,
      isActive: true
    });

    await test('refund authorization resolves the real garage owner', async () => {
      const payment = { garageId: String(garageId) };
      assert.strictEqual(
        await isGarageUserAuthorizedForPayment({
          user: { id: 'garage-owner-1', role: 'GARAGE' },
          payment,
          db
        }),
        true
      );
      assert.strictEqual(
        await isGarageUserAuthorizedForPayment({
          user: { id: 'other-garage-owner', role: 'GARAGE' },
          payment,
          db
        }),
        false
      );
    });

    await test('non-garage users cannot initiate garage refunds', async () => {
      assert.strictEqual(
        await isGarageUserAuthorizedForPayment({
          user: { id: 'customer-1', role: 'USER' },
          payment: { garageId: String(garageId) },
          db
        }),
        false
      );
    });
  } finally {
    await db.collection('payment_webhook_events').deleteMany({ eventId });
    await db.collection('garages').deleteMany({ _id: garageId });
    await client.close();
  }

  console.log(`\nPayment security suite: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal payment security suite error:', err);
  process.exit(1);
});
