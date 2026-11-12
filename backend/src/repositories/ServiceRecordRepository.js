/**
 * Service/maintenance records and invoices (the `services` collection). Owned by: services refactor.
 * Add query methods here instead of calling db.collection('services') from routes or services.
 *
 * Invoices have no repository of their own yet; the invoice document is written together with its
 * completed service record, so its single write lives here as well (`upsertInvoice`).
 */
const { BaseRepository, toObjectId, idValues } = require('./BaseRepository');
const { withSession } = require('../core/transaction');

const NOT_ARCHIVED = { isArchived: { $ne: true } };

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
}

module.exports = { ServiceRecordRepository };
