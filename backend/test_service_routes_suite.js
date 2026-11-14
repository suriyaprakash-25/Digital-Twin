/**
 * Service routes suite: /api/services after the Repository + service-layer refactor.
 *
 *  1. Pure unit tests of the invoice arithmetic (buildInvoiceLines / computeTotals / applyTax).
 *  2. Service unit tests with FAKE repositories (no database).
 *  3. HTTP tests against the real Express app and a throwaway MongoDB database.
 *
 * Plain Node + assert, like the other suites. Uses its own database and drops it at the end.
 */
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'service-suite-secret-key-2026-minimum-32-chars';
process.env.MONGO_DB_NAME = `driveportz_service_suite_${process.pid}`;
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
    console.error(`  ❌ ${name}\n     ${err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n     ') : err}`);
  }
}

function tokenFor(user) {
  return jwt.sign({ role: user.role, tv: user.tokenVersion || 0 }, process.env.JWT_SECRET_KEY, { subject: String(user._id), expiresIn: '1h', algorithm: 'HS256' });
}

// ---------------------------------------------------------------------------------------------
// 1. Pure invoice arithmetic
// ---------------------------------------------------------------------------------------------
async function pureTests() {
  console.log('\n— Unit: invoice arithmetic (pure) —');
  const { buildInvoiceLines, computeTotals, applyTax } = require('./src/services/serviceRecords/invoiceCalculator');
  const { ValidationError } = require('./src/core/errors');

  await test('Parts, labour and charges are normalised into integer paise', () => {
    const lines = buildInvoiceLines({
      parts: [{ partName: ' Engine Oil ', quantity: 4, unitPrice: 450.5 }, { name: 'Filter', cost: '350' }],
      labour: [{ description: 'Labour', hours: 1.5, rate: 333.33 }],
      additionalCharges: [{ description: 'Disposal', amountPaise: 2550 }],
    });
    assert.strictEqual(lines.parts[0].partName, 'Engine Oil');
    assert.strictEqual(lines.parts[0].totalPaise, 180200);
    assert.strictEqual(lines.parts[1].quantity, 1, 'missing quantity defaults to 1');
    assert.strictEqual(lines.parts[1].unitPricePaise, 35000, 'legacy `cost` key');
    assert.strictEqual(lines.partsPaise, 215200);
    assert.strictEqual(lines.labour[0].totalPaise, 50000, '1.5 h x 33333 paise rounds half up');
    assert.strictEqual(lines.labour[0].hours, 1.5);
    assert.strictEqual(lines.additionalPaise, 2550, 'paise input accepted');
    for (const p of lines.parts) assert.ok(Number.isSafeInteger(p.totalPaise));
  });

  await test('Fallbacks: partsReplaced, `labor` alias, laborCost, junk entries skipped', () => {
    const a = buildInvoiceLines({ parts: [], partsReplaced: [{ partName: 'Pad', unitPricePaise: 12345 }], labor: [{ rate: 100 }] });
    assert.strictEqual(a.partsPaise, 12345);
    assert.strictEqual(a.labourPaise, 10000);
    const b = buildInvoiceLines({ laborCost: '799.99', parts: [null, 'x', { unitPrice: -50 }], additionalCharges: [null] });
    assert.strictEqual(b.labour[0].description, 'Labour Charges');
    assert.strictEqual(b.labourPaise, 79999);
    assert.strictEqual(b.parts.length, 1, 'null/string entries ignored instead of crashing');
    assert.strictEqual(b.partsPaise, 0, 'negative price clamps to zero');
    assert.strictEqual(b.additionalCharges.length, 0);
  });

  await test('Infinite or overflowing amounts are rejected as validation errors', () => {
    assert.throws(() => buildInvoiceLines({ parts: [{ unitPrice: '1e400' }] }), ValidationError);
    assert.throws(() => buildInvoiceLines({ parts: [{ quantity: '99999999999999999999', unitPrice: 1000 }] }), ValidationError);
  });

  await test('Discount: capped at subtotal, paise fallback, garbage ignored, float-safe', () => {
    const lines = { partsPaise: 10, labourPaise: 20, additionalPaise: 0 };
    assert.deepStrictEqual(computeTotals(lines, { discount: 0.1 }), { subtotalPaise: 30, discountPaise: 10, taxablePaise: 20 });
    assert.strictEqual(computeTotals(lines, { discount: 5000 }).taxablePaise, 0, 'discount larger than subtotal');
    assert.strictEqual(computeTotals(lines, { discount: 5000 }).discountPaise, 30);
    assert.strictEqual(computeTotals({ partsPaise: 100000, labourPaise: 0, additionalPaise: 0 }, { discountPaise: 2500 }).discountPaise, 2500);
    assert.strictEqual(computeTotals(lines, { discount: 'abc' }).discountPaise, 0);
    assert.strictEqual(computeTotals(lines, { discount: -10 }).discountPaise, 0);
    const sum = computeTotals({ partsPaise: 10, labourPaise: 20, additionalPaise: 0 }, {});
    assert.strictEqual(sum.subtotalPaise, 30, '0.10 + 0.20 is exactly 0.30 in paise');
  });

  await test('GST is added from the tax snapshot; rupee display values derived from paise', () => {
    const totals = applyTax({ subtotalPaise: 250100, discountPaise: 10000, taxablePaise: 240100 }, { totalTaxPaise: 43218 });
    assert.strictEqual(totals.grandTotalPaise, 283318);
    assert.strictEqual(totals.grandTotalAmount, 2833.18);
    assert.strictEqual(totals.taxableAmount, 2401);
    assert.strictEqual(totals.discountAmount, 100);
    assert.strictEqual(applyTax({ subtotalPaise: 0, discountPaise: 0, taxablePaise: 0 }, null).grandTotalPaise, 0);
  });
}

