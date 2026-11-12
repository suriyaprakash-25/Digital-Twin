/**
 * Admin routes suite: covers the routes/admin.js refactor (thin HTTP adapters over
 * services/admin, which depend only on injected repositories).
 *
 *   1. Unit tests of the admin services with FAKE repositories (no database): proves the services
 *      depend on abstractions (DIP) and holds the business rules (search escaping, status filters,
 *      moderation changes, KPI shaping, injected clock).
 *   2. HTTP tests of every /api/admin endpoint in routes/admin.js against a real MongoDB through
 *      the real Express app: response shapes, RBAC, search escaping, pagination, no secrets leaked.
 *
 * Plain Node + assert. Uses its own database (driveportz_admin_suite_<pid>) and drops it at the end.
 */
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'admin-suite-secret-key-2026-minimum-32-chars';
process.env.MONGO_DB_NAME = `driveportz_admin_suite_${process.pid}`;
process.env.EMAIL_PROVIDER = 'mock';
process.env.JOB_WORKER_ENABLED = 'false';

const assert = require('assert');
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
    console.error(`  ❌ ${name}\n     ${err && err.stack ? err.stack.split('\n').slice(0, 4).join('\n     ') : err}`);
  }
}

function tokenFor(user) {
  return jwt.sign({ role: user.role, tv: user.tokenVersion || 0 }, process.env.JWT_SECRET_KEY, { subject: String(user._id), expiresIn: '1h', algorithm: 'HS256' });
}

const PAGE = { page: 1, limit: 20, skip: 0 };

/** Minimal fake repository: records calls, returns canned values. */
function fakeRepo(overrides = {}) {
  const calls = [];
  const record = (name, fallback) => async (...args) => {
    calls.push({ name, args });
    return typeof overrides[name] === 'function' ? overrides[name](...args) : (overrides[name] !== undefined ? overrides[name] : fallback);
  };
  return {
    calls,
    count: record('count', 0),
    countAll: record('countAll', 0),
    aggregate: record('aggregate', []),
    find: record('find', []),
    findOne: record('findOne', null),
    updateOne: record('updateOne', { matchedCount: 1 }),
    findPageForAdmin: record('findPageForAdmin', { items: [], total: 0, page: 1, limit: 20 }),
    findByIdWithoutSecrets: record('findByIdWithoutSecrets', null),
    getAdminKpis: record('getAdminKpis', {}),
    getCommissionKpis: record('getCommissionKpis', {}),
  };
}

