/**
 * Refactor architecture suite: verifies the abstractions and fixes introduced by the
 * evaluation-driven refactor (security hardening, concurrency safety, gateway polymorphism,
 * caching, async messaging, pagination, settlement state machine).
 *
 * Plain Node + assert against a real MongoDB, like the other suites. Uses its own database name
 * suffix so it can never touch dev data.
 */
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'refactor-suite-secret-key-2026-minimum-32-chars';
process.env.MONGO_DB_NAME = `${process.env.MONGO_DB_NAME || 'driveportz_ci'}_refactor_${process.pid}`;
process.env.EMAIL_PROVIDER = 'mock';
process.env.JOB_WORKER_ENABLED = 'false';

const assert = require('assert');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ❌ ${name}\n     ${err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n     ') : err}`);
  }
}

function tokenFor(user) {
  return jwt.sign({ role: user.role, tv: user.tokenVersion || 0 }, process.env.JWT_SECRET_KEY, { subject: String(user._id), expiresIn: '1h', algorithm: 'HS256' });
}

async function unitTests() {
  console.log('\n— Unit: core abstractions (no database) —');
  const { MemoryCacheProvider } = require('./src/infrastructure/cache/cache');
  const { CircuitBreaker, BREAKER_STATE } = require('./src/infrastructure/http/resilientHttp');
  const { parsePagination } = require('./src/core/pagination');
  const { escapeRegex, safeSearchRegex, asString } = require('./src/core/text');
  const { stripMongoOperators } = require('./src/security/httpHardening');
  const { buildErrorBody, AppError, ValidationError } = require('./src/core/errors');
  const { canTransitionSettlementStatus, normalizeSettlementStatus } = require('./src/services/settlementStateMachine');
  const auth = require('./src/services/authService');
  const { isWebhookTimestampFresh } = require('./src/services/cashfreeService');
  const { resolveGatewayForPayment } = require('./src/services/payments/gateways');
  const { backoffMs } = require('./src/infrastructure/messaging/jobQueue');

  await test('Cache: TTL expiry, LRU eviction and read-through wrap', async () => {
    let now = 0;
    const cache = new MemoryCacheProvider({ maxEntries: 2, defaultTtlMs: 100, now: () => now });
    await cache.set('a', { v: 1 });
    await cache.set('b', { v: 2 });
    assert.deepStrictEqual(await cache.get('a'), { v: 1 }); // touch a => b is LRU
    await cache.set('c', { v: 3 });
    assert.strictEqual(await cache.get('b'), undefined, 'LRU entry evicted');
    now = 1000;
    assert.strictEqual(await cache.get('a'), undefined, 'expired');
    let computed = 0;
    const value = await cache.wrap('k', 50, async () => { computed += 1; return { x: 1 }; });
    await cache.wrap('k', 50, async () => { computed += 1; return { x: 2 }; });
    assert.deepStrictEqual(value, { x: 1 });
    assert.strictEqual(computed, 1, 'second call served from cache');
    const hit = await cache.get('k');
    hit.x = 99;
    assert.deepStrictEqual(await cache.get('k'), { x: 1 }, 'cached values are isolated from caller mutation');
  });

  await test('Circuit breaker: opens after threshold, half-opens after timeout, closes on success', async () => {
    let now = 0;
    const breaker = new CircuitBreaker('t', { failureThreshold: 2, resetTimeoutMs: 100, now: () => now });
    const boom = () => Promise.reject(Object.assign(new Error('down'), { response: { status: 503 } }));
    await breaker.execute(boom).catch(() => {});
    await breaker.execute(boom).catch(() => {});
    assert.strictEqual(breaker.state, BREAKER_STATE.OPEN);
    await assert.rejects(breaker.execute(() => Promise.resolve('x')), /circuit open/);
    now = 200;
    assert.strictEqual(await breaker.execute(() => Promise.resolve('ok')), 'ok');
    assert.strictEqual(breaker.state, BREAKER_STATE.CLOSED);
    await breaker.execute(() => Promise.reject(Object.assign(new Error('bad input'), { response: { status: 400 } }))).catch(() => {});
    assert.strictEqual(breaker.failures, 0, '4xx does not count as a dependency failure');
  });

  await test('Pagination: bounded page/limit', () => {
    assert.deepStrictEqual(parsePagination({}), { page: 1, limit: 50, skip: 0 });
    assert.deepStrictEqual(parsePagination({ page: '3', limit: '10' }), { page: 3, limit: 10, skip: 20 });
    assert.strictEqual(parsePagination({ limit: '100000' }).limit, 200, 'max limit enforced');
    assert.strictEqual(parsePagination({ page: '-5', limit: 'abc' }).page, 1);
  });

  await test('Search input is escaped and bounded (no ReDoS / regex injection)', () => {
    assert.strictEqual(escapeRegex('a.*(b)'), 'a\\.\\*\\(b\\)');
    const re = safeSearchRegex('(a+)+$');
    assert.ok(re.test('xx(a+)+$yy') && !re.test('aaaa'), 'treated literally');
    assert.strictEqual(safeSearchRegex('   '), null);
    assert.strictEqual(asString({ $ne: null }), '', 'objects are not coerced into query values');
  });

  await test('Request sanitizer strips Mongo operators recursively', () => {
    const body = { email: { $ne: null }, nested: { ok: 1, 'a.b': 2, deep: [{ $where: 'x' }] } };
    const removed = stripMongoOperators(body);
    assert.strictEqual(removed, 3);
    assert.deepStrictEqual(body, { email: {}, nested: { ok: 1, deep: [{}] } });
  });

  await test('Error bodies mask 5xx details and keep legacy msg/message fields', () => {
    const server = buildErrorBody(new AppError('db password leaked in message'), { requestId: 'r1' });
    assert.strictEqual(server.message, 'Internal server error');
    assert.strictEqual(server.msg, server.message);
    const client = buildErrorBody(new ValidationError('bad email'), {});
    assert.strictEqual(client.message, 'bad email');
    assert.strictEqual(client.code, 'VALIDATION_ERROR');
  });

  await test('5xx bodies never leak internal error details; 4xx untouched', () => {
    const { maskServerErrors } = require('./src/security/httpHardening');
    const makeRes = (status) => {
      const res = { statusCode: status, sent: null };
      res.json = (b) => { res.sent = b; return res; };
      return res;
    };
    const res500 = makeRes(500);
    maskServerErrors({ requestId: 'r9', path: '/x' }, res500, () => {});
    res500.json({ msg: 'Error loading', error: 'MongoServerError: E11000 secret detail', stack: 'at x.js:1' });
    assert.deepStrictEqual(res500.sent, { msg: 'Error loading', requestId: 'r9' });
    const res400 = makeRes(400);
    maskServerErrors({ requestId: 'r1' }, res400, () => {});
    res400.json({ msg: 'bad', error: 'shown to client' });
    assert.strictEqual(res400.sent.error, 'shown to client');
  });

  await test('Settlement state machine: legal/illegal transitions + legacy alias', () => {
    assert.ok(canTransitionSettlementStatus('APPROVED', 'PROCESSING'));
    assert.ok(!canTransitionSettlementStatus('REQUESTED', 'PROCESSING'), 'cannot pay out unapproved settlement');
    assert.ok(!canTransitionSettlementStatus('PROCESSING', 'REJECTED'), 'cannot reject mid-payout');
    assert.ok(!canTransitionSettlementStatus('SETTLED', 'PROCESSING'), 'terminal');
    assert.strictEqual(normalizeSettlementStatus('COMPLETED'), 'SETTLED');
  });

  await test('Auth: password policy, secure OTP, hashed OTP compare', () => {
    assert.ok(!auth.isStrongPassword('1'));
    assert.ok(!auth.isStrongPassword('abcdefgh'));
    assert.ok(auth.isStrongPassword('abcdefg1'));
    const otp = auth.generateOtp();
    assert.match(otp, /^\d{6}$/);
    const user = { otpHash: auth.hashOtp(otp) };
    assert.ok(auth.otpMatches(user, otp));
    assert.ok(!auth.otpMatches(user, '000000'));
    assert.ok(!auth.otpMatches(user, { $ne: null }), 'object OTP rejected');
  });

  await test('Webhook freshness window rejects replays', () => {
    assert.ok(isWebhookTimestampFresh(Date.now()));
    assert.ok(isWebhookTimestampFresh(Math.floor(Date.now() / 1000)), 'epoch seconds accepted');
    assert.ok(!isWebhookTimestampFresh(Date.now() - 24 * 3600 * 1000), 'day-old webhook rejected');
    assert.ok(!isWebhookTimestampFresh('not-a-number'));
  });

  await test('Gateway polymorphism: payment owner resolution', () => {
    assert.strictEqual(resolveGatewayForPayment({ cfOrderId: 'DP_1' }).name, 'cashfree');
    assert.strictEqual(resolveGatewayForPayment({ razorpayPaymentId: 'pay_123' }).name, 'razorpay');
    assert.strictEqual(resolveGatewayForPayment({ paymentMethod: 'CASH' }), null, 'offline payment has no gateway');
  });

  await test('Job queue backoff grows exponentially and is capped', () => {
    assert.ok(backoffMs(2) > backoffMs(1));
    assert.ok(backoffMs(50) <= 30 * 60 * 1000);
  });
}

