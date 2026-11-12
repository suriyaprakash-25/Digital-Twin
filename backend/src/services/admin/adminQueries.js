/**
 * Query specifications (pure filter/pipeline builders) for the admin read models that live on
 * collections whose repositories are owned by other modules (garages, bookings, vehicles,
 * services). Services execute them through the injected repository's generic `aggregate`/`count`,
 * so nothing here touches a database and every builder is unit-testable.
 *
 * Amounts use core/aggregation `num()` ($convert with onError/onNull = 0): the previous `$toDouble`
 * aborted the whole aggregation (HTTP 500) as soon as one legacy booking stored a non-numeric price.
 */
const { ObjectId } = require('mongodb');
const { num, countWhere, sumWhere, equals } = require('../../core/aggregation');
const { ADMIN_LIMITS, BOOKING_STATUS, FALLBACK_LABELS, MONTH_BUCKET_FORMAT } = require('./adminConstants');

/** Path-parameter id to ObjectId, or null when it is not a valid id (caller answers 400). */
function toObjectIdOrNull(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

const NOT_ARCHIVED = Object.freeze({ isArchived: { $ne: true } });
const ACTIVE_GARAGE = Object.freeze({ isActive: { $ne: false } });
const VERIFIED_ACTIVE_GARAGE = Object.freeze({ verified: true, ...ACTIVE_GARAGE });
const COMPLETED_BOOKING = Object.freeze({ status: BOOKING_STATUS.COMPLETED });

const BOOKING_PRICE = '$snapshots.service.price';
const IS_COMPLETED = equals('$status', BOOKING_STATUS.COMPLETED);
const HAS_CREATED_DATE = { createdAt: { $exists: true, $type: 'date' } };

/** Case-insensitive "contains" over several fields; `regex` comes from core/text safeSearchRegex. */
function anyFieldMatches(fields, regex) {
  return regex ? { $or: fields.map((field) => ({ [field]: regex })) } : {};
}

function garageListFilter(regex) {
  return { ...ACTIVE_GARAGE, ...anyFieldMatches(['name', 'city'], regex) };
}

/** Grand total of completed-booking revenue (dashboard KPI). */
function completedBookingRevenuePipeline() {
  return [
    { $match: COMPLETED_BOOKING },
    { $group: { _id: null, total: { $sum: num(BOOKING_PRICE) } } },
  ];
}

const garageLookup = {
  $lookup: {
    from: 'garages',
    localField: '_id',
    foreignField: '_id',
    pipeline: [{ $project: { name: 1, city: 1, verified: 1 } }],
    as: '_garage',
  },
};
const unwindGarage = { $unwind: { path: '$_garage', preserveNullAndEmptyArrays: true } };

/** Completed bookings grouped per garage, every garage, highest revenue first (revenue page). */
function revenueByGaragePipeline() {
  return [
    { $match: COMPLETED_BOOKING },
    { $group: { _id: '$garageId', totalServices: { $sum: 1 }, totalRevenue: { $sum: num(BOOKING_PRICE) } } },
    { $sort: { totalRevenue: -1 } },
    garageLookup,
    unwindGarage,
    {
      $project: {
        garageId: { $toString: '$_id' },
        garageName: { $ifNull: ['$_garage.name', FALLBACK_LABELS.REVENUE_GARAGE] },
        city: { $ifNull: ['$_garage.city', ''] },
        totalServices: 1,
        totalRevenue: 1,
        verified: { $ifNull: ['$_garage.verified', false] },
      },
    },
  ];
}

/** Analytics leaderboard: top N garages by completed-booking revenue. */
function topGaragesPipeline(limit = ADMIN_LIMITS.TOP_GARAGES) {
  return [
    { $match: COMPLETED_BOOKING },
    { $group: { _id: '$garageId', completedCount: { $sum: 1 }, revenue: { $sum: num(BOOKING_PRICE) } } },
    { $sort: { revenue: -1 } },
    { $limit: limit },
    garageLookup,
    unwindGarage,
    {
      $project: {
        name: { $ifNull: ['$_garage.name', FALLBACK_LABELS.TOP_GARAGE] },
        city: { $ifNull: ['$_garage.city', ''] },
        completedCount: 1,
        revenue: 1,
        _id: 0,
      },
    },
  ];
}

/** Documents created per calendar month, oldest first; `sums` adds extra summed fields. */
function monthlySeriesPipeline(match = {}, sums = {}) {
  const extraFields = Object.fromEntries(Object.keys(sums).map((key) => [key, 1]));
  return [
    { $match: { ...HAS_CREATED_DATE, ...match } },
    {
      $group: {
        _id: { $dateToString: { format: MONTH_BUCKET_FORMAT, date: '$createdAt' } },
        count: { $sum: 1 },
        ...sums,
      },
    },
    { $sort: { _id: 1 } },
    { $project: { month: '$_id', count: 1, ...extraFields, _id: 0 } },
  ];
}

function monthlyRevenuePipeline() {
  return monthlySeriesPipeline(COMPLETED_BOOKING, { revenue: { $sum: num(BOOKING_PRICE) } });
}

/**
 * One page of active garages with per-garage booking stats and owner contact.
 * Booking stats are grouped inside the lookup (previously every booking document of every garage
 * on the page was pulled into Node just to be counted), and the owner is matched by converting
 * `ownerUserId` to an ObjectId so the users `_id` index is used instead of a `$toString` scan.
 */
function garagePageWithStatsPipeline(filter, { skip, limit }) {
  return [
    { $match: filter },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'bookings',
        localField: '_id',
        foreignField: 'garageId',
        pipeline: [
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              servicesCompleted: countWhere(IS_COMPLETED),
              revenue: sumWhere(IS_COMPLETED, BOOKING_PRICE),
            },
          },
        ],
        as: '_bookingStats',
      },
    },
    {
      $lookup: {
        from: 'users',
        let: { ownerObjectId: { $convert: { input: '$ownerUserId', to: 'objectId', onError: null, onNull: null } } },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$ownerObjectId'] } } },
          { $project: { name: 1, email: 1 } },
        ],
        as: '_owner',
      },
    },
  ];
}

