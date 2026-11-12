/**
 * Invoice + earnings routes suite: /api/invoices, /api/garage/invoices and /api/garage(/earnings)
 * after the Repository + service-layer refactor.
 *
 *  1. Pure unit tests: invoice arithmetic, settlement selection, payout profile masking.
 *  2. Service unit tests with FAKE repositories (no database).
 *  3. HTTP tests against the real Express app and a throwaway MongoDB database: RBAC/ownership,
 *     money math, pagination headers, concurrency (settlement requests, finalize) and the
 *     checkout lock.
 *
 * Plain Node + assert, like the other suites. Uses its own database and drops it at the end.
 */
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'invoice-suite-secret-key-2026-minimum-32-chars';
process.env.MONGO_DB_NAME = `driveportz_inv_earn_suite_${process.pid}`;
process.env.EMAIL_PROVIDER = 'mock';
process.env.JOB_WORKER_ENABLED = 'false';
delete process.env.MIN_SETTLEMENT_AMOUNT;

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
  return jwt.sign({ role: user.role, tv: user.tokenVersion || 0, typ: 'session' }, process.env.JWT_SECRET_KEY, { subject: String(user._id), expiresIn: '1h', algorithm: 'HS256' });
}

// ---------------------------------------------------------------------------------------------
// 1. Pure functions
// ---------------------------------------------------------------------------------------------
async function pureTests() {
  console.log('\n— Unit: pure invoice / settlement arithmetic —');
  const { calculateInvoiceTotals, retaxSnapshot, toStoredTotals } = require('./src/services/invoices/invoiceTotals');
  const { parseRequestedAmount, selectEarningsForPayout, earningNetPaise } = require('./src/services/earnings/settlementSelection');
  const { buildMaskedProfile } = require('./src/services/earnings/payoutProfileService');
  const { ValidationError } = require('./src/core/errors');

  await test('Invoice totals are exact in paise (0.1 + 0.2 style inputs)', () => {
    const t = calculateInvoiceTotals({
      partsReplaced: [{ partName: ' Bulb ', quantity: 3, unitPrice: 0.1 }, { partName: 'Fuse', unitPrice: '0.2' }],
      laborAmount: 100.1, additionalCharges: 0.2, discountAmount: 0.3,
    });
    assert.strictEqual(t.partsPaise, 50);
    assert.strictEqual(t.partsAmount, 0.5);
    assert.strictEqual(t.subtotal, 100.8);
    assert.strictEqual(t.totalAmount, 100.5);
    assert.strictEqual(t.totalPaise, 10050);
    assert.strictEqual(t.partsReplaced[0].partName, 'Bulb');
    assert.strictEqual(t.partsReplaced[0].cost, 0.3, 'line cost = qty x unit price');
    assert.strictEqual(t.partsReplaced[1].quantity, 1);
  });

  await test('Discount capped at subtotal; legacy laborCost/cost keys; junk parts ignored; infinities rejected', () => {
    const t = calculateInvoiceTotals({ partsReplaced: [null, 'x', { cost: 50 }], laborCost: '25', discountAmount: 1000 });
    assert.deepStrictEqual([t.subtotalPaise, t.discountPaise, t.totalPaise], [7500, 7500, 0]);
    assert.throws(() => calculateInvoiceTotals({ laborAmount: '1e400' }), ValidationError);
    assert.throws(() => calculateInvoiceTotals({ partsReplaced: [{ quantity: '99999999999999999999', unitPrice: 1000 }] }), ValidationError);
    assert.strictEqual(calculateInvoiceTotals({ laborAmount: -50, discountAmount: 'abc' }).totalPaise, 0);
  });

  await test('Itemised additional charges (completion shape) are summed, not dropped', () => {
    const t = calculateInvoiceTotals({ laborAmount: 100, additionalCharges: [{ description: 'Disposal', amount: 100 }, { amountPaise: 2550 }, null] });
    assert.strictEqual(t.additionalPaise, 12550);
    assert.ok(Array.isArray(t.additionalCharges) && t.additionalCharges.length === 2);
    assert.strictEqual(t.totalAmount, 225.5);
  });

  await test('GST: recomputed from the frozen snapshot rate; client taxAmount ignored when a snapshot exists', () => {
    const snapshot = { rate: 18, isIntrastate: true, totalTaxPaise: 1, sellerState: 'KA' };
    const t = calculateInvoiceTotals({ laborAmount: 2401, taxAmount: 0 }, { taxSnapshot: snapshot });
    assert.strictEqual(t.taxPaise, 43218, '9% + 9% of 2401.00 = 216.09 + 216.09');
    assert.strictEqual(t.totalAmount, 2833.18);
    assert.strictEqual(t.taxSnapshot.cgstPaise, 21609);
    assert.strictEqual(t.taxSnapshot.sellerState, 'KA', 'snapshot metadata kept');
    assert.strictEqual(retaxSnapshot({ rate: 18, isIntrastate: false }, 10000).igstPaise, 1800);
    assert.strictEqual(retaxSnapshot(null, 100), null);
    const legacy = calculateInvoiceTotals({ laborAmount: 100, taxAmount: 18 });
    assert.strictEqual(legacy.totalAmount, 118, 'legacy rows without snapshot keep the entered tax');
    const stored = toStoredTotals(t);
    assert.strictEqual(stored.grandTotalPaise, 283318);
    assert.strictEqual(stored.subtotalAmount, stored.subtotal);
  });

  await test('parseRequestedAmount: undefined = full balance; junk, zero, negative and objects rejected', () => {
    assert.strictEqual(parseRequestedAmount(undefined), undefined);
    assert.strictEqual(parseRequestedAmount(null), undefined);
    assert.strictEqual(parseRequestedAmount('600.5'), 600.5);
    for (const bad of ['abc', 0, -5, 'Infinity', { $gt: 0 }, [1], true]) {
      assert.throws(() => parseRequestedAmount(bad), ValidationError, `rejects ${JSON.stringify(bad)}`);
    }
  });

  await test('Settlement selection never exceeds the requested amount and pays whole rows', () => {
    const rows = [{ _id: 1, garageNetPaise: 40000 }, { _id: 2, garageNetPaise: 40000 }, { _id: 3, garageNetPaise: 40000 }];
    assert.deepStrictEqual(selectEarningsForPayout(rows, 100000).selected.map((r) => r._id), [1, 2]);
    assert.strictEqual(selectEarningsForPayout(rows, 100000).totalPaise, 80000);
    assert.strictEqual(selectEarningsForPayout(rows, 50000).totalPaise, 40000);
    assert.strictEqual(selectEarningsForPayout(rows, 30000).totalPaise, 0, 'a single larger row is never part-paid');
    assert.strictEqual(selectEarningsForPayout(rows, null).totalPaise, 120000, 'full balance');
    const withRefund = [{ _id: 'a', netAfterRefundPaise: 80000 }, { _id: 'b', netAfterRefundPaise: -30000 }];
    assert.strictEqual(selectEarningsForPayout(withRefund, 50000).totalPaise, 50000, 'refund adjustments netted first');
    assert.strictEqual(earningNetPaise({ netAfterRefund: 12.345 }), 1235);
    assert.strictEqual(earningNetPaise({ garageNetAmount: '0.29' }), 29);
  });

  await test('Reporting calendar: business days are IST regardless of the server timezone', () => {
    const { dayKey, startOfBusinessDay, startOfBusinessMonth, businessDaysAgo } = require('./src/services/invoices/reportingCalendar');
    const lateNightUtc = new Date('2026-11-11T19:00:00Z'); // 00:30 IST on the 12th
    assert.strictEqual(dayKey(lateNightUtc), '2026-11-12');
    assert.strictEqual(startOfBusinessDay(lateNightUtc).toISOString(), '2026-11-11T18:30:00.000Z');
    assert.strictEqual(startOfBusinessMonth(lateNightUtc).toISOString(), '2026-10-31T18:30:00.000Z');
    assert.strictEqual(dayKey(businessDaysAgo(lateNightUtc, 7)), '2026-11-05');
  });

  await test('Payout profile: validated and masked; full account number never kept', () => {
    const p = buildMaskedProfile({ accountHolderName: ' Apex Auto ', accountNumber: '5010 0492 8172 91', ifscCode: 'hdfc0001234' });
    assert.deepStrictEqual(p, { accountHolderName: 'Apex Auto', bankAccountLast4: '7291', bankName: 'Bank Account', ifscMasked: 'HDFC***234', verified: true });
    assert.throws(() => buildMaskedProfile({ accountHolderName: 'A', accountNumber: '123', ifscCode: 'HDFC0001234' }), /6 to 18 digits/);
    assert.throws(() => buildMaskedProfile({ accountHolderName: 'A', accountNumber: '12345678', ifscCode: 'BAD' }), /IFSC/);
    assert.throws(() => buildMaskedProfile({ accountHolderName: 'A', accountNumber: { $ne: 1 }, ifscCode: 'HDFC0001234' }), /required/);
  });
}