async function integrationTests() {
  const { loadConfig } = require('./src/config');
  const { connectToMongo, getDb, closeMongo } = require('./src/db');
  await connectToMongo(loadConfig());
  const db = getDb();
  await db.dropDatabase();
  await require('./src/models/RiskEvent').ensureRiskIndexes(db);
  await require('./src/models/Earnings').ensureEarningsIndexes(db);
  await require('./src/models/PaymentWebhookEvent').ensureWebhookEventIndexes(db);
  await require('./src/models/CoreIndexes').ensureCoreIndexes(db);
  await require('./src/infrastructure/messaging/jobQueue').ensureJobQueueIndexes(db);

  const { resetGateways, CashfreeGateway, RazorpayGateway } = require('./src/services/payments/gateways');
  const gatewayCalls = { refunds: [] };
  const fakeCashfree = {
    createCashfreeOrder: async ({ orderId }) => ({ cf_order_id: `cf_${orderId}`, payment_session_id: 'session_test' }),
    verifyCashfreePayment: async () => ({ verified: true, paymentId: 'cfpay_1', method: 'UPI', status: 'PAID', amountInRupees: 1000 }),
    createCashfreeRefund: async ({ refundId, amountInRupees }) => {
      gatewayCalls.refunds.push(amountInRupees);
      await new Promise((r) => setTimeout(r, 30)); // widen the race window
      return { refund_id: refundId, cf_refund_id: `cfr_${refundId}`, refund_status: 'PENDING' };
    },
    fetchCashfreeOrder: async () => ({ order_amount: 1000, order_status: 'PAID', order_currency: 'INR' }),
    fetchOrderRefunds: async () => [{ refund_status: 'SUCCESS', refund_amount: 250 }],
  };
  resetGateways([new CashfreeGateway(fakeCashfree), new RazorpayGateway(() => ({}))]);

  console.log('\n— Integration: concurrency & money safety (MongoDB) —');

  const users = db.collection('users');
  const owner = { _id: new ObjectId(), name: 'Owner', email: 'owner@driveportz-test.in', role: 'USER', tokenVersion: 0 };
  const garageUser = { _id: new ObjectId(), name: 'Garage A', email: 'garagea@driveportz-test.in', role: 'GARAGE', tokenVersion: 0 };
  const otherGarageUser = { _id: new ObjectId(), name: 'Garage B', email: 'garageb@driveportz-test.in', role: 'GARAGE', tokenVersion: 0 };
  const admin = { _id: new ObjectId(), name: 'Admin', email: 'admin@driveportz-test.in', role: 'ADMIN', tokenVersion: 0 };
  await users.insertMany([owner, garageUser, otherGarageUser, admin]);

  await test('Unique email index blocks duplicate accounts', async () => {
    await assert.rejects(users.insertOne({ email: 'owner@driveportz-test.in', name: 'dup' }), (err) => err.code === 11000);
  });

  const { capturePayment } = require('./src/services/payments/paymentCaptureService');
  const { initiateRefund } = require('./src/services/payments/refundService');

  async function seedPayment(overrides = {}) {
    const serviceId = new ObjectId();
    await db.collection('services').insertOne({ _id: serviceId, totalAmount: overrides.currentTotal || 1000, createdBy: String(garageUser._id), vehicleId: 'v1' });
    const payment = { _id: new ObjectId(), serviceId: String(serviceId), userId: String(owner._id), garageId: String(garageUser._id), amount: 1000, cfOrderId: `DP_${crypto.randomBytes(4).toString('hex')}`, status: 'CREATED', createdAt: new Date(), updatedAt: new Date(), ...overrides.payment };
    await db.collection('payments').insertOne(payment);
    return { payment, serviceId };
  }

  await test('Capture is atomic: concurrent verify + webhook capture exactly once', async () => {
    const { payment } = await seedPayment();
    const args = { db, payment, gatewayPaymentId: 'cfpay_1', method: 'UPI', orderId: payment.cfOrderId, gatewayAmountInRupees: 1000 };
    const results = await Promise.all([capturePayment({ ...args, source: 'VERIFY' }), capturePayment({ ...args, source: 'WEBHOOK' })]);
    assert.strictEqual(results.filter((r) => r.captured).length, 1);
    assert.strictEqual(results.filter((r) => r.alreadyCaptured).length, 1);
    assert.strictEqual(await db.collection('garage_earnings').countDocuments({ paymentId: String(payment._id) }), 1, 'one earnings row');
  });

  await test('Paying a stale (lower) order after the invoice was raised => PARTIALLY_PAID, balance due', async () => {
    const { payment, serviceId } = await seedPayment({ currentTotal: 1500 });
    const result = await capturePayment({ db, payment, gatewayPaymentId: 'p', method: 'UPI', orderId: payment.cfOrderId, gatewayAmountInRupees: 1000, source: 'VERIFY' });
    assert.strictEqual(result.servicePaymentStatus, 'PARTIALLY_PAID');
    const service = await db.collection('services').findOne({ _id: serviceId });
    assert.strictEqual(service.paymentStatus, 'PARTIALLY_PAID');
    assert.strictEqual(service.amountDue, 500);
  });

  await test('Concurrent refunds can never exceed the captured amount', async () => {
    const { payment } = await seedPayment({ payment: { status: 'CAPTURED' } });
    gatewayCalls.refunds.length = 0;
    const attempts = await Promise.allSettled([
      initiateRefund({ db, payment, amount: 700, reason: 'a', actor: admin }),
      initiateRefund({ db, payment, amount: 700, reason: 'b', actor: admin }),
    ]);
    assert.strictEqual(attempts.filter((a) => a.status === 'fulfilled').length, 1, 'exactly one refund succeeds');
    assert.strictEqual(gatewayCalls.refunds.length, 1, 'gateway called once');
    const after = await db.collection('payments').findOne({ _id: payment._id });
    assert.strictEqual(after.totalRefundedAmount, 700);
    assert.strictEqual(after.pendingRefundAmount, 0);
    assert.strictEqual(after.status, 'PARTIALLY_REFUNDED');
  });

  await test('Dispute refund on a Cashfree payment actually calls the gateway', async () => {
    const { payment } = await seedPayment({ payment: { status: 'CAPTURED' } });
    const dispute = { _id: new ObjectId(), disputeNumber: 'DP-DSP-T1', paymentId: String(payment._id), userId: String(owner._id), disputedAmount: 300, status: 'OPEN' };
    await db.collection('payment_disputes').insertOne(dispute);
    gatewayCalls.refunds.length = 0;
    const { resolveDispute } = require('./src/services/disputeService');
    await resolveDispute({ disputeId: String(dispute._id), adminId: String(admin._id), resolution: 'REFUND_PARTIAL', resolutionNote: 'ok', refundAmount: 300, dbInstance: db });
    assert.deepStrictEqual(gatewayCalls.refunds, [300], 'Cashfree refund issued (previously skipped)');
    const after = await db.collection('payments').findOne({ _id: payment._id });
    assert.strictEqual(after.refunds[0].gateway, 'cashfree');
    const resolved = await db.collection('payment_disputes').findOne({ _id: dispute._id });
    assert.strictEqual(resolved.status, 'RESOLVED');
    assert.ok(!resolved.resolutionInProgress, 'claim released');
  });

  await test('Reconciliation uses the owning gateway (Cashfree snapshot, amounts in paise)', async () => {
    const { reconcilePayment } = require('./src/services/reconciliationService');
    const { payment } = await seedPayment({ payment: { status: 'PARTIALLY_REFUNDED', totalRefundedAmount: 250 } });
    const result = await reconcilePayment({ payment, dbInstance: db });
    const mismatchTypes = (result.mismatches || []).map((m) => m.type);
    assert.ok(!mismatchTypes.includes('PAYMENT_NOT_FOUND'), `gateway record found (got ${mismatchTypes.join(',')})`);
    assert.ok(!mismatchTypes.includes('AMOUNT_MISMATCH'));
    assert.ok(!mismatchTypes.includes('REFUND_MISMATCH'));
  });

  await test('Settlement payout claim: concurrent "process" transitions => exactly one wins', async () => {
    const { transitionSettlement } = require('./src/services/settlementStateMachine');
    const settlements = db.collection('settlements');
    const settlement = { _id: new ObjectId(), settlementId: 'DP-SET-T1', status: 'APPROVED' };
    await settlements.insertOne(settlement);
    const outcomes = await Promise.allSettled([
      transitionSettlement({ collection: settlements, settlement, to: 'PROCESSING' }),
      transitionSettlement({ collection: settlements, settlement, to: 'PROCESSING' }),
    ]);
    assert.strictEqual(outcomes.filter((o) => o.status === 'fulfilled').length, 1);
    assert.strictEqual(outcomes.find((o) => o.status === 'rejected').reason.code, 'SETTLEMENT_CONCURRENT_MODIFICATION');
    const after = await settlements.findOne({ _id: settlement._id });
    assert.strictEqual(after.statusHistory.length, 1, 'transition audited once');
  });

  console.log('\n— Integration: async messaging & distributed rate limiting —');

  await test('Job queue: dedupe, retry with backoff, dead-letter, exactly-once claim', async () => {
    const { enqueue, JobWorker, JOB_STATUS } = require('./src/infrastructure/messaging/jobQueue');
    const first = await enqueue('test.job', { n: 1 }, { dedupeKey: 'same' });
    const dup = await enqueue('test.job', { n: 1 }, { dedupeKey: 'same' });
    assert.ok(first.enqueued && dup.duplicate, 'idempotent enqueue');

    let runs = 0;
    const workers = [new JobWorker({ handlers: { 'test.job': async () => { runs += 1; } } }), new JobWorker({ handlers: { 'test.job': async () => { runs += 1; } } })];
    await Promise.all(workers.map((w) => w.drain()));
    assert.strictEqual(runs, 1, 'two workers, one execution');

    await enqueue('test.fail', {});
    const failing = new JobWorker({ handlers: { 'test.fail': async () => { throw new Error('nope'); } } });
    await failing.drain();
    const job = await db.collection('job_queue').findOne({ type: 'test.fail' });
    assert.strictEqual(job.status, JOB_STATUS.PENDING, 'rescheduled');
    assert.ok(job.runAt > new Date(), 'with backoff');
    await db.collection('job_queue').updateOne({ _id: job._id }, { $set: { attempts: 6, runAt: new Date(0) } });
    await failing.drain();
    assert.strictEqual((await db.collection('job_queue').findOne({ _id: job._id })).status, JOB_STATUS.DEAD, 'dead-lettered');
  });

  await test('Payment capture enqueues notifications instead of sending inline', async () => {
    const { registerPaymentNotifications } = require('./src/services/payments/paymentNotifications');
    const sent = [];
    const handlers = registerPaymentNotifications({ notifyUser: async (userId, msg) => { sent.push({ userId, title: msg.title }); } });
    const { payment } = await seedPayment();
    await capturePayment({ db, payment, gatewayPaymentId: 'x', method: 'UPI', orderId: payment.cfOrderId, gatewayAmountInRupees: 1000, source: 'VERIFY' });
    assert.strictEqual(sent.length, 0, 'nothing sent on the request path');
    const { JobWorker } = require('./src/infrastructure/messaging/jobQueue');
    await new JobWorker({ handlers }).drain(50);
    assert.ok(sent.some((s) => s.userId === String(owner._id)) && sent.some((s) => s.userId === String(garageUser._id)), 'delivered by worker');
  });

  await test('Rate-limit store shares counters through MongoDB', async () => {
    const { MongoRateLimitStore } = require('./src/infrastructure/rateLimit/rateLimiters');
    const a = new MongoRateLimitStore({ prefix: 't:' });
    const b = new MongoRateLimitStore({ prefix: 't:' });
    a.init({ windowMs: 60000 });
    b.init({ windowMs: 60000 });
    await a.increment('ip1');
    const second = await b.increment('ip1');
    assert.strictEqual(second.totalHits, 2, 'instance B sees instance A hits');
  });

  console.log('\n— HTTP: hardening & authorization (real Express app) —');
  const { buildApp } = require('./server');
  const server = buildApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { body, token, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  };

  try {
    await test('Security headers present, X-Powered-By removed', async () => {
      const r = await call('GET', '/');
      assert.strictEqual(r.headers.get('x-powered-by'), null);
      assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(r.headers.get('x-frame-options'), 'DENY');
      assert.ok(r.headers.get('content-security-policy'));
    });

    await test('Unknown route => JSON 404; malformed JSON => 400 without stack trace', async () => {
      const nf = await call('GET', '/api/nope');
      assert.strictEqual(nf.status, 404);
      assert.strictEqual(nf.json.code, 'NOT_FOUND');
      const bad = await call('POST', '/api/auth/login', { body: '{"email":' });
      assert.strictEqual(bad.status, 400);
      assert.strictEqual(bad.json.code, 'MALFORMED_JSON');
      assert.ok(!/at .*\.js:\d+/.test(bad.text), 'no stack trace');
    });

    await test('Oversized JSON body rejected with 413 (default 1mb limit)', async () => {
      const r = await call('POST', '/api/auth/login', { body: JSON.stringify({ email: 'a'.repeat(2 * 1024 * 1024), password: 'x' }) });
      assert.strictEqual(r.status, 413);
    });

    await test('NoSQL operator injection on login is neutralised', async () => {
      const r = await call('POST', '/api/auth/login', { body: { email: { $ne: null }, password: { $ne: null } } });
      assert.ok([400, 401].includes(r.status), `got ${r.status}`);
      assert.ok(!r.json.token);
    });

    await test('Signup enforces password policy', async () => {
      const r = await call('POST', '/api/auth/signup', { body: { name: 'W', email: 'weak@driveportz-test.in', password: '1', termsAccepted: true, privacyAccepted: true } });
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.json.code, 'WEAK_PASSWORD');
    });

    await test('Revoked sessions: token with stale tokenVersion is rejected', async () => {
      const token = tokenFor(owner);
      assert.strictEqual((await call('GET', '/api/auth/me', { token })).status, 200);
      await users.updateOne({ _id: owner._id }, { $inc: { tokenVersion: 1 } });
      // Code paths that bump tokenVersion invalidate the auth-user cache (other instances: <=30s TTL).
      await require('./src/middleware/auth').invalidateAuthUser(owner._id);
      assert.strictEqual((await call('GET', '/api/auth/me', { token })).status, 401);
      owner.tokenVersion = 1;
    });

    await test('Forged alg:none token rejected', async () => {
      const forged = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: String(admin._id) })).toString('base64url')}.`;
      assert.strictEqual((await call('GET', '/api/auth/me', { token: forged })).status, 401);
    });

    // Vehicle access policy
    const vehicles = db.collection('vehicles');
    const relatedVehicle = { _id: new ObjectId(), vehicleNumber: 'KA01AB1234', ownerId: String(owner._id), ownerName: 'Owner', phone: '9000000000', purchasePrice: 900000, rcBookUrl: '/uploads/rc.pdf', createdAt: new Date() };
    const strangerVehicle = { _id: new ObjectId(), vehicleNumber: 'KA09ZZ9999', ownerId: new ObjectId().toString(), ownerName: 'Stranger', phone: '9111111111', purchasePrice: 500000, createdAt: new Date() };
    await vehicles.insertMany([relatedVehicle, strangerVehicle]);
    const garageA = { _id: new ObjectId(), ownerUserId: String(garageUser._id), name: 'Garage A', isActive: true };
    const garageB = { _id: new ObjectId(), ownerUserId: String(otherGarageUser._id), name: 'Garage B', isActive: true };
    await db.collection('garages').insertMany([garageA, garageB]);
    const booking = { _id: new ObjectId(), garageId: String(garageA._id), vehicleId: String(relatedVehicle._id), userId: String(owner._id), status: 'ACCEPTED', createdAt: new Date() };
    await db.collection('bookings').insertOne(booking);

    await test('Garage lists only vehicles it has a relationship with, without purchase/document PII', async () => {
      const r = await call('GET', '/api/vehicles/all', { token: tokenFor(garageUser) });
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(r.json.map((v) => v.vehicleNumber), ['KA01AB1234']);
      assert.strictEqual(r.json[0].purchasePrice, undefined);
      assert.strictEqual(r.json[0].rcBookUrl, undefined);
      assert.strictEqual(r.headers.get('x-total-count'), '1');
    });

    await test('Garage exact-number lookup returns identification only (walk-ins)', async () => {
      const r = await call('GET', '/api/vehicles/all?vehicleNumber=ka09zz9999', { token: tokenFor(garageUser) });
      assert.strictEqual(r.json.length, 1);
      assert.strictEqual(r.json[0].lookupOnly, true);
      assert.strictEqual(r.json[0].phone, undefined);
      assert.strictEqual(r.json[0].ownerName, undefined);
    });

    await test('Garage cannot read an unrelated vehicle or its service history', async () => {
      assert.strictEqual((await call('GET', `/api/vehicles/${strangerVehicle._id}`, { token: tokenFor(garageUser) })).status, 403);
      assert.strictEqual((await call('GET', `/api/services/${strangerVehicle._id}`, { token: tokenFor(garageUser) })).status, 403);
      assert.strictEqual((await call('GET', `/api/vehicles/${relatedVehicle._id}`, { token: tokenFor(garageUser) })).status, 200);
    });

    await test('Garage cannot complete another garage\'s booking', async () => {
      const r = await call('POST', '/api/services/complete', { token: tokenFor(otherGarageUser), body: { bookingId: String(booking._id), vehicleId: String(relatedVehicle._id), odometerKm: 1000 } });
      assert.strictEqual(r.status, 403);
    });

    await test('Walk-in service by unrelated garage is recorded but NOT verified', async () => {
      const r = await call('POST', '/api/services/add', { token: tokenFor(otherGarageUser), body: { vehicleId: String(strangerVehicle._id), serviceDate: '2026-11-01', odometerKm: 1200, serviceCategory: 'General', serviceType: 'Oil change' } });
      assert.ok([200, 201].includes(r.status), `got ${r.status} ${r.text.slice(0, 120)}`);
      const svc = await db.collection('services').findOne({ vehicleId: String(strangerVehicle._id) });
      assert.strictEqual(svc.verifiedService, false);
      assert.strictEqual(svc.verificationStatus, 'Pending');
    });

    await test('Suspended garage cannot reactivate itself by re-saving its profile', async () => {
      await db.collection('garages').updateOne({ _id: garageB._id }, { $set: { isActive: false } });
      const r = await call('POST', '/api/garages/me', { token: tokenFor(otherGarageUser), body: { name: 'Garage B renamed' } });
      assert.ok(r.status < 300, `got ${r.status}`);
      assert.strictEqual((await db.collection('garages').findOne({ _id: garageB._id })).isActive, false);
    });

    await test('Admin settlement mutations reach the hardened router (idempotency key required)', async () => {
      const s = { _id: new ObjectId(), settlementId: 'DP-SET-HTTP', status: 'REQUESTED', requestedAmount: 1000, garageId: String(garageUser._id) };
      await db.collection('settlements').insertOne(s);
      const noKey = await call('POST', `/api/admin/settlements/${s._id}/approve`, { token: tokenFor(admin), body: { confirmation: true } });
      assert.strictEqual(noKey.status, 400);
      assert.strictEqual(noKey.json.code, 'IDEMPOTENCY_KEY_REQUIRED');
      const ok = await call('POST', `/api/admin/settlements/${s._id}/approve`, { token: tokenFor(admin), body: { confirmation: true }, headers: { 'Idempotency-Key': crypto.randomUUID() } });
      assert.strictEqual(ok.status, 200, ok.text);
      assert.strictEqual((await db.collection('settlements').findOne({ _id: s._id })).status, 'APPROVED');
    });

    await test('Idempotency: concurrent duplicates execute once, replay returns stored response', async () => {
      const s = { _id: new ObjectId(), settlementId: 'DP-SET-IDEM', status: 'APPROVED', requestedAmount: 1000, garageId: String(garageUser._id) };
      await db.collection('settlements').insertOne(s);
      const key = crypto.randomUUID();
      const opts = { token: tokenFor(admin), body: { confirmation: true, reason: 'dup test' }, headers: { 'Idempotency-Key': key } };
      const [a, b] = await Promise.all([call('POST', `/api/admin/settlements/${s._id}/reject`, opts), call('POST', `/api/admin/settlements/${s._id}/reject`, opts)]);
      const statuses = [a.status, b.status].sort();
      assert.ok(statuses[0] === 200 && [200, 409].includes(statuses[1]), `got ${statuses}`);
      const replay = await call('POST', `/api/admin/settlements/${s._id}/reject`, opts);
      assert.strictEqual(replay.status, 200);
      assert.strictEqual(replay.headers.get('idempotent-replayed'), 'true');
    });

    await test('Cashfree webhook: stale timestamp rejected even with a valid signature', async () => {
      process.env.CASHFREE_SECRET_KEY = 'whsec_test';
      process.env.CASHFREE_WEBHOOK_SECRET = 'whsec_test';
      const body = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: 'X' } } });
      const ts = String(Date.now() - 2 * 3600 * 1000);
      const signature = crypto.createHmac('sha256', 'whsec_test').update(ts + body).digest('base64');
      const r = await call('POST', '/api/payments/cashfree-webhook', { body, headers: { 'x-webhook-signature': signature, 'x-webhook-timestamp': ts } });
      assert.strictEqual(r.status, 400);
    });

    await test('Uploaded file whose bytes do not match its declared type is rejected', async () => {
      const form = new FormData();
      form.append('photo', new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' }), 'x.png');
      const res = await fetch(`${base}/api/auth/me/photo`, { method: 'POST', headers: { Authorization: `Bearer ${tokenFor(owner)}` }, body: form });
      assert.strictEqual(res.status, 415);
    });

    await test('Payment history is paginated with total headers', async () => {
      const r = await call('GET', '/api/payments/history?limit=2', { token: tokenFor(owner) });
      assert.strictEqual(r.status, 200);
      assert.ok(r.json.payments.length <= 2);
      assert.ok(Number(r.headers.get('x-total-count')) >= 2);
    });

    await test('Superseded checkout attempts are kept for audit but hidden from customer history', async () => {
      const serviceId = new ObjectId();
      await db.collection('services').insertOne({ _id: serviceId, totalAmount: 1000, vehicleId: 'v-sup' });
      const older = { _id: new ObjectId(), serviceId: String(serviceId), userId: String(owner._id), amount: 1000, cfOrderId: 'DP_SUP_OLD', status: 'CREATED', createdAt: new Date(Date.now() - 60000), updatedAt: new Date() };
      const newer = { _id: new ObjectId(), serviceId: String(serviceId), userId: String(owner._id), amount: 1000, cfOrderId: 'DP_SUP_NEW', status: 'CREATED', createdAt: new Date(), updatedAt: new Date() };
      await db.collection('payments').insertMany([older, newer]);
      await capturePayment({ db, payment: newer, gatewayPaymentId: 'p', method: 'UPI', orderId: 'DP_SUP_NEW', gatewayAmountInRupees: 1000, source: 'VERIFY' });
      const audit = await db.collection('payments').findOne({ _id: older._id });
      assert.strictEqual(audit.status, 'FAILED');
      assert.strictEqual(audit.supersededBy, String(newer._id));
      const r = await call('GET', '/api/payments/history?limit=200', { token: tokenFor(owner) });
      const ids = r.json.payments.map((p) => p.id);
      assert.ok(ids.includes(String(newer._id)) && !ids.includes(String(older._id)));
    });

    // --- httpOnly cookie sessions + CSRF ---
    const bcrypt = require('bcryptjs');
    const cookieUser = { _id: new ObjectId(), name: 'Cookie User', email: 'cookie@driveportz-test.in', role: 'USER', tokenVersion: 0, password: await bcrypt.hash('Cookie123', 4) };
    await users.insertOne(cookieUser);
    let sessionCookie = null;
    let accessToken = null;

    await test('Login sets an httpOnly session cookie and returns only a short-lived access token', async () => {
      const r = await call('POST', '/api/auth/login', { body: { email: 'cookie@driveportz-test.in', password: 'Cookie123' } });
      assert.strictEqual(r.status, 200, r.text);
      const setCookie = r.headers.get('set-cookie') || '';
      assert.match(setCookie, /dp_session=/);
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /Path=\/api/);
      sessionCookie = setCookie.split(';')[0];
      accessToken = r.json.token;
      const decoded = jwt.decode(accessToken);
      assert.strictEqual(decoded.typ, 'access');
      assert.ok(decoded.exp - decoded.iat <= 15 * 60, 'access token lives at most 15 minutes');
    });

    await test('Cookie alone authenticates safe requests', async () => {
      const r = await call('GET', '/api/auth/me', { headers: { Cookie: sessionCookie } });
      assert.strictEqual(r.status, 200);
    });

    await test('Cookie-authenticated mutation without CSRF header is rejected', async () => {
      const blocked = await call('POST', '/api/payments/create-order', { headers: { Cookie: sessionCookie }, body: {} });
      assert.strictEqual(blocked.status, 403);
      assert.strictEqual(blocked.json.code, 'CSRF_CHECK_FAILED');
      const allowed = await call('POST', '/api/payments/create-order', { headers: { Cookie: sessionCookie, 'X-Requested-With': 'DrivePortz' }, body: {} });
      assert.strictEqual(allowed.status, 400, 'passes auth+CSRF, fails validation');
    });

    await test('Session refresh: cookie mints a new access token; an access token cannot refresh itself', async () => {
      const viaCookie = await call('GET', '/api/auth/session', { headers: { Cookie: sessionCookie } });
      assert.strictEqual(viaCookie.status, 200);
      assert.strictEqual(jwt.decode(viaCookie.json.token).typ, 'access');
      const viaAccess = await call('GET', '/api/auth/session', { token: accessToken });
      assert.strictEqual(viaAccess.status, 401);
      assert.strictEqual(viaAccess.json.code, 'SESSION_REQUIRED');
    });

    await test('Logout everywhere clears the cookie and revokes existing sessions', async () => {
      const r = await call('POST', '/api/auth/logout', { headers: { Cookie: sessionCookie, 'X-Requested-With': 'DrivePortz' }, body: { allDevices: true } });
      assert.strictEqual(r.status, 200);
      assert.match(r.headers.get('set-cookie') || '', /dp_session=;/);
      assert.strictEqual((await call('GET', '/api/auth/me', { headers: { Cookie: sessionCookie } })).status, 401);
    });

    await test('Login is rate limited (distributed store)', async () => {
      let limited = false;
      for (let i = 0; i < 15 && !limited; i += 1) {
        const r = await call('POST', '/api/auth/login', { body: { email: 'nobody@driveportz-test.in', password: `wrong${i}` } });
        if (r.status === 429) limited = true;
      }
      assert.ok(limited, 'expected 429 within 15 attempts');
    });
  } finally {
    server.close();
    await db.dropDatabase();
    await closeMongo();
  }
}

(async () => {
  console.log('🚀 DrivePortz refactor architecture suite');
  await unitTests();
  await integrationTests();
  console.log(`\n${failed === 0 ? '✅' : '❌'} Refactor suite: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('❌ Refactor suite crashed:', err);
  process.exit(1);
});
