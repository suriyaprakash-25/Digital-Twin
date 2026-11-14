/**
 * Garage bookings. Owned by: bookings/disputes refactor (completion claim used by services refactor).
 * Add query methods here instead of calling db.collection('bookings') from routes or services.
 */
const { BaseRepository, toObjectId, idValues } = require('./BaseRepository');
const { withSession } = require('../core/transaction');

const NOT_INVOICED = { $or: [{ invoiceNumber: { $exists: false } }, { invoiceNumber: null }, { invoiceNumber: '' }] };
// Service completion may claim a booking only from these states (see services/bookings/bookingStateMachine).
// COMPLETED stays claimable so a booking completed through the status endpoint can still be invoiced once.
const COMPLETION_CLAIMABLE_STATUSES = Object.freeze(['ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);
// mongodb driver v6: findOneAndUpdate resolves to the document itself (or null).
const RETURN_UPDATED = Object.freeze({ returnDocument: 'after' });

/** Legacy rows store userId/garageId as a string or an ObjectId. */
const anyIdOf = (id) => ({ $in: idValues(id) });

class BookingRepository extends BaseRepository {
  constructor(db) {
    super(db, 'bookings');
  }

  create(doc) {
    return this.insertOne(doc);
  }

  /** Paged bookings of a vehicle owner, newest first. */
  findPageForUser(userId, page) {
    return this.findPage({ userId: anyIdOf(userId) }, page);
  }

  /** Paged bookings of a garage, newest first. */
  findPageForGarage(garageId, page) {
    return this.findPage({ garageId: anyIdOf(garageId) }, page);
  }

  /** A booking only if it belongs to `garageId` (null for malformed ids or another garage's booking). */
  findOwnedByGarage(bookingId, garageId) {
    const _id = toObjectId(bookingId);
    return _id ? this.findOne({ _id, garageId: anyIdOf(garageId) }) : Promise.resolve(null);
  }

  /** A booking only if it was requested by `userId`. */
  findOwnedByUser(bookingId, userId) {
    const _id = toObjectId(bookingId);
    return _id ? this.findOne({ _id, userId: anyIdOf(userId) }) : Promise.resolve(null);
  }

  countForGarageInStatuses(garageId, statuses) {
    return this.count({ garageId: anyIdOf(garageId), status: { $in: statuses } });
  }

  /**
   * Compare-and-swap status change: applies only while the booking still has `expectedStatus`.
   * @returns {Promise<object|null>} the updated booking, or null when another writer got there first
   */
  compareAndSetStatus(bookingObjectId, expectedStatus, { to, timelineEntry, at = new Date() }) {
    return this.collection.findOneAndUpdate(
      { _id: bookingObjectId, status: expectedStatus },
      { $set: { status: to, updatedAt: at }, $push: { timeline: timelineEntry } },
      RETURN_UPDATED,
    );
  }

  /**
   * Compare-and-swap claim used by service completion: marks the booking COMPLETED and links the
   * invoice only if no invoice has been issued for it yet and the booking is in a completable state
   * (a REQUESTED, REJECTED or CANCELLED booking can no longer be invoiced through this path).
   * @returns {Promise<boolean>} true when this call won the claim
   */
  async markCompleted(bookingObjectId, { serviceId, invoiceNumber, by, at = new Date() }, { session } = {}) {
    const result = await this.collection.updateOne(
      { _id: bookingObjectId, status: { $in: COMPLETION_CLAIMABLE_STATUSES }, ...NOT_INVOICED },
      {
        $set: { status: 'COMPLETED', serviceId, invoiceNumber, updatedAt: at },
        $push: { timeline: { status: 'COMPLETED', at, by } },
      },
      withSession(session),
    );
    return result.matchedCount === 1;
  }

  /**
   * Compensation for deployments without transactions: undoes a `markCompleted` claim whose
   * follow-up writes failed, so the garage can retry the completion.
   */
  releaseCompletionClaim(booking, { invoiceNumber, at }) {
    const restore = { status: booking.status, updatedAt: new Date() };
    const unset = { invoiceNumber: '' };
    if (booking.serviceId) restore.serviceId = booking.serviceId;
    else unset.serviceId = '';
    return this.collection.updateOne(
      { _id: booking._id, invoiceNumber },
      { $set: restore, $unset: unset, $pull: { timeline: { status: 'COMPLETED', at } } },
    );
  }
}

module.exports = { BookingRepository, COMPLETION_CLAIMABLE_STATUSES };
