const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * Resolves all identifier strings (user._id, garage._id) associated with a garage account.
 * This guarantees consistent querying across legacy records and newer service records.
 * @param {string} userIdOrGarageId 
 * @param {Object} [dbInstance] 
 * @returns {Promise<string[]>} Array of unique ID strings
 */
async function resolveGarageIds(userIdOrGarageId, dbInstance) {
  if (!userIdOrGarageId) return [];
  const db = dbInstance || getDb();
  const garages = db.collection('garages');
  const strId = String(userIdOrGarageId);

  const ids = new Set([strId]);

  try {
    // 1. If strId is ownerUserId, find garage documents
    const byOwner = await garages.find({ ownerUserId: strId }).toArray();
    byOwner.forEach(g => {
      ids.add(String(g._id));
      if (g.id) ids.add(String(g.id));
    });

    // 2. If strId is garage._id, find ownerUserId
    const gObj = toObjectId(strId);
    const byId = await garages.findOne(
      gObj ? { $or: [{ _id: gObj }, { _id: strId }, { id: strId }] } : { $or: [{ _id: strId }, { id: strId }] }
    );
    if (byId && byId.ownerUserId) {
      ids.add(String(byId.ownerUserId));
    }
  } catch (err) {
    console.warn('Warning resolving garage IDs:', err.message);
  }

  return Array.from(ids);
}

module.exports = {
  resolveGarageIds,
  toObjectId
};
