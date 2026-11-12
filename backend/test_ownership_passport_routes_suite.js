/**
 * Ownership + passport routes suite: /api/ownership and /api/passport after the Repository +
 * service-layer refactor.
 *
 *  1. Pure unit tests: the transfer state machine and the privacy presenters.
 *  2. Service unit tests with FAKE repositories (no database).
 *  3. HTTP tests against the real Express app and a throwaway MongoDB database: RBAC, concurrent
 *     accepts, accept vs reject races, the public passport allow-list, owner vs public views.
 *
 * Plain Node + assert, like the other suites. Uses its own database and drops it at the end.
 */
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'ownership-suite-secret-key-2026-minimum-32-chars';
process.env.MONGO_DB_NAME = `driveportz_ownership_suite_${process.pid}`;
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
  return jwt.sign({ role: user.role, tv: user.tokenVersion || 0, typ: 'session' }, process.env.JWT_SECRET_KEY, { subject: String(user._id), expiresIn: '1h', algorithm: 'HS256' });
}

/** Every key path in a JSON value (used to prove forbidden fields are absent). */
function collectKeys(value, prefix = '', out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => collectKeys(v, `${prefix}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push({ path: `${prefix}.${k}`, key: k, value: v });
      collectKeys(v, `${prefix}.${k}`, out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// 1. Pure units
// ---------------------------------------------------------------------------------------------
async function pureTests() {
  console.log('\n— Unit: transfer state machine and privacy presenters (pure) —');
  const sm = require('./src/services/ownership/transferStateMachine');
  const { ConflictError } = require('./src/core/errors');
  const { publicOwnerName, toHistoryEntryView } = require('./src/services/ownership/presenters');
  const presenters = require('./src/services/passport/presenters');
  const S = sm.TRANSFER_STATUS;

  await test('State machine: pending is the only non-terminal state; legal moves are exactly accept/reject/cancel', () => {
    const all = Object.values(S);
    const legal = [];
    for (const from of all) for (const to of all) if (sm.canTransitionTransfer(from, to)) legal.push(`${from}->${to}`);
    assert.deepStrictEqual(legal.sort(), ['pending->accepted', 'pending->cancelled', 'pending->rejected']);
    assert.strictEqual(sm.isTerminalTransferStatus(S.PENDING), false);
    for (const s of [S.ACCEPTED, S.REJECTED, S.CANCELLED]) assert.strictEqual(sm.isTerminalTransferStatus(s), true);
  });

  await test('State machine: self-transitions and unknown states are illegal (accept can never re-run)', () => {
    assert.strictEqual(sm.canTransitionTransfer(S.ACCEPTED, S.ACCEPTED), false);
    assert.strictEqual(sm.canTransitionTransfer(S.PENDING, S.PENDING), false);
    assert.strictEqual(sm.canTransitionTransfer('PENDING', S.ACCEPTED), false, 'case-sensitive stored values');
    assert.strictEqual(sm.canTransitionTransfer(undefined, S.ACCEPTED), false);
    assert.throws(() => sm.assertTransferTransition(S.REJECTED, S.ACCEPTED), ConflictError);
    assert.doesNotThrow(() => sm.assertTransferTransition(S.PENDING, S.CANCELLED));
  });

  await test('publicOwnerName: first name + last initial; blanks fall back', () => {
    assert.strictEqual(publicOwnerName('Ravi Kumar Sharma', 'X'), 'Ravi S.');
    assert.strictEqual(publicOwnerName('  Priya  ', 'X'), 'Priya');
    assert.strictEqual(publicOwnerName('', 'Original Owner'), 'Original Owner');
    assert.strictEqual(publicOwnerName(null, 'Original Owner'), 'Original Owner');
  });

  await test('History rows: public audience hides user ids and shortens names', () => {
    const row = { _id: new ObjectId(), vehicleId: 'v', ownerId: 'u1', ownerName: 'Anil Mehta', fromDate: 'a', toDate: null };
    assert.deepStrictEqual({ ...toHistoryEntryView(row, 'public'), id: undefined }, { id: undefined, vehicleId: 'v', ownerId: null, ownerName: 'Anil M.', fromDate: 'a', toDate: null });
    assert.strictEqual(toHistoryEntryView(row, 'owner').ownerId, 'u1');
    assert.strictEqual(toHistoryEntryView(row, 'owner').ownerName, 'Anil Mehta');
  });

  await test('Records: walk-ins excluded from the public view; verified only for confirmed garage records', () => {
    const verified = { _id: 1, verifiedService: true, verificationStatus: 'Verified' };
    const owner = { _id: 2, verifiedService: false, verificationStatus: 'Pending' };
    const selfVerifiedLegacy = { _id: 3, verifiedService: true, verificationStatus: 'Pending' };
    const walkIn = { _id: 4, verifiedService: false, verificationStatus: 'Pending', requiresOwnerConfirmation: true };
    const all = [verified, owner, selfVerifiedLegacy, walkIn];
    assert.deepStrictEqual(presenters.visibleRecords(all, 'public').map((r) => r._id), [1, 2, 3]);
    assert.strictEqual(presenters.visibleRecords(all, 'owner').length, 4);
    assert.deepStrictEqual(all.map(presenters.isVerifiedRecord), [true, false, false, false]);
  });
}

// ---------------------------------------------------------------------------------------------
// 2. Services with fake repositories
// ---------------------------------------------------------------------------------------------
function fakeTransferRepos(seed = {}) {
  const calls = [];
  const log = (name, result) => (...args) => { calls.push([name, ...args]); return Promise.resolve(typeof result === 'function' ? result(...args) : result); };
  return {
    calls,
    vehicles: {
      findActiveById: async () => seed.vehicle || null,
      findById: async () => seed.vehicle || null,
      reassignOwner: log('reassignOwner', seed.reassignResult !== false),
      findManyByIds: async () => seed.vehicles || [],
    },
    users: { findOne: async () => (seed.buyer === undefined ? null : seed.buyer) },
    bookings: { count: async () => seed.openBookings || 0 },
    transfers: {
      findByObjectId: async () => seed.transfer || null,
      findPendingForVehicle: async () => seed.existingPending || null,
      insertPending: log('insertPending', () => {
        if (seed.insertError) throw seed.insertError;
        return { insertedId: 'new-transfer' };
      }),
      transitionStatus: log('transitionStatus', (...args) => (seed.transitionResult ? seed.transitionResult(...args) : true)),
      voidUnfinalizedAcceptance: log('voidUnfinalizedAcceptance', true),
      markFinalized: log('markFinalized', {}),
      rejectOtherPending: log('rejectOtherPending', {}),
      repointServiceRecords: log('repointServiceRecords', {}),
      listPendingForBuyer: async () => seed.pendingList || [],
    },
    ownershipHistory: {
      closeOpenEntry: log('closeOpenEntry', { matchedCount: 1 }),
      insertOnce: log('insertOnce', true),
      listForVehicle: async () => [],
    },
    diagnoses: { reassignVehicle: log('reassignVehicle', {}) },
  };
}

async function serviceUnitTests() {
  console.log('\n— Unit: services with fake repositories —');
  const { createOwnershipTransferService } = require('./src/services/ownership/ownershipTransferService');
  const { createPassportService } = require('./src/services/passport/passportService');
  const { ForbiddenError, ValidationError, ConflictError, NotFoundError } = require('./src/core/errors');
  const { isOwner } = require('./src/security/vehicleAccess');

  const sellerId = String(new ObjectId());
  const buyerId = String(new ObjectId());
  const seller = { id: sellerId, role: 'USER', email: 'seller@x.in', name: 'Seller One' };
  const buyer = { id: buyerId, role: 'USER', email: 'buyer@x.in', name: 'Buyer Two', phone: '9000000000' };
  const vehicleId = new ObjectId();
  const vehicle = { _id: vehicleId, ownerId: sellerId, brand: 'Tata', model: 'Nexon', vehicleNumber: 'KA01' };
  const transferId = new ObjectId();
  const pending = { _id: transferId, vehicleId: String(vehicleId), sellerId, buyerId, status: 'pending' };
  const notifications = [];
  const quietLogger = { error: () => {} };
  const build = (repos, extra = {}) => createOwnershipTransferService({
    repos, isOwner, notifyUser: async (...a) => { notifications.push(a); }, logger: quietLogger, ...extra,
  });

  await test('initiate: a non-owner cannot transfer someone else\'s vehicle (404, nothing inserted)', async () => {
    const repos = fakeTransferRepos({ vehicle, buyer: { _id: new ObjectId(buyerId), email: 'buyer@x.in' } });
    await assert.rejects(build(repos).initiateTransfer({ ...buyer, id: String(new ObjectId()) }, { vehicleId: String(vehicleId), buyerEmail: 'buyer@x.in' }), NotFoundError);
    assert.ok(!repos.calls.some((c) => c[0] === 'insertPending'));
  });

  await test('initiate: validation (missing, non-string email, bad id, self by email or id, disabled buyer)', async () => {
    const svc = build(fakeTransferRepos({ vehicle, buyer: { _id: new ObjectId(sellerId), email: 'alias@x.in' } }));
    await assert.rejects(svc.initiateTransfer(seller, {}), ValidationError);
    await assert.rejects(svc.initiateTransfer(seller, { vehicleId: String(vehicleId), buyerEmail: ['a@b.c'] }), ValidationError);
    await assert.rejects(svc.initiateTransfer(seller, { vehicleId: 'nope', buyerEmail: 'b@x.in' }), ValidationError);
    await assert.rejects(svc.initiateTransfer(seller, { vehicleId: String(vehicleId), buyerEmail: ' SELLER@x.in ' }), ValidationError);
    await assert.rejects(svc.initiateTransfer(seller, { vehicleId: String(vehicleId), buyerEmail: 'alias@x.in' }), ValidationError, 'same account under another email');
    const disabled = build(fakeTransferRepos({ vehicle, buyer: { _id: new ObjectId(buyerId), isDisabled: true } }));
    await assert.rejects(disabled.initiateTransfer(seller, { vehicleId: String(vehicleId), buyerEmail: 'buyer@x.in' }), NotFoundError);
  });

  await test('initiate: existing pending, or a duplicate-key race, is a 400; success inserts canonical ids', async () => {
    const b = { _id: new ObjectId(buyerId), email: 'buyer@x.in' };
    await assert.rejects(build(fakeTransferRepos({ vehicle, buyer: b, existingPending: pending })).initiateTransfer(seller, { vehicleId: String(vehicleId), buyerEmail: 'buyer@x.in' }), ValidationError);
    const dup = Object.assign(new Error('E11000'), { code: 11000 });
    await assert.rejects(build(fakeTransferRepos({ vehicle, buyer: b, insertError: dup })).initiateTransfer(seller, { vehicleId: String(vehicleId), buyerEmail: 'buyer@x.in' }), ValidationError);
    const repos = fakeTransferRepos({ vehicle, buyer: b });
    let indexed = false;
    const result = await build(repos, { ensureIndexes: async () => { indexed = true; } }).initiateTransfer(seller, { vehicleId: String(vehicleId), buyerEmail: 'Buyer@X.in' });
    assert.strictEqual(result.transferId, 'new-transfer');
    assert.ok(indexed, 'unique pending index ensured before insert');
    const [, doc] = repos.calls.find((c) => c[0] === 'insertPending');
    assert.deepStrictEqual([doc.vehicleId, doc.sellerId, doc.buyerId, doc.buyerEmail], [String(vehicleId), sellerId, buyerId, 'buyer@x.in']);
  });

  await test('accept: only the designated buyer (403 while pending; 404 once not pending)', async () => {
    const svc = build(fakeTransferRepos({ vehicle, transfer: pending }));
    await assert.rejects(svc.acceptTransfer(seller, { transferId: String(transferId) }), ForbiddenError);
    const done = build(fakeTransferRepos({ vehicle, transfer: { ...pending, status: 'rejected' } }));
    await assert.rejects(done.acceptTransfer({ id: String(new ObjectId()) }, { transferId: String(transferId) }), NotFoundError);
    await assert.rejects(svc.acceptTransfer(buyer, {}), ValidationError);
  });

  await test('accept: CAS order, follow-ups share the transaction session, seller notified once', async () => {
    const repos = fakeTransferRepos({ vehicle, transfer: pending });
    const session = { id: 'txn' };
    notifications.length = 0;
    await build(repos, { runInTransaction: async (client, work) => work(session) }).acceptTransfer(buyer, { transferId: String(transferId) });
    const names = repos.calls.map((c) => c[0]);
    assert.deepStrictEqual(names, ['transitionStatus', 'reassignOwner', 'closeOpenEntry', 'insertOnce', 'repointServiceRecords', 'reassignVehicle', 'rejectOtherPending', 'markFinalized']);
    const [, , from, to] = repos.calls[0];
    assert.deepStrictEqual([from, to], ['pending', 'accepted']);
    for (const c of repos.calls) assert.strictEqual(c[c.length - 1].session, session, `${c[0]} runs in the transaction`);
    const history = repos.calls.find((c) => c[0] === 'insertOnce')[1];
    assert.strictEqual(String(history._id), String(transferId), 'deterministic history _id = transfer id');
    assert.strictEqual(notifications.length, 1);
    assert.strictEqual(notifications[0][0], sellerId);
  });

  await test('accept: losing the CAS to a concurrent accept is a 409 (no vehicle write)', async () => {
    const repos = fakeTransferRepos({ vehicle, transfer: pending, transitionResult: () => false });
    repos.transfers.findByObjectId = async () => ({ ...pending, status: 'accepted', acceptedAt: new Date() });
    await assert.rejects(build(repos).acceptTransfer(buyer, { transferId: String(transferId) }), (e) => e instanceof ConflictError && e.code === 'TRANSFER_ACCEPT_IN_PROGRESS');
    assert.ok(!repos.calls.some((c) => c[0] === 'reassignOwner'));
  });

  await test('accept: losing the CAS to a reject is a 409 TRANSFER_NOT_PENDING', async () => {
    const repos = fakeTransferRepos({ vehicle, transfer: pending, transitionResult: () => false });
    repos.transfers.findByObjectId = (() => { let n = 0; return async () => (n++ === 0 ? pending : { ...pending, status: 'rejected' }); })();
    await assert.rejects(build(repos).acceptTransfer(buyer, { transferId: String(transferId) }), (e) => e.code === 'TRANSFER_NOT_PENDING');
  });

  await test('accept: vehicle CAS failure voids the claimed transfer on a standalone server', async () => {
    const repos = fakeTransferRepos({ vehicle, transfer: pending, reassignResult: false });
    await assert.rejects(build(repos).acceptTransfer(buyer, { transferId: String(transferId) }), (e) => e.code === 'TRANSFER_OWNERSHIP_CHANGED');
    assert.ok(repos.calls.some((c) => c[0] === 'voidUnfinalizedAcceptance'));
    assert.ok(!repos.calls.some((c) => c[0] === 'closeOpenEntry'), 'no history written');
  });

  await test('accept: seller no longer owns the vehicle -> transfer auto-rejected, 409', async () => {
    const repos = fakeTransferRepos({ vehicle: { ...vehicle, ownerId: String(new ObjectId()) }, transfer: pending });
    await assert.rejects(build(repos).acceptTransfer(buyer, { transferId: String(transferId) }), ConflictError);
    const t = repos.calls.find((c) => c[0] === 'transitionStatus');
    assert.deepStrictEqual([t[2], t[3]], ['pending', 'rejected']);
    assert.ok(!repos.calls.some((c) => c[0] === 'reassignOwner'));
  });

  await test('accept: an open garage booking blocks the transfer (buyer would be billed)', async () => {
    const repos = fakeTransferRepos({ vehicle, transfer: pending, openBookings: 1 });
    await assert.rejects(build(repos).acceptTransfer(buyer, { transferId: String(transferId) }), (e) => e.code === 'TRANSFER_OPEN_BOOKINGS');
    assert.strictEqual(repos.calls.length, 0);
  });

  await test('accept replay: finalised or legacy acceptances succeed with zero writes; stale unfinalised ones are re-driven', async () => {
    for (const t of [{ ...pending, status: 'accepted', acceptedAt: new Date(), finalizedAt: new Date() }, { ...pending, status: 'accepted', completedAt: new Date() }]) {
      const repos = fakeTransferRepos({ vehicle, transfer: t });
      assert.deepStrictEqual(await build(repos).acceptTransfer(buyer, { transferId: String(transferId) }), { replayed: true });
      assert.strictEqual(repos.calls.length, 0);
    }
    const stale = { ...pending, status: 'accepted', acceptedAt: new Date(Date.now() - 60 * 1000) };
    const repos = fakeTransferRepos({ vehicle: { ...vehicle, ownerId: buyerId }, transfer: stale });
    await build(repos).acceptTransfer(buyer, { transferId: String(transferId) });
    assert.ok(repos.calls.some((c) => c[0] === 'markFinalized'), 'interrupted run completed');
    assert.ok(!repos.calls.some((c) => c[0] === 'reassignOwner'), 'vehicle already moved, not moved again');
  });

  await test('reject/cancel: party checks and a lost race is a 409', async () => {
    const svc = build(fakeTransferRepos({ vehicle, transfer: pending }));
    await assert.rejects(svc.rejectTransfer(seller, { transferId: String(transferId) }), ForbiddenError, 'seller cannot reject');
    await assert.rejects(svc.cancelTransfer(buyer, { transferId: String(transferId) }), ForbiddenError, 'buyer cannot cancel');
    const lost = build(fakeTransferRepos({ vehicle, transfer: pending, transitionResult: () => false }));
    await assert.rejects(lost.rejectTransfer(buyer, { transferId: String(transferId) }), ConflictError);
    const repos = fakeTransferRepos({ vehicle, transfer: pending });
    await build(repos).cancelTransfer(seller, { transferId: String(transferId) });
    const t = repos.calls.find((c) => c[0] === 'transitionStatus');
    assert.deepStrictEqual([t[2], t[3]], ['pending', 'cancelled']);
  });

  await test('passport service: public vs owner audience from the same data', async () => {
    const v = { _id: vehicleId, ownerId: sellerId, vehicleNumber: 'KA01', chassisNumber: 'MA3CHASSIS1234567', engineNumber: 'ENG9876543', phone: '9876543210', purchasePrice: 500000, rcBookUrl: '/uploads/rc.pdf', qrCodeUrl: 'data:cached', qrCodeTarget: 'http://site/passport/' + vehicleId };
    const repos = {
      vehicles: { findActiveForPassport: async () => v, saveQrCode: async () => { throw new Error('should use cache'); } },
      serviceRecords: { find: async () => [{ _id: 1, verifiedService: true, verificationStatus: 'Verified', serviceDate: '2026-01-01' }, { _id: 2, requiresOwnerConfirmation: true, verificationStatus: 'Pending', partsReplaced: [{ partName: 'Fake' }] }] },
      ownershipHistory: { listForVehicle: async () => [] },
      media: { listVehicleProfilePhotos: async () => [{ _id: 'm1', url: '/u/p.jpg', storageKey: 'secret', uploadedBy: sellerId }] },
      users: { findById: async () => ({ name: 'Seller Person', email: 'seller@x.in', phone: '9876543210' }) },
    };
    const svc = createPassportService({ repos, isOwner, generateQRCode: async () => 'data:new', calculateHealthScore: (_v, s) => ({ healthScore: s.length, conditionLevel: 'Poor' }), frontendUrl: 'http://site/', logger: quietLogger });
    const pub = await svc.getPassport(null, String(vehicleId));
    assert.strictEqual(pub.vehicle.chassisNumber, null);
    assert.strictEqual(pub.owner.email, '');
    assert.strictEqual(pub.owner.name, 'Seller P.');
    assert.strictEqual(pub.services.length, 1, 'walk-in excluded');
    assert.strictEqual(pub.partsReplaced.length, 0);
    assert.strictEqual(pub.healthScore, 1, 'health ignores unconfirmed walk-ins');
    assert.deepStrictEqual(Object.keys(pub.vehiclePhotos[0]).sort(), ['_id', 'category', 'createdAt', 'id', 'url']);
    assert.strictEqual(pub.vehicle.qrCodeUrl, 'data:cached');
    const own = await svc.getPassport(seller, String(vehicleId));
    assert.strictEqual(own.vehicle.chassisNumber, 'MA3CHASSIS1234567');
    assert.strictEqual(own.owner.email, 'seller@x.in');
    assert.strictEqual(own.services.length, 2);
    assert.strictEqual(own.services[1].requiresOwnerConfirmation, true);
    const forced = await svc.getPassport(seller, String(vehicleId), { forcePublic: true });
    assert.strictEqual(forced.owner.email, '');
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
  await require('./src/services/ownership').ensureOwnershipIndexes(db);

  const { buildApp } = require('./server');
  const server = buildApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { body, token } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    let json = null;
    try { json = JSON.parse(buf.toString('utf8')); } catch { /* not json */ }
    return { status: res.status, json, buf, headers: res.headers };
  };

  console.log('\n— HTTP: /api/ownership and /api/passport (real Express app + MongoDB) —');
  const mk = (role, name, extra = {}) => ({ _id: new ObjectId(), name, email: `${name.toLowerCase().replace(/\s/g, '')}@driveportz-test.in`, phone: '98' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0'), role, tokenVersion: 0, ...extra });
  const seller = mk('USER', 'Sanjay Seller');
  const buyer = mk('USER', 'Bina Buyer');
  const stranger = mk('USER', 'Stan Stranger');
  const admin = mk('ADMIN', 'Ada Admin');
  const disabled = mk('USER', 'Dee Disabled', { isDisabled: true });
  const garageUser = mk('GARAGE', 'Garage Owner');
  await db.collection('users').insertMany([seller, buyer, stranger, admin, disabled, garageUser]);
  const T = { seller: tokenFor(seller), buyer: tokenFor(buyer), stranger: tokenFor(stranger), admin: tokenFor(admin) };

  const SECRETS = { chassis: 'MA3EWDE1S00123456', engine: 'K12MN4567890', rc: '/uploads/rc-secret.pdf', ins: '/uploads/ins-secret.pdf', policy: 'POL-SECRET-778899', storageKey: 'driveportz/media/vehicle/secret-key' };
  const mkVehicle = (number, extra = {}) => ({
    _id: new ObjectId(), vehicleNumber: number, brand: 'Maruti', model: 'Swift', variant: 'VXi', manufacturingYear: 2021, fuelType: 'Petrol', color: 'Red',
    registeredRTO: 'KA01', ownerId: String(seller._id), ownerName: seller.name, phone: seller.phone, email: seller.email,
    chassisNumber: SECRETS.chassis, engineNumber: SECRETS.engine, purchasePrice: 650000, purchaseDate: '2021-03-01',
    rcBookUrl: SECRETS.rc, insuranceDocumentUrl: SECRETS.ins, currentOdometerKm: 32000, isArchived: false, createdAt: new Date(), ...extra,
  });
  const car = mkVehicle('KA01OW0001');
  const raceCar = mkVehicle('KA01OW0002');
  const bookedCar = mkVehicle('KA01OW0003');
  const archivable = mkVehicle('KA01OW0004');
  const cancelCar = mkVehicle('KA01OW0005');
  const initRaceCar = mkVehicle('KA01OW0006');
  const legacyUserIdCar = mkVehicle('KA01OW0007', { ownerId: undefined, userId: String(seller._id) });
  delete legacyUserIdCar.ownerId;
  await db.collection('vehicles').insertMany([car, raceCar, bookedCar, archivable, cancelCar, initRaceCar, legacyUserIdCar]);
  await db.collection('ownershipHistory').insertOne({ vehicleId: String(car._id), ownerId: String(seller._id), ownerName: seller.name, fromDate: '2021-03-01T00:00:00.000Z', toDate: null });
  const garageRecord = { _id: new ObjectId(), vehicleId: String(car._id), ownerId: String(seller._id), createdBy: String(garageUser._id), garageName: 'Trusted Motors', serviceType: 'Periodic 30K', serviceDate: '2026-06-01', totalCost: 4200, verifiedService: true, verificationStatus: 'Verified', partsReplaced: [{ partName: 'Oil Filter', brand: 'Bosch', cost: 350 }] };
  const ownerRecord = { _id: new ObjectId(), vehicleId: String(car._id), ownerId: String(seller._id), createdBy: String(seller._id), garageName: 'Self', serviceType: 'Wash', serviceDate: '2026-05-01', totalCost: 300, verifiedService: false, verificationStatus: 'Pending', requiresOwnerConfirmation: false };
  const walkIn = { _id: new ObjectId(), vehicleId: String(car._id), ownerId: String(seller._id), createdBy: String(new ObjectId()), garageName: 'Shady Garage', serviceType: 'Engine Rebuild', serviceDate: '2026-07-01', totalCost: 90000, verifiedService: false, verificationStatus: 'Pending', requiresOwnerConfirmation: true, partsReplaced: [{ partName: 'Fake Turbo', cost: 50000 }] };
  await db.collection('services').insertMany([garageRecord, ownerRecord, walkIn]);
  await db.collection('diagnoses').insertOne({ vehicleId: String(car._id), userId: seller._id, summary: 'Brake noise' });
  await db.collection('media').insertOne({ entityId: String(car._id), entityType: 'VEHICLE', category: 'VEHICLE_PROFILE', url: '/uploads/car.jpg', storageKey: SECRETS.storageKey, storageProvider: 'cloudinary', uploadedBy: String(seller._id), role: 'USER', createdAt: new Date() });
  await db.collection('insurance').insertOne({ vehicleId: String(car._id), provider: 'Acko', policyNumber: SECRETS.policy, startDate: '2026-01-01', expiryDate: '2027-01-01' });
  await db.collection('bookings').insertOne({ _id: new ObjectId(), vehicleId: String(bookedCar._id), userId: String(seller._id), garageId: 'g1', status: 'ACCEPTED', createdAt: new Date() });

  const initiate = (token, vehicle, email) => call('POST', '/api/ownership/transfer', { token, body: { vehicleId: String(vehicle._id), buyerEmail: email } });
  const act = (token, action, transferId) => call('POST', `/api/ownership/transfer/${action}`, { token, body: { transferId: String(transferId) } });
  const forbidden = (keys) => keys.filter(({ key, value }) => ['purchasePrice', 'purchaseDate', 'rcBookUrl', 'insuranceDocumentUrl', 'storageKey', 'storageProvider', 'uploadedBy', 'ownerId', 'userId', 'policyNumber', 'requiresOwnerConfirmation'].includes(key)
    || (['email', 'phone', 'chassisNumber', 'engineNumber'].includes(key) && value));

  try {
    // --- Public passport BEFORE the transfer (seller is the owner) ---
    await test('Public passport (anonymous): forbidden fields absent, no secret value anywhere, walk-in excluded', async () => {
      const r = await call('GET', `/api/passport/${car._id}`);
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(Object.keys(r.json).sort(), ['healthScore', 'owner', 'ownershipHistory', 'partsReplaced', 'services', 'vehicle', 'vehiclePhotos']);
      assert.deepStrictEqual(forbidden(collectKeys(r.json)).map((k) => k.path), []);
      const raw = r.buf.toString('utf8');
      for (const secret of [seller.email, seller.phone, SECRETS.chassis, SECRETS.chassis.slice(0, 5), SECRETS.engine, SECRETS.rc, SECRETS.ins, SECRETS.storageKey, String(seller._id), '650000']) {
        assert.ok(!raw.includes(secret), `public body leaks ${secret}`);
      }
      assert.deepStrictEqual(r.json.owner, { name: 'Sanjay S.', email: '', phone: '' });
      assert.deepStrictEqual(r.json.services.map((s) => s.garageName).sort(), ['Self', 'Trusted Motors']);
      assert.ok(!r.json.partsReplaced.some((p) => p.partName === 'Fake Turbo'), 'walk-in parts excluded');
      const self = r.json.services.find((s) => s.garageName === 'Self');
      assert.deepStrictEqual([self.verifiedService, self.verificationStatus], [false, 'Pending'], 'owner self-report marked unverified');
      assert.strictEqual(r.json.ownershipHistory[0].ownerName, 'Sanjay S.');
      assert.ok(r.json.vehicle.qrCodeUrl.startsWith('data:image/png;base64,'));
      assert.deepStrictEqual(Object.keys(r.json.vehiclePhotos[0]).sort(), ['_id', 'category', 'createdAt', 'id', 'url']);
    });

    await test('Passport: a stranger\'s token gets the public view; the owner and admin get full detail with walk-ins flagged', async () => {
      const s = await call('GET', `/api/passport/${car._id}`, { token: T.stranger });
      assert.deepStrictEqual(forbidden(collectKeys(s.json)), []);
      const o = await call('GET', `/api/passport/${car._id}`, { token: T.seller });
      assert.strictEqual(o.status, 200);
      assert.strictEqual(o.json.vehicle.chassisNumber, SECRETS.chassis);
      assert.strictEqual(o.json.owner.email, seller.email);
      assert.strictEqual(o.json.owner.name, seller.name);
      const flagged = o.json.services.find((x) => x.garageName === 'Shady Garage');
      assert.deepStrictEqual([flagged.requiresOwnerConfirmation, flagged.verifiedService, flagged.verificationStatus], [true, false, 'Pending']);
      const a = await call('GET', `/api/passport/${car._id}`, { token: T.admin });
      assert.strictEqual(a.json.vehicle.engineNumber, SECRETS.engine);
      const forced = await call('GET', `/api/passport/public/${car._id}`, { token: T.seller });
      assert.deepStrictEqual(forbidden(collectKeys(forced.json)), [], '/public/:id is always the buyer view');
    });

    await test('Passport: QR rendered once and cached with its target; unknown/archived ids 404', async () => {
      const v = await db.collection('vehicles').findOne({ _id: car._id });
      assert.strictEqual(v.qrCodeTarget, `http://localhost:5173/passport/${car._id}`);
      await db.collection('vehicles').updateOne({ _id: car._id }, { $set: { qrCodeUrl: 'data:image/png;base64,CACHED' } });
      assert.strictEqual((await call('GET', `/api/passport/${car._id}`)).json.vehicle.qrCodeUrl, 'data:image/png;base64,CACHED');
      assert.strictEqual((await call('GET', `/api/passport/${new ObjectId()}`)).status, 404);
      assert.strictEqual((await call('GET', '/api/passport/not-a-real-id')).status, 404);
      assert.strictEqual((await call('GET', '/api/passport/pdf/not-an-id')).status, 400);
    });

    await test('Passport PDF: public model redacts; owner model keeps detail; endpoint streams a PDF', async () => {
      const { getPassportService } = require('./src/services/passport');
      const pub = await getPassportService().getPdfModel(null, String(car._id));
      assert.strictEqual(pub.audience, 'public');
      assert.deepStrictEqual([pub.vehicle.chassisNumber, pub.vehicle.engineNumber, pub.owner.email, pub.owner.phone], [null, null, '', '']);
      assert.strictEqual(pub.insurance[0].policyNumber, 'Hidden');
      assert.ok(!pub.services.some((s) => s.unconfirmed));
      const own = await getPassportService().getPdfModel({ id: String(seller._id), role: 'USER' }, String(car._id));
      assert.strictEqual(own.insurance[0].policyNumber, SECRETS.policy);
      assert.strictEqual(own.vehicle.chassisNumber, SECRETS.chassis);
      assert.ok(own.services.some((s) => s.unconfirmed));
      const r = await call('GET', `/api/passport/pdf/${car._id}`);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.headers.get('content-type'), 'application/pdf');
      assert.strictEqual(r.buf.subarray(0, 5).toString(), '%PDF-');
      assert.match(r.headers.get('content-disposition'), /passport_KA01OW0001\.pdf/);
    });

    await test('GET /ownership/history: public hides user ids and shortens names; owner sees both; bad id 400', async () => {
      const pub = await call('GET', `/api/ownership/history/${car._id}`);
      assert.strictEqual(pub.status, 200);
      assert.deepStrictEqual(pub.json.map((h) => [h.ownerId, h.ownerName]), [[null, 'Sanjay S.']]);
      const own = await call('GET', `/api/ownership/history/${car._id}`, { token: T.seller });
      assert.deepStrictEqual(own.json.map((h) => [h.ownerId, h.ownerName]), [[String(seller._id), seller.name]]);
      assert.strictEqual((await call('GET', '/api/ownership/history/xyz')).status, 400);
      const fallback = await call('GET', `/api/ownership/history/${raceCar._id}`);
      assert.strictEqual(fallback.json.length, 1, 'synthetic first entry for legacy vehicles');
    });

    // --- Initiate RBAC ---
    await test('Initiate: stranger cannot transfer the seller\'s vehicle; validation and buyer checks', async () => {
      assert.strictEqual((await initiate(T.stranger, car, buyer.email)).status, 404);
      assert.strictEqual((await initiate(T.seller, car, seller.email)).status, 400);
      assert.strictEqual((await initiate(T.seller, car, 'nobody@driveportz-test.in')).status, 404);
      assert.strictEqual((await initiate(T.seller, car, disabled.email)).status, 404);
      assert.strictEqual((await call('POST', '/api/ownership/transfer', { token: T.seller, body: { vehicleId: String(car._id), buyerEmail: { $ne: '' } } })).status, 400);
      assert.strictEqual((await call('POST', '/api/ownership/transfer', { token: T.seller, body: {} })).status, 400);
      assert.strictEqual((await call('POST', '/api/ownership/transfer', { body: {} })).status, 401);
      assert.strictEqual(await db.collection('transfers').countDocuments({}), 0);
    });

    await test('Initiate: concurrent requests for one vehicle create exactly one pending transfer', async () => {
      const results = await Promise.all([1, 2, 3, 4].map(() => initiate(T.seller, initRaceCar, buyer.email)));
      assert.strictEqual(results.filter((r) => r.status === 201).length, 1, JSON.stringify(results.map((r) => r.status)));
      assert.ok(results.every((r) => r.status === 201 || r.status === 400));
      assert.strictEqual(await db.collection('transfers').countDocuments({ vehicleId: String(initRaceCar._id), status: 'pending' }), 1);
    });

    let carTransferId;
    await test('Initiate by owner: 201 { msg, transferId }; buyer inbox lists it; stranger inbox empty', async () => {
      const r = await initiate(T.seller, car, buyer.email.toUpperCase());
      assert.strictEqual(r.status, 201);
      assert.strictEqual(r.json.msg, 'Transfer request initiated successfully');
      carTransferId = r.json.transferId;
      assert.strictEqual((await initiate(T.seller, car, buyer.email)).status, 400, 'second pending refused');
      const inbox = await call('GET', '/api/ownership/pending', { token: T.buyer });
      const row = inbox.json.find((t) => t.id === carTransferId);
      assert.deepStrictEqual(Object.keys(row).sort(), ['buyerEmail', 'buyerId', 'createdAt', 'id', 'sellerId', 'sellerName', 'vehicle', 'vehicleId']);
      assert.deepStrictEqual(row.vehicle, { brand: 'Maruti', model: 'Swift', year: 2021, vehicleNumber: 'KA01OW0001' });
      assert.deepStrictEqual((await call('GET', '/api/ownership/pending', { token: T.stranger })).json, []);
    });

    await test('Accept/reject/cancel RBAC: only the buyer accepts or rejects, only the seller cancels', async () => {
      assert.strictEqual((await act(T.stranger, 'accept', carTransferId)).status, 403);
      assert.strictEqual((await act(T.seller, 'accept', carTransferId)).status, 403);
      assert.strictEqual((await act(T.stranger, 'reject', carTransferId)).status, 403);
      assert.strictEqual((await act(T.buyer, 'cancel', carTransferId)).status, 403);
      assert.strictEqual((await act(T.buyer, 'accept', 'bad')).status, 400);
      assert.strictEqual((await act(T.buyer, 'accept', new ObjectId())).status, 404);
      assert.strictEqual((await db.collection('transfers').findOne({ _id: new ObjectId(carTransferId) })).status, 'pending');
    });

    await test('Concurrent accepts: exactly one transfer of ownership, one history period, one notification', async () => {
      const results = await Promise.all([1, 2, 3, 4, 5].map(() => act(T.buyer, 'accept', carTransferId)));
      const statuses = results.map((r) => r.status);
      assert.ok(statuses.includes(200), JSON.stringify(statuses));
      assert.ok(statuses.every((s) => s === 200 || s === 409), JSON.stringify(statuses));
      const ok = results.find((r) => r.status === 200);
      assert.deepStrictEqual(ok.json, { msg: 'Ownership transferred successfully' });
      const v = await db.collection('vehicles').findOne({ _id: car._id });
      assert.deepStrictEqual([v.ownerId, v.ownerName, v.phone], [String(buyer._id), buyer.name, buyer.phone]);
      const history = await db.collection('ownershipHistory').find({ vehicleId: String(car._id) }).sort({ fromDate: 1 }).toArray();
      assert.strictEqual(history.length, 2, 'seller period + exactly one buyer period');
      assert.ok(history[0].toDate, 'seller period closed');
      assert.deepStrictEqual([history[1].ownerId, history[1].toDate], [String(buyer._id), null]);
      assert.strictEqual(await db.collection('notifications').countDocuments({ userId: String(seller._id), 'data.type': 'transfer_accepted' }), 1);
      const t = await db.collection('transfers').findOne({ _id: new ObjectId(carTransferId) });
      assert.strictEqual(t.status, 'accepted');
      assert.ok(t.finalizedAt, 'unit of work finalised');
    });

    await test('After accept: records re-pointed, garage authorship kept, diagnoses moved, seller lost access', async () => {
      const g = await db.collection('services').findOne({ _id: garageRecord._id });
      assert.deepStrictEqual([g.ownerId, g.createdBy], [String(buyer._id), String(garageUser._id)], 'garage still owns its record/invoice');
      const d = await db.collection('diagnoses').findOne({ vehicleId: String(car._id) });
      assert.strictEqual(String(d.userId), String(buyer._id));
      assert.strictEqual((await initiate(T.seller, car, stranger.email)).status, 404, 'old owner cannot re-sell');
      const sellerView = await call('GET', `/api/passport/${car._id}`, { token: T.seller });
      assert.strictEqual(sellerView.json.vehicle.chassisNumber, null, 'old owner now gets the public view');
      const buyerView = await call('GET', `/api/passport/${car._id}`, { token: T.buyer });
      assert.strictEqual(buyerView.json.vehicle.chassisNumber, SECRETS.chassis);
    });

    await test('Replay: accepting again is idempotent (200, nothing changes); rejecting it is 404', async () => {
      const before = await db.collection('ownershipHistory').countDocuments({});
      const again = await act(T.buyer, 'accept', carTransferId);
      assert.deepStrictEqual([again.status, again.json.msg], [200, 'Ownership transferred successfully']);
      assert.strictEqual(await db.collection('ownershipHistory').countDocuments({}), before);
      assert.strictEqual(await db.collection('notifications').countDocuments({ 'data.type': 'transfer_accepted' }), 1);
      assert.strictEqual((await act(T.buyer, 'reject', carTransferId)).status, 404);
    });

    await test('Accept vs reject race: exactly one wins and the state is consistent', async () => {
      for (let round = 0; round < 3; round += 1) {
        const vehicle = round === 0 ? raceCar : mkVehicle(`KA01RACE${round}`);
        if (round > 0) await db.collection('vehicles').insertOne(vehicle);
        const { json } = await initiate(T.seller, vehicle, buyer.email);
        const [acc, rej] = await Promise.all([act(T.buyer, 'accept', json.transferId), act(T.buyer, 'reject', json.transferId)]);
        assert.strictEqual([acc.status, rej.status].filter((s) => s === 200).length, 1, `round ${round}: ${acc.status}/${rej.status}`);
        const t = await db.collection('transfers').findOne({ _id: new ObjectId(json.transferId) });
        const v = await db.collection('vehicles').findOne({ _id: vehicle._id });
        if (acc.status === 200) assert.deepStrictEqual([t.status, v.ownerId], ['accepted', String(buyer._id)]);
        else assert.deepStrictEqual([t.status, v.ownerId], ['rejected', String(seller._id)]);
        const open = await db.collection('ownershipHistory').countDocuments({ vehicleId: String(vehicle._id), toDate: null });
        assert.strictEqual(open, acc.status === 200 ? 1 : 0, 'never two open periods');
      }
    });

    await test('Cancel by seller then accept: 200 then 404, vehicle untouched', async () => {
      const { json } = await initiate(T.seller, cancelCar, buyer.email);
      const c = await act(T.seller, 'cancel', json.transferId);
      assert.deepStrictEqual([c.status, c.json.msg], [200, 'Ownership transfer request cancelled']);
      assert.strictEqual((await act(T.buyer, 'accept', json.transferId)).status, 404);
      assert.strictEqual((await db.collection('vehicles').findOne({ _id: cancelCar._id })).ownerId, String(seller._id));
      assert.strictEqual((await db.collection('transfers').findOne({ _id: new ObjectId(json.transferId) })).status, 'cancelled');
    });

    await test('Accept blocked by an open booking (409, transfer stays pending); archived vehicle 404', async () => {
      const { json } = await initiate(T.seller, bookedCar, buyer.email);
      const r = await act(T.buyer, 'accept', json.transferId);
      assert.deepStrictEqual([r.status, r.json.code], [409, 'TRANSFER_OPEN_BOOKINGS']);
      assert.strictEqual((await db.collection('transfers').findOne({ _id: new ObjectId(json.transferId) })).status, 'pending');
      assert.strictEqual((await db.collection('vehicles').findOne({ _id: bookedCar._id })).ownerId, String(seller._id));
      const a = await initiate(T.seller, archivable, buyer.email);
      await db.collection('vehicles').updateOne({ _id: archivable._id }, { $set: { isArchived: true } });
      assert.strictEqual((await act(T.buyer, 'accept', a.json.transferId)).status, 404);
      assert.strictEqual((await db.collection('vehicles').findOne({ _id: archivable._id })).ownerId, String(seller._id));
    });

    await test('Legacy userId-owned vehicle: transfer rewrites userId so the seller keeps no owner access', async () => {
      const { status, json } = await initiate(T.seller, legacyUserIdCar, buyer.email);
      assert.strictEqual(status, 201);
      assert.strictEqual((await act(T.buyer, 'accept', json.transferId)).status, 200);
      const v = await db.collection('vehicles').findOne({ _id: legacyUserIdCar._id });
      assert.deepStrictEqual([v.ownerId, v.userId], [String(buyer._id), String(buyer._id)]);
      const history = await db.collection('ownershipHistory').find({ vehicleId: String(legacyUserIdCar._id) }).sort({ fromDate: 1 }).toArray();
      assert.deepStrictEqual(history.map((h) => [h.ownerId, h.toDate === null]), [[String(seller._id), false], [String(buyer._id), true]], 'seller period preserved for pre-history vehicles');
    });
  } finally {
    server.close();
    await db.dropDatabase();
    await closeMongo();
  }
}

(async () => {
  console.log('🚀 DrivePortz ownership + passport routes suite');
  await pureTests();
  await serviceUnitTests();
  await httpTests();
  console.log(`\n${failed === 0 ? '✅' : '❌'} Ownership + passport routes suite: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('❌ Ownership + passport routes suite crashed:', err);
  process.exit(1);
});
