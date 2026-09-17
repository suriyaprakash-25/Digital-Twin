const { ObjectId } = require('mongodb');

function normalizeId(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

/**
 * A payment order may only be created by an administrator or by a user whose
 * id is explicitly attached to the target invoice/service or its vehicle.
 * Missing ownership metadata is denied by default instead of becoming an
 * implicit allow condition.
 */
function isPaymentOrderAuthorized({ user, vehicle, targetDoc }) {
  if (!user || !targetDoc) return false;
  if (String(user.role || '').toUpperCase() === 'ADMIN') return true;

  const currentUserId = normalizeId(user.id);
  if (!currentUserId) return false;

  const ownerIds = [
    vehicle?.ownerId,
    targetDoc.ownerId,
    targetDoc.userId,
    targetDoc.customerId
  ]
    .map(normalizeId)
    .filter(Boolean);

  return ownerIds.some((ownerId) => ownerId === currentUserId);
}

function toObjectId(value) {
  try {
    return new ObjectId(String(value));
  } catch {
    return null;
  }
}

/**
 * Refunds may be initiated only by an administrator or by the authenticated
 * owner of the garage associated with the payment. Legacy records that stored
 * the garage owner's user id directly in garageId remain supported.
 */
async function isGarageUserAuthorizedForPayment({ user, payment, db }) {
  if (!user || !payment || !db) return false;

  const role = String(user.role || '').toUpperCase();
  const userId = normalizeId(user.id);
  if (!userId) return false;
  if (role === 'ADMIN') return true;
  if (role !== 'GARAGE') return false;

  if (
    normalizeId(payment.garageOwnerUserId) === userId ||
    normalizeId(payment.garageUserId) === userId ||
    normalizeId(payment.garageId) === userId
  ) {
    return true;
  }

  const garageId = normalizeId(payment.garageId);
  if (!garageId) return false;

  const objectId = toObjectId(garageId);
  const identityFilters = [
    { id: garageId },
    { garageId }
  ];
  if (objectId) identityFilters.push({ _id: objectId });

  const garage = await db.collection('garages').findOne({
    $and: [
      { $or: identityFilters },
      { ownerUserId: userId },
      { isActive: { $ne: false } }
    ]
  });

  return Boolean(garage);
}

module.exports = {
  isPaymentOrderAuthorized,
  isGarageUserAuthorizedForPayment
};
