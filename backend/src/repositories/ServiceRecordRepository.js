/**
 * Service/maintenance records and invoices (the `services` collection). Owned by: services refactor.
 * Add query methods here instead of calling db.collection('services') from routes or services.
 *
 * Invoices have no repository of their own yet; the invoice document is written together with its
 * completed service record, so its single write lives here as well (`upsertInvoice`).
 */
const { BaseRepository, toObjectId, idValues, idFilter } = require('./BaseRepository');
const { withSession } = require('../core/transaction');
const { num } = require('../core/aggregation');

const NOT_ARCHIVED = { isArchived: { $ne: true } };

/** Integer paise of a rupee field that may be a string/number/null on legacy rows. */
const paiseOf = (field) => ({ $round: [{ $multiply: [num(field), 100] }, 0] });

/** No invoice number assigned yet (missing, null or empty). */
const WITHOUT_INVOICE_NUMBER = { $or: [{ invoiceNumber: { $exists: false } }, { invoiceNumber: null }, { invoiceNumber: '' }] };

/** `$toObjectId` throws on legacy non-ObjectId strings and fails the whole listing; this yields null. */
const objectIdOrNull = (field) => ({ $convert: { input: field, to: 'objectId', onError: null, onNull: null } });

/** Matches a finalised service: completed (or finalised) AND carrying an invoice number. */
const ALREADY_INVOICED = {
  $or: [
    { status: 'COMPLETED', invoiceNumber: { $nin: [null, ''] } },
    { invoiceStatus: 'FINALIZED', invoiceNumber: { $nin: [null, ''] } },
  ],
};

class ServiceRecordRepository extends BaseRepository {
  constructor(db) {
    super(db, 'services');
  }

  get invoices() {
    return this.db.collection('invoices');
  }

  /**
   * Highest-odometer active record for a vehicle, used as the regression baseline. Walk-in records
   * still awaiting owner confirmation are excluded so an unrelated garage cannot block the owner.
   */
  findOdometerBaseline(vehicleId) {
    return this.collection
      .find({ vehicleId: { $in: idValues(vehicleId) }, ...NOT_ARCHIVED, requiresOwnerConfirmation: { $ne: true } })
      .sort({ odometerKm: -1 })
      .limit(1)
      .next();
  }

  insertRecord(doc, { session } = {}) {
    return this.collection.insertOne(doc, withSession(session));
  }