// ---------------------------------------------------------------------------------------------
// 2. Services with fake repositories
// ---------------------------------------------------------------------------------------------
function fakeRepos(seed = {}) {
  const calls = [];
  const record = (name) => (...args) => { calls.push([name, ...args]); };
  return {
    calls,
    vehicles: {
      findActiveById: async () => seed.vehicle || null,
      findById: async () => seed.vehicle || null,
      raiseOdometer: async (...a) => record('raiseOdometer')(...a),
    },
    serviceRecords: {
      findOdometerBaseline: async () => seed.baseline || null,
      insertRecord: async (doc) => { calls.push(['insertRecord', doc]); return { insertedId: doc._id || 'new-id' }; },
      findById: async (id) => (seed.servicesById || {})[String(id)] || null,
      findOne: async () => seed.service || null,
      deleteById: async (id) => record('deleteById')(id),
      completeExisting: async (...a) => { calls.push(['completeExisting', ...a]); return seed.completeExistingResult !== false; },
      upsertInvoice: async (...a) => record('upsertInvoice')(...a),
    },
    bookings: {
      findById: async () => seed.booking || null,
      markCompleted: async (...a) => { calls.push(['markCompleted', ...a]); return seed.markCompletedResult !== false; },
      releaseCompletionClaim: async (...a) => record('releaseCompletionClaim')(...a),
    },
    garages: { findOne: async () => seed.garage || null, findById: async () => seed.garage || null },
    users: { findOne: async () => seed.customer || null },
    payments: { updateOne: async (...a) => record('paymentUpsert')(...a) },
  };
}