// ---------------------------------------------------------------------------------------------
// 2. Services with fake repositories
// ---------------------------------------------------------------------------------------------
function fakeInvoiceRepos(seed = {}) {
  const calls = [];
  const rec = (name, result) => async (...args) => { calls.push([name, ...args]); return typeof result === 'function' ? result(...args) : result; };
  return {
    calls,
    serviceRecords: {
      findActive: rec('findActive', () => seed.service || null),
      findActiveByReference: rec('findActiveByReference', () => seed.service || null),
      updateOpenInvoice: rec('updateOpenInvoice', () => seed.updateResult !== false),
      claimInvoiceNumber: rec('claimInvoiceNumber', () => seed.claimResult !== false),
      releaseInvoiceNumberClaim: rec('releaseInvoiceNumberClaim'),
    },
    invoices: { findByReference: rec('invoiceByRef', null), syncFromService: rec('syncFromService') },
    vehicles: { findActiveById: rec('vehicle', () => seed.vehicle || null) },
    garages: { findByOwner: rec('garageByOwner', () => seed.garage || null), findOne: rec('garageFindOne', null) },
    users: { findOne: rec('userFindOne', (filter) => (seed.users || {})[String(filter._id)] || null) },
    payments: { findForReceipt: rec('findForReceipt', () => seed.payment || null) },
  };
}

function fakeEarningsRepos(seed = {}) {
  const calls = [];
  const rec = (name, result) => async (...args) => { calls.push([name, ...args]); return typeof result === 'function' ? result(...args) : result; };
  return {
    calls,
    earnings: {
      findAvailableForGarage: rec('findAvailable', () => seed.available || []),
      claimForSettlement: rec('claim', (ids) => (seed.claimCount !== undefined ? seed.claimCount : ids.length)),
      releaseSettlementClaim: rec('release'),
      findByIds: rec('findByIds', []),
      findByReference: rec('earningByRef', () => seed.earning || null),
    },
    settlements: {
      acquireRequestLock: rec('acquireLock', () => seed.lockFree !== false),
      releaseRequestLock: rec('releaseLock'),
      insertRequested: rec('insertRequested', () => ({ insertedId: 'settlement-oid' })),
      findByReference: rec('settlementByRef', () => seed.settlement || null),
    },
  };
}

