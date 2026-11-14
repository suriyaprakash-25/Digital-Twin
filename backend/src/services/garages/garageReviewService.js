/**
 * Garage reviews: paginated listing with an aggregated rating summary, review eligibility,
 * creation (one review per COMPLETED booking owned by the caller), owner replies and admin removal.
 */
const { ValidationError, ForbiddenError, NotFoundError } = require('../../core/errors');
const { toObjectId, idValues } = require('../../repositories/BaseRepository');
const { parsePagination } = require('../../core/pagination');
const { BOOKING_STATUS_COMPLETED, RATINGS, REVIEWS } = require('./garageConstants');

const DUPLICATE_KEY_ERROR = 11000;

const MSG = Object.freeze({
  INVALID_GARAGE_ID: 'Invalid Garage ID',
  RATING_REQUIRED: `Rating is required (${RATINGS.MIN} to ${RATINGS.MAX} stars)`,
  MESSAGE_TOO_SHORT: `Review message must be at least ${REVIEWS.MESSAGE_MIN_LENGTH} characters long`,
  MESSAGE_TOO_LONG: `Review message cannot exceed ${REVIEWS.MESSAGE_MAX_LENGTH} characters`,
  NOT_ELIGIBLE: 'Only customers with a completed service booking at this garage can write a review.',
  DUPLICATE: 'You have already submitted a review for this service booking.',
  REPLY_TOO_SHORT: `Reply message must be at least ${REVIEWS.REPLY_MIN_LENGTH} characters`,
  PROFILE_NOT_FOUND: 'Garage profile not found',
  REVIEW_NOT_FOUND: 'Review not found',
});

const NO_ELIGIBILITY = Object.freeze({ userCanReview: false, completedBookings: [] });

function bookingServiceName(booking, fallback) {
  return (booking.snapshots && booking.snapshots.service && booking.snapshots.service.title) || fallback;
}

function bookingVehicleModel(booking) {
  const vehicle = booking.snapshots && booking.snapshots.vehicle;
  return (vehicle && `${vehicle.brand} ${vehicle.model}`) || REVIEWS.DEFAULT_VEHICLE;
}

function toPublicReview(r) {
  return {
    id: String(r._id),
    garageId: String(r.garageId),
    userId: String(r.userId),
    userName: r.userName || REVIEWS.DEFAULT_USER_NAME,
    userPhotoUrl: r.userPhotoUrl || null,
    rating: r.rating || RATINGS.DEFAULT_REVIEW_RATING,
    reviewTitle: r.reviewTitle || '',
    reviewMessage: r.reviewMessage || '',
    vehicleModel: r.vehicleModel || REVIEWS.DEFAULT_VEHICLE,
    serviceName: r.serviceName || REVIEWS.DEFAULT_SERVICE_NAME,
    reply: r.reply || null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
  };
}

function toBookingOption(b) {
  return {
    id: String(b._id),
    serviceName: bookingServiceName(b, REVIEWS.DEFAULT_BOOKING_SERVICE),
    vehicleModel: bookingVehicleModel(b),
    date: b.createdAt ? new Date(b.createdAt).toLocaleDateString() : REVIEWS.DEFAULT_BOOKING_DATE,
  };
}

/** Bookings store garageId/userId as ObjectId or string depending on age: match both. */
function completedBookingFilter(garageId, userId) {
  return {
    garageId: { $in: idValues(garageId) },
    userId: { $in: idValues(userId) },
    status: BOOKING_STATUS_COMPLETED,
  };
}

function resolveSort(sort) {
  const key = typeof sort === 'string' && Object.prototype.hasOwnProperty.call(REVIEWS.SORTS, sort) ? sort : REVIEWS.DEFAULT_SORT;
  return REVIEWS.SORTS[key];
}

function parseGarageId(garageIdParam) {
  const garageId = toObjectId(garageIdParam);
  if (!garageId) throw new ValidationError(MSG.INVALID_GARAGE_ID);
  return garageId;
}

function validateReviewInput({ rating, reviewMessage } = {}) {
  const numRating = Number.parseInt(rating, 10);
  if (Number.isNaN(numRating) || numRating < RATINGS.MIN || numRating > RATINGS.MAX) throw new ValidationError(MSG.RATING_REQUIRED);
  const message = String(reviewMessage || '').trim();
  if (message.length < REVIEWS.MESSAGE_MIN_LENGTH) throw new ValidationError(MSG.MESSAGE_TOO_SHORT);
  if (message.length > REVIEWS.MESSAGE_MAX_LENGTH) throw new ValidationError(MSG.MESSAGE_TOO_LONG);
  return { numRating, message };
}