async function unitTests() {
  console.log('\n— Unit: admin services with fake repositories (no database) —');
  const {
    createAdminServices, createAdminUserService, createAdminGarageService,
    createAdminDashboardService, createAdminFinanceService,
  } = require('./src/services/admin');
  const { ValidationError, NotFoundError } = require('./src/core/errors');
  const { SAFE_USER_PROJECTION } = require('./src/repositories/UserRepository');
  const queries = require('./src/services/admin/adminQueries');

  await test('createAdminServices requires injected repositories and never needs a database', () => {
    assert.throws(() => createAdminServices(), /requires repositories/);
    const services = createAdminServices({ users: fakeRepo(), garages: fakeRepo() });
    assert.ok(services.users && services.garages && services.dashboard && services.finance);
  });

  await test('Users list: search is escaped via safeSearchRegex and rows are whitelisted', async () => {
    const users = fakeRepo({
      findPageForAdmin: () => ({ items: [{ _id: new ObjectId(), name: 'A', email: 'a@x.in', password: 'hash', otp: '1', vehicleCount: 2 }], total: 1, page: 1, limit: 20 }),
    });
    const service = createAdminUserService({ users, vehicles: fakeRepo(), serviceRecords: fakeRepo() });
    const out = await service.listUsers({ search: '(a+)+$', page: PAGE });
    const [filter, page] = users.calls[0].args;
    assert.ok(filter.$or[0].name instanceof RegExp);
    assert.strictEqual(filter.$or[0].name.source, '\\(a\\+\\)\\+\\$', 'metacharacters escaped');
    assert.deepStrictEqual(filter.$or.map((c) => Object.keys(c)[0]), ['name', 'email']);
    assert.deepStrictEqual(page, PAGE);
    assert.strictEqual(out.items[0].password, undefined);
    assert.strictEqual(out.items[0].otp, undefined);
    assert.strictEqual(out.items[0].vehicleCount, 2);
    assert.strictEqual(out.items[0].serviceCount, 0);
    await service.listUsers({ search: '   ', page: PAGE });
    assert.deepStrictEqual(users.calls[1].args[0], {}, 'blank search means no filter');
  });

  await test('User detail: 400 for bad id, 404 when missing, bounded owned-asset queries', async () => {
    const id = new ObjectId();
    const users = fakeRepo({ findByIdWithoutSecrets: (oid) => (String(oid) === String(id) ? { _id: id, name: 'U' } : null) });
    const vehicles = fakeRepo({ find: [{ _id: new ObjectId(), vehicleNumber: 'TN01', manufacturingYear: 2020 }] });
    const serviceRecords = fakeRepo({ find: [{ _id: new ObjectId(), totalCost: 0 }] });
    const service = createAdminUserService({ users, vehicles, serviceRecords });
    await assert.rejects(service.getUserDetail('not-an-id'), (e) => e instanceof ValidationError && e.message === 'Invalid user ID');
    await assert.rejects(service.getUserDetail(String(new ObjectId())), (e) => e instanceof NotFoundError && e.message === 'User not found');
    const detail = await service.getUserDetail(String(id));
    assert.strictEqual(detail.id, String(id));
    assert.strictEqual(detail.vehicles[0].year, 2020);
    const [vFilter, vOpts] = vehicles.calls[0].args;
    assert.deepStrictEqual(vFilter, { ownerId: String(id), isArchived: { $ne: true } });
    assert.ok(vOpts.limit > 0 && vOpts.projection, 'vehicle query is bounded and projected');
    assert.deepStrictEqual(serviceRecords.calls[0].args[1].sort, { serviceDate: -1 });
  });

  await test('Garage moderation: correct field changes, injected clock, typed errors', async () => {
    const fixed = new Date('2026-01-02T03:04:05Z');
    const garages = fakeRepo();
    const service = createAdminGarageService({ garages }, { now: () => fixed });
    const id = String(new ObjectId());
    await service.moderateGarage(id, 'suspend');
    const [filter, update] = garages.calls[0].args;
    assert.strictEqual(String(filter._id), id);
    assert.deepStrictEqual(update, { $set: { isActive: false, verified: false, updatedAt: fixed } });
    await service.moderateGarage(id, 'activate');
    assert.deepStrictEqual(garages.calls[1].args[1].$set, { isActive: true, updatedAt: fixed });
    await assert.rejects(service.moderateGarage(id, 'constructor'), ValidationError);
    await assert.rejects(service.moderateGarage('bad', 'verify'), (e) => e.message === 'Invalid garage ID');
    const missing = createAdminGarageService({ garages: fakeRepo({ updateOne: { matchedCount: 0 } }) });
    await assert.rejects(missing.moderateGarage(id, 'verify'), (e) => e instanceof NotFoundError && e.message === 'Garage not found');
  });

  await test('Garage list: booking stats are grouped inside the lookup (no per-booking documents)', async () => {
    const garages = fakeRepo({ aggregate: [{ _id: new ObjectId(), name: 'G', _bookingStats: [{ totalBookings: 3, servicesCompleted: 2, revenue: 900 }], _owner: [{ name: 'O', email: 'o@x.in' }] }], count: 1 });
    const out = await createAdminGarageService({ garages }).listGarages({ search: 'a.b', page: PAGE });
    assert.deepStrictEqual(out.items[0].ownerName, 'O');
    assert.strictEqual(out.items[0].servicesCompleted, 2);
    assert.strictEqual(out.items[0].revenue, 900);
    assert.strictEqual(out.total, 1);
    const pipeline = garages.calls.find((c) => c.name === 'aggregate').args[0];
    const bookingLookup = pipeline.find((s) => s.$lookup && s.$lookup.from === 'bookings').$lookup;
    assert.ok(bookingLookup.pipeline.some((s) => s.$group), 'bookings aggregated, not loaded');
    assert.strictEqual(pipeline[0].$match.$or[0].name.source, 'a\\.b');
    assert.deepStrictEqual(pipeline[0].$match.isActive, { $ne: false });
  });

  await test('Dashboard / revenue / analytics: composed from counts and aggregations', async () => {
    const repos = {
      users: fakeRepo({ countAll: 7, aggregate: [{ month: '2026-01', count: 7 }] }),
      garages: fakeRepo({ count: (filter) => (filter.verified ? 2 : 5) }),
      vehicles: fakeRepo({ count: 9 }),
      serviceRecords: fakeRepo({ count: 4 }),
      bookings: fakeRepo({ aggregate: (pipeline) => (pipeline.length === 2 ? [{ total: 1234 }] : [{ totalRevenue: 100, totalServices: 2 }, { totalRevenue: 50, totalServices: 1 }]) }),
    };
    const service = createAdminDashboardService(repos);
    assert.deepStrictEqual(await service.getDashboard(), { totalUsers: 7, totalGarages: 5, totalVehicles: 9, totalServices: 4, totalRevenue: 1234, verifiedGarages: 2 });
    const revenue = await service.getRevenue();
    assert.strictEqual(revenue.grandTotal, 150);
    assert.strictEqual(revenue.totalServices, 3);
    assert.strictEqual(revenue.totalGarages, 2);
    const analytics = await service.getAnalytics();
    assert.deepStrictEqual(Object.keys(analytics), ['monthlyUsers', 'monthlyVehicles', 'monthlyServices', 'monthlyRevenue', 'topGarages']);
    const empty = createAdminDashboardService({ ...repos, bookings: fakeRepo({ aggregate: [] }) });
    assert.strictEqual((await empty.getDashboard()).totalRevenue, 0);
  });

  await test('Finance: payment status aliases, safe search, ALL = no filter', async () => {
    const payments = fakeRepo();
    const service = createAdminFinanceService({ payments, earnings: fakeRepo(), settlements: fakeRepo(), garages: fakeRepo(), serviceRecords: fakeRepo() });
    const run = async (query) => { await service.listPayments({ ...query, page: PAGE }); return payments.calls[payments.calls.length - 1].args[0]; };
    assert.deepStrictEqual(await run({ status: 'PAID' }), { status: 'CAPTURED' });
    assert.deepStrictEqual(await run({ status: 'REFUNDED' }), { status: { $in: ['REFUNDED', 'PARTIALLY_REFUNDED'] } });
    assert.deepStrictEqual(await run({ status: 'PENDING' }), { status: { $in: ['CREATED', 'PENDING'] } });
    assert.deepStrictEqual(await run({ status: 'ALL' }), {});
    assert.deepStrictEqual(await run({}), {});
    assert.deepStrictEqual(await run({ status: 'constructor' }), { status: 'constructor' }, 'prototype keys are literal values');
    assert.deepStrictEqual(await run({ status: { $ne: null } }), {}, 'object status values are ignored');
    const searched = await run({ search: 'INV-(1)' });
    assert.strictEqual(searched.$or.length, 6);
    assert.ok(searched.$or[0].invoiceNumber.test('xx INV-(1) yy') && !searched.$or[0].invoiceNumber.test('INV-1'));
  });

  await test('Finance: commission windows come from the injected clock; net revenue is clamped', async () => {
    const now = new Date(2026, 4, 17, 15, 30);
    const earnings = fakeRepo({ getCommissionKpis: { totalPlatformCommission: -5, totalEarningRecords: 3, totalGrossVolume: 10 } });
    const service = createAdminFinanceService({ earnings, payments: fakeRepo(), settlements: fakeRepo(), garages: fakeRepo(), serviceRecords: fakeRepo() }, { now: () => now });
    const summary = await service.getCommissionSummary();
    const { todayStart, monthStart } = earnings.calls[0].args[0];
    assert.strictEqual(todayStart.getTime(), new Date(2026, 4, 17).getTime());
    assert.strictEqual(monthStart.getTime(), new Date(2026, 4, 1).getTime());
    assert.strictEqual(summary.netPlatformRevenue, 0);
    assert.strictEqual(summary.totalEarningRecords, 3);
  });

  await test('Finance: payment summary merges payment KPIs with pending invoices', async () => {
    const service = createAdminFinanceService({
      payments: fakeRepo({ getAdminKpis: { totalVolume: 10, successfulVolume: 8, successfulCount: 2, failedCount: 1, refundedCount: 0, totalRefundedAmount: 0, totalTransactions: 3 } }),
      serviceRecords: fakeRepo({ aggregate: [{ pendingCount: 4, pendingAmount: 99 }] }),
      earnings: fakeRepo(), settlements: fakeRepo(), garages: fakeRepo(),
    });
    assert.deepStrictEqual(await service.getPaymentSummary(), {
      totalVolume: 10, successfulVolume: 8, successfulCount: 2, failedCount: 1, totalRefundedAmount: 0,
      refundedCount: 0, pendingAmount: 99, pendingCount: 4, totalTransactions: 3,
    });
  });

  await test('Finance: settlements resolve garage names for ObjectId and string ids; summary attached', async () => {
    const gid = new ObjectId();
    const garages = fakeRepo({ find: [{ _id: gid, garageName: 'Legacy Name' }] });
    const settlements = fakeRepo({
      findPageForAdmin: { items: [{ _id: new ObjectId(), garageId: String(gid), requestedAmount: 100 }, { _id: new ObjectId(), garageId: 'unknown' }], total: 2, page: 1, limit: 20 },
      getAdminKpis: { pendingCount: 1, completedCount: 0, totalPendingVolume: 100, totalSettledVolume: 0, totalRequests: 2 },
    });
    const out = await createAdminFinanceService({ settlements, garages, payments: fakeRepo(), earnings: fakeRepo(), serviceRecords: fakeRepo() })
      .listSettlements({ status: 'REQUESTED', page: PAGE });
    assert.strictEqual(out.items[0].garageName, 'Legacy Name');
    assert.strictEqual(out.items[0].approvedAmount, 100);
    assert.strictEqual(out.items[1].garageName, 'Authorized Garage');
    assert.deepStrictEqual(settlements.calls[0].args[0], { status: 'REQUESTED' });
    assert.strictEqual(out.summary.totalRequests, 2);
    const empty = createAdminFinanceService({ settlements: fakeRepo({ getAdminKpis: {} }), garages: fakeRepo(), payments: fakeRepo(), earnings: fakeRepo(), serviceRecords: fakeRepo() });
    await empty.listSettlements({ page: PAGE });
  });

  await test('Repositories project out credentials and OTP state; query specs are pure', () => {
    ['password', 'otp', 'otpHash', 'otpExpiry', 'otpAttempts', 'tokenVersion'].forEach((field) => assert.strictEqual(SAFE_USER_PROJECTION[field], 0, field));
    const pipeline = queries.monthlySeriesPipeline({ isArchived: { $ne: true } }, { revenue: { $sum: 1 } });
    assert.deepStrictEqual(pipeline[3].$project, { month: '$_id', count: 1, revenue: 1, _id: 0 });
    assert.strictEqual(queries.topGaragesPipeline().find((s) => s.$limit).$limit, 10);
    assert.strictEqual(queries.toObjectIdOrNull('zzz'), null);
  });
}

