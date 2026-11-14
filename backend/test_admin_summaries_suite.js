/**
 * Admin KPI summaries: verifies the aggregation-pipeline implementations (which replaced
 * load-everything-into-memory loops) return exactly the expected counts and sums, including
 * legacy rows with string amounts and missing fields.
 */
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'summaries-suite-secret-key-2026-minimum-32-chars';
process.env.MONGO_DB_NAME = `${process.env.MONGO_DB_NAME || 'driveportz_ci'}_summaries_${process.pid}`;
process.env.JOB_WORKER_ENABLED = 'false';

const assert = require('assert');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`  ✅ ${name}`); } catch (err) { failed += 1; console.error(`  ❌ ${name}\n     ${err.stack.split('\n').slice(0, 3).join('\n     ')}`); }
}

(async () => {
  console.log('🚀 Admin summaries suite');
  const { aggregateKpis, countWhere, sumWhere, equals, inList, num } = require('./src/core/aggregation');
  const { loadConfig } = require('./src/config');
  const { connectToMongo, getDb, closeMongo } = require('./src/db');
  await connectToMongo(loadConfig());
  const db = getDb();
  await db.dropDatabase();

  await test('aggregateKpis: zero defaults on empty collection, string amounts coerced', async () => {
    const empty = await aggregateKpis(db.collection('nothing_here'), { a: countWhere(equals('$s', 'X')), v: { $sum: num('$amt') } });
    assert.deepStrictEqual(empty, { total: 0, a: 0, v: 0 });
    await db.collection('agg_t').insertMany([{ s: 'X', amt: '10.5' }, { s: 'Y', amt: 4 }, { s: 'X', amt: null }, { s: 'X', amt: 'bad' }]);
    const r = await aggregateKpis(db.collection('agg_t'), { xs: countWhere(equals('$s', 'X')), xAmt: sumWhere(equals('$s', 'X'), '$amt'), any: countWhere(inList('$s', ['X', 'Y'])) });
    assert.deepStrictEqual(r, { total: 4, xs: 3, xAmt: 10.5, any: 4 });
  });

  const admin = { _id: new ObjectId(), email: 'admin@driveportz-test.in', role: 'ADMIN', tokenVersion: 0 };
  const user = { _id: new ObjectId(), email: 'user@driveportz-test.in', role: 'USER', tokenVersion: 0 };
  await db.collection('users').insertMany([admin, user]);
  const tokenFor = (u) => jwt.sign({ role: u.role, tv: 0 }, process.env.JWT_SECRET_KEY, { subject: String(u._id), expiresIn: '1h', algorithm: 'HS256' });

  await db.collection('payment_disputes').insertMany([
    { status: 'OPEN', category: 'REFUND_NOT_RECEIVED', disputedAmount: 100 },
    { status: 'UNDER_REVIEW', category: 'OTHER', disputedAmount: '250.5' },
    { status: 'WAITING_FOR_GARAGE', category: 'WRONG_REFUND_AMOUNT', disputedAmount: 50 },
    { status: 'RESOLVED', category: 'OTHER' },
    { status: 'REJECTED', category: 'OTHER', disputedAmount: 10 },
  ]);
  await db.collection('settlements').insertMany([
    { status: 'REQUESTED', requestedAmount: 1000 },
    { status: 'UNDER_REVIEW', requestedAmount: 2000, approvedAmount: 1500 },
    { status: 'PROCESSING', requestedAmount: 300 },
    { status: 'SETTLED', approvedAmount: 400 },
    { status: 'COMPLETED', requestedAmount: '600' },
    { status: 'FAILED', requestedAmount: 1 },
    { status: 'FAILED_PERMANENTLY', requestedAmount: 1 },
    { status: 'RETRY_PENDING', requestedAmount: 1 },
    { status: 'UNDER_REVIEW', requestedAmount: 60000, isHighValue: true, approvalCount: 1, requiredApprovalCount: 2 },
    { status: 'SETTLED', requestedAmount: 70000, isHighValue: true, approvalCount: 1 },
  ]);
  await db.collection('settlement_holds').insertMany([{ active: true }, { active: false }]);
  await db.collection('settlement_reconciliation').insertMany([{ status: 'OPEN' }, { status: 'OPEN' }, { status: 'CLOSED' }]);
  await db.collection('payment_reconciliations').insertMany([
    { reconciliationStatus: 'MATCHED' }, { reconciliationStatus: 'MISMATCH', amountDifference: '12.5' },
    { reconciliationStatus: 'MISMATCH', amountDifference: 7.5 }, { reconciliationStatus: 'MISSING' }, { reconciliationStatus: 'PENDING' }, { reconciliationStatus: 'RESOLVED', amountDifference: 99 },
  ]);
  await db.collection('payment_risk_events').insertMany([
    { riskLevel: 'CRITICAL', status: 'OPEN' }, { riskLevel: 'HIGH', status: 'OPEN' }, { riskLevel: 'HIGH', status: 'REVIEWED' }, { riskLevel: 'MEDIUM', status: 'DISMISSED' }, { riskLevel: 'LOW', status: 'OPEN' },
  ]);

  const { buildApp } = require('./server');
  const server = buildApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (path, u = admin) => {
    const res = await fetch(base + path, { headers: { Authorization: `Bearer ${tokenFor(u)}` } });
    return { status: res.status, json: await res.json().catch(() => null) };
  };

  try {
    await test('GET /api/admin/disputes/summary', async () => {
      const r = await get('/api/admin/disputes/summary');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(r.json.summary, { totalDisputes: 5, open: 1, underReview: 2, resolved: 1, rejected: 1, refundDisputes: 2, totalDisputedVolume: 410.5 });
    });

    await test('GET /api/admin/financial-operations/summary', async () => {
      const r = await get('/api/admin/financial-operations/summary');
      assert.strictEqual(r.status, 200);
      const s = r.json.summary;
      assert.strictEqual(s.pendingCount, 1); assert.strictEqual(s.pendingAmount, 1000);
      assert.strictEqual(s.underReviewCount, 2); assert.strictEqual(s.underReviewAmount, 61500);
      assert.strictEqual(s.processingCount, 1); assert.strictEqual(s.processingAmount, 300);
      assert.strictEqual(s.settledCount, 3); assert.strictEqual(s.settledAmount, 71000, 'SETTLED + legacy COMPLETED');
      assert.strictEqual(s.failedCount, 2); assert.strictEqual(s.retryQueueCount, 1);
      assert.strictEqual(s.highValuePendingCount, 1, 'only the open high-value settlement awaiting 2nd approval');
      assert.strictEqual(s.highValuePendingAmount, 60000);
      assert.strictEqual(s.activeHoldsCount, 1); assert.strictEqual(s.openReconciliationsCount, 2);
    });

    await test('GET /api/admin/reconciliation/summary', async () => {
      const r = await get('/api/admin/reconciliation/summary');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(r.json.summary, { totalChecked: 6, matched: 1, mismatched: 2, missing: 1, pending: 1, resolved: 1, totalMismatchAmount: 20 });
    });

    await test('GET /api/admin/risk/summary', async () => {
      const r = await get('/api/admin/risk/summary');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(r.json.summary, { totalFlagged: 5, criticalCount: 1, highCount: 2, mediumCount: 1, openCount: 3, reviewedCount: 2 });
    });

    await test('Summaries are admin-only', async () => {
      for (const path of ['/api/admin/disputes/summary', '/api/admin/financial-operations/summary', '/api/admin/reconciliation/summary', '/api/admin/risk/summary']) {
        assert.ok([401, 403].includes((await get(path, user)).status), path);
      }
    });
  } finally {
    server.close();
    await db.dropDatabase();
    await closeMongo();
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} Admin summaries suite: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => { console.error('❌ Admin summaries suite crashed:', err); process.exit(1); });