async function serviceUnitTests() {
  console.log('\n— Unit: services with fake repositories —');
  const { createInvoiceCommandService } = require('./src/services/invoices/invoiceCommandService');
  const { createInvoiceQueryService } = require('./src/services/invoices/invoiceQueryService');
  const { createSettlementRequestService, SettlementIneligibleError } = require('./src/services/earnings/settlementRequestService');
  const { createEarningsQueryService } = require('./src/services/earnings/earningsQueryService');
  const { ForbiddenError, ValidationError, ConflictError, NotFoundError } = require('./src/core/errors');

  const garageUser = { id: 'g1', role: 'GARAGE' };
  const otherGarage = { id: 'g2', role: 'GARAGE' };
  const sid = new ObjectId();
  const openService = { _id: sid, createdBy: 'g1', ownerId: 'u1', vehicleId: 'v1', paymentStatus: 'UNPAID', invoiceStatus: 'DRAFT' };
  const commands = (repos, extra = {}) => createInvoiceCommandService({
    repos, hasOpenPayment: async () => Boolean(extra.open), nextInvoiceNumber: extra.next || (async () => 'DP-INV-T-1'), newToken: () => 'tok',
  });

  await test('updateDraft: other garage 403, paid/partially-paid 400, cancelled 400, missing 404', async () => {
    await assert.rejects(commands(fakeInvoiceRepos({ service: openService })).updateDraft(otherGarage, String(sid), {}), ForbiddenError);
    for (const paymentStatus of ['PAID', 'PARTIALLY_PAID']) {
      await assert.rejects(commands(fakeInvoiceRepos({ service: { ...openService, paymentStatus } })).updateDraft(garageUser, String(sid), {}), (e) => e instanceof ValidationError && e.message === 'Cannot modify a paid invoice');
    }
    await assert.rejects(commands(fakeInvoiceRepos({ service: { ...openService, invoiceStatus: 'CANCELLED' } })).updateDraft(garageUser, String(sid), {}), ValidationError);
    await assert.rejects(commands(fakeInvoiceRepos({})).updateDraft(garageUser, 'x', {}), NotFoundError);
  });

  await test('updateDraft: open checkout => 409 CHECKOUT_IN_PROGRESS and nothing written', async () => {
    const repos = fakeInvoiceRepos({ service: openService });
    await assert.rejects(commands(repos, { open: true }).updateDraft(garageUser, String(sid), { laborAmount: 10 }), (e) => e instanceof ConflictError && e.code === 'CHECKOUT_IN_PROGRESS');
    assert.ok(!repos.calls.some((c) => c[0] === 'updateOpenInvoice'));
  });

  await test('updateDraft: CAS lost to a concurrent capture => 409; success writes paise-consistent totals and syncs invoice doc', async () => {
    await assert.rejects(commands(fakeInvoiceRepos({ service: openService, updateResult: false })).updateDraft(garageUser, String(sid), {}), (e) => e.code === 'INVOICE_CHANGED');
    const repos = fakeInvoiceRepos({ service: { ...openService, invoiceNumber: 'DP-INV-9' } });
    const { invoice } = await commands(repos).updateDraft(garageUser, String(sid), { laborAmount: 0.1, additionalCharges: 0.2, mechanicNotes: { $set: 1 } });
    assert.strictEqual(invoice.totalAmount, 0.3);
    assert.strictEqual(invoice.mechanicNotes, '', 'non-string notes coerced');
    const write = repos.calls.find((c) => c[0] === 'updateOpenInvoice')[2];
    assert.strictEqual(write.set.grandTotalPaise, 30);
    assert.deepStrictEqual(write.lockedPaymentStatuses.slice(0, 2), ['PAID', 'PARTIALLY_PAID']);
    assert.ok(repos.calls.some((c) => c[0] === 'syncFromService' && c[1] === 'DP-INV-9'));
  });

  await test('finalize: losing the number claim => 409 and no number generated; failed write releases the claim', async () => {
    let generated = 0;
    const next = async () => { generated += 1; return 'DP-INV-T-2'; };
    await assert.rejects(commands(fakeInvoiceRepos({ service: openService, claimResult: false }), { next }).finalize(garageUser, String(sid), {}), (e) => e.code === 'FINALIZE_IN_PROGRESS');
    assert.strictEqual(generated, 0, 'no invoice number burned by the loser');
    const repos = fakeInvoiceRepos({ service: openService, updateResult: false });
    await assert.rejects(commands(repos, { next }).finalize(garageUser, String(sid), {}), ConflictError);
    assert.ok(repos.calls.some((c) => c[0] === 'releaseInvoiceNumberClaim' && c[2] === 'tok'));
    const ok = fakeInvoiceRepos({ service: openService });
    const result = await commands(ok, { next }).finalize(garageUser, String(sid), { laborAmount: 500 });
    assert.deepStrictEqual(result, { invoiceNumber: 'DP-INV-T-2', totalAmount: 500, invoiceStatus: 'FINALIZED' });
    const write = ok.calls.find((c) => c[0] === 'updateOpenInvoice')[2];
    assert.deepStrictEqual(write.guard, { invoiceFinalizeToken: 'tok' });
    assert.ok(!ok.calls.some((c) => c[0] === 'releaseInvoiceNumberClaim'), 'consumed claim not released');
  });

  await test('finalize/cancel: open checkout => 409 (totals or status cannot change under a payment)', async () => {
    await assert.rejects(commands(fakeInvoiceRepos({ service: openService }), { open: true }).finalize(garageUser, String(sid), {}), (e) => e.code === 'CHECKOUT_IN_PROGRESS');
    await assert.rejects(commands(fakeInvoiceRepos({ service: openService }), { open: true }).cancel(garageUser, String(sid)), (e) => e.code === 'CHECKOUT_IN_PROGRESS');
    const done = await commands(fakeInvoiceRepos({ service: { ...openService, invoiceStatus: 'CANCELLED' } })).cancel(garageUser, String(sid));
    assert.strictEqual(done.alreadyCancelled, true);
  });

  const queries = (repos, garageIds = {}) => createInvoiceQueryService({ repos, resolveGarageIds: async (id) => garageIds[id] || [id] });
  const owner = { id: 'u1', role: 'USER' };
  const newOwner = { id: 'u2', role: 'USER' };
  const users = { };

  await test('getInvoice: stranger and other garage 403; billing garage via garageId alias allowed', async () => {
    const service = { ...openService, createdBy: 'admin-x', garageId: 'garage-doc-1' };
    const repos = fakeInvoiceRepos({ service, vehicle: { _id: 'v1', ownerId: 'u1' }, users });
    await assert.rejects(queries(repos).getInvoice({ id: 'zz', role: 'USER' }, String(sid)), ForbiddenError);
    await assert.rejects(queries(repos).getInvoice(otherGarage, String(sid)), ForbiddenError);
    const inv = await queries(repos, { g1: ['g1', 'garage-doc-1'] }).getInvoice(garageUser, String(sid));
    assert.strictEqual(inv.id, String(sid));
  });

  await test('getInvoice: after a transfer the new vehicle owner sees the invoice but not the previous owner\'s contact details', async () => {
    const ownerOid = new ObjectId();
    const service = { ...openService, ownerId: String(ownerOid) };
    const repos = fakeInvoiceRepos({ service, vehicle: { _id: 'v1', ownerId: 'u2' }, users: { [String(ownerOid)]: { name: 'Old Owner', email: 'old@x.in', phone: '1' } } });
    const asNew = await queries(repos).getInvoice(newOwner, String(sid));
    assert.deepStrictEqual(asNew.customer, { name: 'Previous Owner', email: '', phone: '' });
    const asGarage = await queries(repos).getInvoice(garageUser, String(sid));
    assert.strictEqual(asGarage.customer.name, 'Old Owner', 'garage sees the customer it billed, not the new owner');
  });

  await test('getReceipt: authorisation happens before the paid check (no paid/unpaid oracle)', async () => {
    const repos = fakeInvoiceRepos({ service: openService, vehicle: { _id: 'v1', ownerId: 'u1' } });
    await assert.rejects(queries(repos).getReceipt({ id: 'zz', role: 'USER' }, String(sid)), ForbiddenError);
    await assert.rejects(queries(repos).getReceipt(owner, String(sid)), (e) => e instanceof ValidationError && /only available for paid/.test(e.message));
  });

  const eligibleResult = { eligible: true, requestedPaise: 100000, requestedRupees: 1000, payoutProfile: { bankAccountLast4: '7291' } };
  const settlementSvc = (repos, extra = {}) => {
    const sideEffects = { notified: 0, audited: 0 };
    const svc = createSettlementRequestService({
      repos,
      resolveGarageIds: async (id) => [id, 'garage-doc-1'],
      checkEligibility: extra.checkEligibility || (async () => eligibleResult),
      nextSettlementNumber: async () => 'DP-SET-T-1',
      notifyUser: extra.notifyUser || (async () => { sideEffects.notified += 1; }),
      logAudit: async () => { sideEffects.audited += 1; },
      highValueThresholdRupees: 50000,
      newToken: () => 'lock-tok',
      log: { warn() {}, error() {} },
    });
    return { svc, sideEffects };
  };
  const rows = [{ _id: 'e1', status: 'AVAILABLE', garageNetPaise: 40000 }, { _id: 'e2', status: 'REFUND_ADJUSTMENT', garageNetPaise: 40000 }, { _id: 'e3', status: 'AVAILABLE', garageNetPaise: 40000 }];

  await test('requestSettlement: lock held elsewhere => 409 before eligibility runs', async () => {
    let checked = false;
    const { svc } = settlementSvc(fakeEarningsRepos({ lockFree: false }), { checkEligibility: async () => { checked = true; return eligibleResult; } });
    await assert.rejects(svc.requestSettlement({ user: garageUser, body: {} }), (e) => e instanceof ConflictError && e.code === 'SETTLEMENT_REQUEST_IN_PROGRESS');
    assert.strictEqual(checked, false);
  });

  await test('requestSettlement: ineligible => 400 with reasonCode and the lock is released', async () => {
    const repos = fakeEarningsRepos({});
    const { svc } = settlementSvc(repos, { checkEligibility: async () => ({ eligible: false, reasonCode: 'INSUFFICIENT_BALANCE', reason: 'too much' }) });
    await assert.rejects(svc.requestSettlement({ user: garageUser, body: { amount: 9999 } }), (e) => e instanceof SettlementIneligibleError && e.details.reasonCode === 'INSUFFICIENT_BALANCE' && e.status === 400);
    assert.ok(repos.calls.some((c) => c[0] === 'releaseLock' && c[2] === 'lock-tok'));
  });

  await test('requestSettlement: invalid amount => 400 without taking the lock', async () => {
    const repos = fakeEarningsRepos({});
    await assert.rejects(settlementSvc(repos).svc.requestSettlement({ user: garageUser, body: { amount: 'abc' } }), ValidationError);
    assert.ok(!repos.calls.some((c) => c[0] === 'acquireLock'));
  });

  await test('requestSettlement: amount = locked sum (<= requested), rows CAS-locked, side-effect failure tolerated', async () => {
    const repos = fakeEarningsRepos({ available: rows });
    const { svc } = settlementSvc(repos, { notifyUser: async () => { throw new Error('push down'); } });
    const { settlement, message } = await svc.requestSettlement({ user: garageUser, body: { amount: 1000, notes: 'weekly' } });
    assert.strictEqual(settlement.requestedPaise, 80000);
    assert.strictEqual(settlement.requestedAmount, 800);
    assert.strictEqual(settlement.garageRequestedPaise, 100000);
    assert.deepStrictEqual(settlement.earningsIds, ['e1', 'e2']);
    assert.strictEqual(settlement.status, 'REQUESTED');
    assert.strictEqual(settlement.id, 'settlement-oid');
    assert.match(message, /₹800 submitted successfully/);
    assert.deepStrictEqual(repos.calls.find((c) => c[0] === 'claim')[1], ['e1', 'e2']);
    assert.ok(repos.calls.some((c) => c[0] === 'releaseLock'));
  });

  await test('requestSettlement: a row taken concurrently => every claimed row released, 409', async () => {
    const repos = fakeEarningsRepos({ available: rows, claimCount: 1 });
    await assert.rejects(settlementSvc(repos).svc.requestSettlement({ user: garageUser, body: {} }), (e) => e.code === 'EARNINGS_CHANGED');
    const release = repos.calls.find((c) => c[0] === 'release');
    assert.strictEqual(release[1], 'DP-SET-T-1');
    assert.strictEqual(release[2].length, 3);
    assert.ok(!repos.calls.some((c) => c[0] === 'insertRequested'));
  });

  await test('requestSettlement: no whole-row combination within the request => 400 NO_MATCHING_EARNINGS', async () => {
    const repos = fakeEarningsRepos({ available: [{ _id: 'big', status: 'AVAILABLE', garageNetPaise: 80000 }] });
    await assert.rejects(settlementSvc(repos).svc.requestSettlement({ user: garageUser, body: { amount: 600 } }), (e) => e.details && e.details.reasonCode === 'NO_MATCHING_EARNINGS');
    assert.ok(!repos.calls.some((c) => c[0] === 'claim'));
  });

  await test('Earnings queries: settlement of another garage 403; alias garage id and admin allowed', async () => {
    const q = (repos) => createEarningsQueryService({ repos, resolveGarageIds: async (id) => (id === 'g1' ? ['g1', 'garage-doc-1'] : [id]), forecast: async () => ({}) });
    const repos = fakeEarningsRepos({ settlement: { _id: 's1', garageId: 'garage-doc-1', earningsIds: [] } });
    await assert.rejects(q(repos).getSettlement(otherGarage, 's1'), ForbiddenError);
    assert.strictEqual((await q(repos).getSettlement(garageUser, 's1')).id, 's1');
    assert.strictEqual((await q(repos).getSettlement({ id: 'a', role: 'ADMIN' }, 's1')).id, 's1');
    await assert.rejects(q(fakeEarningsRepos({})).getSettlement(garageUser, 'nope'), NotFoundError);
    await assert.rejects(q(fakeEarningsRepos({ earning: { _id: 'e', garageId: 'g9' } })).getEarning(garageUser, 'e'), ForbiddenError);
  });
}