async function serviceUnitTests() {
  console.log('\n— Unit: services with fake repositories —');
  const { createServiceRecordService } = require('./src/services/serviceRecords/serviceRecordService');
  const { createServiceCompletionService } = require('./src/services/serviceRecords/serviceCompletionService');
  const { ForbiddenError, ValidationError, ConflictError, NotFoundError } = require('./src/core/errors');
  const { isOwner } = require('./src/security/vehicleAccess');

  const vehicleId = new ObjectId();
  const vehicle = { _id: vehicleId, ownerId: 'owner1', currentOdometerKm: 10000, brand: 'Maruti', vehicleNumber: 'KA01X' };
  const policy = (related = false) => ({ isOwner, canAccessVehicle: async () => true, garageHasRelationship: async () => related });
  const base = { vehicleId: String(vehicleId), serviceDate: '2026-11-01', serviceCategory: 'General', serviceType: 'Oil' };
  const owner = { id: 'owner1', role: 'USER' };

  await test('addRecord: odometer regression rejected; abnormal jump flagged with lower confidence', async () => {
    const repos = fakeRepos({ vehicle, baseline: { odometerKm: 20000 } });
    const svc = createServiceRecordService({ repos, accessPolicy: policy() });
    await assert.rejects(svc.addRecord(owner, { ...base, odometerKm: 19999 }), (e) => e instanceof ValidationError && /cannot be less than previous record \(20000 km\)/.test(e.message));
    await svc.addRecord(owner, { ...base, odometerKm: 60001 });
    const doc = repos.calls.find((c) => c[0] === 'insertRecord')[1];
    assert.strictEqual(doc.abnormalKmJump, true);
    assert.strictEqual(doc.confidenceScore, 80);
    assert.strictEqual(doc.verifiedService, false, 'owners never self-verify');
    assert.strictEqual(doc.verificationStatus, 'Pending');
    assert.ok(repos.calls.some((c) => c[0] === 'raiseOdometer' && c[2] === 60001));
  });

  await test('addRecord: unrelated garage walk-in is pending, needs owner confirmation, leaves odometer alone', async () => {
    const repos = fakeRepos({ vehicle });
    await createServiceRecordService({ repos, accessPolicy: policy(false) }).addRecord({ id: 'g1', role: 'GARAGE' }, { ...base, odometerKm: 12000, verifiedService: true });
    const doc = repos.calls.find((c) => c[0] === 'insertRecord')[1];
    assert.deepStrictEqual([doc.verifiedService, doc.verificationStatus, doc.requiresOwnerConfirmation], [false, 'Pending', true]);
    assert.ok(!repos.calls.some((c) => c[0] === 'raiseOdometer'));
  });

  await test('addRecord: related garage is verified; stranger is forbidden; bad input is a validation error', async () => {
    const repos = fakeRepos({ vehicle });
    await createServiceRecordService({ repos, accessPolicy: policy(true) }).addRecord({ id: 'g1', role: 'GARAGE' }, { ...base, odometerKm: 12000 });
    const doc = repos.calls.find((c) => c[0] === 'insertRecord')[1];
    assert.deepStrictEqual([doc.verifiedService, doc.verificationStatus, doc.requiresOwnerConfirmation], [true, 'Verified', false]);
    const svc = createServiceRecordService({ repos: fakeRepos({ vehicle }), accessPolicy: policy() });
    await assert.rejects(svc.addRecord({ id: 'x', role: 'USER' }, { ...base, odometerKm: 1 }), ForbiddenError);
    await assert.rejects(svc.addRecord(owner, { ...base, odometerKm: 'abc' }), /valid number/);
    await assert.rejects(svc.addRecord(owner, { ...base, vehicleId: 'not-an-id', odometerKm: 1 }), /Invalid vehicle ID/);
  });

  await test('deleteRecord: only the owner, never an invoiced record', async () => {
    const serviceId = new ObjectId();
    const svc = (service) => createServiceRecordService({ repos: fakeRepos({ vehicle, service }), accessPolicy: policy() });
    await assert.rejects(svc({ _id: serviceId, vehicleId: String(vehicleId) }).deleteRecord({ id: 'other', role: 'USER' }, String(serviceId)), ForbiddenError);
    await assert.rejects(svc({ _id: serviceId, vehicleId: String(vehicleId), invoiceNumber: 'DP-INV-1' }).deleteRecord(owner, String(serviceId)), ConflictError);
    await assert.rejects(svc(null).deleteRecord(owner, 'garbage'), NotFoundError);
    const repos = fakeRepos({ vehicle, service: { _id: serviceId, vehicleId: String(vehicleId) } });
    await createServiceRecordService({ repos, accessPolicy: policy() }).deleteRecord(owner, String(serviceId));
    assert.ok(repos.calls.some((c) => c[0] === 'deleteById'));
  });

  const garage = { _id: new ObjectId(), ownerUserId: 'g1', name: 'Garage One', stateCode: 'KA' };
  const booking = { _id: new ObjectId(), garageId: String(garage._id), vehicleId: String(vehicleId), userId: 'owner1', status: 'IN_PROGRESS' };
  function completion(repos, overrides = {}) {
    const audits = [];
    const notes = [];
    const svc = createServiceCompletionService({
      repos,
      client: null,
      resolveGarageIds: async (id) => (id === 'g1' ? ['g1', String(garage._id)] : [String(id)]),
      createTaxSnapshot: async ({ amountPaise }) => ({ totalTaxPaise: Math.round(amountPaise * 0.18), totalTaxAmount: Math.round(amountPaise * 0.18) / 100 }),
      nextInvoiceNumber: async () => 'DP-INV-TEST-1',
      logAudit: async (e) => { audits.push(e); },
      notifyUser: async (userId, msg) => { notes.push({ userId, msg }); },
      logger: { warn: () => {} },
      ...overrides,
    });
    return { svc, audits, notes };
  }
  const garageUser = { id: 'g1', role: 'GARAGE' };
  const body = { bookingId: String(booking._id), parts: [{ partName: 'Oil', quantity: 2, unitPrice: 500 }], labour: [{ description: 'L', quantity: 1, rate: 1000 }], discount: 100 };

  await test('completeService: happy path claims booking, writes service/invoice/payment, audits and notifies', async () => {
    const repos = fakeRepos({ booking, vehicle, garage, customer: { name: 'Owner' } });
    const { svc, audits, notes } = completion(repos);
    const result = await svc.completeService({ user: garageUser, input: body });
    assert.strictEqual(result.invoiceNumber, 'DP-INV-TEST-1');
    assert.strictEqual(result.subtotal, 2000);
    assert.strictEqual(result.grandTotalPaise, 190000 + 34200);
    const names = repos.calls.map((c) => c[0]);
    assert.deepStrictEqual(names.filter((n) => ['markCompleted', 'insertRecord', 'upsertInvoice', 'paymentUpsert'].includes(n)), ['markCompleted', 'insertRecord', 'upsertInvoice', 'paymentUpsert']);
    const inserted = repos.calls.find((c) => c[0] === 'insertRecord')[1];
    assert.strictEqual(String(inserted._id), result.serviceId);
    assert.strictEqual(inserted.garageId, String(garage._id));
    assert.deepStrictEqual(audits.map((a) => a.action), ['SERVICE_COMPLETED', 'INVOICE_FINALIZED']);
    assert.strictEqual(audits[0].actorRole, 'GARAGE');
    assert.strictEqual(notes[0].userId, 'owner1');
  });

  await test('completeService: other garage forbidden; owner role forbidden; vehicle swap rejected', async () => {
    const { svc } = completion(fakeRepos({ booking, vehicle, garage }));
    await assert.rejects(svc.completeService({ user: { id: 'g2', role: 'GARAGE' }, input: body }), (e) => e instanceof ForbiddenError && /another garage/.test(e.message));
    await assert.rejects(svc.completeService({ user: owner, input: body }), ForbiddenError);
    await assert.rejects(svc.completeService({ user: garageUser, input: { ...body, vehicleId: String(new ObjectId()) } }), ValidationError);
  });

  await test('completeService: already-completed record replays its invoice without writing', async () => {
    const done = { _id: new ObjectId(), createdBy: 'g1', status: 'COMPLETED', invoiceNumber: 'DP-INV-OLD', totalAmount: 118, grandTotalPaise: 11800 };
    const repos = fakeRepos({ vehicle, garage, servicesById: { [String(done._id)]: done } });
    const { svc } = completion(repos);
    const result = await svc.completeService({ user: garageUser, input: { serviceId: String(done._id) } });
    assert.deepStrictEqual(result, { success: true, message: 'Service is already completed and invoice generated', invoiceNumber: 'DP-INV-OLD', grandTotal: 118, grandTotalPaise: 11800, status: 'COMPLETED' });
    assert.strictEqual(repos.calls.length, 0, 'no writes');
  });

  await test('completeService: losing a concurrent claim replays the winner\'s invoice; failures are non-fatal for side effects', async () => {
    const winner = { _id: new ObjectId(), createdBy: 'g1', status: 'COMPLETED', invoiceNumber: 'DP-INV-WIN', totalAmount: 50 };
    let lookups = 0;
    const repos = fakeRepos({ vehicle, garage, markCompletedResult: false });
    repos.bookings.findById = async () => (lookups++ === 0 ? booking : { ...booking, invoiceNumber: 'DP-INV-WIN', serviceId: String(winner._id) });
    repos.serviceRecords.findById = async (id) => (String(id) === String(winner._id) ? winner : null);
    const { svc } = completion(repos);
    const result = await svc.completeService({ user: garageUser, input: body });
    assert.strictEqual(result.invoiceNumber, 'DP-INV-WIN');
    assert.strictEqual(result.grandTotalPaise, 5000);
    assert.ok(!repos.calls.some((c) => c[0] === 'insertRecord'), 'loser writes nothing');

    const { svc: flaky } = completion(fakeRepos({ booking, vehicle, garage }), { logAudit: async () => { throw new Error('audit down'); }, notifyUser: async () => { throw new Error('push down'); } });
    assert.strictEqual((await flaky.completeService({ user: garageUser, input: body })).success, true);
  });

  await test('completeService: a failed write without transactions releases the booking claim', async () => {
    const repos = fakeRepos({ booking, vehicle, garage });
    repos.serviceRecords.upsertInvoice = async () => { throw new Error('disk full'); };
    const { svc } = completion(repos);
    await assert.rejects(svc.completeService({ user: garageUser, input: body }), /disk full/);
    assert.ok(repos.calls.some((c) => c[0] === 'releaseCompletionClaim'));
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

  const { buildApp } = require('./server');
  const server = buildApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { body, token } = {}) => {
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

  console.log('\n— HTTP: /api/services (real Express app + MongoDB) —');
  const mk = (role, name) => ({ _id: new ObjectId(), name, email: `${name.toLowerCase().replace(/\s/g, '')}@driveportz-test.in`, role, tokenVersion: 0 });
  const owner = mk('USER', 'Owner');
  const stranger = mk('USER', 'Stranger');
  const garageUserA = mk('GARAGE', 'Garage A');
  const garageUserB = mk('GARAGE', 'Garage B');
  const admin = mk('ADMIN', 'Admin');
  await db.collection('users').insertMany([owner, stranger, garageUserA, garageUserB, admin]);
  const garageA = { _id: new ObjectId(), ownerUserId: String(garageUserA._id), name: 'Garage A', stateCode: 'KA', isActive: true };
  const garageB = { _id: new ObjectId(), ownerUserId: String(garageUserB._id), name: 'Garage B', stateCode: 'KA', isActive: true };
  await db.collection('garages').insertMany([garageA, garageB]);
  const car = { _id: new ObjectId(), vehicleNumber: 'KA01AB1234', brand: 'Hyundai', ownerId: String(owner._id), currentOdometerKm: 10000, stateCode: 'KA', createdAt: new Date() };
  const bike = { _id: new ObjectId(), vehicleNumber: 'KA02CD5678', brand: 'Honda', ownerId: String(owner._id), currentOdometerKm: 500, createdAt: new Date() };
  await db.collection('vehicles').insertMany([car, bike]);
  const booking = { _id: new ObjectId(), garageId: String(garageA._id), vehicleId: String(car._id), userId: String(owner._id), status: 'IN_PROGRESS', snapshots: { service: { title: 'Periodic 30K' } }, createdAt: new Date() };
  await db.collection('bookings').insertOne(booking);

  const T = { owner: tokenFor(owner), stranger: tokenFor(stranger), a: tokenFor(garageUserA), b: tokenFor(garageUserB), admin: tokenFor(admin) };
  const addBody = (vehicle, odometerKm, extra = {}) => ({ vehicleId: String(vehicle._id), serviceDate: '2026-11-01', odometerKm, serviceCategory: 'General', serviceType: 'Oil change', ...extra });

  try {
    let ownerLogId;
    await test('POST /add by owner: 201, never self-verified, raises vehicle odometer', async () => {
      const r = await call('POST', '/api/services/add', { token: T.owner, body: addBody(car, 12000, { verifiedService: true, laborCost: '500', partsReplaced: [{ cost: 250 }] }) });
      assert.strictEqual(r.status, 201, r.text);
      assert.strictEqual(r.json.msg, 'Service record added successfully');
      ownerLogId = r.json.serviceId;
      const doc = await db.collection('services').findOne({ _id: new ObjectId(ownerLogId) });
      assert.deepStrictEqual([doc.verifiedService, doc.verificationStatus, doc.requiresOwnerConfirmation, doc.totalCost], [false, 'Pending', false, 750]);
      assert.strictEqual((await db.collection('vehicles').findOne({ _id: car._id })).currentOdometerKm, 12000);
    });

    await test('POST /add: odometer regression rejected with 400 { msg }', async () => {
      const r = await call('POST', '/api/services/add', { token: T.owner, body: addBody(car, 11000) });
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.json.msg, 'Odometer reading (11000 km) cannot be less than previous record (12000 km)');
    });

    await test('POST /add: abnormal jump (> 40000 km) stored but flagged', async () => {
      const r = await call('POST', '/api/services/add', { token: T.owner, body: addBody(car, 52001) });
      assert.strictEqual(r.status, 201);
      const doc = await db.collection('services').findOne({ _id: new ObjectId(r.json.serviceId) });
      assert.strictEqual(doc.abnormalKmJump, true);
      assert.strictEqual(doc.confidenceScore, 80);
    });

    await test('POST /add: related garage verified; unrelated walk-in pending and cannot move the odometer', async () => {
      const related = await call('POST', '/api/services/add', { token: T.a, body: addBody(car, 53000) });
      assert.strictEqual(related.status, 201, related.text);
      const relatedDoc = await db.collection('services').findOne({ _id: new ObjectId(related.json.serviceId) });
      assert.deepStrictEqual([relatedDoc.verifiedService, relatedDoc.verificationStatus], [true, 'Verified']);

      const walkIn = await call('POST', '/api/services/add', { token: T.b, body: addBody(car, 999999) });
      assert.strictEqual(walkIn.status, 201);
      const walkInDoc = await db.collection('services').findOne({ _id: new ObjectId(walkIn.json.serviceId) });
      assert.deepStrictEqual([walkInDoc.verifiedService, walkInDoc.verificationStatus, walkInDoc.requiresOwnerConfirmation], [false, 'Pending', true]);
      assert.strictEqual((await db.collection('vehicles').findOne({ _id: car._id })).currentOdometerKm, 53000, 'unconfirmed walk-in did not raise odometer');
      const next = await call('POST', '/api/services/add', { token: T.owner, body: addBody(car, 54000) });
      assert.strictEqual(next.status, 201, 'unconfirmed walk-in cannot block the owner with a bogus reading');
    });

    await test('POST /add: stranger 403, missing fields 400, unknown vehicle 404', async () => {
      assert.strictEqual((await call('POST', '/api/services/add', { token: T.stranger, body: addBody(car, 60000) })).status, 403);
      const missing = await call('POST', '/api/services/add', { token: T.owner, body: { vehicleId: String(car._id) } });
      assert.strictEqual(missing.status, 400);
      assert.match(missing.json.msg, /Core details/);
      assert.strictEqual((await call('POST', '/api/services/add', { token: T.owner, body: addBody({ _id: new ObjectId() }, 1) })).status, 404);
    });

    await test('GET /:vehicle_id history RBAC: owner, related garage, admin allowed; stranger and unrelated garage 403', async () => {
      const own = await call('GET', `/api/services/${car._id}`, { token: T.owner });
      assert.strictEqual(own.status, 200);
      assert.ok(Array.isArray(own.json) && own.json.length >= 4);
      assert.ok(['id', 'serviceDate', 'totalCost', 'verificationStatus', 'paymentStatus', 'billPhotoUrls'].every((k) => k in own.json[0]));
      assert.strictEqual((await call('GET', `/api/services/${car._id}`, { token: T.a })).status, 200);
      assert.strictEqual((await call('GET', `/api/services/${car._id}`, { token: T.admin })).status, 200);
      assert.strictEqual((await call('GET', `/api/services/${car._id}`, { token: T.stranger })).status, 403);
      assert.strictEqual((await call('GET', `/api/services/${bike._id}`, { token: T.b })).status, 403);
      assert.strictEqual((await call('GET', `/api/services/${new ObjectId()}`, { token: T.owner })).status, 404);
    });

    const completeBody = {
      bookingId: String(booking._id),
      vehicleId: String(car._id),
      odometer: 55000,
      serviceCategory: 'Periodic Maintenance',
      parts: [{ partName: 'Engine Oil', quantity: 2, unitPrice: 450.5 }],
      labour: [{ description: 'Labour', quantity: 1, rate: 1500 }],
      additionalCharges: [{ description: 'Disposal', amount: 100 }],
      discount: 100,
    };
    let firstCompletion;

    await test('POST /complete by another garage => 403 and nothing written', async () => {
      const r = await call('POST', '/api/services/complete', { token: T.b, body: completeBody });
      assert.strictEqual(r.status, 403);
      assert.strictEqual(r.json.success, false);
      assert.strictEqual(await db.collection('invoices').countDocuments({}), 0);
    });

    await test('POST /complete by an owner (USER role) => 403', async () => {
      assert.strictEqual((await call('POST', '/api/services/complete', { token: T.owner, body: completeBody })).status, 403);
    });

    await test('POST /complete with a swapped vehicle => 400 (cannot bill another owner)', async () => {
      const r = await call('POST', '/api/services/complete', { token: T.a, body: { ...completeBody, vehicleId: String(bike._id) } });
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.json.success, false);
    });

    await test('POST /complete by the owning garage: invoice, payment, booking and totals are correct', async () => {
      const r = await call('POST', '/api/services/complete', { token: T.a, body: completeBody });
      assert.strictEqual(r.status, 200, r.text);
      firstCompletion = r.json;
      // parts 2 x 450.50 = 901.00, labour 1500.00, disposal 100.00 => 2501.00; discount 100 => taxable 2401.00
      // 18% intrastate GST: CGST 9% = 216.09, SGST 9% = 216.09 => tax 432.18; grand total 2833.18
      assert.strictEqual(r.json.subtotal, 2501);
      assert.strictEqual(r.json.tax, 432.18);
      assert.strictEqual(r.json.grandTotal, 2833.18);
      assert.strictEqual(r.json.grandTotalPaise, 283318);
      assert.strictEqual(r.json.paymentStatus, 'UNPAID');
      assert.strictEqual(r.json.status, 'COMPLETED');
      assert.strictEqual(r.json.taxSnapshot.cgstPaise, 21609);
      assert.deepStrictEqual(Object.keys(r.json).sort(), ['grandTotal', 'grandTotalPaise', 'invoiceNumber', 'message', 'paymentStatus', 'serviceId', 'status', 'subtotal', 'success', 'tax', 'taxSnapshot'].sort());

      const invoice = await db.collection('invoices').findOne({ invoiceNumber: r.json.invoiceNumber });
      assert.strictEqual(invoice.grandTotalPaise, 283318);
      assert.strictEqual(invoice.discountPaise, 10000);
      assert.strictEqual(invoice.garageId, String(garageA._id));
      assert.strictEqual(invoice.customerId, String(owner._id));
      const payment = await db.collection('payments').findOne({ invoiceNumber: r.json.invoiceNumber });
      assert.strictEqual(payment.amountPaise, 283318);
      assert.strictEqual(payment.status, 'PENDING');
      assert.strictEqual(payment.serviceId, r.json.serviceId);
      const svc = await db.collection('services').findOne({ _id: new ObjectId(r.json.serviceId) });
      assert.strictEqual(svc.status, 'COMPLETED');
      assert.strictEqual(svc.createdBy, String(garageUserA._id));
      assert.strictEqual(svc.serviceType, 'Periodic 30K', 'falls back to the booking snapshot');
      const b = await db.collection('bookings').findOne({ _id: booking._id });
      assert.strictEqual(b.status, 'COMPLETED');
      assert.strictEqual(b.serviceId, r.json.serviceId);
      assert.strictEqual(b.invoiceNumber, r.json.invoiceNumber);
      assert.strictEqual((await db.collection('vehicles').findOne({ _id: car._id })).currentOdometerKm, 55000);
      const audit = await db.collection('financial_audit_logs').findOne({ action: 'INVOICE_FINALIZED', resourceId: r.json.invoiceNumber });
      assert.ok(audit, 'invoice finalisation audited');
      assert.strictEqual(audit.actorRole, 'GARAGE');
    });

    await test('Re-completing (same booking, or via /:serviceId/complete) returns the existing invoice', async () => {
      const again = await call('POST', '/api/services/complete', { token: T.a, body: completeBody });
      assert.strictEqual(again.status, 200);
      assert.strictEqual(again.json.invoiceNumber, firstCompletion.invoiceNumber);
      assert.strictEqual(again.json.message, 'Service is already completed and invoice generated');
      assert.strictEqual(again.json.grandTotalPaise, 283318);
      const byId = await call('POST', `/api/services/${firstCompletion.serviceId}/complete`, { token: T.a, body: {} });
      assert.strictEqual(byId.status, 200);
      assert.strictEqual(byId.json.invoiceNumber, firstCompletion.invoiceNumber);
      assert.strictEqual(await db.collection('invoices').countDocuments({ bookingId: String(booking._id) }), 1, 'one invoice per booking');
      assert.strictEqual(await db.collection('payments').countDocuments({ serviceId: firstCompletion.serviceId }), 1);
    });

    await test('Concurrent completions of one booking issue exactly one invoice', async () => {
      const b2 = { _id: new ObjectId(), garageId: String(garageA._id), vehicleId: String(car._id), userId: String(owner._id), status: 'IN_PROGRESS', createdAt: new Date() };
      await db.collection('bookings').insertOne(b2);
      const body = { ...completeBody, bookingId: String(b2._id), odometer: 56000 };
      const results = await Promise.all([1, 2, 3].map(() => call('POST', '/api/services/complete', { token: T.a, body })));
      assert.ok(results.every((r) => r.status === 200), results.map((r) => `${r.status} ${r.text.slice(0, 80)}`).join(' | '));
      assert.strictEqual(new Set(results.map((r) => r.json.invoiceNumber)).size, 1, 'every caller sees the same invoice');
      assert.strictEqual(await db.collection('invoices').countDocuments({ bookingId: String(b2._id) }), 1);
      assert.strictEqual(await db.collection('services').countDocuments({ bookingId: String(b2._id) }), 1);
    });

    await test('Admin completion acts for the booking\'s garage and keeps the record in its listing', async () => {
      const b3 = { _id: new ObjectId(), garageId: String(garageA._id), vehicleId: String(car._id), userId: String(owner._id), status: 'COMPLETED', createdAt: new Date() };
      await db.collection('bookings').insertOne(b3);
      const r = await call('POST', '/api/services/complete', { token: T.admin, body: { ...completeBody, bookingId: String(b3._id), odometer: 57000 } });
      assert.strictEqual(r.status, 200, r.text);
      const svc = await db.collection('services').findOne({ _id: new ObjectId(r.json.serviceId) });
      assert.strictEqual(svc.garageId, String(garageA._id));
      assert.strictEqual(svc.createdBy, String(garageUserA._id));
      assert.strictEqual(svc.completedBy, String(admin._id));
    });

    await test('GET /completion-details: owning garage and owner allowed; other garage and stranger 403', async () => {
      const q = `/api/services/completion-details?bookingId=${booking._id}`;
      const mine = await call('GET', q, { token: T.a });
      assert.strictEqual(mine.status, 200);
      assert.strictEqual(mine.json.success, true);
      assert.strictEqual(mine.json.vehicle.vehicleNumber, 'KA01AB1234');
      assert.strictEqual(mine.json.garage.name, 'Garage A');
      assert.strictEqual(mine.json.customer.name, 'Owner');
      assert.strictEqual((await call('GET', q, { token: T.owner })).status, 200);
      assert.strictEqual((await call('GET', q, { token: T.b })).status, 403);
      assert.strictEqual((await call('GET', q, { token: T.stranger })).status, 403);
      const none = await call('GET', '/api/services/completion-details', { token: T.a });
      assert.strictEqual(none.status, 400);
      assert.deepStrictEqual(none.json, { success: false, message: 'bookingId or serviceId is required' });
    });

    await test('DELETE /:service_id: non-owner 403, invoiced record 409, unknown 404, owner 200', async () => {
      assert.strictEqual((await call('DELETE', `/api/services/${ownerLogId}`, { token: T.stranger })).status, 403);
      assert.strictEqual((await call('DELETE', `/api/services/${ownerLogId}`, { token: T.a })).status, 403);
      const invoiced = await call('DELETE', `/api/services/${firstCompletion.serviceId}`, { token: T.owner });
      assert.strictEqual(invoiced.status, 409);
      assert.ok(await db.collection('services').findOne({ _id: new ObjectId(firstCompletion.serviceId) }), 'invoice record kept');
      assert.strictEqual((await call('DELETE', '/api/services/not-an-id', { token: T.owner })).status, 404);
      const ok = await call('DELETE', `/api/services/${ownerLogId}`, { token: T.owner });
      assert.strictEqual(ok.status, 200);
      assert.deepStrictEqual(ok.json, { msg: 'Service record deleted successfully' });
      assert.strictEqual(await db.collection('services').findOne({ _id: new ObjectId(ownerLogId) }), null);
    });

    await test('GET /garage/all: paginated with headers, body shape kept, legacy ids do not break the join', async () => {
      await db.collection('services').insertOne({ vehicleId: 'legacy-v1', ownerId: 'cust_legacy', createdBy: String(garageUserA._id), serviceType: 'Legacy job', serviceDate: '2020-01-01', totalCost: 10 });
      const all = await call('GET', '/api/services/garage/all?limit=100', { token: T.a });
      assert.strictEqual(all.status, 200, all.text);
      const total = all.json.totalCount;
      assert.ok(total >= 5, `total ${total}`);
      const r = await call('GET', '/api/services/garage/all?page=2&limit=2', { token: T.a });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.headers.get('x-total-count'), String(total));
      assert.strictEqual(r.headers.get('x-page'), '2');
      assert.strictEqual(r.headers.get('x-limit'), '2');
      assert.strictEqual(r.headers.get('x-total-pages'), String(Math.ceil(total / 2)));
      assert.strictEqual(r.json.services.length, 2);
      assert.deepStrictEqual(Object.keys(r.json).sort(), ['currentPage', 'services', 'stats', 'totalCount', 'totalPages']);
      assert.strictEqual(r.json.currentPage, 2);
      assert.strictEqual(r.json.totalPages, Math.ceil(total / 2));
      assert.strictEqual(r.json.stats.totalServices, total);
      const search = await call('GET', '/api/services/garage/all?search=owner', { token: T.a });
      assert.ok(search.json.services.length >= 1, 'owner-name search hits');
      assert.ok(search.json.services.every((s) => s.customer && s.customer.name === 'Owner'));
      const regex = await call('GET', `/api/services/garage/all?search=${encodeURIComponent('(a+)+$')}`, { token: T.a });
      assert.strictEqual(regex.status, 200, 'regex metacharacters are literal');
      const legacy = await call('GET', '/api/services/garage/all?search=Legacy', { token: T.a });
      assert.strictEqual(legacy.json.services.length, 1);
      assert.strictEqual(legacy.json.services[0].vehicle, null);
      const byCost = await call('GET', '/api/services/garage/all?sortBy=cost&sortOrder=asc&limit=100', { token: T.a });
      const costs = byCost.json.services.map((s) => s.totalCost || 0);
      assert.deepStrictEqual(costs, [...costs].sort((x, y) => x - y), 'cheapest first');
      assert.strictEqual((await call('GET', '/api/services/garage/all?limit=100000', { token: T.a })).headers.get('x-limit'), '200', 'limit bounded');
      assert.strictEqual((await call('GET', '/api/services/garage/all', { token: T.owner })).status, 403);
    });
  } finally {
    server.close();
    await db.dropDatabase();
    await closeMongo();
  }
}

(async () => {
  console.log('🚀 DrivePortz service routes suite');
  await pureTests();
  await serviceUnitTests();
  await httpTests();
  console.log(`\n${failed === 0 ? '✅' : '❌'} Service routes suite: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('❌ Service routes suite crashed:', err);
  process.exit(1);
});
