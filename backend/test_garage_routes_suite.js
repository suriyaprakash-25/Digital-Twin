/**
 * Garage routes suite: services/garages/* (unit, with fake repositories) and /api/garages
 * (HTTP, real Express app + real MongoDB).
 *
 * Plain Node + assert like the other suites. Uses its own database, dropped at the end.
 */
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'garage-suite-secret-key-2026-minimum-32-chars';
process.env.MONGO_DB_NAME = `driveportz_garage_suite_${process.pid}`;
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
    console.error(`  ❌ ${name}\n     ${err && err.stack ? err.stack.split('\n').slice(0, 4).join('\n     ') : err}`);
  }
}

function tokenFor(user) {
  return jwt.sign({ role: user.role, tv: user.tokenVersion || 0 }, process.env.JWT_SECRET_KEY, { subject: String(user._id), expiresIn: '1h', algorithm: 'HS256' });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Fakes ──────────────────────────────────────────────────────────────────

function fakeRepos(overrides = {}) {
  const calls = { setRatingStats: [], setFields: [], create: [], updateOwned: [], deleted: [], pulled: [] };
  const repos = {
    garages: {
      findByOwner: async () => null,
      findByObjectId: async () => null,
      setFields: async (id, fields) => { calls.setFields.push({ id, fields }); return { matchedCount: 1 }; },
      create: async (doc) => { calls.create.push(doc); return { insertedId: new ObjectId() }; },
      setFieldsByOwner: async () => null,
      pushGalleryPhotos: async () => null,
      pullGalleryPhoto: async (id, url) => { calls.pulled.push(url); return null; },
      setRatingStats: async (id, stats, opts) => { calls.setRatingStats.push({ id, stats, opts }); },
      ...overrides.garages,
    },
    garageServices: {
      listForGarage: async () => [],
      listPublicForGarage: async () => [],
      create: async () => ({ insertedId: new ObjectId() }),
      updateOwned: async (serviceId, garageId, fields) => { calls.updateOwned.push({ serviceId, garageId, fields }); return 0; },
      archiveOwned: async () => 0,
      ...overrides.garageServices,
    },
    reviews: {
      ratingSummary: async () => ({ count: 0, average: null, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } }),
      listPageForGarage: async (garageId, page) => ({ items: [], total: 0, page: page.page, limit: page.limit }),
      reviewedBookingIds: async () => new Set(),
      existsForBooking: async () => false,
      create: async (doc) => { calls.create.push(doc); return { insertedId: new ObjectId() }; },
      findInGarage: async () => null,
      findByObjectId: async () => null,
      setReply: async () => {},
      deleteByObjectId: async (id) => { calls.deleted.push(id); },
      ...overrides.reviews,
    },
    bookings: { find: async () => [], findOne: async () => null, ...overrides.bookings },
    users: { findById: async () => null, ...overrides.users },
  };
  return { repos, calls };
}

function fakeStorage() {
  const log = { persisted: [], deleted: [], removedTemp: [] };
  return {
    log,
    persistUploadedFiles: async (files) => files.map((f, i) => { const a = { url: `/uploads/new-${i}.jpg` }; log.persisted.push(a); return a; }),
    persistUploadedFile: async () => ({ url: '/uploads/logo.jpg' }),
    deletePersistedFile: async (asset) => { log.deleted.push(asset); },
    removeTemporaryFile: (file) => { log.removedTemp.push(file); },
  };
}

async function expectStatus(promise, status, messagePattern) {
  await assert.rejects(promise, (err) => {
    assert.strictEqual(err.status, status, `expected status ${status}, got ${err.status} (${err.message})`);
    if (messagePattern) assert.match(err.message, messagePattern);
    return true;
  });
}

// ─── Unit tests ─────────────────────────────────────────────────────────────

