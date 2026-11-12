#!/usr/bin/env node
// Browser end-to-end seed: drops the throwaway E2E database and creates one vehicle owner, one
// garage partner (active profile + one catalogue service) and one admin.
//
//   MONGO_URI=mongodb://127.0.0.1:27017 MONGO_DB_NAME=driveportz_e2e node scripts/e2e-seed.mjs
//
// It deliberately does NOT load backend/.env (that file may point at a shared database). Safety
// rails: the database name must contain "e2e", NODE_ENV must not be production/staging, and the
// Mongo host must be local unless E2E_ALLOW_REMOTE_MONGO=true.
//
// The default credentials below are mirrored in frontend/tests/e2e/support/accounts.js; both read
// the same E2E_* overrides, so keep them in sync.
import { createRequire } from 'node:module';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

const require = createRequire(import.meta.url);
const { AUTH } = require('../src/core/constants');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGO_DB_NAME || 'driveportz_e2e';
const PASSWORD = process.env.E2E_PASSWORD || 'E2eDrivePortz2026';
const LEGAL_VERSION = 'pilot-2026-09-v1';

const ACCOUNTS = Object.freeze({
  owner: { name: 'E2E Vehicle Owner', email: process.env.E2E_OWNER_EMAIL || 'owner@driveportz-e2e.in', role: 'USER', phone: '9000000001' },
  garage: { name: 'E2E Garage Partner', email: process.env.E2E_GARAGE_EMAIL || 'garage@driveportz-e2e.in', role: 'GARAGE', phone: '9000000002' },
  admin: { name: 'E2E Admin', email: process.env.E2E_ADMIN_EMAIL || 'admin@driveportz-e2e.in', role: 'ADMIN', phone: '9000000003' },
});

const GARAGE_PROFILE = Object.freeze({
  name: process.env.E2E_GARAGE_NAME || 'E2E Trusted Motors',
  serviceTitle: process.env.E2E_SERVICE_TITLE || 'E2E Full Car Service',
  servicePrice: 1000,
});

function assertSafeTarget() {
  const nodeEnv = String(process.env.NODE_ENV || 'development').toLowerCase();
  if (['production', 'staging'].includes(nodeEnv)) {
    throw new Error(`Refusing to seed with NODE_ENV=${nodeEnv}.`);
  }
  if (!/e2e/i.test(DB_NAME)) {
    throw new Error(`Refusing to drop "${DB_NAME}": the E2E database name must contain "e2e".`);
  }
  const remoteAllowed = process.env.E2E_ALLOW_REMOTE_MONGO === 'true';
  const isLocal = /^mongodb:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(MONGO_URI);
  if (!isLocal && !remoteAllowed) {
    throw new Error('Refusing to seed a non-local MongoDB. Set E2E_ALLOW_REMOTE_MONGO=true if this is really a throwaway instance.');
  }
  if (PASSWORD.length < AUTH.PASSWORD_MIN_LENGTH || !/[A-Za-z]/.test(PASSWORD) || !/\d/.test(PASSWORD)) {
    throw new Error('E2E_PASSWORD must satisfy the app password policy (8+ chars, a letter and a digit).');
  }
}

function legalFields(at) {
  return {
    termsAccepted: true,
    privacyAccepted: true,
    termsAcceptedAt: at,
    privacyAcceptedAt: at,
    termsVersionAccepted: LEGAL_VERSION,
    privacyVersionAccepted: LEGAL_VERSION,
    legalVersionAccepted: LEGAL_VERSION,
  };
}

async function seed(db) {
  const now = new Date();
  const passwordHash = await bcrypt.hash(PASSWORD, AUTH.BCRYPT_ROUNDS);
  const users = db.collection('users');

  const ids = {};
  for (const [key, account] of Object.entries(ACCOUNTS)) {
    const { insertedId } = await users.insertOne({
      name: account.name,
      email: account.email.toLowerCase(),
      password: passwordHash,
      role: account.role,
      phone: account.phone,
      city: 'Chennai',
      tokenVersion: 0,
      e2eSeed: true,
      createdAt: now,
      updatedAt: now,
      ...legalFields(now),
    });
    ids[key] = insertedId;
  }

  // Manual availability keeps the garage bookable regardless of the wall clock (AUTO mode closes
  // outside 09:00-19:00 IST, which would make the marketplace "Request" button disabled).
  const { insertedId: garageId } = await db.collection('garages').insertOne({
    name: GARAGE_PROFILE.name,
    ownerUserId: String(ids.garage),
    phone: ACCOUNTS.garage.phone,
    email: ACCOUNTS.garage.email,
    address: '1 Test Street, Guindy',
    city: 'Chennai',
    state: 'Tamil Nadu',
    description: 'Seeded garage for browser end-to-end tests.',
    maxCapacity: 20,
    certifications: [],
    specializations: [],
    galleryPhotos: [],
    availabilityMode: 'MANUAL',
    manualStatus: 'AVAILABLE',
    verified: true,
    isVerified: true,
    isActive: true,
    e2eSeed: true,
    createdAt: now,
    updatedAt: now,
  });

  const { insertedId: serviceId } = await db.collection('garageServices').insertOne({
    garageId,
    title: GARAGE_PROFILE.serviceTitle,
    description: 'Oil, filter and multi-point inspection.',
    price: GARAGE_PROFILE.servicePrice,
    durationMins: 60,
    category: 'General Service',
    photoUrl: null,
    whatsIncluded: ['Engine oil', 'Oil filter', 'Inspection'],
    bundledItems: [],
    isPackage: false,
    isActive: true,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });

  return { userIds: ids, garageId, serviceId };
}

async function main() {
  assertSafeTarget();
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  try {
    const db = client.db(DB_NAME);
    await db.dropDatabase();
    const result = await seed(db);
    const summary = {
      database: DB_NAME,
      password: PASSWORD,
      accounts: Object.fromEntries(Object.entries(ACCOUNTS).map(([key, a]) => [key, { email: a.email, role: a.role, id: String(result.userIds[key]) }])),
      garage: { id: String(result.garageId), name: GARAGE_PROFILE.name },
      service: { id: String(result.serviceId), title: GARAGE_PROFILE.serviceTitle, price: GARAGE_PROFILE.servicePrice },
    };
    console.log(`[e2e-seed] ${JSON.stringify(summary)}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`[e2e-seed] FAILED: ${err.message || err}`);
  process.exit(1);
});
