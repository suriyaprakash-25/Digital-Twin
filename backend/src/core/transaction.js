/**
 * Unit-of-work helper.
 *
 * On a replica set / Atlas (production) the callback runs inside a real multi-document
 * transaction with majority write concern. On a standalone mongod (local dev, CI) MongoDB cannot
 * run transactions, so the callback runs without a session; callers stay safe there because every
 * money-moving write is ALSO guarded by a conditional (compare-and-swap) filter and unique indexes.
 */
const capabilityCache = new WeakMap();

async function supportsTransactions(client) {
  if (!client) return false;
  if (capabilityCache.has(client)) return capabilityCache.get(client);
  let supported = false;
  try {
    const hello = await client.db('admin').command({ hello: 1 });
    supported = Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch {
    supported = false;
  }
  capabilityCache.set(client, supported);
  return supported;
}

/**
 * @param {import('mongodb').MongoClient|null} client
 * @param {(session: import('mongodb').ClientSession|undefined) => Promise<T>} work
 * @returns {Promise<T>}
 * @template T
 */
async function runInTransaction(client, work) {
  if (!(await supportsTransactions(client))) {
    return work(undefined);
  }
  const session = client.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    return result;
  } finally {
    await session.endSession();
  }
}

/** Spreads `{ session }` into driver options only when a session exists. */
function withSession(session, options = {}) {
  return session ? { ...options, session } : options;
}

module.exports = { runInTransaction, supportsTransactions, withSession };
