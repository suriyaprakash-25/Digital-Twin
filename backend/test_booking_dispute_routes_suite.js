/**
 * Booking + dispute routes suite: /api/bookings and the three dispute routers after the
 * Repository + service-layer refactor.
 *
 *  1. Pure unit tests of the booking state machine.
 *  2. Service unit tests with FAKE repositories (capacity guard, booking service, dispute commands).
 *  3. HTTP tests against the real Express app and a throwaway MongoDB database: RBAC/ownership,
 *     illegal and concurrent transitions, atomic capacity, duplicate disputes, pagination headers
 *     and a forged evidence upload.
 *
 * Plain Node + assert, like the other suites. Uses its own database and drops it at the end.
 */
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'booking-suite-secret-key-2026-minimum-32-chars';
process.env.MONGO_DB_NAME = `driveportz_booking_dispute_suite_${process.pid}`;
process.env.EMAIL_PROVIDER = 'mock';
process.env.JOB_WORKER_ENABLED = 'false';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
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
  return jwt.sign({ role: user.role, tv: user.tokenVersion || 0, typ: 'session' }, process.env.JWT_SECRET_KEY, { subject: String(user._id), expiresIn: '1h', algorithm: 'HS256' });
}

const silentNotifier = () => ({ calls: [], bookingRequested() {}, async statusChanged() {}, async notifyGarageOfOwnerAction() {} });

// ---------------------------------------------------------------------------------------------
// 1. Booking state machine (pure)
// ---------------------------------------------------------------------------------------------
async function stateMachineTests() {
  console.log('\n— Unit: booking state machine —');
  const sm = require('./src/services/bookings/bookingStateMachine');
  const { BOOKING_STATUS: S } = sm;

  await test('Transition table: happy path allowed, terminal states have no exits', () => {
    assert.ok(sm.canTransitionBooking(S.REQUESTED, S.ACCEPTED));
    assert.ok(sm.canTransitionBooking(S.ACCEPTED, S.IN_PROGRESS));
    assert.ok(sm.canTransitionBooking(S.IN_PROGRESS, S.COMPLETED));
    assert.ok(sm.canTransitionBooking(S.MORE_INFO_REQUIRED, S.REQUESTED));
    for (const terminal of [S.COMPLETED, S.REJECTED, S.CANCELLED]) {
      assert.deepStrictEqual(sm.ALLOWED_TRANSITIONS[terminal], []);
      for (const to of Object.values(S)) assert.strictEqual(sm.canTransitionBooking(terminal, to), false, `${terminal} -> ${to}`);
    }
  });

  await test('Illegal moves rejected: accept cancelled, complete requested, re-accept, unknown status', () => {
    assert.strictEqual(sm.canTransitionBooking(S.CANCELLED, S.ACCEPTED), false);
    assert.strictEqual(sm.canTransitionBooking(S.REQUESTED, S.COMPLETED), false);
    assert.strictEqual(sm.canTransitionBooking(S.ACCEPTED, S.ACCEPTED), false, 'same-status is a conflict, not a no-op');
    assert.strictEqual(sm.canTransitionBooking(S.IN_PROGRESS, S.REQUESTED), false);
    assert.strictEqual(sm.canTransitionBooking(undefined, S.ACCEPTED), false);
  });

  await test('Legacy PENDING behaves as REQUESTED; actor permissions are separate from the table', () => {
    assert.strictEqual(sm.normalizeBookingStatus('pending'), S.REQUESTED);
    assert.ok(sm.canTransitionBooking('PENDING', S.ACCEPTED));
    assert.ok(sm.canActorSet(sm.ACTORS.GARAGE, S.ACCEPTED));
    assert.strictEqual(sm.canActorSet(sm.ACTORS.GARAGE, S.CANCELLED), false);
    assert.strictEqual(sm.canActorSet(sm.ACTORS.USER, S.ACCEPTED), false);
    assert.ok(sm.consumesCapacity(S.REQUESTED, S.ACCEPTED));
    assert.strictEqual(sm.consumesCapacity(S.ACCEPTED, S.IN_PROGRESS), false);
  });

  await test('transitionBooking: CAS on the current status, timeline entry carries from/to/actor', async () => {
    let call;
    const bookings = { compareAndSetStatus: async (id, expected, change) => { call = { id, expected, change }; return { _id: id, status: change.to }; } };
    const at = new Date('2026-11-01T10:00:00Z');
    const booking = { _id: new ObjectId(), status: 'PENDING' };
    const updated = await sm.transitionBooking({ bookings, booking, to: S.ACCEPTED, actor: 'GARAGE', now: () => at });
    assert.strictEqual(updated.status, S.ACCEPTED);
    assert.strictEqual(call.expected, 'PENDING', 'filter uses the stored (legacy) status');
    assert.deepStrictEqual(call.change.timelineEntry, { status: S.ACCEPTED, from: S.REQUESTED, at, by: 'GARAGE' });
  });

  await test('transitionBooking: lost CAS -> 409 concurrent; illegal -> 409 without touching the db', async () => {
    let writes = 0;
    const bookings = { compareAndSetStatus: async () => { writes += 1; return null; } };
    await assert.rejects(sm.transitionBooking({ bookings, booking: { _id: 1, status: S.REQUESTED }, to: S.ACCEPTED, actor: 'GARAGE' }),
      (e) => e.status === 409 && e.code === 'BOOKING_CONCURRENT_MODIFICATION');
    await assert.rejects(sm.transitionBooking({ bookings, booking: { _id: 1, status: S.CANCELLED }, to: S.ACCEPTED, actor: 'GARAGE' }),
      (e) => e.status === 409 && e.code === 'ILLEGAL_BOOKING_TRANSITION');
    assert.strictEqual(writes, 1);
    await assert.rejects(sm.transitionBooking({ bookings, booking: { _id: 1, status: S.REQUESTED }, to: S.ACCEPTED, actor: 'USER' }), (e) => e.status === 403);
  });
}

