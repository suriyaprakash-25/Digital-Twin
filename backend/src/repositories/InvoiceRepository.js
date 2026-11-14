/**
 * Invoices (the `invoices` collection, written at service completion). Owned by: invoices/earnings refactor.
 * Add query methods here instead of calling db.collection('invoices') from routes or services.
 */
const { BaseRepository, idFilter } = require('./BaseRepository');

class InvoiceRepository extends BaseRepository {
  constructor(db) {
    super(db, 'invoices');
  }

  /** An invoice by id, legacy `id` field or invoice number. */
  findByReference(ref) {
    const { $or } = idFilter(ref);
    return this.findOne({ $or: [...$or, { invoiceNumber: String(ref) }] });
  }

  /**
   * Mirrors edited totals / status from the service record onto its invoice document so the two
   * never disagree. No upsert: legacy services without an invoice document are left alone.
   */
  syncFromService(invoiceNumber, fields, now) {
    if (!invoiceNumber) return Promise.resolve(null);
    return this.updateOne({ invoiceNumber }, { $set: { ...fields, updatedAt: now } });
  }
}

module.exports = { InvoiceRepository };