  /**
   * Paged garage listing joined with vehicle and owner, filtered by an already-escaped search regex.
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listForGarage({ createdBy, category, searchRegex, sort, skip, limit }) {
    const match = { createdBy, ...NOT_ARCHIVED };
    if (category) match.serviceCategory = category;
    const pipeline = [
      { $match: match },
      { $addFields: { vehicleObjectId: objectIdOrNull('$vehicleId') } },
      { $lookup: { from: 'vehicles', localField: 'vehicleObjectId', foreignField: '_id', as: 'vehicleDetails' } },
      { $unwind: { path: '$vehicleDetails', preserveNullAndEmptyArrays: true } },
      { $addFields: { ownerObjectId: objectIdOrNull('$ownerId') } },
      { $lookup: { from: 'users', localField: 'ownerObjectId', foreignField: '_id', as: 'ownerDetails' } },
      { $unwind: { path: '$ownerDetails', preserveNullAndEmptyArrays: true } },
    ];
    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { 'vehicleDetails.registrationNumber': searchRegex },
            { 'ownerDetails.name': searchRegex },
            { 'ownerDetails.email': searchRegex },
            { serviceType: searchRegex },
          ],
        },
      });
    }
    pipeline.push({ $sort: sort });
    pipeline.push({ $facet: { metadata: [{ $count: 'total' }], data: [{ $skip: skip }, { $limit: limit }] } });
    const [result] = await this.aggregate(pipeline);
    return { items: result.data, total: result.metadata.length > 0 ? result.metadata[0].total : 0 };
  }

  /** Revenue and count across every active record the garage created. */
  async garageTotals(createdBy) {
    const [row] = await this.aggregate([
      { $match: { createdBy, ...NOT_ARCHIVED } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalCost' }, totalServices: { $sum: 1 } } },
    ]);
    return row ? { totalRevenue: row.totalRevenue, totalServices: row.totalServices } : { totalRevenue: 0, totalServices: 0 };
  }

  /** Active records for a vehicle across every legacy foreign-key shape, newest first. */
  findHistoryForVehicle(vehicleId) {
    const objectId = toObjectId(vehicleId);
    const id = String(vehicleId);
    return this.find(
      {
        $or: [
          ...(objectId ? [{ vehicleId: objectId }, { vehicleId: String(objectId) }] : []),
          { vehicleId: id },
          { vehicle_id: id },
          { 'vehicle.id': id },
        ],
        ...NOT_ARCHIVED,
      },
      { sort: { serviceDate: -1, createdAt: -1 } },
    );
  }

  deleteById(serviceObjectId) {
    return this.collection.deleteOne({ _id: serviceObjectId });
  }

  /**
   * Compare-and-swap completion of an existing record: succeeds only if the record has not already
   * been finalised with an invoice, so two concurrent completions cannot both write one.
   * @returns {Promise<boolean>} true when this call completed the record
   */
  async completeExisting(serviceObjectId, payload, { session } = {}) {
    const result = await this.collection.updateOne(
      { _id: serviceObjectId, $nor: [ALREADY_INVOICED] },
      { $set: payload },
      withSession(session),
    );
    return result.matchedCount === 1;
  }

  upsertInvoice(invoiceNumber, invoiceDoc, { session } = {}) {
    return this.invoices.updateOne({ invoiceNumber }, { $set: invoiceDoc }, withSession(session, { upsert: true }));
  }

  // ----- Invoice (billing) queries used by services/invoices ------------------------------------

  /** An active (not archived) record by any legacy id shape. */
  findActive(id) {
    if (id === undefined || id === null || id === '') return Promise.resolve(null);
    return this.findOne({ ...idFilter(id), ...NOT_ARCHIVED });
  }

  /** An active record by id, legacy `id` field or its invoice number. */
  findActiveByReference(ref) {
    const { $or } = idFilter(ref);
    return this.findOne({ $or: [...$or, { invoiceNumber: String(ref) }], ...NOT_ARCHIVED });
  }

  /**
   * Paged invoice listing for a garage, joined with vehicle and owner. `statusMatch` is a plain
   * filter fragment; `searchRegex` must already be escaped (core/text.safeSearchRegex).
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listInvoicesForGarage({ createdBy, statusMatch = {}, searchRegex, skip, limit }) {
    const pipeline = [
      { $match: { createdBy, ...NOT_ARCHIVED, ...statusMatch } },
      { $addFields: { vehicleObjectId: objectIdOrNull('$vehicleId'), ownerObjectId: objectIdOrNull('$ownerId') } },
      { $lookup: { from: 'vehicles', localField: 'vehicleObjectId', foreignField: '_id', as: 'vehicleDetails' } },
      { $unwind: { path: '$vehicleDetails', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'ownerObjectId', foreignField: '_id', as: 'ownerDetails' } },
      { $unwind: { path: '$ownerDetails', preserveNullAndEmptyArrays: true } },
    ];
    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { invoiceNumber: searchRegex },
            { 'vehicleDetails.registrationNumber': searchRegex },
            { 'vehicleDetails.vehicleNumber': searchRegex },
            { 'ownerDetails.name': searchRegex },
            { serviceType: searchRegex },
          ],
        },
      });
    }
    pipeline.push({ $sort: { createdAt: -1, _id: -1 } });
    pipeline.push({ $project: { 'ownerDetails.password': 0, 'ownerDetails.otp': 0 } });
    pipeline.push({ $facet: { metadata: [{ $count: 'total' }], data: [{ $skip: skip }, { $limit: limit }] } });
    const [result] = await this.aggregate(pipeline);
    return { items: result.data, total: result.metadata.length > 0 ? result.metadata[0].total : 0 };
  }

  /** String ids of every active record a garage created (ids only; used to scope payments). */
  async findIdsForGarage(createdBy) {
    const ids = await this.collection.distinct('_id', { createdBy, ...NOT_ARCHIVED });
    return ids.map(String);
  }

  /** Record count and unpaid, non-cancelled billed amount (integer paise) for a garage. */
  async garageBillingKpis(createdBy) {
    const isPending = { $and: [{ $ne: ['$paymentStatus', 'PAID'] }, { $ne: ['$invoiceStatus', 'CANCELLED'] }] };
    const [row] = await this.aggregate([
      { $match: { createdBy, ...NOT_ARCHIVED } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pendingPaise: { $sum: { $cond: [isPending, paiseOf({ $ifNull: ['$totalAmount', '$totalCost'] }), 0] } },
        },
      },
    ]);
    return { total: row ? row.total : 0, pendingPaise: row ? row.pendingPaise : 0 };
  }

  /**
   * Compare-and-swap update of an unpaid, non-cancelled invoice. `guard` adds extra conditions
   * (e.g. the expected invoice number). Returns false when the record no longer qualifies, so a
   * concurrent payment capture or cancellation cannot be overwritten.
   */
  async updateOpenInvoice(serviceObjectId, { set, unset, guard = {}, lockedPaymentStatuses }) {
    const update = { $set: set };
    if (unset) update.$unset = unset;
    const result = await this.collection.updateOne(
      { _id: serviceObjectId, paymentStatus: { $nin: lockedPaymentStatuses }, invoiceStatus: { $ne: 'CANCELLED' }, ...guard },
      update,
    );
    return result.matchedCount === 1;
  }

  /**
   * Claims the right to assign an invoice number (lease, so a crashed request cannot block forever).
   * Exactly one concurrent finalize wins; the others see false and no number is burned.
   */
  async claimInvoiceNumber(serviceObjectId, token, { now, leaseMs }) {
    const result = await this.collection.updateOne(
      {
        _id: serviceObjectId,
        $and: [WITHOUT_INVOICE_NUMBER, { $or: [{ invoiceFinalizeLockUntil: { $exists: false } }, { invoiceFinalizeLockUntil: { $lte: now } }] }],
      },
      { $set: { invoiceFinalizeToken: token, invoiceFinalizeLockUntil: new Date(now.getTime() + leaseMs) } },
    );
    return result.modifiedCount === 1;
  }

  /** Releases a finalize claim that did not complete (no-op if the claim was already consumed). */
  releaseInvoiceNumberClaim(serviceObjectId, token) {
    return this.collection.updateOne(
      { _id: serviceObjectId, invoiceFinalizeToken: token },
      { $unset: { invoiceFinalizeToken: '', invoiceFinalizeLockUntil: '' } },
    );
  }
}

module.exports = { ServiceRecordRepository };