async function unitTests() {
  console.log('\n— Unit: garage services with fake repositories —');
  const { summarizeRatingBuckets } = require('./src/repositories/ReviewRepository');
  const { createGarageReviewService } = require('./src/services/garages/garageReviewService');
  const { createGarageCatalogService } = require('./src/services/garages/garageCatalogService');
  const { createGarageProfileService } = require('./src/services/garages/garageProfileService');
  const { createGaragePublicService, detailCacheKey } = require('./src/services/garages/garagePublicService');
  const { MemoryCacheProvider } = require('./src/infrastructure/cache/cache');

  const garageId = new ObjectId();
  const customer = { id: String(new ObjectId()), name: 'Cust' };

  await test('summarizeRatingBuckets folds aggregation buckets into average/count/distribution', () => {
    const empty = summarizeRatingBuckets([]);
    assert.deepStrictEqual(empty, { count: 0, average: null, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
    const s = summarizeRatingBuckets([{ _id: 5, count: 2, sum: 10 }, { _id: 4, count: 3, sum: 11.6 }, { _id: 2, count: 1, sum: 2 }]);
    assert.strictEqual(s.count, 6);
    assert.strictEqual(s.average, 3.9);
    assert.deepStrictEqual(s.distribution, { 5: 2, 4: 3, 3: 0, 2: 1, 1: 0 });
  });

  await test('createReview: 403 without a COMPLETED booking owned by the caller', async () => {
    const { repos } = fakeRepos();
    const svc = createGarageReviewService({ repos });
    await expectStatus(svc.createReview(String(garageId), customer, { rating: 5, reviewMessage: 'x'.repeat(25) }), 403, /completed service booking/);
  });

  await test('createReview: input validation runs before eligibility (400s keep their messages)', async () => {
    const { repos } = fakeRepos();
    const svc = createGarageReviewService({ repos });
    await expectStatus(svc.createReview('not-an-id', customer, {}), 400, /Invalid Garage ID/);
    await expectStatus(svc.createReview(String(garageId), customer, { rating: 9, reviewMessage: 'x'.repeat(25) }), 400, /Rating is required/);
    await expectStatus(svc.createReview(String(garageId), customer, { rating: 4, reviewMessage: 'too short' }), 400, /at least 20/);
    await expectStatus(svc.createReview(String(garageId), customer, { rating: 4, reviewMessage: 'x'.repeat(1001) }), 400, /cannot exceed 1000/);
  });

  await test('createReview: an already-reviewed booking is rejected as a duplicate (with and without bookingId)', async () => {
    const booking = { _id: new ObjectId(), status: 'COMPLETED' };
    const { repos } = fakeRepos({
      bookings: { find: async () => [booking], findOne: async () => booking },
      reviews: { existsForBooking: async () => true, reviewedBookingIds: async () => new Set([String(booking._id)]) },
    });
    const svc = createGarageReviewService({ repos });
    const body = { rating: 5, reviewMessage: 'x'.repeat(25) };
    await expectStatus(svc.createReview(String(garageId), customer, { ...body, bookingId: String(booking._id) }), 400, /already submitted/);
    await expectStatus(svc.createReview(String(garageId), customer, body), 400, /already submitted/);
  });

  await test('createReview: attaches the unreviewed booking, maps E11000 to duplicate, refreshes garage stats', async () => {
    const reviewedBooking = { _id: new ObjectId() };
    const freshBooking = { _id: new ObjectId(), snapshots: { service: { title: 'Oil change' }, vehicle: { brand: 'Tata', model: 'Nexon' } } };
    let bookingFilter = null;
    const { repos, calls } = fakeRepos({
      bookings: { find: async (filter) => { bookingFilter = filter; return [reviewedBooking, freshBooking]; } },
      reviews: {
        reviewedBookingIds: async () => new Set([String(reviewedBooking._id)]),
        ratingSummary: async () => ({ count: 3, average: 4.3, distribution: {} }),
      },
      users: { findById: async () => ({ name: 'Stored Name', photoUrl: 'p.jpg' }) },
    });
    const svc = createGarageReviewService({ repos });
    const result = await svc.createReview(String(garageId), customer, { rating: '4', reviewMessage: '  Great service, very quick and tidy.  ', reviewTitle: 'T'.repeat(200) });
    const saved = calls.create[0];
    assert.strictEqual(String(saved.bookingId), String(freshBooking._id), 'unreviewed booking chosen');
    assert.strictEqual(saved.serviceName, 'Oil change');
    assert.strictEqual(saved.vehicleModel, 'Tata Nexon');
    assert.strictEqual(saved.userName, 'Stored Name');
    assert.strictEqual(saved.reviewTitle.length, 150);
    assert.strictEqual(saved.reviewMessage, 'Great service, very quick and tidy.');
    assert.deepStrictEqual(bookingFilter.status, 'COMPLETED');
    assert.strictEqual(bookingFilter.garageId.$in.length, 2, 'garageId matched as ObjectId and string');
    assert.strictEqual(result.averageRating, 4.3);
    assert.strictEqual(result.totalReviews, 3);
    assert.deepStrictEqual(calls.setRatingStats[0].stats, { rating: 4.3, reviewCount: 3 });

    const race = fakeRepos({
      bookings: { find: async () => [freshBooking] },
      reviews: { create: async () => { throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 }); } },
    });
    await expectStatus(createGarageReviewService({ repos: race.repos }).createReview(String(garageId), customer, { rating: 5, reviewMessage: 'x'.repeat(25) }), 400, /already submitted/);
  });

  await test('listReviews: pagination + sort whitelist + eligibility excludes reviewed bookings', async () => {
    const b1 = { _id: new ObjectId(), createdAt: new Date() };
    const b2 = { _id: new ObjectId() };
    let seen = null;
    const { repos } = fakeRepos({
      bookings: { find: async () => [b1, b2] },
      reviews: {
        reviewedBookingIds: async () => new Set([String(b1._id)]),
        listPageForGarage: async (gid, page, sort) => { seen = { page, sort }; return { items: [{ _id: new ObjectId(), garageId: gid, userId: 'u1' }], total: 7 }; },
        ratingSummary: async () => ({ count: 7, average: 4.1, distribution: { 5: 3, 4: 2, 3: 1, 2: 1, 1: 0 } }),
      },
    });
    const svc = createGarageReviewService({ repos });
    const { body, pagination } = await svc.listReviews(String(garageId), { page: '2', limit: '3', sort: '__proto__' }, { id: customer.id });
    assert.deepStrictEqual(seen.page, { page: 2, limit: 3, skip: 3 });
    assert.deepStrictEqual(seen.sort, { createdAt: -1, _id: -1 }, 'unknown sort falls back to newest');
    assert.deepStrictEqual(pagination, { total: 7, page: 2, limit: 3 });
    assert.strictEqual(body.totalReviews, 7);
    assert.strictEqual(body.averageRating, 4.1);
    assert.strictEqual(body.userCanReview, true);
    assert.deepStrictEqual(body.completedBookings.map((b) => b.id), [String(b2._id)]);
    assert.strictEqual(body.reviews[0].rating, 5, 'missing rating shown as 5');
    assert.deepStrictEqual(Object.keys(body), ['averageRating', 'totalReviews', 'ratingDistribution', 'userCanReview', 'completedBookings', 'reviews']);

    const anon = await svc.listReviews(String(garageId), { sort: 'rating_low' }, null);
    assert.deepStrictEqual(seen.sort, { rating: 1, createdAt: -1, _id: -1 });
    assert.strictEqual(seen.page.limit, 200, 'default page keeps the old "all reviews" behaviour for pilot sizes');
    assert.strictEqual(anon.body.userCanReview, false);
  });

  await test('deleteReview recomputes stats without touching updatedAt; bad id is 404', async () => {
    const review = { _id: new ObjectId(), garageId };
    const { repos, calls } = fakeRepos({ reviews: { findByObjectId: async () => review } });
    const svc = createGarageReviewService({ repos });
    await svc.deleteReview(String(review._id));
    assert.strictEqual(calls.deleted.length, 1);
    assert.deepStrictEqual(calls.setRatingStats[0].stats, { rating: 4.8, reviewCount: 0 }, 'no reviews left: default rating');
    assert.strictEqual(calls.setRatingStats[0].opts.touchUpdatedAt, false);
    await expectStatus(svc.deleteReview('garbage'), 404, /Review not found/);
  });

  await test('Catalog: ownership is part of the update filter; invalid ids are 404, missing profile 400', async () => {
    const garage = { _id: new ObjectId() };
    const { repos, calls } = fakeRepos({ garages: { findByOwner: async () => garage } });
    const svc = createGarageCatalogService({ repos });
    await expectStatus(svc.updateMine('u', String(new ObjectId()), { title: 'x' }), 404, /Service not found/);
    assert.strictEqual(String(calls.updateOwned[0].garageId), String(garage._id));
    await expectStatus(svc.updateMine('u', 'not-an-object-id', {}), 404, /Service not found/);
    await expectStatus(svc.archiveMine('u', 'nope'), 404);
    const noGarage = createGarageCatalogService({ repos: fakeRepos().repos });
    await expectStatus(noGarage.listMine('u'), 400, /Create your garage profile first/);
    await expectStatus(noGarage.createMine('u', {}), 400, /Service title is required/);
    await expectStatus(noGarage.listPublic('bad'), 400, /Invalid Garage ID/);
  });

  await test('Profile: update never sets isActive; insert does; gallery limited to own photos', async () => {
    const existing = { _id: new ObjectId(), isActive: false, maxCapacity: 12, galleryPhotos: ['/uploads/a.jpg', '/uploads/b.jpg'] };
    const { repos, calls } = fakeRepos({ garages: { findByOwner: async () => existing } });
    const svc = createGarageProfileService({ repos, storage: fakeStorage() });
    const r = await svc.saveMyProfile('owner1', { name: 'G', maxCapacity: 'abc', galleryPhotos: ['/uploads/b.jpg', 'https://evil.example/x.jpg', ''] });
    assert.deepStrictEqual(r, { created: false, id: String(existing._id) });
    const fields = calls.setFields[0].fields;
    assert.ok(!('isActive' in fields), 'isActive not written on update');
    assert.strictEqual(fields.maxCapacity, 12, 'invalid capacity keeps the stored value');
    assert.deepStrictEqual(fields.galleryPhotos, ['/uploads/b.jpg']);
    await svc.saveMyProfile('owner1', { name: 'G' });
    assert.ok(!('galleryPhotos' in calls.setFields[1].fields), 'omitted gallery left unchanged');

    const fresh = fakeRepos();
    const created = await createGarageProfileService({ repos: fresh.repos, storage: fakeStorage() }).saveMyProfile('owner2', { name: 'New', galleryPhotos: ['/uploads/x.jpg'] });
    assert.strictEqual(created.created, true);
    assert.strictEqual(fresh.calls.create[0].isActive, true);
    assert.strictEqual(fresh.calls.create[0].maxCapacity, 20);
    assert.deepStrictEqual(fresh.calls.create[0].galleryPhotos, []);
    await expectStatus(createGarageProfileService({ repos: fresh.repos, storage: fakeStorage() }).saveMyProfile('o', {}), 400, /name is required/);
  });

  await test('Profile: removing a URL outside the caller gallery never deletes the file', async () => {
    const garage = { _id: new ObjectId(), galleryPhotos: ['/uploads/mine.jpg'] };
    const storage = fakeStorage();
    const { repos, calls } = fakeRepos({ garages: { findByOwner: async () => garage } });
    const svc = createGarageProfileService({ repos, storage });
    const foreign = await svc.removeGalleryPhoto('o', '/uploads/someone-else.jpg');
    assert.deepStrictEqual(foreign.galleryPhotos, ['/uploads/mine.jpg']);
    assert.strictEqual(storage.log.deleted.length, 0);
    const own = await svc.removeGalleryPhoto('o', '/uploads/mine.jpg');
    assert.deepStrictEqual(own.galleryPhotos, []);
    assert.deepStrictEqual(calls.pulled, ['/uploads/mine.jpg']);
    assert.deepStrictEqual(storage.log.deleted, [{ url: '/uploads/mine.jpg' }]);
  });

  await test('Profile: gallery upload without a profile cleans temp files and is 404', async () => {
    const storage = fakeStorage();
    const svc = createGarageProfileService({ repos: fakeRepos().repos, storage });
    const files = [{ path: '/tmp/a' }, { path: '/tmp/b' }];
    await expectStatus(svc.addGalleryPhotos('o', files), 404, /Garage profile not found/);
    assert.strictEqual(storage.log.removedTemp.length, 2);
    assert.strictEqual(storage.log.persisted.length, 0);
  });

  await test('Public details: cached snapshot (plain data), live status per request, misses not cached', async () => {
    const garage = { _id: garageId, name: 'Cached Garage', ownerUserId: 'o1', createdAt: new Date('2025-03-01'), availabilityMode: 'MANUAL', manualStatus: 'BUSY' };
    let loads = 0;
    let ownerLookups = 0;
    const { repos } = fakeRepos({
      garages: { findByObjectId: async (id) => { loads += 1; return String(id) === String(garageId) ? garage : null; } },
      garageServices: { listPublicForGarage: async () => [{ _id: new ObjectId(), garageId, title: 'Wash', price: '250' }] },
      reviews: { ratingSummary: async () => ({ count: 2, average: 4.5, distribution: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 } }) },
      users: { findById: async () => { ownerLookups += 1; return { email: 'owner@example.test' }; } },
    });
    let statusCalls = 0;
    const cache = new MemoryCacheProvider();
    const svc = createGaragePublicService({ repos, cache, availability: { calculateCurrentStatus: (g) => { statusCalls += 1; return g.manualStatus; }, getCurrentTimeString: () => 'now' } });
    const first = await svc.getDetails(String(garageId));
    const second = await svc.getDetails(String(garageId));
    assert.strictEqual(loads, 1, 'second read served from cache');
    assert.strictEqual(ownerLookups, 1);
    assert.strictEqual(statusCalls, 2, 'status computed on every request');
    assert.deepStrictEqual(first, second);
    assert.strictEqual(first.currentStatus, 'BUSY');
    assert.strictEqual(first.rating, 4.5);
    assert.strictEqual(first.reviewCount, 2);
    assert.strictEqual(first.partnerSince, 2025);
    assert.strictEqual(first.email, 'owner@example.test');
    assert.strictEqual(first.services[0].price, 250);
    assert.ok(!('availability' in first), 'internal snapshot fields not leaked');
    const raw = await cache.get(detailCacheKey(garageId));
    const hasObjectId = (v) => v instanceof ObjectId || (v && typeof v === 'object' && Object.values(v).some(hasObjectId));
    assert.ok(!hasObjectId(raw), 'cache value is plain data');
    const missing = String(new ObjectId());
    await expectStatus(svc.getDetails(missing), 404, /Garage profile not found/);
    assert.strictEqual(await cache.get(detailCacheKey(missing)), undefined, '404 is not cached');
    await expectStatus(svc.getDetails('xyz'), 400, /Invalid Garage ID/);
  });
}

