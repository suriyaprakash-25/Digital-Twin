const { MongoClient, ObjectId } = require('mongodb');
const { loadConfig } = require('../src/config');

const EXECUTE = process.argv.includes('--execute');
const SAFE_CONFIRM = process.env.PILOT_CLEANUP_CONFIRM === 'DELETE_TAGGED_PILOT_DATA';
const BACKUP_CONFIRMED = process.env.PILOT_BACKUP_CONFIRMED === 'YES';

const DEMO_EMAIL_DOMAINS = new Set([
  'example.com',
  'test.com',
  'tempmail.com',
  'yopmail.com',
  'mailinator.com'
]);

function isHeuristicDemoUser(user = {}) {
  const email = String(user.email || '').trim().toLowerCase();
  const domain = email.split('@')[1] || '';
  const name = String(user.name || '');
  return DEMO_EMAIL_DOMAINS.has(domain) ||
    /(^|[+._-])(demo|test|sample)([+._-]|@|$)/i.test(email) ||
    /\b(demo|test|sample)\b/i.test(name);
}

function isSafelyTagged(doc = {}) {
  return doc.pilotSeed === true ||
    doc.testData === true ||
    doc.isTestData === true ||
    doc.isDemo === true;
}

function idVariants(ids) {
  const values = [];
  for (const id of ids) {
    values.push(String(id));
    if (ObjectId.isValid(String(id))) values.push(new ObjectId(String(id)));
  }
  return values;
}

async function main() {
  const config = loadConfig();
  const client = new MongoClient(config.mongoUri);
  await client.connect();
  const db = client.db(config.mongoDbName);

  try {
    const users = await db.collection('users').find({}).project({
      email: 1, name: 1, role: 1, pilotSeed: 1, pilotSeedBatch: 1,
      testData: 1, isTestData: 1, isDemo: 1
    }).toArray();

    const garages = await db.collection('garages').find({}).project({
      name: 1, ownerUserId: 1, pilotSeed: 1, pilotSeedBatch: 1,
      testData: 1, isTestData: 1, isDemo: 1
    }).toArray();

    const safeUsers = users.filter(isSafelyTagged);
    const reviewUsers = users.filter((u) => !isSafelyTagged(u) && isHeuristicDemoUser(u));
    const safeGarages = garages.filter(isSafelyTagged);
    const reviewGarages = garages.filter((g) =>
      !isSafelyTagged(g) && /\b(demo|test|sample)\b/i.test(String(g.name || ''))
    );

    const summary = {
      mode: EXECUTE ? 'EXECUTE' : 'DRY_RUN',
      database: config.mongoDbName,
      safelyTaggedUsers: safeUsers.map((u) => ({ id: String(u._id), email: u.email, role: u.role })),
      reviewOnlyUsers: reviewUsers.map((u) => ({ id: String(u._id), email: u.email, role: u.role })),
      safelyTaggedGarages: safeGarages.map((g) => ({ id: String(g._id), name: g.name })),
      reviewOnlyGarages: reviewGarages.map((g) => ({ id: String(g._id), name: g.name }))
    };

    console.log(JSON.stringify(summary, null, 2));

    if (!EXECUTE) {
      console.log('\nDRY RUN ONLY. No data was deleted.');
      console.log('Only explicitly tagged pilot/test/demo records are eligible for automatic deletion.');
      console.log('Heuristic matches are review-only and are NEVER deleted automatically.');
      return;
    }

    if (!SAFE_CONFIRM) {
      throw new Error('Execution blocked. Set PILOT_CLEANUP_CONFIRM=DELETE_TAGGED_PILOT_DATA.');
    }
    if ((process.env.NODE_ENV || '').toLowerCase() === 'production' && !BACKUP_CONFIRMED) {
      throw new Error('Production cleanup blocked until PILOT_BACKUP_CONFIRMED=YES.');
    }

    const userIds = safeUsers.map((u) => u._id);
    const userIdValues = idVariants(userIds);
    const garageIds = safeGarages.map((g) => g._id);
    const garageIdValues = idVariants(garageIds);

    if (userIds.length === 0 && garageIds.length === 0) {
      console.log('No safely tagged pilot/test/demo records found. Nothing to delete.');
      return;
    }

    const deletePlan = [
      ['notifications', { userId: { $in: userIdValues } }],
      ['deviceTokens', { userId: { $in: userIdValues } }],
      ['chat_history', { userId: { $in: userIdValues } }],
      ['diagnoses', { userId: { $in: userIdValues } }],
      ['vehicles', { $or: [{ ownerId: { $in: userIdValues } }, { userId: { $in: userIdValues } }] }],
      ['bookings', { $or: [{ userId: { $in: userIdValues } }, { garageId: { $in: garageIdValues } }] }],
      ['services', { $or: [{ ownerId: { $in: userIdValues } }, { garageId: { $in: garageIdValues } }, { createdBy: { $in: userIdValues } }] }],
      ['invoices', { $or: [{ customerId: { $in: userIdValues } }, { garageId: { $in: garageIdValues } }] }],
      ['payments', { $or: [{ userId: { $in: userIdValues } }, { garageId: { $in: garageIdValues } }] }],
      ['garage_earnings', { garageId: { $in: garageIdValues } }],
      ['settlements', { garageId: { $in: garageIdValues } }],
      ['feedback', { userId: { $in: userIdValues } }],
      ['reviews', { userId: { $in: userIdValues } }]
    ];

    const deletionResults = {};
    for (const [collectionName, query] of deletePlan) {
      const result = await db.collection(collectionName).deleteMany(query);
      deletionResults[collectionName] = result.deletedCount;
    }

    const garageResult = await db.collection('garages').deleteMany({ _id: { $in: garageIds } });
    const userResult = await db.collection('users').deleteMany({ _id: { $in: userIds } });

    deletionResults.garages = garageResult.deletedCount;
    deletionResults.users = userResult.deletedCount;

    await db.collection('admin_audit_logs').insertOne({
      action: 'PILOT_TAGGED_DATA_CLEANUP',
      actor: 'pilot-data-cleanup-script',
      deleted: deletionResults,
      safelyTaggedUserIds: userIds.map(String),
      safelyTaggedGarageIds: garageIds.map(String),
      createdAt: new Date()
    });

    console.log('\nCleanup complete:');
    console.log(JSON.stringify(deletionResults, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Pilot data cleanup failed:', err.message || err);
  process.exit(1);
});
