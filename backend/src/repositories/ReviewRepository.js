/**
 * Customer reviews of garages. Owned by: garages refactor.
 * Add query methods here instead of calling db.collection('reviews') from routes or services.
 */
const { BaseRepository } = require('./BaseRepository');

const STAR_MIN = 1;
const STAR_MAX = 5;
// Legacy reviews without a rating have always been counted as 5 stars (`r.rating || 5`).
const MISSING_RATING_VALUE = 5;
const RATING_DECIMALS = 1;

const REVIEW_INDEXES = Object.freeze([
  // One review per booking. Partial so legacy reviews without a bookingId are unaffected.
  [{ bookingId: 1 }, { unique: true, partialFilterExpression: { bookingId: { $type: 'objectId' } }, name: 'uniq_review_booking' }],
  [{ garageId: 1, createdAt: -1 }, { name: 'garage_reviews_newest' }],
  [{ garageId: 1, rating: -1, createdAt: -1 }, { name: 'garage_reviews_by_rating' }],
]);

function emptyDistribution() {
  const distribution = {};
  for (let star = STAR_MAX; star >= STAR_MIN; star -= 1) distribution[star] = 0;
  return distribution;
}

function roundRating(value) {
  return Number.parseFloat(value.toFixed(RATING_DECIMALS));
}

/**
 * Folds aggregation buckets ({ _id: star, count, sum }) into the public summary shape.
 * `average` is null when there are no reviews; callers choose their own fallback.
 */
function summarizeRatingBuckets(buckets = []) {
  const distribution = emptyDistribution();
  let count = 0;
  let sum = 0;
  for (const bucket of buckets) {
    const star = Number(bucket._id);
    if (star >= STAR_MIN && star <= STAR_MAX) distribution[star] += bucket.count;
    count += bucket.count;
    sum += bucket.sum;
  }
  return { count, average: count > 0 ? roundRating(sum / count) : null, distribution };
}

class ReviewRepository extends BaseRepository {
  constructor(db) {
    super(db, 'reviews');
  }

  /**
   * Rating summary computed in MongoDB, so we never load every review to average them.
   * Same semantics as the old in-memory loop: a missing/zero rating counts as 5, and the
   * distribution bucket is the rating rounded half-up and clamped to 1..5.
   * @returns {Promise<{ average: number|null, count: number, distribution: Record<number, number> }>}
   */
  async ratingSummary(garageId) {
    const value = { $cond: [{ $gt: [{ $ifNull: ['$rating', 0] }, 0] }, '$rating', MISSING_RATING_VALUE] };
    const buckets = await this.aggregate([
      { $match: { garageId } },
      { $project: { _id: 0, value } },
      { $project: { value: 1, star: { $min: [STAR_MAX, { $max: [STAR_MIN, { $floor: { $add: ['$value', 0.5] } }] }] } } },
      { $group: { _id: '$star', count: { $sum: 1 }, sum: { $sum: '$value' } } },
    ]);
    return summarizeRatingBuckets(buckets);
  }

  /** One page of a garage's reviews; `page` comes from core/pagination.parsePagination. */
  listPageForGarage(garageId, page, sort) {
    return this.findPage({ garageId }, page, { sort });
  }

  findInGarage(reviewId, garageId) {
    return this.findOne({ _id: reviewId, garageId });
  }

  findByObjectId(reviewId) {
    return this.findOne({ _id: reviewId });
  }

  async existsForBooking(bookingId) {
    return (await this.count({ bookingId })) > 0;
  }

  /** Which of the given booking ObjectIds already have a review. Resolves to a Set of id strings. */
  async reviewedBookingIds(bookingIds) {
    if (!bookingIds.length) return new Set();
    const rows = await this.find({ bookingId: { $in: bookingIds } }, { projection: { bookingId: 1 } });
    return new Set(rows.map((row) => String(row.bookingId)));
  }

  create(doc) {
    return this.insertOne(doc);
  }

  setReply(reviewId, reply, now = new Date()) {
    return this.updateOne({ _id: reviewId }, { $set: { reply, updatedAt: now } });
  }

  deleteByObjectId(reviewId) {
    return this.deleteOne({ _id: reviewId });
  }
}

/**
 * Creates the reviews indexes. A unique-index failure (legacy duplicate reviews for one booking)
 * is reported rather than crashing startup, like models/CoreIndexes.js.
 */
async function ensureReviewIndexes(db) {
  const problems = [];
  for (const [keys, options] of REVIEW_INDEXES) {
    try {
      await db.collection('reviews').createIndex(keys, options);
    } catch (err) {
      problems.push(`reviews ${JSON.stringify(keys)}: ${err.message}`);
    }
  }
  return { problems };
}

module.exports = { ReviewRepository, ensureReviewIndexes, summarizeRatingBuckets, REVIEW_INDEXES };