/** Unpaid, non-cancelled invoices (payments summary "pending" KPI) on the `services` collection. */
function pendingInvoicesPipeline() {
  return [
    { $match: { paymentStatus: { $ne: 'PAID' }, ...NOT_ARCHIVED, invoiceStatus: { $ne: 'CANCELLED' } } },
    { $group: { _id: null, pendingCount: { $sum: 1 }, pendingAmount: { $sum: num({ $ifNull: ['$totalAmount', '$totalCost'] }) } } },
  ];
}

const VEHICLE_SUMMARY_PROJECTION = Object.freeze({
  vehicleNumber: 1, brand: 1, model: 1, manufacturingYear: 1, year: 1, fuelType: 1, createdAt: 1,
});
const SERVICE_SUMMARY_PROJECTION = Object.freeze({
  vehicleId: 1, serviceDate: 1, serviceType: 1, serviceCategory: 1, totalCost: 1, garageName: 1, createdAt: 1,
});

function ownedActiveFilter(ownerId) {
  return { ownerId, ...NOT_ARCHIVED };
}

module.exports = {
  NOT_ARCHIVED,
  ACTIVE_GARAGE,
  VERIFIED_ACTIVE_GARAGE,
  VEHICLE_SUMMARY_PROJECTION,
  SERVICE_SUMMARY_PROJECTION,
  toObjectIdOrNull,
  anyFieldMatches,
  garageListFilter,
  ownedActiveFilter,
  completedBookingRevenuePipeline,
  revenueByGaragePipeline,
  topGaragesPipeline,
  monthlySeriesPipeline,
  monthlyRevenuePipeline,
  garagePageWithStatsPipeline,
  pendingInvoicesPipeline,
};