async function seed(db) {
  const now = new Date();
  const admin = { _id: new ObjectId(), name: 'Root Admin', email: 'admin@driveportz-test.in', role: 'ADMIN', password: '$2b$10$adminhash', tokenVersion: 0, createdAt: now };
  const owner = {
    _id: new ObjectId(), name: 'Asha Owner', email: 'asha@driveportz-test.in', role: 'USER', password: '$2b$10$ownerhash',
    otp: '123456', otpHash: 'otp-hmac', otpExpiry: now, otpAttempts: 1, tokenVersion: 0, phone: '999', city: 'Chennai', createdAt: new Date(now.getTime() - 1000),
  };
  const garageUser = { _id: new ObjectId(), name: 'Garage Guru', email: 'guru@driveportz-test.in', role: 'GARAGE', password: '$2b$10$garagehash', tokenVersion: 0, createdAt: new Date(now.getTime() - 2000) };
  const filler = Array.from({ length: 25 }, (_, i) => ({
    _id: new ObjectId(), name: `Filler ${i}`, email: `filler${i}@driveportz-test.in`, role: 'USER', password: 'x', createdAt: new Date(now.getTime() - 10000 - i),
  }));
  await db.collection('users').insertMany([admin, owner, garageUser, ...filler]);

  const ownerId = String(owner._id);
  await db.collection('vehicles').insertMany([
    { ownerId, vehicleNumber: 'TN01AA0001', brand: 'Maruti', model: 'Swift', manufacturingYear: 2020, fuelType: 'PETROL', createdAt: now },
    { ownerId, vehicleNumber: 'TN01AA0002', brand: 'Honda', model: 'City', year: 2019, fuelType: 'PETROL', createdAt: now },
    { ownerId, vehicleNumber: 'TN01AA0003', brand: 'Old', model: 'Gone', isArchived: true, createdAt: now },
  ]);
  await db.collection('services').insertMany([
    { ownerId, serviceType: 'Oil change', serviceDate: now, totalCost: 1500, paymentStatus: 'UNPAID', totalAmount: 1500, createdAt: now },
    { ownerId, serviceType: 'Wash', serviceDate: now, totalCost: 300, paymentStatus: 'PAID', createdAt: now },
  ]);

  const garageA = { _id: new ObjectId(), name: 'Alpha Motors', city: 'Chennai', ownerUserId: String(garageUser._id), verified: false, isActive: true, createdAt: now };
  const garageB = { _id: new ObjectId(), name: 'Bravo Suspended', city: 'Madurai', verified: true, isActive: false, createdAt: now };
  await db.collection('garages').insertMany([garageA, garageB]);
  await db.collection('bookings').insertMany([
    { garageId: garageA._id, status: 'COMPLETED', snapshots: { service: { price: '1500' } }, createdAt: now },
    { garageId: garageA._id, status: 'COMPLETED', snapshots: { service: { price: 500 } }, createdAt: now },
    // Legacy row with a non-numeric price: previously aborted dashboard/revenue/analytics with HTTP 500.
    { garageId: garageA._id, status: 'COMPLETED', snapshots: { service: { price: '' } }, createdAt: now },
    { garageId: garageA._id, status: 'PENDING', snapshots: { service: { price: 999 } }, createdAt: now },
  ]);

  await db.collection('payments').insertMany([
    { invoiceNumber: 'INV-(1)', status: 'CAPTURED', amount: 1000, garageName: 'Alpha Motors', razorpayOrderId: 'order_1', createdAt: now },
    { invoiceNumber: 'INV-2', status: 'FAILED', amount: 200, createdAt: new Date(now.getTime() - 1000) },
    { invoiceNumber: 'INV-3', status: 'REFUNDED', amount: 300, totalRefundedAmount: 300, createdAt: new Date(now.getTime() - 2000) },
    { invoiceNumber: 'INV-4', status: 'CREATED', amount: 50, createdAt: new Date(now.getTime() - 3000) },
  ]);
  await db.collection('garage_earnings').insertMany([
    { invoiceNumber: 'INV-(1)', garageName: 'Alpha Motors', grossAmount: 1000, platformCommission: 100, garageNetAmount: 900, status: 'AVAILABLE', createdAt: now },
    { invoiceNumber: 'INV-3', grossAmount: 300, platformCommission: 30, garageNetAmount: 270, netAfterRefund: 0, refundAmount: 300, status: 'REFUND_ADJUSTMENT', createdAt: new Date('2020-01-01') },
  ]);
  await db.collection('settlements').insertMany([
    { settlementId: 'SET-1', garageId: String(garageA._id), requestedAmount: 900, status: 'REQUESTED', earningsIds: ['e1'], requestedAt: now },
    { settlementId: 'SET-2', garageId: 'missing-garage', requestedAmount: 100, approvedAmount: 80, status: 'SETTLED', requestedAt: new Date(now.getTime() - 1000) },
  ]);
  return { admin, owner, garageUser, garageA, garageB };
}

