/**
 * Append-only dispute timeline events. Owned by: bookings/disputes refactor.
 * Add query methods here instead of calling db.collection('dispute_events') from routes or services.
 */
const { BaseRepository } = require('./BaseRepository');

class DisputeEventRepository extends BaseRepository {
  constructor(db) {
    super(db, 'dispute_events');
  }

  append(event) {
    return this.insertOne(event);
  }

  /** The dispute's timeline, oldest first. */
  listForDispute(disputeId) {
    return this.find({ disputeId: String(disputeId) }, { sort: { createdAt: 1 } });
  }
}

module.exports = { DisputeEventRepository };
