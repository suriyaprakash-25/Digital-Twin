const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
const { loadConfig } = require('../src/config');

const EXECUTE = process.argv.includes('--execute');
const CONFIRMED = process.env.PILOT_SEED_CONFIRM === 'CREATE_PILOT_ACCOUNTS';
const seedPath = path.resolve(
  process.env.PILOT_SEED_FILE || path.join(__dirname, 'pilot-accounts.example.json')
);

function requireValue(value, label) {
  if (!value || String(value).includes('CHANGE_ME')) {
    throw new Error(`Missing/placeholder value for ${label}`);
  }
  return String(value).trim();
}

function validateEmail(email) {
  const value = requireValue(email, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error(`Invalid email: ${value}`);
  return value;
}

async function upsertUser(users, account, role, batchId) {
  const email = validateEmail(account.email);
  const name = requireValue(account.name, `${role} name`);
  const password = requireValue(account.password, `${role} password`);
  if (password.length < 12) throw new Error(`Pilot password for ${email} must be at least 12 characters`);

  const existing = await users.findOne({ email });
  if (existing && existing.pilotSeed !== true) {
    throw new Error(`Refusing to overwrite non-pilot account: ${email}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await users.updateOne(
    { email },
    {
      $set: {
        name,
        email,
        password: passwordHash,
        role,
        phone: account.phone ? String(account.phone).trim() : '',
        city: account.city ? String(account.city).trim() : '',
        pilotSeed: true,
        pilotSeedBatch: batchId,
        termsAccepted: true,
        privacyAccepted: true,
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
        legalVersionAccepted: 'pilot-2026-09-v1',
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
  return users.findOne({ email });
}

async function main() {
  if (!fs.existsSync(seedPath)) throw new Error(`Seed file not found: ${seedPath}`);
  const payload = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  const admins = Array.isArray(payload.admins) ? payload.admins : [];
  const customers = Array.isArray(payload.customers) ? payload.customers : [];
  const garages = Array.isArray(payload.garages) ? payload.garages : [];

  if (admins.length < 1 || customers.length < 1 || garages.length < 1) {
    throw new Error('Seed file must include at least one admin, customer, and garage.');
  }

  const preview = {
    mode: EXECUTE ? 'EXECUTE' : 'DRY_RUN',
    seedFile: seedPath,
    admins: admins.map((a) => ({ email: a.email, name: a.name })),
    customers: customers.map((a) => ({ email: a.email, name: a.name })),
    garages: garages.map((g) => ({ ownerEmail: g.owner?.email, garageName: g.garage?.name }))
  };
  console.log(JSON.stringify(preview, null, 2));

  if (!EXECUTE) {
    console.log('\nDRY RUN ONLY. No accounts were created.');
    return;
  }
  if (!CONFIRMED) {
    throw new Error('Execution blocked. Set PILOT_SEED_CONFIRM=CREATE_PILOT_ACCOUNTS.');
  }

  const config = loadConfig();
  const client = new MongoClient(config.mongoUri);
  await client.connect();
  const db = client.db(config.mongoDbName);
  const users = db.collection('users');
  const garageCollection = db.collection('garages');
  const batchId = `pilot-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  try {
    for (const admin of admins) {
      await upsertUser(users, admin, 'ADMIN', batchId);
    }

    for (const customer of customers) {
      await upsertUser(users, customer, 'USER', batchId);
    }

    for (const entry of garages) {
      const owner = await upsertUser(users, entry.owner || {}, 'GARAGE', batchId);
      const garage = entry.garage || {};
      const name = requireValue(garage.name, 'garage name');

      await garageCollection.updateOne(
        { ownerUserId: String(owner._id) },
        {
          $set: {
            name,
            ownerUserId: String(owner._id),
            phone: garage.phone ? String(garage.phone).trim() : owner.phone || '',
            email: garage.email ? validateEmail(garage.email) : owner.email,
            address: requireValue(garage.address, 'garage address'),
            city: requireValue(garage.city, 'garage city'),
            state: garage.state ? String(garage.state).trim() : '',
            isVerified: Boolean(garage.isVerified),
            isActive: true,
            pilotSeed: true,
            pilotSeedBatch: batchId,
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
    }

    await db.collection('admin_audit_logs').insertOne({
      action: 'PILOT_ACCOUNTS_SEEDED',
      actor: 'seed-pilot-accounts-script',
      batchId,
      counts: { admins: admins.length, customers: customers.length, garages: garages.length },
      createdAt: new Date()
    });

    console.log(`Pilot accounts seeded successfully. Batch: ${batchId}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Pilot account seeding failed:', err.message || err);
  process.exit(1);
});