// ---------------------------------------------------------------------------------------------
// 3. HTTP against the real app
// ---------------------------------------------------------------------------------------------
async function httpTests() {
  const { loadConfig } = require('./src/config');
  const { connectToMongo, getDb, closeMongo } = require('./src/db');
  await connectToMongo(loadConfig());
  const db = getDb();
  await db.dropDatabase();
  await require('./src/models/CoreIndexes').ensureCoreIndexes(db);
  await require('./src/models/Payment').ensurePaymentIndexes(db);
  await require('./src/models/Earnings').ensureEarningsIndexes(db);

  const { buildApp } = require('./server');
  const server = buildApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  let keySeq = 0;
  const call = async (method, path, { body, token, idempotent } = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (idempotent) headers['Idempotency-Key'] = `suite-${process.pid}-${(keySeq += 1)}`;
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  };

  console.log('\n— HTTP: invoices + earnings (real Express app + MongoDB) —');
  const mk = (role, name) => ({ _id: new ObjectId(), name, email: `${name.toLowerCase().replace(/\s/g, '')}@driveportz-test.in`, phone: '9000000000', role, tokenVersion: 0 });
  const owner = mk('USER', 'Owner');
  const newOwner = mk('USER', 'New Owner');
  const stranger = mk('USER', 'Stranger');
  const gUserA = mk('GARAGE', 'Garage A');
  const gUserB = mk('GARAGE', 'Garage B');
  const gUserC = mk('GARAGE', 'Garage C');
  const admin = mk('ADMIN', 'Admin');
  await db.collection('users').insertMany([owner, newOwner, stranger, gUserA, gUserB, gUserC, admin]);
  const garageA = { _id: new ObjectId(), ownerUserId: String(gUserA._id), name: 'Garage A', city: 'Bengaluru', isActive: true };
  const garageB = { _id: new ObjectId(), ownerUserId: String(gUserB._id), name: 'Garage B', isActive: true };
  const garageC = { _id: new ObjectId(), ownerUserId: String(gUserC._id), name: 'Garage C', isActive: true };
  await db.collection('garages').insertMany([garageA, garageB, garageC]);
  const car = { _id: new ObjectId(), vehicleNumber: 'KA01AB1234', brand: 'Hyundai', model: 'i20', ownerId: String(owner._id), createdAt: new Date() };
  const soldCar = { _id: new ObjectId(), vehicleNumber: 'KA05ZZ0001', brand: 'Tata', ownerId: String(newOwner._id), createdAt: new Date() };
  await db.collection('vehicles').insertMany([car, soldCar]);

  const T = { owner: tokenFor(owner), newOwner: tokenFor(newOwner), stranger: tokenFor(stranger), a: tokenFor(gUserA), b: tokenFor(gUserB), c: tokenFor(gUserC), admin: tokenFor(admin) };
  const services = db.collection('services');
  let n = 0;
  const mkService = async (extra = {}) => {
    n += 1;
    const doc = { _id: new ObjectId(), vehicleId: String(car._id), ownerId: String(owner._id), createdBy: String(gUserA._id), serviceType: `Job ${n}`, serviceDate: '2026-11-01', totalCost: 100, totalAmount: 100, paymentStatus: 'UNPAID', invoiceStatus: 'DRAFT', createdAt: new Date(Date.now() + n), ...extra };
    await services.insertOne(doc);
    return doc;
  };
  const inv = (path) => `/api/garage/invoices/garage/${path}`;

  try {
    // ----- Invoice detail / receipt RBAC ------------------------------------------------------
    const billed = await mkService({ invoiceNumber: 'DP-INV-2026-900001', invoiceStatus: 'FINALIZED' });

    await test('GET /api/invoices/:id: owner, issuing garage and admin 200; stranger and other garage 403; unknown 404', async () => {
      const r = await call('GET', `/api/invoices/${billed._id}`, { token: T.owner });
      assert.strictEqual(r.status, 200, r.text);
      assert.strictEqual(r.json.success, true);
      const keys = ['id', 'invoiceNumber', 'invoiceStatus', 'paymentStatus', 'serviceDate', 'serviceCategory', 'serviceType', 'mechanicNotes', 'partsReplaced', 'partsAmount', 'laborCharges', 'laborAmount', 'additionalCharges', 'discountAmount', 'taxableAmount', 'taxAmount', 'taxSnapshot', 'subtotal', 'totalAmount', 'paidAt', 'paymentId', 'paymentMethod', 'razorpayOrderId', 'garage', 'vehicle', 'customer', 'billPhotoUrls', 'createdAt', 'invoiceFinalizedAt'];
      assert.ok(keys.every((k) => k in r.json.invoice || ['paidAt', 'paymentId', 'paymentMethod', 'razorpayOrderId', 'invoiceFinalizedAt'].includes(k)), JSON.stringify(Object.keys(r.json.invoice)));
      assert.strictEqual(r.json.invoice.garage.name, 'Garage A');
      assert.strictEqual(r.json.invoice.customer.name, 'Owner');
      assert.strictEqual(r.json.invoice.vehicle.registrationNumber, 'KA01AB1234');
      assert.strictEqual((await call('GET', `/api/invoices/${billed._id}`, { token: T.a })).status, 200);
      assert.strictEqual((await call('GET', `/api/invoices/${billed._id}`, { token: T.admin })).status, 200);
      assert.strictEqual((await call('GET', `/api/invoices/DP-INV-2026-900001`, { token: T.owner })).status, 200, 'by invoice number');
      assert.strictEqual((await call('GET', `/api/invoices/${billed._id}`, { token: T.stranger })).status, 403);
      assert.strictEqual((await call('GET', `/api/invoices/${billed._id}`, { token: T.b })).status, 403);
      assert.strictEqual((await call('GET', `/api/garage/invoices/${billed._id}`, { token: T.b })).status, 403, 'second mount enforces the same rule');
      assert.strictEqual((await call('GET', `/api/invoices/${new ObjectId()}`, { token: T.owner })).status, 404);
      assert.strictEqual((await call('GET', `/api/invoices/${billed._id}`)).status, 401);
    });

    await test('GET /api/invoices/:id after a transfer: new owner gets no previous-owner PII; garage sees its customer, not the new owner', async () => {
      const old = await mkService({ vehicleId: String(soldCar._id), ownerId: String(owner._id) });
      const asNew = await call('GET', `/api/invoices/${old._id}`, { token: T.newOwner });
      assert.strictEqual(asNew.status, 200, asNew.text);
      assert.deepStrictEqual(asNew.json.invoice.customer, { name: 'Previous Owner', email: '', phone: '' });
      const asGarage = await call('GET', `/api/invoices/${old._id}`, { token: T.a });
      assert.strictEqual(asGarage.json.invoice.customer.email, owner.email);
    });

    await test('GET /:id/receipt: stranger 403 even when unpaid; owner 400 until paid; paid receipt never borrows another payment', async () => {
      await db.collection('payments').insertOne({ _id: new ObjectId(), serviceId: String(new ObjectId()), status: 'CAPTURED', amount: 1, razorpayOrderId: 'order_FOREIGN', paymentMethod: 'Foreign card', createdAt: new Date() });
      assert.strictEqual((await call('GET', `/api/invoices/${billed._id}/receipt`, { token: T.stranger })).status, 403);
      const unpaid = await call('GET', `/api/invoices/${billed._id}/receipt`, { token: T.owner });
      assert.strictEqual(unpaid.status, 400);
      assert.strictEqual(unpaid.json.message, 'Receipt is only available for paid invoices');
      await services.updateOne({ _id: billed._id }, { $set: { paymentStatus: 'PAID', paidAt: new Date() } });
      const r = await call('GET', `/api/invoices/${billed._id}/receipt`, { token: T.owner });
      assert.strictEqual(r.status, 200, r.text);
      assert.strictEqual(r.json.receipt.amount, 100);
      assert.strictEqual(r.json.receipt.invoiceNumber, 'DP-INV-2026-900001');
      assert.notStrictEqual(r.json.receipt.orderId, 'order_FOREIGN', 'missing paymentId must not match an unrelated payment');
      assert.notStrictEqual(r.json.receipt.paymentMethod, 'Foreign card');
      assert.strictEqual((await call('GET', `/api/invoices/${billed._id}/receipt`, { token: T.b })).status, 403);
    });

    // ----- Bill edits, money math and the checkout lock ----------------------------------------
    const draft = await mkService();

    await test('PUT /garage/:id: owner (USER) 403 by role, other garage 403, unknown 404', async () => {
      const body = { laborAmount: 10 };
      assert.strictEqual((await call('PUT', inv(draft._id), { token: T.owner, body })).status, 403);
      const other = await call('PUT', inv(draft._id), { token: T.b, body });
      assert.strictEqual(other.status, 403);
      assert.strictEqual(other.json.message, 'Forbidden: You can only edit your own garage services');
      assert.strictEqual((await call('PUT', inv(new ObjectId()), { token: T.a, body })).status, 404);
      assert.strictEqual((await services.findOne({ _id: draft._id })).totalAmount, 100, 'unchanged');
    });

    await test('PUT /garage/:id: exact paise totals, legacy response keys, paise fields kept consistent', async () => {
      const r = await call('PUT', inv(draft._id), { token: T.a, body: { partsReplaced: [{ partName: 'Bulb', quantity: 3, unitPrice: 0.1 }, { partName: 'Fuse', unitPrice: 0.2 }], laborAmount: 100.1, additionalCharges: 0.2, discountAmount: 0.3, mechanicNotes: 'ok' } });
      assert.strictEqual(r.status, 200, r.text);
      assert.strictEqual(r.json.message, 'Invoice bill items updated successfully');
      assert.deepStrictEqual(Object.keys(r.json.invoice).sort(), ['additionalCharges', 'discountAmount', 'id', 'laborAmount', 'laborCost', 'mechanicNotes', 'partsAmount', 'partsReplaced', 'subtotal', 'taxAmount', 'totalAmount', 'totalCost', 'updatedAt'].sort());
      assert.strictEqual(r.json.invoice.totalAmount, 100.5);
      assert.strictEqual(r.json.invoice.subtotal, 100.8);
      const doc = await services.findOne({ _id: draft._id });
      assert.deepStrictEqual([doc.totalAmount, doc.totalCost, doc.grandTotalPaise, doc.subtotalAmount, doc.taxablePaise], [100.5, 100.5, 10050, 100.8, 10050]);
      const detail = await call('GET', `/api/invoices/${draft._id}`, { token: T.owner });
      assert.strictEqual(detail.json.invoice.subtotal, 100.8, 'detail no longer shows a stale subtotal');
    });

    await test('PUT /garage/:id: checkout lock => 409 CHECKOUT_IN_PROGRESS; stale checkout no longer blocks', async () => {
      const pay = { _id: new ObjectId(), serviceId: String(draft._id), status: 'CREATED', amount: 100.5, updatedAt: new Date(), createdAt: new Date() };
      await db.collection('payments').insertOne(pay);
      const r = await call('PUT', inv(draft._id), { token: T.a, body: { laborAmount: 1 } });
      assert.strictEqual(r.status, 409, r.text);
      assert.deepStrictEqual([r.json.success, r.json.code], [false, 'CHECKOUT_IN_PROGRESS']);
      assert.strictEqual((await services.findOne({ _id: draft._id })).totalAmount, 100.5, 'total untouched during checkout');
      const fin = await call('POST', inv(`${draft._id}/finalize`), { token: T.a, body: { laborAmount: 1 } });
      assert.strictEqual(fin.status, 409, 'finalize cannot change totals during checkout either');
      assert.strictEqual((await call('POST', inv(`${draft._id}/cancel`), { token: T.a })).status, 409, 'nor cancel');
      await db.collection('payments').updateOne({ _id: pay._id }, { $set: { updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
      assert.strictEqual((await call('PUT', inv(draft._id), { token: T.a, body: { laborAmount: 1 } })).status, 200);
    });

    await test('PUT/finalize: PAID and PARTIALLY_PAID are frozen (400)', async () => {
      const paid = await mkService({ paymentStatus: 'PAID' });
      const partial = await mkService({ paymentStatus: 'PARTIALLY_PAID' });
      assert.strictEqual((await call('PUT', inv(paid._id), { token: T.a, body: { laborAmount: 1 } })).json.message, 'Cannot modify a paid invoice');
      assert.strictEqual((await call('PUT', inv(partial._id), { token: T.a, body: { laborAmount: 1 } })).status, 400);
      assert.strictEqual((await call('POST', inv(`${partial._id}/finalize`), { token: T.a, body: {} })).status, 400);
      assert.strictEqual((await call('POST', inv(`${paid._id}/cancel`), { token: T.a })).status, 400);
      assert.strictEqual((await services.findOne({ _id: partial._id })).totalAmount, 100);
    });

    await test('PUT on a GST invoice recomputes tax from the snapshot (was silently zeroed) and syncs the invoice document', async () => {
      const gst = await mkService({ invoiceNumber: 'DP-INV-2026-900002', invoiceStatus: 'FINALIZED', status: 'COMPLETED', taxSnapshot: { rate: 18, isIntrastate: true, totalTaxPaise: 0 }, taxAmount: 0 });
      await db.collection('invoices').insertOne({ invoiceNumber: 'DP-INV-2026-900002', serviceId: String(gst._id), grandTotalPaise: 0 });
      const r = await call('PUT', inv(gst._id), { token: T.a, body: { laborAmount: 2401 } });
      assert.strictEqual(r.status, 200, r.text);
      assert.strictEqual(r.json.invoice.taxAmount, 432.18);
      assert.strictEqual(r.json.invoice.totalAmount, 2833.18);
      const doc = await services.findOne({ _id: gst._id });
      assert.strictEqual(doc.taxSnapshot.totalTaxPaise, 43218);
      assert.strictEqual(doc.taxAmountPaise, 43218);
      assert.strictEqual((await db.collection('invoices').findOne({ invoiceNumber: 'DP-INV-2026-900002' })).grandTotalPaise, 283318);
    });

    // ----- Finalize (incl. concurrency) and cancel --------------------------------------------
    await test('POST finalize: other garage 403; 6 concurrent finalizes assign exactly ONE invoice number', async () => {
      const fresh = await mkService({ partsReplaced: [{ partName: 'Pad', quantity: 2, unitPrice: 450.5 }], laborCost: 99.99 });
      assert.strictEqual((await call('POST', inv(`${fresh._id}/finalize`), { token: T.b, body: {} })).status, 403);
      const year = new Date().getFullYear();
      const before = (await db.collection('counters').findOne({ _id: `invoice_${year}` })) || { seq: 0 };
      const results = await Promise.all(Array.from({ length: 6 }, () => call('POST', inv(`${fresh._id}/finalize`), { token: T.a, body: {} })));
      const statuses = results.map((r) => r.status);
      assert.ok(statuses.every((s) => s === 200 || s === 409), statuses.join(','));
      const ok = results.filter((r) => r.status === 200);
      assert.ok(ok.length >= 1);
      assert.strictEqual(new Set(ok.map((r) => r.json.invoiceNumber)).size, 1, 'every success reports the same number');
      results.filter((r) => r.status === 409).forEach((r) => assert.strictEqual(r.json.code, 'FINALIZE_IN_PROGRESS'));
      const after = await db.collection('counters').findOne({ _id: `invoice_${year}` });
      assert.strictEqual(after.seq - (before.seq || 0), 1, 'no invoice number burned');
      const doc = await services.findOne({ _id: fresh._id });
      assert.strictEqual(doc.invoiceNumber, ok[0].json.invoiceNumber);
      assert.strictEqual(doc.invoiceStatus, 'FINALIZED');
      assert.strictEqual(doc.totalAmount, 1000.99, '2 x 450.50 + 99.99');
      assert.strictEqual(doc.invoiceFinalizeToken, undefined, 'claim consumed');
      assert.deepStrictEqual(Object.keys(ok[0].json).sort(), ['invoiceNumber', 'invoiceStatus', 'message', 'success', 'totalAmount']);
      const again = await call('POST', inv(`${fresh._id}/finalize`), { token: T.a, body: { laborAmount: 0.01, partsReplaced: [] } });
      assert.strictEqual(again.status, 200);
      assert.strictEqual(again.json.invoiceNumber, doc.invoiceNumber, 're-finalize keeps the number');
      assert.strictEqual(again.json.totalAmount, 0.01);
    });

    await test('POST cancel: other garage 403; cancelled invoice cannot be edited or finalized; cancel is idempotent', async () => {
      const c = await mkService();
      assert.strictEqual((await call('POST', inv(`${c._id}/cancel`), { token: T.b })).status, 403);
      const r = await call('POST', inv(`${c._id}/cancel`), { token: T.a });
      assert.deepStrictEqual([r.status, r.json.message], [200, 'Invoice cancelled successfully']);
      assert.strictEqual((await services.findOne({ _id: c._id })).invoiceStatus, 'CANCELLED');
      assert.strictEqual((await call('PUT', inv(c._id), { token: T.a, body: { laborAmount: 5 } })).status, 400);
      assert.strictEqual((await call('POST', inv(`${c._id}/finalize`), { token: T.a, body: {} })).status, 400, 'cannot resurrect a cancelled invoice');
      assert.strictEqual((await call('POST', inv(`${c._id}/cancel`), { token: T.a })).status, 200);
    });

    // ----- Garage invoice list -------------------------------------------------------------------
    await test('GET /garage/all: pagination headers, body shape, status filters, isolation, literal search, legacy ids', async () => {
      await mkService({ vehicleId: 'legacy-vehicle', ownerId: 'legacy-owner', serviceType: 'Legacy row' });
      await mkService({ createdBy: String(gUserB._id), serviceType: 'B only' });
      const all = await call('GET', `${inv('all')}?limit=100`, { token: T.a });
      assert.strictEqual(all.status, 200, all.text);
      const total = all.json.totalCount;
      assert.ok(total >= 8, `total ${total}`);
      assert.ok(all.json.invoices.every((i) => i.serviceType !== 'B only'), 'garage A never sees garage B rows');
      const p2 = await call('GET', `${inv('all')}?page=2&limit=3`, { token: T.a });
      assert.deepStrictEqual([p2.headers.get('x-total-count'), p2.headers.get('x-page'), p2.headers.get('x-limit'), p2.headers.get('x-total-pages')], [String(total), '2', '3', String(Math.ceil(total / 3))]);
      assert.deepStrictEqual(Object.keys(p2.json).sort(), ['currentPage', 'invoices', 'success', 'totalCount', 'totalPages']);
      assert.strictEqual(p2.json.invoices.length, 3);
      assert.strictEqual(p2.json.totalPages, Math.ceil(total / 3));
      const paid = await call('GET', `${inv('all')}?status=PAID&limit=100`, { token: T.a });
      assert.ok(paid.json.invoices.length >= 2 && paid.json.invoices.every((i) => i.paymentStatus === 'PAID'));
      const cancelled = await call('GET', `${inv('all')}?status=CANCELLED`, { token: T.a });
      assert.ok(cancelled.json.invoices.every((i) => i.invoiceStatus === 'CANCELLED') && cancelled.json.invoices.length >= 1);
      const legacy = await call('GET', `${inv('all')}?search=Legacy`, { token: T.a });
      assert.strictEqual(legacy.status, 200, 'non-ObjectId vehicleId no longer 500s the whole list');
      assert.strictEqual(legacy.json.invoices.length, 1);
      assert.strictEqual(legacy.json.invoices[0].vehicle, null);
      const byPlate = await call('GET', `${inv('all')}?search=ka01ab`, { token: T.a });
      assert.ok(byPlate.json.invoices.length >= 1);
      assert.strictEqual((await call('GET', `${inv('all')}?search=${encodeURIComponent('(a+)+$')}`, { token: T.a })).status, 200);
      assert.strictEqual((await call('GET', `${inv('all')}?limit=100000`, { token: T.a })).headers.get('x-limit'), '100', 'limit bounded');
      assert.strictEqual((await call('GET', inv('all'), { token: T.owner })).status, 403);
    });

    // ----- Payments, revenue, analytics -----------------------------------------------------------
    await test('Revenue summary: exact paise sums (no float drift), refunds, failures, pending; garage isolation', async () => {
      const today = new Date();
      const pays = db.collection('payments');
      await pays.insertMany([
        { serviceId: String(billed._id), status: 'CAPTURED', amount: 0.1, paidAt: today, createdAt: today },
        { garageId: String(garageA._id), status: 'CAPTURED', amount: 0.2, paidAt: today, createdAt: today },
        { garageId: String(gUserA._id), status: 'CAPTURED', amount: '100.05', paidAt: new Date('2020-01-01'), createdAt: new Date('2020-01-01') },
        { garageId: String(gUserA._id), status: 'PARTIALLY_REFUNDED', amount: 50, totalRefundedAmount: 10.1, paidAt: today, createdAt: today },
        { garageId: String(gUserA._id), status: 'FAILED', amount: 70, createdAt: today },
        { garageId: String(gUserB._id), status: 'CAPTURED', amount: 999, paidAt: today, createdAt: today },
      ]);
      const r = await call('GET', inv('revenue/summary'), { token: T.a });
      assert.strictEqual(r.status, 200, r.text);
      const s = r.json.summary;
      assert.deepStrictEqual(Object.keys(s).sort(), ['failedPayments', 'monthRevenue', 'paidInvoices', 'pendingPayments', 'refundedAmount', 'todayRevenue', 'totalRevenue', 'totalServicesLogged'].sort());
      assert.strictEqual(s.totalRevenue, 100.35, '0.1 + 0.2 + 100.05 exactly (garage-id alias payment included)');
      assert.strictEqual(s.paidInvoices, 3);
      assert.strictEqual(s.todayRevenue, 0.3);
      assert.strictEqual(s.refundedAmount, 10.1);
      assert.strictEqual(s.failedPayments, 1);
      const unpaidOpen = await services.find({ createdBy: String(gUserA._id), paymentStatus: { $ne: 'PAID' }, invoiceStatus: { $ne: 'CANCELLED' } }).toArray();
      const expectedPending = unpaidOpen.reduce((sum, d) => sum + Math.round(Number(d.totalAmount ?? d.totalCost ?? 0) * 100), 0) / 100;
      assert.strictEqual(s.pendingPayments, expectedPending);
      assert.strictEqual(s.totalServicesLogged, await services.countDocuments({ createdBy: String(gUserA._id) }));
      const b = await call('GET', inv('revenue/summary'), { token: T.b });
      assert.strictEqual(b.json.summary.totalRevenue, 999);
    });

    await test('GET /garage/payments/all: paginated with headers, includes alias-id payments, isolated per garage', async () => {
      const r = await call('GET', `${inv('payments/all')}?limit=2`, { token: T.a });
      assert.strictEqual(r.status, 200, r.text);
      assert.deepStrictEqual(Object.keys(r.json).sort(), ['payments', 'success']);
      assert.strictEqual(r.json.payments.length, 2);
      assert.ok(Number(r.headers.get('x-total-count')) >= 6);
      const all = await call('GET', inv('payments/all'), { token: T.a });
      assert.ok(all.json.payments.some((p) => p.amount === 0.2), 'payment stamped with the garage _id is included');
      assert.ok(all.json.payments.every((p) => p.amount !== 999 && p.amount !== 1));
      assert.ok(['id', 'invoiceNumber', 'orderId', 'paymentId', 'amount', 'currency', 'serviceType', 'vehicleNumber', 'status', 'paymentMethod', 'date'].every((k) => k in all.json.payments[0] || k === 'orderId'));
      const b = await call('GET', inv('payments/all'), { token: T.b });
      assert.deepStrictEqual(b.json.payments.map((p) => p.amount), [999]);
    });

    await test('GET /garage/payments/analytics: days+1 buckets, today aggregated in paise', async () => {
      const r = await call('GET', `${inv('payments/analytics')}?period=30days`, { token: T.a });
      assert.strictEqual(r.status, 200, r.text);
      assert.strictEqual(r.json.period, '30days');
      assert.strictEqual(r.json.trends.length, 31);
      const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      assert.strictEqual(r.json.trends[r.json.trends.length - 1].date, todayKey, 'last bucket is today (business timezone)');
      const bucket = r.json.trends.find((t) => t.date === todayKey);
      assert.ok(bucket, 'today bucket present');
      assert.strictEqual(bucket.revenue, 50.3, '0.1 + 0.2 + 50 (partially refunded counts as revenue in trends)');
      assert.strictEqual(bucket.refunds, 10.1);
      assert.strictEqual(bucket.count, 3);
      assert.strictEqual((await call('GET', inv('payments/analytics'), { token: T.a })).json.trends.length, 8);
    });

    // ----- Earnings, payout profile, settlements --------------------------------------------------
    const earnings = db.collection('garage_earnings');
    const mkEarning = (garageId, netPaise, extra = {}) => ({ _id: new ObjectId(), garageId, paymentId: String(new ObjectId()), invoiceNumber: `INV-${netPaise}`, grossAmount: netPaise / 100 + 50, platformCommission: 50, garageNetAmount: netPaise / 100, garageNetPaise: netPaise, status: 'AVAILABLE', createdAt: new Date(Date.now() + (n += 1)), ...extra });
    const aRows = [mkEarning(String(garageA._id), 40000), mkEarning(String(gUserA._id), 40000), mkEarning(String(garageA._id), 40000)];
    await earnings.insertMany([...aRows, mkEarning(String(gUserA._id), 12345, { status: 'SETTLED' }), mkEarning(String(gUserB._id), 99900)]);

    await test('Payout profile: invalid input 400; saved masked; GET returns masked only', async () => {
      assert.strictEqual((await call('PUT', '/api/garage/payout-profile', { token: T.a, body: { accountHolderName: 'A' } })).status, 400);
      assert.strictEqual((await call('PUT', '/api/garage/payout-profile', { token: T.a, body: { accountHolderName: 'A', accountNumber: '12', ifscCode: 'HDFC0001234' } })).status, 400);
      assert.strictEqual((await call('PUT', '/api/garage/payout-profile', { token: T.a, body: { accountHolderName: 'A', accountNumber: '50100492817291', ifscCode: 'nope' } })).status, 400);
      const r = await call('PUT', '/api/garage/payout-profile', { token: T.a, body: { accountHolderName: 'Apex Auto', accountNumber: '50100492817291', ifscCode: 'hdfc0001234', bankName: 'HDFC' } });
      assert.strictEqual(r.status, 200, r.text);
      assert.deepStrictEqual(r.json.profile, { accountHolderName: 'Apex Auto', bankAccountLast4: '7291', bankName: 'HDFC', ifscMasked: 'HDFC***234', verified: true });
      const stored = await db.collection('garage_payout_profiles').findOne({ garageId: String(gUserA._id) });
      assert.ok(!JSON.stringify(stored).includes('50100492817291'), 'full account number never stored');
      const g = await call('GET', '/api/garage/payout-profile', { token: T.a });
      assert.deepStrictEqual(g.json, { success: true, profile: r.json.profile });
      assert.strictEqual((await call('GET', '/api/garage/payout-profile', { token: T.b })).json.profile, null);
      assert.strictEqual((await call('GET', '/api/garage/payout-profile', { token: T.owner })).status, 403);
      await call('PUT', '/api/garage/payout-profile', { token: T.c, body: { accountHolderName: 'C Motors', accountNumber: '1234567890', ifscCode: 'ICIC0000001' } });
    });

    await test('GET /earnings/summary: paise-exact totals over every garage id alias', async () => {
      const r = await call('GET', '/api/garage/earnings/summary', { token: T.a });
      assert.strictEqual(r.status, 200, r.text);
      assert.deepStrictEqual(r.json.summary, { totalGrossRevenue: 1523.45, platformCommission: 200, netGarageEarnings: 1323.45, availableBalance: 1200, pendingSettlement: 0, settledAmount: 123.45, totalRefundAdjustments: 0, totalTransactions: 4 });
    });

    await test('GET /earnings list + /earnings/:id: headers, filters, isolation', async () => {
      const r = await call('GET', '/api/garage/earnings?limit=2', { token: T.a });
      assert.strictEqual(r.status, 200, r.text);
      assert.strictEqual(r.headers.get('x-total-count'), '4');
      assert.deepStrictEqual(Object.keys(r.json).sort(), ['currentPage', 'earnings', 'success', 'totalCount', 'totalPages']);
      assert.strictEqual(r.json.totalPages, 2);
      assert.strictEqual((await call('GET', '/api/garage/earnings?status=AVAILABLE', { token: T.a })).json.totalCount, 3);
      assert.strictEqual((await call('GET', '/api/garage/earnings?search=INV-12345', { token: T.a })).json.totalCount, 1);
      assert.strictEqual((await call('GET', `/api/garage/earnings/${aRows[0]._id}`, { token: T.b })).status, 403);
      const own = await call('GET', `/api/garage/earnings/${aRows[0]._id}`, { token: T.a });
      assert.deepStrictEqual([own.status, own.json.earning.id], [200, String(aRows[0]._id)]);
      assert.strictEqual((await call('GET', `/api/garage/earnings/${aRows[1].paymentId}`, { token: T.a })).status, 200, 'lookup by paymentId works');
      assert.strictEqual((await call('GET', `/api/garage/earnings/earnings/${aRows[0]._id}`, { token: T.a })).status, 200, 'second mount still served');
    });

    await test('GET /settlements: no longer a 500 (missing import); paginated with headers', async () => {
      const r = await call('GET', '/api/garage/settlements?limit=5', { token: T.a });
      assert.strictEqual(r.status, 200, r.text);
      assert.deepStrictEqual(Object.keys(r.json).sort(), ['currentPage', 'settlements', 'success', 'totalCount', 'totalPages']);
      assert.strictEqual(r.headers.get('x-limit'), '5');
    });

    let settlementA;
    await test('POST /settlements/request: junk amount 400, over balance 400, no whole-row match 400 — nothing locked', async () => {
      const junk = await call('POST', '/api/garage/settlements/request', { token: T.a, body: { amount: 'abc' }, idempotent: true });
      assert.strictEqual(junk.status, 400, junk.text);
      const over = await call('POST', '/api/garage/settlements/request', { token: T.a, body: { amount: 5000 }, idempotent: true });
      assert.deepStrictEqual([over.status, over.json.reasonCode], [400, 'INSUFFICIENT_BALANCE']);
      const noMatch = await call('POST', '/api/garage/settlements/request', { token: T.a, body: { amount: 500 }, idempotent: true });
      assert.deepStrictEqual([noMatch.status, noMatch.json.reasonCode], [400, 'NO_MATCHING_EARNINGS'], noMatch.text);
      assert.strictEqual(await db.collection('settlements').countDocuments({}), 0);
      assert.strictEqual(await earnings.countDocuments({ status: 'SETTLEMENT_PENDING' }), 0);
    });

    await test('POST /settlements/request: settles exactly the locked rows (≤ requested), 201 shape kept; second request refused', async () => {
      const r = await call('POST', '/api/garage/settlements/request', { token: T.a, body: { amount: 1000, notes: 'weekly' }, idempotent: true });
      assert.strictEqual(r.status, 201, r.text);
      settlementA = r.json.settlement;
      assert.strictEqual(r.json.success, true);
      assert.match(r.json.message, /for ₹800 submitted successfully/);
      assert.strictEqual(settlementA.status, 'REQUESTED');
      assert.strictEqual(settlementA.requestedPaise, 80000);
      assert.strictEqual(settlementA.requestedAmount, 800);
      assert.strictEqual(settlementA.garageId, String(gUserA._id));
      assert.ok(settlementA.id && settlementA.settlementId);
      const locked = await earnings.find({ settlementId: settlementA.settlementId }).toArray();
      assert.strictEqual(locked.length, 2);
      assert.ok(locked.every((e) => e.status === 'SETTLEMENT_PENDING'));
      assert.strictEqual(locked.reduce((s, e) => s + e.garageNetPaise, 0), settlementA.requestedPaise, 'locked sum == payout (reconciliation invariant)');
      assert.strictEqual(await earnings.countDocuments({ _id: aRows[2]._id, status: 'AVAILABLE' }), 1, 'third row untouched');
      const again = await call('POST', '/api/garage/settlements/request', { token: T.a, body: {}, idempotent: true });
      assert.deepStrictEqual([again.status, again.json.reasonCode], [400, 'ACTIVE_SETTLEMENT_EXISTS']);
      assert.strictEqual((await call('POST', '/api/garage/settlements/request', { token: T.owner, body: {}, idempotent: true })).status, 403);
    });

    await test('POST /settlements/request: 6 concurrent requests (distinct keys) => exactly ONE settlement, no double lock', async () => {
      await earnings.insertMany([mkEarning(String(gUserC._id), 30000), mkEarning(String(garageC._id), 30050), mkEarning(String(gUserC._id), -5000, { status: 'REFUND_ADJUSTMENT', netAfterRefundPaise: -5000 })]);
      const results = await Promise.all(Array.from({ length: 6 }, () => call('POST', '/api/garage/settlements/request', { token: T.c, body: {}, idempotent: true })));
      const statuses = results.map((r) => r.status);
      assert.strictEqual(statuses.filter((s) => s === 201).length, 1, statuses.join(','));
      assert.ok(statuses.every((s) => s === 201 || s === 409 || s === 400), statuses.join(','));
      results.filter((r) => r.status === 409).forEach((r) => assert.strictEqual(r.json.code, 'SETTLEMENT_REQUEST_IN_PROGRESS'));
      const created = await db.collection('settlements').find({ garageId: String(gUserC._id) }).toArray();
      assert.strictEqual(created.length, 1);
      assert.strictEqual(created[0].requestedPaise, 55050, 'full balance incl. the refund adjustment, in paise');
      assert.strictEqual(created[0].requestedAmount, 550.5);
      const locked = await earnings.find({ settlementId: created[0].settlementId }).toArray();
      assert.strictEqual(locked.length, 3);
      assert.strictEqual(locked.reduce((s, e) => s + (e.netAfterRefundPaise ?? e.garageNetPaise), 0), 55050);
      assert.strictEqual(await db.collection('settlement_request_locks').countDocuments({}), 0, 'locks released');
    });

    await test('GET /settlements/:id: owner 200 with included earnings, other garage 403, admin 200, scheduler (garage _id) settlement visible', async () => {
      const r = await call('GET', `/api/garage/settlements/${settlementA.id}`, { token: T.a });
      assert.strictEqual(r.status, 200, r.text);
      assert.strictEqual(r.json.settlement.includedEarnings.length, 2);
      assert.strictEqual((await call('GET', `/api/garage/settlements/${settlementA.settlementId}`, { token: T.a })).status, 200, 'by settlement number');
      assert.strictEqual((await call('GET', `/api/garage/settlements/${settlementA.id}`, { token: T.b })).status, 403);
      assert.strictEqual((await call('GET', `/api/garage/settlements/${settlementA.id}`, { token: T.stranger })).status, 403);
      assert.strictEqual((await call('GET', `/api/garage/settlements/${settlementA.id}`, { token: T.admin })).status, 200);
      const scheduled = { _id: new ObjectId(), settlementId: 'DP-SET-SCHED-1', garageId: String(garageA._id), status: 'SETTLED', requestedAmount: 10, earningsIds: [], requestedAt: new Date(0) };
      await db.collection('settlements').insertOne(scheduled);
      assert.strictEqual((await call('GET', `/api/garage/settlements/${scheduled._id}`, { token: T.a })).status, 200, 'was 403: garageId stored as garage _id');
      const list = await call('GET', '/api/garage/settlements', { token: T.a });
      assert.strictEqual(list.json.totalCount, 2, 'list covers both id aliases');
      assert.strictEqual(list.json.settlements[0].earningsCount, 2);
      assert.strictEqual((await call('GET', `/api/garage/settlements/${new ObjectId()}`, { token: T.a })).status, 404);
    });
  } finally {
    server.close();
    await db.dropDatabase();
    await closeMongo();
  }
}

(async () => {
  console.log('🚀 DrivePortz invoice + earnings routes suite');
  await pureTests();
  await serviceUnitTests();
  await httpTests();
  console.log(`\n${failed === 0 ? '✅' : '❌'} Invoice + earnings routes suite: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('❌ Invoice + earnings routes suite crashed:', err);
  process.exit(1);
});