// ---------------------------------------------------------------------------------------------
// 2. Services with fake repositories
// ---------------------------------------------------------------------------------------------
async function serviceUnitTests() {
  console.log('\n— Unit: capacity guard, booking service, dispute commands (fake repositories) —');
  const { createCapacityGuard, CapacityExceededError } = require('./src/services/bookings/capacityGuard');
  const { createBookingService } = require('./src/services/bookings/bookingService');
  const { escapeHtml, requestEmailHtml, requestDetails } = require('./src/services/bookings/bookingNotifications');
  const { createDisputeServices } = require('./src/services/disputes');
  const settings = { DEFAULT_MAX: 20, LOCK_TTL_MS: 1000, LOCK_MAX_ATTEMPTS: 3, LOCK_RETRY_DELAY_MS: 0 };

  function lockRepos({ active = 0, lockFree = true } = {}) {
    const log = [];
    return {
      log,
      garages: {
        acquireCapacityLock: async (id, { token }) => { log.push(['acquire', token]); return lockFree ? { _id: id, maxCapacity: 2 } : null; },
        releaseCapacityLock: async (id, token) => { log.push(['release', token]); },
      },
      bookings: { countForGarageInStatuses: async (id, statuses) => { log.push(['count', statuses.join(',')]); return active; } },
    };
  }

  await test('Capacity guard: work runs under the lease and the lease is always released', async () => {
    const repos = lockRepos({ active: 1 });
    const guard = createCapacityGuard({ repos, settings, sleep: async () => {}, newToken: () => 't1' });
    assert.strictEqual(await guard.withReservedSlot({ _id: 'g' }, async () => 'done'), 'done');
    assert.deepStrictEqual(repos.log, [['acquire', 't1'], ['count', 'ACCEPTED,IN_PROGRESS'], ['release', 't1']]);
  });

  await test('Capacity guard: full garage -> 409 GARAGE_CAPACITY_FULL, work never runs, lease released', async () => {
    const repos = lockRepos({ active: 2 });
    const guard = createCapacityGuard({ repos, settings, sleep: async () => {}, newToken: () => 't2' });
    let ran = false;
    await assert.rejects(guard.withReservedSlot({ _id: 'g' }, async () => { ran = true; }), (e) => e instanceof CapacityExceededError && e.status === 409);
    assert.strictEqual(ran, false);
    assert.deepStrictEqual(repos.log[repos.log.length - 1], ['release', 't2']);
  });

  await test('Capacity guard: lease held elsewhere -> bounded retries then 409 busy', async () => {
    const repos = lockRepos({ lockFree: false });
    const guard = createCapacityGuard({ repos, settings, sleep: async () => {} });
    await assert.rejects(guard.withReservedSlot({ _id: 'g' }, async () => {}), (e) => e.status === 409 && e.code === 'GARAGE_CAPACITY_BUSY');
    assert.strictEqual(repos.log.filter((l) => l[0] === 'acquire').length, 3);
    assert.strictEqual(await createCapacityGuard({ repos: lockRepos({ active: 19 }), settings }).hasFreeSlot({ _id: 'g' }), true, 'default capacity 20');
  });

  const garage = { _id: new ObjectId(), name: 'Garage A', ownerUserId: 'gu1', maxCapacity: 5 };
  const owner = { id: String(new ObjectId()), role: 'USER', name: 'Owner', email: 'o@x.in', phone: '9' };
  function bookingRepos(overrides = {}) {
    const calls = [];
    return {
      calls,
      garages: { findActiveById: async () => garage, findByOwner: async () => garage, ...overrides.garages },
      garageServices: { findBookable: async (id, gid) => { calls.push(['findBookable', String(gid)]); return null; }, ...overrides.garageServices },
      vehicles: { findOne: async (filter) => { calls.push(['vehicle', filter]); return null; }, ...overrides.vehicles },
      bookings: { create: async (doc) => { calls.push(['create', doc]); return { insertedId: new ObjectId() }; }, ...overrides.bookings },
      users: { find: async () => [] },
    };
  }
  const openCapacity = { hasFreeSlot: async () => true, withReservedSlot: async (g, work) => work() };

  await test('createBooking: another owner\'s vehicle is a 404 (lookup is scoped to the caller)', async () => {
    const repos = bookingRepos({ garageServices: { findBookable: async () => ({ _id: new ObjectId(), title: 'Oil', price: 10 }) } });
    const svc = createBookingService({ repos, notifier: silentNotifier(), capacity: openCapacity });
    await assert.rejects(svc.createBooking(owner, { garageId: String(garage._id), serviceId: String(new ObjectId()), vehicleId: String(new ObjectId()) }), (e) => e.status === 404 && e.message === 'Vehicle not found');
    const [, filter] = repos.calls.find((c) => c[0] === 'vehicle');
    assert.deepStrictEqual(filter.ownerId.$in, [owner.id, new ObjectId(owner.id)]);
    assert.deepStrictEqual(filter.isArchived, { $ne: true });
  });

  await test('createBooking: catalogue item must belong to the booked garage; malformed ids are 4xx not 500', async () => {
    const repos = bookingRepos({ vehicles: { findOne: async () => ({ _id: new ObjectId(), vehicleNumber: 'KA01' }) } });
    const svc = createBookingService({ repos, notifier: silentNotifier(), capacity: openCapacity });
    await assert.rejects(svc.createBooking(owner, { garageId: String(garage._id), serviceId: String(new ObjectId()), vehicleId: 'x' }), (e) => e.status === 404 && e.message === 'Service not found');
    assert.deepStrictEqual(repos.calls.find((c) => c[0] === 'findBookable'), ['findBookable', String(garage._id)]);
    await assert.rejects(svc.createBooking(owner, { garageId: 'g', vehicleId: 'v', scheduledFor: 'not-a-date', isCustomIssue: true }), (e) => e.status === 400);
    await assert.rejects(svc.createBooking(owner, { garageId: 'g' }), (e) => e.status === 400 && e.message === 'garageId and vehicleId are required');
  });

  await test('createBooking: custom issue stores bounded strings only; no-slot garage is a 400', async () => {
    const vehicle = { _id: new ObjectId(), vehicleNumber: 'KA01', brand: 'Kia', model: 'Seltos' };
    const repos = bookingRepos({ vehicles: { findOne: async () => vehicle } });
    const svc = createBookingService({ repos, notifier: silentNotifier(), capacity: openCapacity });
    const { id } = await svc.createBooking(owner, { garageId: String(garage._id), vehicleId: String(vehicle._id), isCustomIssue: true, issueDetails: { description: 'Noise', urgency: { $gt: '' }, extra: 'x'.repeat(10) } });
    assert.ok(ObjectId.isValid(id));
    const [, doc] = repos.calls.find((c) => c[0] === 'create');
    assert.deepStrictEqual(doc.snapshots.service.issueDetails, { description: 'Noise', duration: '', urgency: '' });
    assert.strictEqual(doc.status, 'REQUESTED');
    assert.strictEqual(doc.isCustomIssue, true);
    const full = createBookingService({ repos, notifier: silentNotifier(), capacity: { hasFreeSlot: async () => false } });
    await assert.rejects(full.createBooking(owner, { garageId: String(garage._id), vehicleId: String(vehicle._id), isCustomIssue: true }), (e) => e.status === 400 && /maximum capacity/.test(e.message));
  });

  await test('Garage status change: other garage\'s booking is 404; provide-info only answers MORE_INFO_REQUIRED', async () => {
    const accepted = { _id: new ObjectId(), status: 'ACCEPTED', userId: owner.id };
    const repos = bookingRepos({ bookings: { findOwnedByGarage: async () => null, findOwnedByUser: async () => accepted, compareAndSetStatus: async () => assert.fail('must not write') } });
    const svc = createBookingService({ repos, notifier: silentNotifier(), capacity: openCapacity });
    await assert.rejects(svc.updateStatusByGarage('gu2', String(accepted._id), 'ACCEPTED'), (e) => e.status === 404);
    await assert.rejects(svc.updateStatusByGarage('gu2', String(accepted._id), 'CANCELLED'), (e) => e.status === 400 && e.message === 'Invalid status');
    await assert.rejects(svc.provideInfo(owner.id, String(accepted._id), 'here'), (e) => e.status === 409, 'owner can no longer reset an accepted booking');
    await assert.rejects(svc.provideInfo(owner.id, String(accepted._id), '   '), (e) => e.status === 400);
  });

  await test('Booking email escapes customer-controlled HTML', () => {
    assert.strictEqual(escapeHtml('<img src=x onerror=alert(1)>&"\''), '&lt;img src=x onerror=alert(1)&gt;&amp;&quot;&#39;');
    const d = requestDetails({
      booking: { _id: 'b1', notes: '<script>x</script>', isCustomIssue: true, scheduledFor: null },
      garage: { name: 'G' }, vehicle: { brand: 'K' }, service: { title: 'T', price: 1, issueDetails: { description: '<b>bold</b>' } }, customer: { name: '<i>n</i>' },
    });
    const html = requestEmailHtml(d, '<u>owner</u>');
    assert.ok(!/<script>|<b>bold|<i>n|<u>owner/.test(html), 'no raw markup from user input');
    assert.ok(html.includes('&lt;script&gt;'));
  });

  // Dispute command service
  const payment = { _id: new ObjectId(), userId: owner.id, garageId: String(garage._id), amount: 1000, status: 'CAPTURED', invoiceNumber: 'INV-1' };
  function disputeRepos(overrides = {}) {
    const calls = [];
    return {
      calls,
      payments: { findOne: async () => payment },
      garages: { findById: async () => garage, findIdsByOwner: async () => ['gu1', String(garage._id)] },
      disputes: {
        findActiveForPayment: async () => null,
        create: async (doc) => { calls.push(['create', doc]); return { insertedId: new ObjectId() }; },
        findByIdOrNumber: async () => null,
        ...overrides.disputes,
      },
      disputeEvents: { append: async (e) => { calls.push(['event', e.action]); }, listForDispute: async () => [] },
    };
  }
  const fakeStorage = () => {
    const log = [];
    return {
      log,
      persistUploadedFile: async (file) => { log.push(['persist', file.path]); return { url: '/uploads/e.png', storageProvider: 'local', storageKey: 'e.png' }; },
      deletePersistedFile: async (p) => { log.push(['delete', p.url]); },
      removeTemporaryFile: (file) => { log.push(['removeTemp', file.path]); },
    };
  };
  const disputeSvc = (repos, storage = fakeStorage(), notifyLog = []) => createDisputeServices({
    repos, storage, nextDisputeNumber: async () => 'DP-DIS-2026-000001', initiateRefund: async () => ({ refund: { refundId: 'r1' } }),
    notifyUser: async (to, n) => { notifyLog.push([to, n.title]); }, auditLog: async () => {},
  });
  const input = { paymentId: String(payment._id), description: 'Charged twice', category: 'DUPLICATE_PAYMENT' };
  const file = { path: '/tmp/x.png', originalname: 'x.png', mimetype: 'image/png' };

  await test('Dispute create: payment of another user -> 403; duplicate -> 409; evidence never persisted for either', async () => {
    const storage = fakeStorage();
    const { commands } = disputeSvc(disputeRepos(), storage);
    await assert.rejects(commands.create({ userId: 'someone-else', input, file }), (e) => e.status === 403);
    const dup = disputeRepos({ disputes: { findActiveForPayment: async () => ({ disputeNumber: 'DP-DIS-2026-000009' }) } });
    await assert.rejects(disputeSvc(dup, storage).commands.create({ userId: owner.id, input, file }), (e) => e.status === 409 && /DP-DIS-2026-000009/.test(e.message));
    assert.deepStrictEqual(storage.log, [['removeTemp', file.path], ['removeTemp', file.path]], 'temp upload removed, nothing persisted');
  });

  await test('Dispute create: notification goes to the garage OWNER; failed insert deletes persisted evidence', async () => {
    const notifyLog = [];
    const repos = disputeRepos();
    const created = await disputeSvc(repos, fakeStorage(), notifyLog).commands.create({ userId: owner.id, input, file });
    assert.strictEqual(created.status, 'OPEN');
    assert.strictEqual(created.evidence[0].mimeType, 'image/png');
    assert.deepStrictEqual(notifyLog, [['gu1', 'New Dispute Raised']], 'previously sent to the garage document id');
    const storage = fakeStorage();
    const failing = disputeRepos({ disputes: { create: async () => { throw Object.assign(new Error('E11000'), { status: 409 }); } } });
    await assert.rejects(disputeSvc(failing, storage).commands.create({ userId: owner.id, input, file }));
    assert.deepStrictEqual(storage.log.map((l) => l[0]), ['persist', 'delete']);
    await assert.rejects(disputeSvc(repos).commands.create({ userId: owner.id, input: { ...input, disputedAmount: 5000 } }), (e) => e.status === 400);
    await assert.rejects(disputeSvc(repos).commands.create({ userId: owner.id, input: { ...input, category: 'BOGUS' } }), (e) => e.status === 400);
  });

  await test('Dispute respond/cancel/resolve: closed disputes stay closed; bad resolution is 400', async () => {
    const closed = { _id: new ObjectId(), status: 'RESOLVED', userId: owner.id, disputeNumber: 'D1' };
    const repos = disputeRepos({ disputes: { findByIdOrNumber: async () => closed, transitionFrom: async () => assert.fail('must not write'), claimResolution: async () => assert.fail('must not claim') } });
    const { commands } = disputeSvc(repos);
    await assert.rejects(commands.respondAsUser({ id: owner.id }, 'D1', 'reopen please'), (e) => e.status === 409);
    await assert.rejects(commands.cancelByUser({ id: owner.id }, 'D1'), (e) => e.status === 400 && e.message === 'Cannot cancel a dispute that is under review or resolved');
    await assert.rejects(commands.respondAsUser({ id: 'stranger' }, 'D1', 'x'), (e) => e.status === 403);
    await assert.rejects(commands.resolve({ disputeId: 'D1', adminId: 'a', resolution: 'REFUND_FULL' }), (e) => e.status === 409);
    await assert.rejects(commands.resolve({ disputeId: 'D1', adminId: 'a', resolution: 'GIVE_ME_MONEY' }), (e) => e.status === 400);
    const busy = { ...closed, status: 'OPEN', resolutionInProgress: true };
    const busyRepos = disputeRepos({ disputes: { findByIdOrNumber: async () => busy } });
    await assert.rejects(disputeSvc(busyRepos).commands.cancelByUser({ id: owner.id }, 'D1'), (e) => e.status === 409 && e.code === 'DISPUTE_BEING_RESOLVED');
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
  await require('./src/models/Dispute').ensureDisputeIndexes(db);

  const { buildApp } = require('./server');
  const server = buildApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, urlPath, { body, token, form, headers = {} } = {}) => {
    const res = await fetch(base + urlPath, {
      method,
      headers: { ...(form ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: form || (body === undefined ? undefined : JSON.stringify(body)),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  };

  console.log('\n— HTTP: /api/bookings + disputes (real Express app + MongoDB) —');
  const mk = (role, name) => ({ _id: new ObjectId(), name, email: `${name.toLowerCase().replace(/\s/g, '')}@driveportz-test.in`, role, tokenVersion: 0, password: '$2b$10$secret-hash-must-never-leak', phone: '9000000000' });
  const owner = mk('USER', 'Owner');
  const stranger = mk('USER', 'Stranger');
  const garageUserA = mk('GARAGE', 'Garage A');
  const garageUserB = mk('GARAGE', 'Garage B');
  const garageUserC = mk('GARAGE', 'Garage C');
  const admin = mk('ADMIN', 'Admin');
  await db.collection('users').insertMany([owner, stranger, garageUserA, garageUserB, garageUserC, admin]);
  const garageA = { _id: new ObjectId(), ownerUserId: String(garageUserA._id), name: 'Garage A', isActive: true, maxCapacity: 1 };
  const garageB = { _id: new ObjectId(), ownerUserId: String(garageUserB._id), name: 'Garage B', isActive: true, maxCapacity: 10 };
  const garageC = { _id: new ObjectId(), ownerUserId: String(garageUserC._id), name: 'Garage C', isActive: true, maxCapacity: 1 };
  await db.collection('garages').insertMany([garageA, garageB, garageC]);
  const svcA = { _id: new ObjectId(), garageId: garageA._id, title: 'Oil change', price: 999, isActive: true };
  const svcB = { _id: new ObjectId(), garageId: garageB._id, title: 'Premium detailing', price: 1, isActive: true };
  await db.collection('garageServices').insertMany([svcA, svcB]);
  const car = { _id: new ObjectId(), vehicleNumber: 'KA01AB1234', brand: 'Hyundai', model: 'i20', ownerId: String(owner._id) };
  const strangerCar = { _id: new ObjectId(), vehicleNumber: 'KA09ZZ9999', brand: 'Tata', model: 'Nexon', ownerId: String(stranger._id) };
  await db.collection('vehicles').insertMany([car, strangerCar]);
  const T = { owner: tokenFor(owner), stranger: tokenFor(stranger), a: tokenFor(garageUserA), b: tokenFor(garageUserB), c: tokenFor(garageUserC), admin: tokenFor(admin) };
  const bookings = db.collection('bookings');
  const book = (garage, extra = {}) => call('POST', '/api/bookings', { token: T.owner, body: { garageId: String(garage._id), vehicleId: String(car._id), isCustomIssue: true, issueDetails: { description: 'Noise' }, ...extra } });
  const setStatus = (token, id, status) => call('PATCH', `/api/bookings/${id}/status`, { token, body: { status } });
  const statusOf = async (id) => (await bookings.findOne({ _id: new ObjectId(id) })).status;

  try {
    let b1;
    await test('POST /bookings: 201 { msg, id } for own vehicle + the garage\'s own service', async () => {
      const r = await call('POST', '/api/bookings', { token: T.owner, body: { garageId: String(garageA._id), serviceId: String(svcA._id), vehicleId: String(car._id), notes: 'Please call first' } });
      assert.strictEqual(r.status, 201, r.text);
      assert.deepStrictEqual(Object.keys(r.json).sort(), ['id', 'msg']);
      assert.strictEqual(r.json.msg, 'Booking requested');
      b1 = r.json.id;
      const doc = await bookings.findOne({ _id: new ObjectId(b1) });
      assert.deepStrictEqual([doc.status, doc.snapshots.service.title, doc.snapshots.service.price, doc.userId], ['REQUESTED', 'Oil change', 999, String(owner._id)]);
    });

    await test('POST /bookings: someone else\'s vehicle 404, other garage\'s service 404, bad ids 404, garage role 403', async () => {
      const foreign = await call('POST', '/api/bookings', { token: T.owner, body: { garageId: String(garageA._id), serviceId: String(svcA._id), vehicleId: String(strangerCar._id) } });
      assert.strictEqual(foreign.status, 404);
      assert.strictEqual(foreign.json.msg, 'Vehicle not found');
      const crossService = await call('POST', '/api/bookings', { token: T.owner, body: { garageId: String(garageA._id), serviceId: String(svcB._id), vehicleId: String(car._id) } });
      assert.strictEqual(crossService.status, 404, 'Garage B\'s 1-rupee service cannot be booked at Garage A');
      assert.strictEqual(crossService.json.msg, 'Service not found');
      assert.strictEqual((await call('POST', '/api/bookings', { token: T.owner, body: { garageId: 'nope', vehicleId: 'nope', serviceId: 'nope' } })).status, 404, 'was a 500 (ObjectId cast)');
      assert.strictEqual((await call('POST', '/api/bookings', { token: T.a, body: {} })).status, 403);
      assert.strictEqual(await bookings.countDocuments({}), 1);
    });

    await test('GET /bookings/my: pagination headers, legacy body shape', async () => {
      await book(garageB);
      await book(garageB);
      const r = await call('GET', '/api/bookings/my?page=2&limit=2', { token: T.owner });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.headers.get('x-total-count'), '3');
      assert.strictEqual(r.headers.get('x-page'), '2');
      assert.strictEqual(r.headers.get('x-limit'), '2');
      assert.strictEqual(r.headers.get('x-total-pages'), '2');
      assert.strictEqual(r.json.length, 1);
      assert.deepStrictEqual(Object.keys(r.json[0]), ['id', 'status', 'scheduledFor', 'notes', 'timeline', 'createdAt', 'isCustomIssue', 'garage', 'service', 'vehicle']);
      assert.strictEqual((await call('GET', '/api/bookings/my', { token: T.stranger })).json.length, 0);
    });

    await test('GET /bookings/garage: own bookings only, customer contact, no password hashes', async () => {
      const r = await call('GET', '/api/bookings/garage', { token: T.a });
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(r.json.map((x) => x.id), [b1]);
      assert.strictEqual(r.json[0].customer.name, 'Owner');
      assert.ok(!r.text.includes('secret-hash'), 'no password hash in the response');
      assert.strictEqual(r.headers.get('x-total-count'), '1');
      assert.strictEqual((await call('GET', '/api/bookings/garage', { token: T.b })).json.length, 2);
      assert.strictEqual((await call('GET', '/api/bookings/garage', { token: T.owner })).status, 403);
    });

    await test('Garage B cannot accept/reject Garage A\'s booking (404, state untouched)', async () => {
      assert.strictEqual((await setStatus(T.b, b1, 'ACCEPTED')).status, 404);
      assert.strictEqual((await setStatus(T.b, b1, 'REJECTED')).status, 404);
      assert.strictEqual((await call('PATCH', `/api/bookings/${b1}/request-info`, { token: T.b, body: { message: 'hi' } })).status, 404);
      assert.strictEqual(await statusOf(b1), 'REQUESTED');
    });

    await test('Illegal transitions: unknown status 400, REQUESTED->COMPLETED 409, re-accept 409', async () => {
      assert.strictEqual((await setStatus(T.a, b1, 'FOO')).status, 400);
      const skip = await setStatus(T.a, b1, 'COMPLETED');
      assert.strictEqual(skip.status, 409);
      assert.strictEqual(skip.json.code, 'ILLEGAL_BOOKING_TRANSITION');
      const ok = await setStatus(T.a, b1, 'ACCEPTED');
      assert.strictEqual(ok.status, 200, ok.text);
      assert.deepStrictEqual(ok.json, { msg: 'Booking updated' });
      assert.strictEqual((await setStatus(T.a, b1, 'ACCEPTED')).status, 409);
      const doc = await bookings.findOne({ _id: new ObjectId(b1) });
      assert.deepStrictEqual(doc.timeline.map((t) => t.status), ['REQUESTED', 'ACCEPTED']);
    });

    await test('Capacity enforced at accept time: Garage A (max 1) cannot accept a second job', async () => {
      const second = await call('POST', '/api/bookings', { token: T.owner, body: { garageId: String(garageA._id), serviceId: String(svcA._id), vehicleId: String(car._id) } });
      assert.strictEqual(second.status, 400, 'request-time check: no slots while the only slot is taken');
      await bookings.insertOne({ _id: new ObjectId(), garageId: garageA._id, userId: String(owner._id), status: 'REQUESTED', timeline: [], createdAt: new Date() });
      const extra = await bookings.findOne({ garageId: garageA._id, status: 'REQUESTED' });
      const r = await setStatus(T.a, String(extra._id), 'ACCEPTED');
      assert.strictEqual(r.status, 409);
      assert.strictEqual(r.json.code, 'GARAGE_CAPACITY_FULL');
      assert.strictEqual(await bookings.countDocuments({ garageId: garageA._id, status: { $in: ['ACCEPTED', 'IN_PROGRESS'] } }), 1);
      assert.ok(!(await db.collection('garages').findOne({ _id: garageA._id })).capacityLock, 'lease released');
    });

    await test('Concurrent accepts of two bookings for the last slot: exactly one wins', async () => {
      const ids = [];
      for (let i = 0; i < 2; i += 1) {
        const { insertedId } = await bookings.insertOne({ garageId: garageC._id, userId: String(owner._id), status: 'REQUESTED', timeline: [], createdAt: new Date() });
        ids.push(String(insertedId));
      }
      const results = await Promise.all(ids.map((id) => setStatus(T.c, id, 'ACCEPTED')));
      assert.deepStrictEqual(results.map((r) => r.status).sort(), [200, 409], results.map((r) => r.text).join(' | '));
      assert.strictEqual(await bookings.countDocuments({ garageId: garageC._id, status: 'ACCEPTED' }), 1);
    });

    await test('Concurrent accepts of the SAME booking: one 200, one 409, one timeline entry', async () => {
      const [, bId] = (await call('GET', '/api/bookings/garage', { token: T.b })).json.map((x) => x.id);
      const results = await Promise.all([setStatus(T.b, bId, 'ACCEPTED'), setStatus(T.b, bId, 'ACCEPTED')]);
      assert.deepStrictEqual(results.map((r) => r.status).sort(), [200, 409]);
      const doc = await bookings.findOne({ _id: new ObjectId(bId) });
      assert.strictEqual(doc.timeline.filter((t) => t.status === 'ACCEPTED').length, 1);
    });

    await test('Owner cancel, then garage accept of the cancelled booking -> 409', async () => {
      const r = await book(garageB);
      assert.strictEqual((await call('PATCH', `/api/bookings/${r.json.id}/cancel`, { token: T.stranger })).status, 404, 'stranger cannot cancel');
      const cancel = await call('PATCH', `/api/bookings/${r.json.id}/cancel`, { token: T.owner, body: { reason: 'Changed plans' } });
      assert.strictEqual(cancel.status, 200, cancel.text);
      const accept = await setStatus(T.b, r.json.id, 'ACCEPTED');
      assert.strictEqual(accept.status, 409);
      assert.strictEqual(await statusOf(r.json.id), 'CANCELLED');
    });

    await test('request-info / provide-info round trip; provide-info can no longer reset an accepted booking', async () => {
      const reset = await call('PATCH', `/api/bookings/${b1}/provide-info`, { token: T.owner, body: { message: 'sneaky' } });
      assert.strictEqual(reset.status, 409, 'previously flipped ACCEPTED back to REQUESTED');
      assert.strictEqual(await statusOf(b1), 'ACCEPTED');
      const r = await book(garageB);
      assert.strictEqual((await call('PATCH', `/api/bookings/${r.json.id}/request-info`, { token: T.b, body: { message: '  ' } })).status, 400);
      const ask = await call('PATCH', `/api/bookings/${r.json.id}/request-info`, { token: T.b, body: { message: 'Which noise?' } });
      assert.deepStrictEqual([ask.status, ask.json], [200, { msg: 'Request for info sent' }]);
      assert.strictEqual((await call('PATCH', `/api/bookings/${r.json.id}/provide-info`, { token: T.stranger, body: { message: 'x' } })).status, 404);
      const answer = await call('PATCH', `/api/bookings/${r.json.id}/provide-info`, { token: T.owner, body: { message: 'Front left' } });
      assert.deepStrictEqual([answer.status, answer.json], [200, { msg: 'Info provided' }]);
      const doc = await bookings.findOne({ _id: new ObjectId(r.json.id) });
      assert.deepStrictEqual(doc.timeline.map((t) => t.status), ['REQUESTED', 'MORE_INFO_REQUIRED', 'REQUESTED']);
      assert.strictEqual(doc.timeline[1].message, 'Which noise?');
    });

    await test('Start and complete via status endpoint; COMPLETED is terminal', async () => {
      assert.strictEqual((await setStatus(T.a, b1, 'IN_PROGRESS')).status, 200);
      assert.strictEqual((await setStatus(T.a, b1, 'COMPLETED')).status, 200);
      assert.strictEqual((await setStatus(T.a, b1, 'IN_PROGRESS')).status, 409);
      assert.strictEqual((await setStatus(T.a, b1, 'REJECTED')).status, 409);
    });

    // ── Disputes ──────────────────────────────────────────────────────────────────────────
    const payments = db.collection('payments');
    const mkPayment = (user, extra = {}) => ({ _id: new ObjectId(), userId: String(user._id), garageId: String(garageA._id), amount: 1000, status: 'CAPTURED', invoiceNumber: `INV-${new ObjectId().toString().slice(-6)}`, garageName: 'Garage A', createdAt: new Date(), ...extra });
    const payOwner = mkPayment(owner);
    const payOwner2 = mkPayment(owner);
    const payOwner3 = mkPayment(owner);
    const payStranger = mkPayment(stranger);
    await payments.insertMany([payOwner, payOwner2, payOwner3, payStranger]);
    const disputeForm = (payment, extra = {}) => {
      const form = new FormData();
      form.append('paymentId', String(payment._id));
      form.append('category', extra.category || 'INCORRECT_AMOUNT');
      form.append('description', 'Charged more than quoted');
      form.append('disputedAmount', String(extra.amount || 200));
      if (extra.file) form.append('evidence', extra.file.blob, extra.file.name);
      return form;
    };
    const fileDispute = (payment, extra) => call('POST', '/api/disputes', { token: T.owner, form: disputeForm(payment, extra) });
    let disputeId;

    await test('POST /disputes: payment of another user -> 403, nothing stored', async () => {
      const r = await fileDispute(payStranger);
      assert.strictEqual(r.status, 403, r.text);
      assert.strictEqual(r.json.success, false);
      assert.strictEqual(await db.collection('payment_disputes').countDocuments({}), 0);
    });

    await test('POST /disputes: a failed/abandoned checkout cannot be disputed (400)', async () => {
      // Filed as `stranger` so it does not consume the owner's per-user dispute rate-limit budget.
      const failedPayment = mkPayment(stranger, { status: 'FAILED' });
      await payments.insertOne(failedPayment);
      const r = await call('POST', '/api/disputes', { token: T.stranger, form: disputeForm(failedPayment) });
      assert.strictEqual(r.status, 400, r.text);
      assert.match(r.json.message, /Only completed payments/);
    });

    await test('POST /disputes: 201 with legacy body; duplicate for the same payment -> 409', async () => {
      const r = await fileDispute(payOwner);
      assert.strictEqual(r.status, 201, r.text);
      assert.strictEqual(r.json.success, true);
      assert.match(r.json.message, /^Dispute DP-DIS-\d{4}-\d{6} submitted successfully$/);
      assert.strictEqual(r.json.dispute.status, 'OPEN');
      assert.strictEqual(r.json.dispute.garageId, String(garageA._id));
      disputeId = r.json.dispute.id;
      const dup = await fileDispute(payOwner);
      assert.strictEqual(dup.status, 409);
      assert.match(dup.json.message, /already open/);
    });

    await test('Concurrent duplicate disputes for one payment: exactly one created (unique partial index)', async () => {
      const results = await Promise.all([fileDispute(payOwner2), fileDispute(payOwner2), fileDispute(payOwner2)]);
      assert.deepStrictEqual(results.map((r) => r.status).filter((s) => s === 201).length, 1, results.map((r) => r.status).join(','));
      assert.ok(results.every((r) => r.status === 201 || r.status === 409));
      assert.strictEqual(await db.collection('payment_disputes').countDocuments({ paymentId: String(payOwner2._id) }), 1);
      assert.ok((await db.collection('payment_disputes').indexes()).some((i) => i.name === 'one_active_dispute_per_payment'));
      // The database itself refuses a second active dispute even if the pre-check is bypassed.
      const { DisputeRepository } = require('./src/repositories/DisputeRepository');
      await assert.rejects(new DisputeRepository(db).create({ disputeNumber: 'DP-DIS-RACE', paymentId: String(payOwner2._id), status: 'UNDER_REVIEW' }), (e) => e.status === 409);
    });

    await test('Evidence with a forged type (HTML declared as PNG) -> 415, no dispute, no file left behind', async () => {
      const { uploadsDir } = require('./src/utils/uploads');
      const before = new Set(fs.readdirSync(uploadsDir));
      const forged = { blob: new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' }), name: 'receipt.png' };
      const r = await fileDispute(payOwner3, { file: forged });
      assert.strictEqual(r.status, 415, r.text);
      const svg = await fileDispute(payOwner3, { file: { blob: new Blob(['<svg/>'], { type: 'image/svg+xml' }), name: 'x.svg' } });
      assert.strictEqual(svg.status, 415, 'type outside the allowlist');
      assert.strictEqual(await db.collection('payment_disputes').countDocuments({ paymentId: String(payOwner3._id) }), 0);
      const leftovers = fs.readdirSync(uploadsDir).filter((f) => !before.has(f));
      assert.deepStrictEqual(leftovers, []);
      const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
      const ok = await fileDispute(payOwner3, { file: { blob: new Blob([png], { type: 'image/png' }), name: 'real.png' } });
      assert.strictEqual(ok.status, 201, ok.text);
      assert.strictEqual(ok.json.dispute.evidence[0].mimeType, 'image/png');
      const stored = ok.json.dispute.evidence[0].storageKey;
      assert.ok(stored && !stored.includes('real'), 'server-side filename');
      fs.rmSync(path.join(uploadsDir, stored), { force: true });
    });

    await test('GET /disputes/:id: owner and the garage concerned 200; stranger and other garage 403', async () => {
      const mine = await call('GET', `/api/disputes/${disputeId}`, { token: T.owner });
      assert.strictEqual(mine.status, 200);
      assert.deepStrictEqual(Object.keys(mine.json), ['success', 'dispute', 'timeline']);
      assert.deepStrictEqual(mine.json.timeline.map((t) => t.action), ['DISPUTE_CREATED']);
      assert.strictEqual((await call('GET', `/api/disputes/${disputeId}`, { token: T.stranger })).status, 403);
      assert.strictEqual((await call('GET', `/api/disputes/${disputeId}`, { token: T.b })).status, 403);
      assert.strictEqual((await call('GET', `/api/disputes/${disputeId}`, { token: T.a })).status, 200, 'garage matched via its garage document id');
      assert.strictEqual((await call('GET', '/api/disputes/DP-DIS-1999-000000', { token: T.owner })).status, 404);
    });

    await test('GET /garage/disputes: garage sees disputes keyed by its garage id (was always empty)', async () => {
      const a = await call('GET', '/api/garage/disputes', { token: T.a });
      assert.strictEqual(a.status, 200);
      assert.strictEqual(a.json.totalCount, 3);
      assert.deepStrictEqual(Object.keys(a.json).sort(), ['currentPage', 'disputes', 'success', 'totalCount', 'totalPages']);
      assert.strictEqual((await call('GET', '/api/garage/disputes', { token: T.b })).json.totalCount, 0);
      assert.strictEqual((await call('GET', '/api/garage/disputes', { token: T.owner })).status, 403);
    });

    await test('GET /disputes: pagination headers + bounded limit + body envelope', async () => {
      const r = await call('GET', '/api/disputes?page=2&limit=1', { token: T.owner });
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual([r.json.totalCount, r.json.totalPages, r.json.currentPage, r.json.disputes.length], [3, 3, 2, 1]);
      assert.strictEqual(r.headers.get('x-total-count'), '3');
      assert.strictEqual(r.headers.get('x-page'), '2');
      assert.strictEqual((await call('GET', '/api/disputes?limit=100000', { token: T.owner })).headers.get('x-limit'), '100');
      assert.strictEqual((await call('GET', '/api/disputes', { token: T.stranger })).json.totalCount, 0);
      const search = await call('GET', `/api/disputes?search=${encodeURIComponent('(a+)+$')}`, { token: T.owner });
      assert.strictEqual(search.status, 200, 'regex metacharacters are literal');
    });

    await test('Respond/cancel RBAC: stranger cannot cancel, other garage cannot respond; garage response moves to review', async () => {
      assert.strictEqual((await call('POST', `/api/disputes/${disputeId}/cancel`, { token: T.stranger })).status, 403);
      assert.strictEqual((await call('POST', `/api/disputes/${disputeId}/respond`, { token: T.stranger, body: { message: 'x' } })).status, 403);
      assert.strictEqual((await call('POST', `/api/garage/disputes/${disputeId}/respond`, { token: T.b, body: { response: 'not mine' } })).status, 403);
      const r = await call('POST', `/api/garage/disputes/${disputeId}/respond`, { token: T.a, body: { response: 'Quoted price included GST' } });
      assert.deepStrictEqual([r.status, r.json], [200, { success: true, message: 'Garage response recorded successfully' }]);
      const cancel = await call('POST', `/api/disputes/${disputeId}/cancel`, { token: T.owner });
      assert.strictEqual(cancel.status, 400, 'UNDER_REVIEW is no longer cancellable');
      assert.strictEqual(cancel.json.message, 'Cannot cancel a dispute that is under review or resolved');
      const reply = await call('POST', `/api/disputes/${disputeId}/respond`, { token: T.owner, body: { message: 'It did not' } });
      assert.deepStrictEqual([reply.status, reply.json], [200, { success: true, message: 'Response submitted successfully' }]);
    });

    await test('Admin: summary aggregation, list with category filter, reject; closed dispute cannot be reopened', async () => {
      const summary = await call('GET', '/api/admin/disputes/summary', { token: T.admin });
      assert.strictEqual(summary.status, 200);
      assert.deepStrictEqual(summary.json.summary, { totalDisputes: 3, open: 2, underReview: 1, resolved: 0, rejected: 0, refundDisputes: 0, totalDisputedVolume: 600 });
      assert.strictEqual((await call('GET', '/api/admin/disputes/summary', { token: T.owner })).status, 403);
      const list = await call('GET', '/api/admin/disputes?category=INCORRECT_AMOUNT&limit=2', { token: T.admin });
      assert.deepStrictEqual([list.json.totalCount, list.json.disputes.length, list.headers.get('x-total-count')], [3, 2, '3']);
      assert.strictEqual((await call('POST', `/api/admin/disputes/${disputeId}/resolve`, { token: T.admin, body: { resolution: 'BOGUS' } })).status, 400);
      const rej = await call('POST', `/api/admin/disputes/${disputeId}/reject`, { token: T.admin, body: {} });
      assert.strictEqual(rej.status, 200, rej.text);
      assert.match(rej.json.message, /rejected$/);
      assert.strictEqual(rej.json.dispute.status, 'REJECTED');
      assert.strictEqual(rej.json.dispute.resolutionInProgress, undefined);
      const reopen = await call('POST', `/api/disputes/${disputeId}/respond`, { token: T.owner, body: { message: 'reopen' } });
      assert.strictEqual(reopen.status, 409, 'respond used to flip REJECTED back to UNDER_REVIEW');
      assert.strictEqual((await call('POST', `/api/admin/disputes/${disputeId}/resolve`, { token: T.admin, body: { resolution: 'NO_ACTION' } })).status, 409);
      const detail = await call('GET', `/api/admin/disputes/${disputeId}`, { token: T.admin });
      assert.deepStrictEqual(detail.json.timeline.map((t) => t.action), ['DISPUTE_CREATED', 'GARAGE_RESPONDED', 'USER_RESPONDED', 'DISPUTE_REJECTED']);
      assert.strictEqual(await db.collection('admin_audit_logs').countDocuments({ targetId: disputeId }), 1);
    });

    await test('Cancelled dispute frees the payment for a new dispute; cancelled cannot be resolved', async () => {
      const open = await db.collection('payment_disputes').findOne({ paymentId: String(payOwner2._id) });
      const cancel = await call('POST', `/api/disputes/${open._id}/cancel`, { token: T.owner });
      assert.deepStrictEqual([cancel.status, cancel.json], [200, { success: true, message: 'Dispute cancelled successfully' }]);
      assert.strictEqual((await call('POST', `/api/admin/disputes/${open._id}/resolve`, { token: T.admin, body: { resolution: 'REFUND_FULL' } })).status, 409);
      assert.strictEqual((await fileDispute(payOwner2)).status, 201);
    });
  } finally {
    server.close();
    await db.dropDatabase();
    await closeMongo();
  }
}

(async () => {
  console.log('🚀 DrivePortz booking + dispute routes suite');
  await stateMachineTests();
  await serviceUnitTests();
  await httpTests();
  console.log(`\n${failed === 0 ? '✅' : '❌'} Booking + dispute routes suite: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('❌ Booking + dispute routes suite crashed:', err);
  process.exit(1);
});
