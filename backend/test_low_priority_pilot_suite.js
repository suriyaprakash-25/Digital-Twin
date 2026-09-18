process.env.NODE_ENV = 'test';

const assert = require('assert');
const { MongoClient, ObjectId } = require('mongodb');
const {
  SUPPORT_QUEUE,
  getSupportDefaults,
  listSupportItems,
  triageSupportItem
} = require('./src/services/pilotSupportService');
const { getPilotAnalytics } = require('./src/services/pilotAnalyticsService');

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(`driveportz_low_priority_${Date.now()}`);

  try {
    const paymentRoute = getSupportDefaults('Payment Issue');
    assert.strictEqual(paymentRoute.supportQueue, SUPPORT_QUEUE.PAYMENTS_AND_RECONCILIATION);
    assert.strictEqual(paymentRoute.supportSlaHours, 2);

    const bookingRoute = getSupportDefaults('Booking Issue');
    assert.strictEqual(bookingRoute.supportQueue, SUPPORT_QUEUE.PILOT_OPERATIONS);
    assert.strictEqual(bookingRoute.supportSlaHours, 4);

    const oldIssueId = new ObjectId();
    await db.collection('feedbacks').insertMany([
      {
        _id: oldIssueId,
        category: 'Payment Issue',
        message: 'Payment debited but status is not captured.',
        status: 'NEW',
        supportQueue: paymentRoute.supportQueue,
        supportPriority: paymentRoute.supportPriority,
        supportSlaHours: paymentRoute.supportSlaHours,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
      },
      {
        category: 'Feature Request',
        message: 'Please add more export options.',
        status: 'NEW',
        supportQueue: 'PRODUCT_FEEDBACK',
        supportPriority: 'LOW',
        supportSlaHours: 48,
        createdAt: new Date()
      }
    ]);

    const queue = await listSupportItems({ limit: 20 }, db);
    assert.strictEqual(queue.items.length, 1);
    assert.strictEqual(queue.metrics.open, 1);
    assert.strictEqual(queue.metrics.urgent, 1);
    assert.strictEqual(queue.metrics.slaBreached, 1);
    assert.strictEqual(queue.items[0].slaBreached, true);

    const triaged = await triageSupportItem(
      oldIssueId,
      { assignedTo: 'Pilot Admin', status: 'REVIEWED', supportPriority: 'HIGH' },
      { id: 'admin-1', role: 'ADMIN' },
      db
    );
    assert.strictEqual(triaged.assignedTo, 'Pilot Admin');
    assert.strictEqual(triaged.status, 'REVIEWED');
    assert.strictEqual(triaged.supportPriority, 'HIGH');
    assert(await db.collection('admin_audit_logs').findOne({ action: 'PILOT_SUPPORT_TRIAGE_UPDATED' }));

    const now = new Date();
    const recent = new Date(now.getTime() - 60 * 60 * 1000);
    const old = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const garageA = new ObjectId();
    const garageB = new ObjectId();

    await db.collection('users').insertMany([
      { name: 'Existing', createdAt: old },
      { name: 'Pilot One', createdAt: recent },
      { name: 'Pilot Two', createdAt: recent }
    ]);

    await db.collection('garages').insertMany([
      { _id: garageA, name: 'Garage A', isActive: true, ownerUserId: 'ga-owner' },
      { _id: garageB, name: 'Garage B', isActive: true, ownerUserId: 'gb-owner' }
    ]);

    await db.collection('bookings').insertMany([
      { garageId: garageA, status: 'COMPLETED', createdAt: recent, completedAt: recent, updatedAt: recent },
      { garageId: garageA, status: 'COMPLETED', createdAt: recent, completedAt: recent, updatedAt: recent },
      { garageId: garageA, status: 'REQUESTED', createdAt: recent, updatedAt: recent },
      { garageId: garageB, status: 'COMPLETED', createdAt: old, completedAt: old, updatedAt: old }
    ]);

    await db.collection('payments').insertMany([
      { status: 'CAPTURED', createdAt: recent },
      { status: 'CAPTURED', createdAt: recent },
      { status: 'FAILED', createdAt: recent },
      { status: 'CAPTURED', createdAt: old }
    ]);

    await db.collection('diagnoses').insertOne({ createdAt: recent });
    await db.collection('chat_history').insertMany([
      { createdAt: recent },
      { createdAt: recent }
    ]);
    await db.collection('operational_error_events').insertMany([
      { severity: 'ERROR', timestamp: recent },
      { severity: 'WARN', timestamp: recent },
      { severity: 'ERROR', timestamp: old }
    ]);
    await db.collection('services').insertOne({ garageId: garageA, createdAt: recent });

    const analytics = await getPilotAnalytics({ days: 30 }, db);
    assert.strictEqual(analytics.users.total, 3);
    assert.strictEqual(analytics.users.new, 2);
    assert.strictEqual(analytics.bookings.created, 3);
    assert.strictEqual(analytics.bookings.completed, 2);
    assert.strictEqual(analytics.bookings.conversionRate, 66.7);
    assert.strictEqual(analytics.payments.attempts, 3);
    assert.strictEqual(analytics.payments.successful, 2);
    assert.strictEqual(analytics.payments.failed, 1);
    assert.strictEqual(analytics.payments.successRate, 66.7);
    assert.strictEqual(analytics.ai.vehicleDoctorUses, 1);
    assert.strictEqual(analytics.ai.copilotMessages, 2);
    assert.strictEqual(analytics.ai.totalUses, 3);
    assert.strictEqual(analytics.reliability.errors, 1);
    assert.strictEqual(analytics.garages.totalActive, 2);
    assert.strictEqual(analytics.garages.activeInPeriod, 1);
    assert.strictEqual(analytics.garages.activityRate, 50);
    assert.strictEqual(analytics.garages.topGarages[0].name, 'Garage A');

    console.log('✅ Low-priority pilot suite passed: support routing/SLAs, triage audit, pilot KPI calculations.');
  } finally {
    await db.dropDatabase();
    await client.close();
  }
}

main().catch((error) => {
  console.error('❌ Low-priority pilot suite failed:', error);
  process.exit(1);
});