// ─── HTTP tests ─────────────────────────────────────────────────────────────

async function httpTests() {
  const { loadConfig } = require('./src/config');
  const { connectToMongo, getDb, closeMongo } = require('./src/db');
  await connectToMongo(loadConfig());
  const db = getDb();
  assert.ok(db.databaseName.startsWith('driveportz_garage_suite_'), 'suite must use its own database');
  await db.dropDatabase();
  await require('./src/models/CoreIndexes').ensureCoreIndexes(db);
  await require('./src/services/garages').ensureGarageIndexes(db);

  const { MemoryCacheProvider, setCache } = require('./src/infrastructure/cache/cache');
  const cache = new MemoryCacheProvider();
  setCache(cache);

  const mkUser = (role, name) => ({ _id: new ObjectId(), name, email: `${name.toLowerCase()}-${process.pid}@driveportz-test.in`, role, tokenVersion: 0 });
  const ownerA = mkUser('GARAGE', 'OwnerA');
  const ownerB = mkUser('GARAGE', 'OwnerB');
  const customer = mkUser('USER', 'Customer');
  const stranger = mkUser('USER', 'Stranger');
  const admin = mkUser('ADMIN', 'Admin');
  await db.collection('users').insertMany([ownerA, ownerB, customer, stranger, admin]);

  console.log('\n— HTTP: /api/garages (real Express app + MongoDB) —');
  const { buildApp } = require('./server');
  const server = buildApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, urlPath, { body, user } = {}) => {
    const res = await fetch(base + urlPath, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, headers: res.headers };
  };

  const uploadsDir = path.join(__dirname, 'uploads');
  const decoyName = `garage-suite-decoy-${process.pid}.txt`;
  const decoyPath = path.join(uploadsDir, decoyName);

  let garageAId;
  let garageBId;
  let serviceId;
  let reviewId;
  try {
    await test('POST /me creates (201) then updates (200); GET /me returns the profile', async () => {
      const created = await call('POST', '/api/garages/me', { user: ownerA, body: { name: 'Garage A', city: 'Chennai', maxCapacity: 8 } });
      assert.strictEqual(created.status, 201);
      assert.strictEqual(created.json.msg, 'Garage profile created');
      garageAId = created.json.id;
      const updated = await call('POST', '/api/garages/me', { user: ownerA, body: { name: 'Garage A+', city: 'Chennai', maxCapacity: 8 } });
      assert.deepStrictEqual(updated.json, { msg: 'Garage profile updated', id: garageAId });
      const me = await call('GET', '/api/garages/me', { user: ownerA });
      assert.strictEqual(me.status, 200);
      assert.strictEqual(me.json.exists, true);
      assert.strictEqual(me.json.name, 'Garage A+');
      assert.strictEqual(me.json.isActive, true);
      assert.strictEqual(me.json.maxCapacity, 8);
      const b = await call('POST', '/api/garages/me', { user: ownerB, body: { name: 'Garage B' } });
      garageBId = b.json.id;
      assert.strictEqual((await call('POST', '/api/garages/me', { user: ownerA, body: {} })).status, 400);
      assert.strictEqual((await call('GET', '/api/garages/me', { user: customer })).status, 403, 'non-garage role forbidden');
    });

    await test('POST /me by a suspended garage keeps isActive:false', async () => {
      await db.collection('garages').updateOne({ _id: new ObjectId(garageBId) }, { $set: { isActive: false } });
      const r = await call('POST', '/api/garages/me', { user: ownerB, body: { name: 'Garage B renamed' } });
      assert.strictEqual(r.status, 200);
      const doc = await db.collection('garages').findOne({ _id: new ObjectId(garageBId) });
      assert.strictEqual(doc.isActive, false, 'suspension preserved');
      assert.strictEqual(doc.name, 'Garage B renamed');
      assert.deepStrictEqual((await call('GET', '/api/garages/me', { user: ownerB })).json, { exists: false });
      assert.strictEqual((await call('GET', `/api/garages/details/${garageBId}`)).status, 404, 'suspended garage hidden publicly');
      await db.collection('garages').updateOne({ _id: new ObjectId(garageBId) }, { $set: { isActive: true } });
    });

    await test('Gallery: cannot plant foreign URLs, and DELETE /gallery never deletes files outside own gallery', async () => {
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(decoyPath, 'not yours');
      const planted = await call('POST', '/api/garages/me', { user: ownerA, body: { name: 'Garage A+', galleryPhotos: [`/uploads/${decoyName}`] } });
      assert.strictEqual(planted.status, 200);
      const doc = await db.collection('garages').findOne({ _id: new ObjectId(garageAId) });
      assert.deepStrictEqual(doc.galleryPhotos, [], 'foreign URL dropped');
      const del = await call('DELETE', '/api/garages/gallery', { user: ownerA, body: { photoUrl: `/uploads/${decoyName}` } });
      assert.strictEqual(del.status, 200);
      assert.deepStrictEqual(del.json, { msg: 'Photo removed', galleryPhotos: [] });
      await sleep(150); // local deletion is asynchronous
      assert.ok(fs.existsSync(decoyPath), 'file outside the garage gallery survives');
      assert.strictEqual((await call('DELETE', '/api/garages/gallery', { user: ownerA, body: {} })).status, 400);
    });

    await test('Capacity and location endpoints validate and persist', async () => {
      assert.strictEqual((await call('PATCH', '/api/garages/me/capacity', { user: ownerA, body: { maxCapacity: 0 } })).status, 400);
      const cap = await call('PATCH', '/api/garages/me/capacity', { user: ownerA, body: { maxCapacity: 15 } });
      assert.deepStrictEqual(cap.json, { msg: 'Capacity updated successfully', maxCapacity: 15 });
      assert.strictEqual((await call('POST', '/api/garages/location', { user: ownerA, body: { latitude: 91, longitude: 0 } })).status, 400);
      const loc = await call('POST', '/api/garages/location', { user: ownerA, body: { latitude: '13.08', longitude: '80.27', address: 'Anna Salai' } });
      assert.strictEqual(loc.status, 200);
      const doc = await db.collection('garages').findOne({ _id: new ObjectId(garageAId) });
      assert.deepStrictEqual(doc.garageLocation, { latitude: 13.08, longitude: 80.27, address: 'Anna Salai' });
      assert.strictEqual(doc.maxCapacity, 15);
    });

    await test('Catalogue CRUD: garage B cannot edit or delete garage A services', async () => {
      const created = await call('POST', '/api/garages/me/services', { user: ownerA, body: { title: 'Full service', price: '1500', durationMins: 90 } });
      assert.strictEqual(created.status, 201);
      assert.strictEqual(created.json.msg, 'Service created');
      serviceId = created.json.id;
      const hijack = await call('PUT', `/api/garages/me/services/${serviceId}`, { user: ownerB, body: { price: 1 } });
      assert.deepStrictEqual([hijack.status, hijack.json], [404, { msg: 'Service not found' }]);
      assert.strictEqual((await call('DELETE', `/api/garages/me/services/${serviceId}`, { user: ownerB })).status, 404);
      const stored = await db.collection('garageServices').findOne({ _id: new ObjectId(serviceId) });
      assert.strictEqual(stored.price, 1500, 'untouched by garage B');
      assert.strictEqual(stored.isArchived, false);
      assert.strictEqual((await call('PUT', '/api/garages/me/services/not-an-id', { user: ownerA, body: {} })).status, 404, 'invalid id is 404, not 500');
      const own = await call('PUT', `/api/garages/me/services/${serviceId}`, { user: ownerA, body: { price: 1800, category: 'Periodic' } });
      assert.deepStrictEqual(own.json, { msg: 'Service updated' });
      const list = await call('GET', '/api/garages/me/services', { user: ownerA });
      assert.strictEqual(list.json.length, 1);
      assert.strictEqual(list.json[0].price, 1800);
      assert.strictEqual(list.json[0].category, 'Periodic');
      const pub = await call('GET', `/api/garages/${garageAId}/services`);
      assert.strictEqual(pub.json[0].price, 1800);
      assert.strictEqual((await call('GET', '/api/garages/zzz/services')).status, 400);
      const temp = await call('POST', '/api/garages/me/services', { user: ownerA, body: { title: 'Temp' } });
      assert.deepStrictEqual((await call('DELETE', `/api/garages/me/services/${temp.json.id}`, { user: ownerA })).json, { msg: 'Service removed' });
      assert.strictEqual((await call('GET', '/api/garages/me/services', { user: ownerA })).json.length, 1, 'archived service hidden');
    });

    const garageAObj = () => new ObjectId(garageAId);
    const completedBooking = { _id: new ObjectId(), garageId: '', userId: String(customer._id), status: 'COMPLETED', createdAt: new Date(), snapshots: { service: { title: 'Full service' }, vehicle: { brand: 'Maruti', model: 'Swift' } } };
    const message = 'Excellent work, finished on time and explained everything.';

    await test('Reviews: only customers with a COMPLETED booking they own can review', async () => {
      completedBooking.garageId = garageAId; // legacy string garageId must still match
      const pendingBooking = { _id: new ObjectId(), garageId: garageAObj(), userId: String(stranger._id), status: 'ACCEPTED', createdAt: new Date() };
      await db.collection('bookings').insertMany([completedBooking, pendingBooking]);

      const anon = await call('GET', `/api/garages/${garageAId}/reviews`);
      assert.strictEqual(anon.json.userCanReview, false);
      const elig = await call('GET', `/api/garages/${garageAId}/reviews`, { user: customer });
      assert.strictEqual(elig.json.userCanReview, true);
      assert.deepStrictEqual(elig.json.completedBookings.map((b) => b.id), [String(completedBooking._id)]);

      const noBooking = await call('POST', `/api/garages/${garageAId}/reviews`, { user: stranger, body: { rating: 5, reviewMessage: message } });
      assert.strictEqual(noBooking.status, 403, 'ACCEPTED booking is not enough');
      const stolen = await call('POST', `/api/garages/${garageAId}/reviews`, { user: stranger, body: { rating: 5, reviewMessage: message, bookingId: String(completedBooking._id) } });
      assert.strictEqual(stolen.status, 403, "another user's booking cannot be used");
      const otherGarage = await call('POST', `/api/garages/${garageBId}/reviews`, { user: customer, body: { rating: 1, reviewMessage: message } });
      assert.strictEqual(otherGarage.status, 403, 'booking at garage A does not allow reviewing garage B');

      const ok = await call('POST', `/api/garages/${garageAId}/reviews`, { user: customer, body: { rating: 4, reviewTitle: 'Good', reviewMessage: message, bookingId: String(completedBooking._id) } });
      assert.strictEqual(ok.status, 201);
      assert.strictEqual(ok.json.msg, 'Review submitted successfully!');
      assert.strictEqual(ok.json.review.bookingId, String(completedBooking._id));
      assert.strictEqual(ok.json.review.userName, 'Customer');
      assert.strictEqual(ok.json.review.vehicleModel, 'Maruti Swift');
      assert.strictEqual(ok.json.averageRating, 4);
      assert.strictEqual(ok.json.totalReviews, 1);
      reviewId = ok.json.review.id;
    });

    await test('Reviews: no duplicate review per booking (API and unique index)', async () => {
      const again = await call('POST', `/api/garages/${garageAId}/reviews`, { user: customer, body: { rating: 5, reviewMessage: message, bookingId: String(completedBooking._id) } });
      assert.deepStrictEqual([again.status, again.json.msg], [400, 'You have already submitted a review for this service booking.']);
      const noId = await call('POST', `/api/garages/${garageAId}/reviews`, { user: customer, body: { rating: 5, reviewMessage: message } });
      assert.strictEqual(noId.status, 400, 'omitting bookingId does not bypass the duplicate check');
      const elig = await call('GET', `/api/garages/${garageAId}/reviews`, { user: customer });
      assert.strictEqual(elig.json.userCanReview, false, 'no unreviewed completed booking left');
      assert.strictEqual(await db.collection('reviews').countDocuments({ bookingId: completedBooking._id }), 1);
      await assert.rejects(db.collection('reviews').insertOne({ garageId: garageAObj(), bookingId: completedBooking._id, rating: 1 }), (err) => err.code === 11000);
    });

    await test('Rating summary: aggregation matches the legacy semantics and updates garage stats', async () => {
      const seed = [5, 4, 2, undefined, 3.6].map((rating, i) => ({
        garageId: garageAObj(), userId: `legacy-${i}`, reviewMessage: 'Seeded legacy review text', createdAt: new Date(Date.now() - (i + 1) * 60000), ...(rating === undefined ? {} : { rating }),
      }));
      await db.collection('reviews').insertMany(seed);
      // Ratings now: 4 (API), 5, 4, 2, missing(=5), 3.6 → sum 23.6 / 6 = 3.93 → 3.9
      const r = await call('GET', `/api/garages/${garageAId}/reviews`);
      assert.strictEqual(r.json.totalReviews, 6);
      assert.strictEqual(r.json.averageRating, 3.9);
      assert.deepStrictEqual(r.json.ratingDistribution, { 1: 0, 2: 1, 3: 0, 4: 3, 5: 2 });
      const details = await call('GET', `/api/garages/details/${garageAId}`);
      assert.strictEqual(details.json.rating, 3.9);
      assert.strictEqual(details.json.reviewCount, 6);
      assert.deepStrictEqual(details.json.ratingDistribution, r.json.ratingDistribution);
      const stats = await db.collection('garages').findOne({ _id: garageAObj() });
      assert.deepStrictEqual([stats.rating, stats.reviewCount], [4, 1], 'stats were refreshed at review creation (before seeding)');
    });

    await test('Reviews: pagination headers, bounded page, body shape unchanged', async () => {
      const r = await call('GET', `/api/garages/${garageAId}/reviews?page=2&limit=4&sort=rating_high`);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.headers.get('x-total-count'), '6');
      assert.strictEqual(r.headers.get('x-page'), '2');
      assert.strictEqual(r.headers.get('x-limit'), '4');
      assert.strictEqual(r.headers.get('x-total-pages'), '2');
      assert.strictEqual(r.json.reviews.length, 2);
      assert.strictEqual(r.json.totalReviews, 6, 'summary covers all reviews, not just the page');
      // rating_high: 5, 4, 4, 3.6 | 2, <missing> (Mongo sorts a missing rating last; it is displayed as 5).
      assert.deepStrictEqual(r.json.reviews.map((x) => x.rating), [2, 5], 'second page of rating_high order');
      assert.deepStrictEqual(Object.keys(r.json), ['averageRating', 'totalReviews', 'ratingDistribution', 'userCanReview', 'completedBookings', 'reviews']);
      const all = await call('GET', `/api/garages/${garageAId}/reviews`);
      assert.strictEqual(all.json.reviews.length, 6, 'default page returns everything for small garages');
      assert.strictEqual(all.headers.get('x-limit'), '200');
      assert.strictEqual((await call('GET', '/api/garages/bad-id/reviews')).status, 400);
    });

    await test('Reply: only the owning garage can reply; admin delete recomputes stats', async () => {
      const short = await call('POST', `/api/garages/${garageAId}/reviews/${reviewId}/reply`, { user: ownerA, body: { replyMessage: 'ok' } });
      assert.strictEqual(short.status, 400);
      const foreign = await call('POST', `/api/garages/${garageAId}/reviews/${reviewId}/reply`, { user: ownerB, body: { replyMessage: 'Thanks a lot!' } });
      assert.strictEqual(foreign.status, 404, "garage B cannot reply to garage A's review");
      const reply = await call('POST', `/api/garages/${garageAId}/reviews/${reviewId}/reply`, { user: ownerA, body: { replyMessage: '  Thanks a lot!  ' } });
      assert.strictEqual(reply.status, 200);
      assert.strictEqual(reply.json.reply.replyMessage, 'Thanks a lot!');
      assert.strictEqual((await call('DELETE', `/api/garages/${garageAId}/reviews/${reviewId}`, { user: ownerA })).status, 403, 'admin only');
      assert.strictEqual((await call('DELETE', `/api/garages/${garageAId}/reviews/not-an-id`, { user: admin })).status, 404);
      const del = await call('DELETE', `/api/garages/${garageAId}/reviews/${reviewId}`, { user: admin });
      assert.deepStrictEqual(del.json, { msg: 'Review deleted by admin' });
      const stats = await db.collection('garages').findOne({ _id: garageAObj() });
      assert.deepStrictEqual([stats.rating, stats.reviewCount], [3.9, 5], '(5+4+2+5+3.6)/5 = 3.92 over the remaining 5 reviews');
    });

    await test('Details cache: hit serves the snapshot, a write on the router invalidates it', async () => {
      await cache.clear();
      const first = await call('GET', `/api/garages/details/${garageAId}`);
      assert.strictEqual(first.json.name, 'Garage A+');
      assert.ok(typeof first.json.currentStatus === 'string' && typeof first.json.currentTime === 'string');
      await db.collection('garages').updateOne({ _id: garageAObj() }, { $set: { name: 'Renamed behind the cache' } });
      const hit = await call('GET', `/api/garages/details/${garageAId}`);
      assert.strictEqual(hit.json.name, 'Garage A+', 'served from cache');
      const write = await call('PATCH', '/api/garages/me/capacity', { user: ownerA, body: { maxCapacity: 16 } });
      assert.strictEqual(write.status, 200);
      await sleep(20); // invalidation runs on response 'finish'
      const fresh = await call('GET', `/api/garages/details/${garageAId}`);
      assert.strictEqual(fresh.json.name, 'Renamed behind the cache', 'cache invalidated by the write');
      assert.strictEqual(fresh.json.maxCapacity, 16);
      assert.strictEqual((await call('GET', '/api/garages/details/nope')).status, 400);
    });

    await test('Public gallery endpoint: 400 on bad id, 404 when missing', async () => {
      assert.deepStrictEqual((await call('GET', `/api/garages/${garageAId}/gallery`)).json, { galleryPhotos: [] });
      assert.strictEqual((await call('GET', '/api/garages/bad/gallery')).status, 400);
      assert.strictEqual((await call('GET', `/api/garages/${new ObjectId()}/gallery`)).status, 404);
    });
  } finally {
    server.close();
    try { fs.unlinkSync(decoyPath); } catch { /* already gone */ }
    await db.dropDatabase();
    await closeMongo();
  }
}

(async () => {
  console.log('🚀 DrivePortz garage routes suite');
  await unitTests();
  await httpTests();
  console.log(`\n${failed === 0 ? '✅' : '❌'} Garage routes suite: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('❌ Garage routes suite crashed:', err);
  process.exit(1);
});