const ADMIN_GET_ENDPOINTS = [
  '/api/admin/dashboard', '/api/admin/revenue', '/api/admin/analytics', '/api/admin/users',
  '/api/admin/garages', '/api/admin/payments/summary', '/api/admin/payments/all',
  '/api/admin/commissions/summary', '/api/admin/commissions/all', '/api/admin/settlements',
];
const SECRET_PATTERN = /password|otpHash|"otp"|\$2b\$|tokenVersion/;

async function integrationTests() {
  const { loadConfig } = require('./src/config');
  const { connectToMongo, getDb, closeMongo } = require('./src/db');
  await connectToMongo(loadConfig());
  const db = getDb();
  assert.ok(db.databaseName.startsWith('driveportz_admin_suite_'), `refusing to run against ${db.databaseName}`);
  await db.dropDatabase();
  await require('./src/models/CoreIndexes').ensureCoreIndexes(db);
  const fx = await seed(db);
  const adminToken = tokenFor(fx.admin);
  const userToken = tokenFor(fx.owner);

  const { buildApp } = require('./server');
  const server = buildApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { token = adminToken, body } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  };

  console.log('\n— HTTP: /api/admin endpoints (real Express app + MongoDB) —');
  try {
    await test('RBAC: every admin endpoint answers 401 without a token and 403 for a USER', async () => {
      const garagePatch = `/api/admin/garages/${fx.garageA._id}/verify`;
      for (const path of [...ADMIN_GET_ENDPOINTS, `/api/admin/users/${fx.owner._id}`]) {
        assert.strictEqual((await call('GET', path, { token: null })).status, 401, `${path} anonymous`);
        const forbidden = await call('GET', path, { token: userToken });
        assert.strictEqual(forbidden.status, 403, `${path} as USER`);
        assert.deepStrictEqual(forbidden.json, { msg: 'Admin access required' });
      }
      assert.strictEqual((await call('PATCH', garagePatch, { token: null, body: {} })).status, 401);
      assert.strictEqual((await call('PATCH', garagePatch, { token: userToken, body: {} })).status, 403);
      assert.strictEqual((await db.collection('garages').findOne({ _id: fx.garageA._id })).verified, false, 'USER could not mutate');
    });

    await test('No admin response leaks password hashes, OTP fields or token versions', async () => {
      for (const path of [...ADMIN_GET_ENDPOINTS, `/api/admin/users/${fx.owner._id}`, '/api/admin/users?limit=100']) {
        const r = await call('GET', path);
        assert.strictEqual(r.status, 200, `${path} -> ${r.status} ${r.text.slice(0, 200)}`);
        assert.ok(!SECRET_PATTERN.test(r.text), `${path} leaked a secret field`);
      }
    });

    await test('GET /dashboard: KPI shape and values (legacy non-numeric price no longer 500s)', async () => {
      const r = await call('GET', '/api/admin/dashboard');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(r.json, { totalUsers: 28, totalGarages: 1, totalVehicles: 2, totalServices: 2, totalRevenue: 2000, verifiedGarages: 0 });
    });

    await test('GET /revenue: per-garage revenue with totals', async () => {
      const r = await call('GET', '/api/admin/revenue');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(Object.keys(r.json).sort(), ['grandTotal', 'items', 'totalGarages', 'totalServices']);
      assert.strictEqual(r.json.grandTotal, 2000);
      assert.strictEqual(r.json.totalServices, 3);
      assert.strictEqual(r.json.totalGarages, 1);
      const [row] = r.json.items;
      assert.strictEqual(row.garageId, String(fx.garageA._id));
      assert.strictEqual(row.garageName, 'Alpha Motors');
      assert.strictEqual(row.city, 'Chennai');
      assert.strictEqual(row.verified, false);
    });

    await test('GET /analytics: monthly series and top garages', async () => {
      const r = await call('GET', '/api/admin/analytics');
      assert.strictEqual(r.status, 200);
      const { monthlyUsers, monthlyVehicles, monthlyServices, monthlyRevenue, topGarages } = r.json;
      const sum = (rows) => rows.reduce((a, row) => a + row.count, 0);
      assert.strictEqual(sum(monthlyUsers), 28);
      assert.strictEqual(sum(monthlyVehicles), 2, 'archived vehicle excluded');
      assert.strictEqual(sum(monthlyServices), 2);
      assert.ok(/^\d{4}-\d{2}$/.test(monthlyRevenue[0].month));
      assert.strictEqual(monthlyRevenue.reduce((a, row) => a + row.revenue, 0), 2000);
      assert.deepStrictEqual(topGarages, [{ completedCount: 3, revenue: 2000, name: 'Alpha Motors', city: 'Chennai' }]);
    });

    await test('GET /users: shape, asset counts, pagination body + headers', async () => {
      const r = await call('GET', '/api/admin/users?page=2&limit=10');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(Object.keys(r.json), ['items', 'total', 'page', 'limit', 'totalPages']);
      assert.strictEqual(r.json.total, 28);
      assert.strictEqual(r.json.page, 2);
      assert.strictEqual(r.json.limit, 10);
      assert.strictEqual(r.json.totalPages, 3);
      assert.strictEqual(r.json.items.length, 10);
      assert.strictEqual(r.headers.get('x-total-count'), '28');
      assert.strictEqual(r.headers.get('x-total-pages'), '3');
      const first = await call('GET', '/api/admin/users?search=asha');
      assert.strictEqual(first.json.total, 1);
      const [asha] = first.json.items;
      assert.deepStrictEqual(Object.keys(asha), ['id', 'name', 'email', 'role', 'phone', 'city', 'photoUrl', 'vehicleCount', 'serviceCount', 'createdAt']);
      assert.strictEqual(asha.vehicleCount, 2, 'archived vehicle not counted');
      assert.strictEqual(asha.serviceCount, 2);
    });

    await test('GET /users: search input is escaped; malformed page/limit fall back instead of 500', async () => {
      assert.strictEqual((await call('GET', '/api/admin/users?search=.*')).json.total, 0, '".*" is literal, not match-all');
      assert.strictEqual((await call('GET', '/api/admin/users?search=(a%2B)%2B%24')).status, 200);
      assert.strictEqual((await call('GET', '/api/admin/users?search=FILLER%201')).json.total, 1 + 10, 'case-insensitive contains (Filler 1, 10-19)');
      const bad = await call('GET', '/api/admin/users?page=abc&limit=xyz');
      assert.strictEqual(bad.status, 200);
      assert.strictEqual(bad.json.page, 1);
      assert.strictEqual(bad.json.limit, 20);
      assert.strictEqual((await call('GET', '/api/admin/users?limit=5000')).json.limit, 100, 'limit capped');
    });

    await test('GET /users/:id: detail shape, 400 invalid id, 404 unknown id', async () => {
      const r = await call('GET', `/api/admin/users/${fx.owner._id}`);
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(Object.keys(r.json), ['id', 'name', 'email', 'role', 'phone', 'city', 'bio', 'photoUrl', 'createdAt', 'vehicles', 'services']);
      assert.strictEqual(r.json.vehicles.length, 2);
      assert.deepStrictEqual(r.json.vehicles.map((v) => v.year).sort(), [2019, 2020]);
      assert.deepStrictEqual(Object.keys(r.json.services[0]), ['id', 'vehicleId', 'serviceDate', 'serviceType', 'serviceCategory', 'totalCost', 'garageName', 'createdAt'].filter((k) => k in r.json.services[0]));
      const invalid = await call('GET', '/api/admin/users/not-an-id');
      assert.strictEqual(invalid.status, 400);
      assert.deepStrictEqual(invalid.json, { msg: 'Invalid user ID' });
      const missing = await call('GET', `/api/admin/users/${new ObjectId()}`);
      assert.strictEqual(missing.status, 404);
      assert.deepStrictEqual(missing.json, { msg: 'User not found' });
    });

    await test('GET /garages: active garages only, booking stats, owner, search escaping', async () => {
      const r = await call('GET', '/api/admin/garages');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(Object.keys(r.json), ['items', 'total', 'page', 'limit', 'totalPages']);
      assert.strictEqual(r.json.total, 1, 'suspended garage hidden');
      const [g] = r.json.items;
      assert.deepStrictEqual(Object.keys(g), ['id', 'name', 'ownerName', 'ownerEmail', 'phone', 'city', 'address', 'description', 'photoUrl', 'verified', 'isActive', 'servicesCompleted', 'totalBookings', 'revenue', 'createdAt']);
      assert.strictEqual(g.ownerName, 'Garage Guru');
      assert.strictEqual(g.ownerEmail, 'guru@driveportz-test.in');
      assert.strictEqual(g.servicesCompleted, 3);
      assert.strictEqual(g.totalBookings, 4);
      assert.strictEqual(g.revenue, 2000);
      assert.strictEqual((await call('GET', '/api/admin/garages?search=chennai')).json.total, 1, 'city search');
      assert.strictEqual((await call('GET', '/api/admin/garages?search=.*')).json.total, 0, 'escaped');
      assert.strictEqual((await call('GET', '/api/admin/garages?search=(')).status, 200, 'unbalanced paren is not a 500');
      assert.strictEqual(r.headers.get('x-total-count'), '1');
    });

    await test('PATCH /garages/:id/{verify,unverify,suspend,activate}: messages, state, 400/404', async () => {
      const path = (action, id = fx.garageA._id) => `/api/admin/garages/${id}/${action}`;
      const state = () => db.collection('garages').findOne({ _id: fx.garageA._id });
      let r = await call('PATCH', path('verify'), { body: {} });
      assert.deepStrictEqual([r.status, r.json], [200, { msg: 'Garage verified successfully' }]);
      assert.strictEqual((await state()).verified, true);
      assert.ok((await state()).updatedAt instanceof Date);
      r = await call('PATCH', path('unverify'), { body: {} });
      assert.deepStrictEqual([r.status, r.json], [200, { msg: 'Garage unverified' }]);
      assert.strictEqual((await state()).verified, false);
      await call('PATCH', path('verify'), { body: {} });
      r = await call('PATCH', path('suspend'), { body: {} });
      assert.deepStrictEqual([r.status, r.json], [200, { msg: 'Garage suspended' }]);
      assert.deepStrictEqual([(await state()).isActive, (await state()).verified], [false, false]);
      r = await call('PATCH', path('activate'), { body: {} });
      assert.deepStrictEqual([r.status, r.json], [200, { msg: 'Garage activated' }]);
      assert.strictEqual((await state()).isActive, true);
      r = await call('PATCH', path('verify', 'bad-id'), { body: {} });
      assert.deepStrictEqual([r.status, r.json], [400, { msg: 'Invalid garage ID' }]);
      r = await call('PATCH', path('suspend', new ObjectId()), { body: {} });
      assert.deepStrictEqual([r.status, r.json], [404, { msg: 'Garage not found' }]);
    });

    await test('GET /payments/summary: aggregated KPIs', async () => {
      const r = await call('GET', '/api/admin/payments/summary');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(r.json, {
        success: true,
        summary: {
          totalVolume: 1550, successfulVolume: 1300, successfulCount: 2, failedCount: 1, totalRefundedAmount: 300,
          refundedCount: 1, pendingAmount: 1500, pendingCount: 1, totalTransactions: 4,
        },
      });
    });

    await test('GET /payments/all: shape, status filters, escaped search, bounded limit', async () => {
      const r = await call('GET', '/api/admin/payments/all?page=1&limit=2');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(Object.keys(r.json), ['success', 'payments', 'totalCount', 'totalPages', 'currentPage']);
      assert.deepStrictEqual([r.json.totalCount, r.json.totalPages, r.json.currentPage, r.json.payments.length], [4, 2, 1, 2]);
      assert.strictEqual(r.json.payments[0].invoiceNumber, 'INV-(1)', 'newest first');
      assert.strictEqual(r.json.payments[0].currency, 'INR');
      assert.strictEqual(r.json.payments[1].garageName, 'Authorized Service Center');
      assert.strictEqual(r.headers.get('x-total-count'), '4');
      const statuses = async (status) => (await call('GET', `/api/admin/payments/all?status=${status}`)).json.payments.map((p) => p.status).sort();
      assert.deepStrictEqual(await statuses('PAID'), ['CAPTURED']);
      assert.deepStrictEqual(await statuses('REFUNDED'), ['REFUNDED']);
      assert.deepStrictEqual(await statuses('PENDING'), ['CREATED']);
      assert.deepStrictEqual(await statuses('ALL'), ['CAPTURED', 'CREATED', 'FAILED', 'REFUNDED']);
      assert.strictEqual((await call('GET', '/api/admin/payments/all?search=INV-(1)')).json.totalCount, 1, 'parentheses literal');
      assert.strictEqual((await call('GET', '/api/admin/payments/all?search=.*')).json.totalCount, 0);
      const big = await call('GET', '/api/admin/payments/all?limit=100000&page=-3');
      assert.strictEqual(big.status, 200, 'negative page used to 500');
      assert.strictEqual(big.json.currentPage, 1);
      assert.strictEqual(big.headers.get('x-limit'), '100');
    });

    await test('GET /commissions/summary and /commissions/all', async () => {
      const s = await call('GET', '/api/admin/commissions/summary');
      assert.strictEqual(s.status, 200);
      assert.deepStrictEqual(s.json, {
        success: true,
        summary: {
          totalGrossVolume: 1300, totalPlatformCommission: 130, todayPlatformCommission: 100, monthPlatformCommission: 100,
          totalGarageEarnings: 900, totalRefundAdjustments: 300, netPlatformRevenue: 130, totalEarningRecords: 2,
        },
      });
      const r = await call('GET', '/api/admin/commissions/all?search=inv-(1)');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(Object.keys(r.json), ['success', 'commissions', 'totalCount', 'totalPages', 'currentPage']);
      assert.strictEqual(r.json.totalCount, 1);
      assert.strictEqual(r.json.commissions[0].netAfterRefund, 900);
      const refunds = await call('GET', '/api/admin/commissions/all?status=REFUND_ADJUSTMENT');
      assert.strictEqual(refunds.json.commissions[0].netAfterRefund, 0);
      assert.strictEqual(refunds.json.commissions[0].garageName, 'Authorized Service Center');
    });

    await test('GET /settlements: list + KPI summary + garage names', async () => {
      const r = await call('GET', '/api/admin/settlements');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(Object.keys(r.json), ['success', 'settlements', 'summary', 'totalCount', 'totalPages', 'currentPage']);
      assert.deepStrictEqual(r.json.summary, { totalPendingVolume: 900, totalSettledVolume: 80, pendingCount: 1, completedCount: 1, totalRequests: 2 });
      const [first, second] = r.json.settlements;
      assert.strictEqual(first.settlementId, 'SET-1');
      assert.strictEqual(first.garageName, 'Alpha Motors');
      assert.strictEqual(first.earningsCount, 1);
      assert.strictEqual(second.garageName, 'Authorized Garage');
      const filtered = await call('GET', '/api/admin/settlements?status=SETTLED&search=SET-');
      assert.deepStrictEqual(filtered.json.settlements.map((s) => s.settlementId), ['SET-2']);
      assert.strictEqual(filtered.json.summary.totalRequests, 2, 'summary is platform-wide');
    });

    await test('Settlement mutations still fall through to the financial operations router', async () => {
      const r = await call('POST', '/api/admin/settlements/SET-1/approve', { body: {} });
      assert.ok(!/Route not found/.test(r.text), `route is still mounted behind /api/admin (got ${r.status} ${r.text.slice(0, 120)})`);
    });
  } finally {
    server.close();
    await db.dropDatabase();
    await closeMongo();
  }
}

(async () => {
  console.log('🚀 DrivePortz admin routes suite');
  await unitTests();
  await integrationTests();
  console.log(`\n${failed === 0 ? '✅' : '❌'} Admin routes suite: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('❌ Admin routes suite crashed:', err);
  process.exit(1);
});