function createGarageReviewService({ repos, now = () => new Date() }) {
  const { reviews, bookings, garages, users } = repos;

  /** The caller's completed bookings at this garage that have not been reviewed yet. */
  async function unreviewedCompletedBookings(garageId, userId) {
    const completed = await bookings.find(completedBookingFilter(garageId, userId));
    const reviewed = await reviews.reviewedBookingIds(completed.map((b) => b._id));
    return { completed, unreviewed: completed.filter((b) => !reviewed.has(String(b._id))) };
  }

  async function eligibilityFor(garageId, user) {
    if (!user || !user.id) return NO_ELIGIBILITY;
    try {
      const { unreviewed } = await unreviewedCompletedBookings(garageId, user.id);
      return { userCanReview: unreviewed.length > 0, completedBookings: unreviewed.map(toBookingOption) };
    } catch {
      return NO_ELIGIBILITY; // eligibility is advisory; never fail the public list over it
    }
  }

  /**
   * GET /:garageId/reviews. The summary covers every review (aggregation); `reviews` is one page.
   * @returns {Promise<{ body: object, pagination: { total: number, page: number, limit: number } }>}
   */
  async function listReviews(garageIdParam, query = {}, user = null) {
    const garageId = parseGarageId(garageIdParam);
    const page = parsePagination(query, { defaultLimit: REVIEWS.PAGE_DEFAULT_LIMIT, maxLimit: REVIEWS.PAGE_MAX_LIMIT });
    const [pageResult, summary, eligibility] = await Promise.all([
      reviews.listPageForGarage(garageId, page, resolveSort(query.sort)),
      reviews.ratingSummary(garageId),
      eligibilityFor(garageId, user),
    ]);
    return {
      pagination: { total: pageResult.total, page: page.page, limit: page.limit },
      body: {
        averageRating: summary.count > 0 ? summary.average : RATINGS.DEFAULT_GARAGE_RATING,
        totalReviews: summary.count,
        ratingDistribution: summary.distribution,
        userCanReview: eligibility.userCanReview,
        completedBookings: eligibility.completedBookings,
        reviews: pageResult.items.map(toPublicReview),
      },
    };
  }

  /** The booking a new review is attached to: COMPLETED, owned by the caller, at this garage, unreviewed. */
  async function resolveReviewableBooking(garageId, userId, bookingIdParam) {
    const filter = completedBookingFilter(garageId, userId);
    if (bookingIdParam) {
      const bookingId = toObjectId(bookingIdParam);
      const booking = bookingId ? await bookings.findOne({ ...filter, _id: bookingId }) : null;
      if (!booking) throw new ForbiddenError(MSG.NOT_ELIGIBLE);
      if (await reviews.existsForBooking(booking._id)) throw new ValidationError(MSG.DUPLICATE);
      return booking;
    }
    const { completed, unreviewed } = await unreviewedCompletedBookings(garageId, userId);
    if (!completed.length) throw new ForbiddenError(MSG.NOT_ELIGIBLE);
    if (!unreviewed.length) throw new ValidationError(MSG.DUPLICATE);
    return unreviewed[0];
  }

  /** Recompute the denormalised garage rating from the aggregation. */
  async function refreshGarageRating(garageId, { touchUpdatedAt }) {
    const summary = await reviews.ratingSummary(garageId);
    const rating = summary.count > 0 ? summary.average : RATINGS.DEFAULT_GARAGE_RATING;
    await garages.setRatingStats(garageId, { rating, reviewCount: summary.count }, { touchUpdatedAt, now: now() });
    return { rating, reviewCount: summary.count };
  }

  async function createReview(garageIdParam, user, body = {}) {
    const garageId = parseGarageId(garageIdParam);
    const { numRating, message } = validateReviewInput(body);
    const booking = await resolveReviewableBooking(garageId, user.id, body.bookingId);
    const author = await users.findById(user.id, { projection: { name: 1, photoUrl: 1 } });
    const timestamp = now();
    const review = {
      garageId,
      userId: String(user.id),
      userName: (author && author.name) || user.name || REVIEWS.DEFAULT_REVIEWER_NAME,
      userPhotoUrl: (author && author.photoUrl) || null,
      bookingId: booking._id,
      serviceName: bookingServiceName(booking, REVIEWS.DEFAULT_REVIEWED_SERVICE),
      vehicleModel: bookingVehicleModel(booking),
      rating: numRating,
      reviewTitle: body.reviewTitle ? String(body.reviewTitle).slice(0, REVIEWS.TITLE_MAX_LENGTH) : '',
      reviewMessage: message,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    let result;
    try {
      result = await reviews.create(review);
    } catch (err) {
      // The unique bookingId index closes the race between two concurrent submissions.
      if (err && err.code === DUPLICATE_KEY_ERROR) throw new ValidationError(MSG.DUPLICATE);
      throw err;
    }
    const stats = await refreshGarageRating(garageId, { touchUpdatedAt: true });
    return {
      review: { id: String(result.insertedId), ...review, createdAt: timestamp.toISOString() },
      averageRating: stats.rating,
      totalReviews: stats.reviewCount,
    };
  }

  /** Owner reply: the review must belong to the caller's own garage. */
  async function replyToReview(user, reviewIdParam, { replyMessage } = {}) {
    if (!replyMessage || String(replyMessage).trim().length < REVIEWS.REPLY_MIN_LENGTH) throw new ValidationError(MSG.REPLY_TOO_SHORT);
    const garage = await garages.findByOwner(user.id);
    if (!garage) throw new ForbiddenError(MSG.PROFILE_NOT_FOUND);
    const reviewId = toObjectId(reviewIdParam);
    const review = reviewId ? await reviews.findInGarage(reviewId, garage._id) : null;
    if (!review) throw new NotFoundError(MSG.REVIEW_NOT_FOUND);
    const reply = { replyMessage: String(replyMessage).trim(), createdAt: now() };
    await reviews.setReply(reviewId, reply, now());
    return reply;
  }

  async function deleteReview(reviewIdParam) {
    const reviewId = toObjectId(reviewIdParam);
    const review = reviewId ? await reviews.findByObjectId(reviewId) : null;
    if (!review) throw new NotFoundError(MSG.REVIEW_NOT_FOUND);
    await reviews.deleteByObjectId(reviewId);
    await refreshGarageRating(review.garageId, { touchUpdatedAt: false });
  }

  return { listReviews, createReview, replyToReview, deleteReview };
}

module.exports = { createGarageReviewService, completedBookingFilter, toPublicReview, MSG };
