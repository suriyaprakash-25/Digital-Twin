/**
 * Indexes for the core (non-financial) collections, derived from the hot query filters in
 * routes/services (users by email, garages by ownerUserId, per-owner/per-garage listings...).
 * Previously these collections had no indexes, so every listing was a collection scan.
 */
const { getDb } = require('../db');

const CORE_INDEXES = Object.freeze({
  users: [
    [{ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } }, name: 'uniq_email' }],
    [{ uid: 1 }, { sparse: true }],
    [{ role: 1, createdAt: -1 }],
  ],
  garages: [
    [{ ownerUserId: 1 }],
    [{ isActive: 1, isVerified: 1 }],
  ],
  vehicles: [
    [{ userId: 1, isArchived: 1 }],
    [{ ownerId: 1 }],
    [{ vehicleNumber: 1 }],
  ],
  bookings: [
    [{ garageId: 1, status: 1, createdAt: -1 }],
    [{ userId: 1, createdAt: -1 }],
    [{ vehicleId: 1 }],
  ],
  services: [
    [{ vehicleId: 1, createdAt: -1 }],
    [{ garageId: 1, createdAt: -1 }],
    [{ createdBy: 1, createdAt: -1 }],
    [{ bookingId: 1 }, { sparse: true }],
  ],
  notifications: [
    [{ userId: 1, createdAt: -1 }],
    [{ userId: 1, read: 1 }],
  ],
  invoices: [
    [{ customerId: 1 }],
    [{ serviceId: 1 }],
  ],
});

async function ensureCoreIndexes(dbInstance) {
  const db = dbInstance || getDb();
  const problems = [];
  for (const [collectionName, specs] of Object.entries(CORE_INDEXES)) {
    for (const [keys, options = {}] of specs) {
      try {
        await db.collection(collectionName).createIndex(keys, options);
      } catch (err) {
        // A unique index fails if legacy duplicates exist; report instead of crashing startup.
        problems.push(`${collectionName} ${JSON.stringify(keys)}: ${err.message}`);
      }
    }
  }
  if (problems.length) {
    console.warn(`⚠️ Core index issues (resolve duplicates, then restart):\n- ${problems.join('\n- ')}`);
  } else {
    console.log('✅ Core collection indexes verified.');
  }
  return { problems };
}

module.exports = { ensureCoreIndexes, CORE_INDEXES };
