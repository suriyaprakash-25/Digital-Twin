/**
 * Garage bookings. Owned by: services refactor.
 * Add query methods here instead of calling db.collection('bookings') from routes or services.
 */
const { BaseRepository } = require('./BaseRepository');
const { withSession } = require('../core/transaction');

const NOT_INVOICED = { $or: [{ invoiceNumber: { $exists: false } }, { invoiceNumber: null }, { invoiceNumber: '' }] };

class BookingRepository extends BaseRepository {
  constructor(db) {
    super(db, 'bookings');
  }

  /**
   * Compare-and-swap claim used by service completion: marks the booking COMPLETED and links the
   * invoice only if no invoice has been issued for it yet. A booking moved to COMPLETED through the
   * status endpoint (without an invoice) can still be invoiced exactly once.
   * @returns {Promise<boolean>} true when this call won the claim
   */
  async markCompleted(bookingObjectId, { serviceId, invoiceNumber, by, at = new Date() }, { session } = {}) {
    const result = await this.collection.updateOne(
      { _id: bookingObjectId, ...NOT_INVOICED },
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

module.exports = { BookingRepository };
