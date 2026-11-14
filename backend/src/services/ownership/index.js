/**
 * Composition root for the ownership module: wires repositories, the Mongo client (transactions),
 * the vehicle access policy and the notifier into the services. This is the only place in the
 * module that knows about the live database connection.
 */
const { getDb, getMongoClient } = require('../../db');
const { createRepositories } = require('../../repositories');
const { ensureTransferIndexes } = require('../../repositories/TransferRepository');
const { ensureOwnershipHistoryIndexes } = require('../../repositories/OwnershipHistoryRepository');
const { isOwner } = require('../../security/vehicleAccess');
const { notifyUser } = require('../notifications');
const { createOwnershipTransferService } = require('./ownershipTransferService');
const { createOwnershipHistoryService } = require('./ownershipHistoryService');

const cache = new WeakMap();

/**
 * Index initialiser for the ownership domain, including the unique partial index that allows one
 * pending transfer per vehicle. Safe to call repeatedly. Belongs in server.js INDEX_INITIALISERS;
 * until it is listed there the module also runs it lazily before the first transfer is created.
 */
async function ensureOwnershipIndexes(dbInstance) {
  const db = dbInstance || getDb();
  await ensureOwnershipHistoryIndexes(db);
  const { problems } = await ensureTransferIndexes(db);
  if (problems.length) {
    console.warn(`⚠️ Ownership index issues (resolve duplicate pending transfers per vehicle, then restart):\n- ${problems.join('\n- ')}`);
  }
  return { problems };
}

function buildOwnershipModule(db, client) {
  const repos = createRepositories(db);
  let indexesReady = null;
  const ensureIndexes = () => {
    indexesReady = indexesReady || ensureOwnershipIndexes(db).catch((err) => {
      indexesReady = null; // retry on the next request rather than caching a failure
      console.warn('⚠️ Could not ensure ownership indexes:', err.message);
    });
    return indexesReady;
  };
  return {
    transfers: createOwnershipTransferService({ repos, client, notifyUser, isOwner, ensureIndexes }),
    history: createOwnershipHistoryService({ repos, isOwner }),
  };
}

/** Services bound to the connected database (memoised per Db instance). */
function getOwnershipModule(db = getDb(), client = getMongoClient()) {
  if (!cache.has(db)) cache.set(db, buildOwnershipModule(db, client));
  return cache.get(db);
}

module.exports = { getOwnershipModule, buildOwnershipModule, ensureOwnershipIndexes };
