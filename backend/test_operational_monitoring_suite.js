const assert = require('assert');
const { MongoClient } = require('mongodb');
const {
  COLLECTION,
  ensureOperationalMonitoringIndexes,
  recordOperationalEvent,
  listOperationalEvents,
  getOperationalSummary
} = require('./src/services/operationalMonitoringService');

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const dbName = `${process.env.MONGO_DB_NAME || 'driveportz_ci'}_monitoring`;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  try {
    await db.collection(COLLECTION).deleteMany({});
    await ensureOperationalMonitoringIndexes(db);

    const indexes = await db.collection(COLLECTION).indexes();
    assert(indexes.some((index) => index.key?.timestamp === -1));

    await recordOperationalEvent({
      kind: 'HTTP_5XX',
      severity: 'ERROR',
      message: 'POST /api/payments/create-order returned 500',
      requestId: 'pilot-monitor-1',
      method: 'POST',
      path: '/api/payments/create-order',
      statusCode: 500,
      durationMs: 120
    }, db);

    await recordOperationalEvent({
      kind: 'SLOW_REQUEST',
      severity: 'WARN',
      message: 'GET /api/garage/reports exceeded 5s',
      requestId: 'pilot-monitor-2',
      method: 'GET',
      path: '/api/garage/reports',
      statusCode: 200,
      durationMs: 6000
    }, db);

    const errors = await listOperationalEvents({ severity: 'ERROR', limit: 10 }, db);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].requestId, 'pilot-monitor-1');

    const summary = await getOperationalSummary(db);
    assert.strictEqual(summary.errorsLastHour, 1);
    assert.strictEqual(summary.http5xxLastHour, 1);
    assert(summary.recent.length >= 2);

    console.log('✅ Operational monitoring suite passed.');
  } finally {
    await db.dropDatabase();
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Operational monitoring suite failed:', err);
  process.exit(1);
});
