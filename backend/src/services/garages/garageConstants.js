/**
 * Named values for the garage domain (previously magic numbers/strings in routes/garages.js).
 * Public-profile defaults are what the marketplace has always shown for incomplete profiles.
 */
const { PAGINATION, TIME } = require('../../core/constants');

const BOOKING_STATUS_COMPLETED = 'COMPLETED';

const PROFILE = Object.freeze({
  DEFAULT_MAX_CAPACITY: 20,
  MIN_CAPACITY: 1,
  LOCATION_ADDRESS_MAX_LENGTH: 500,
  LATITUDE_RANGE: Object.freeze([-90, 90]),
  LONGITUDE_RANGE: Object.freeze([-180, 180]),
});

const UPLOADS = Object.freeze({
  GALLERY_MAX_FILES: 10,
  GALLERY_FOLDER: 'driveportz/garages/gallery',
  PROFILE_FOLDER: 'driveportz/garages/profile',
  RESOURCE_TYPE: 'image',
});

const RATINGS = Object.freeze({
  // Shown before a garage has any reviews.
  DEFAULT_GARAGE_RATING: 4.8,
  // Legacy reviews without a rating count as 5 stars.
  DEFAULT_REVIEW_RATING: 5,
  MIN: 1,
  MAX: 5,
});

const REVIEWS = Object.freeze({
  MESSAGE_MIN_LENGTH: 20,
  MESSAGE_MAX_LENGTH: 1000,
  TITLE_MAX_LENGTH: 150,
  REPLY_MIN_LENGTH: 5,
  // The list used to be unbounded; the default page is the largest allowed page so existing
  // clients (which never send ?page) keep seeing every review of a pilot-sized garage.
  PAGE_DEFAULT_LIMIT: PAGINATION.MAX_LIMIT,
  PAGE_MAX_LIMIT: PAGINATION.MAX_LIMIT,
  SORTS: Object.freeze({
    newest: { createdAt: -1, _id: -1 },
    rating_high: { rating: -1, createdAt: -1, _id: -1 },
    rating_low: { rating: 1, createdAt: -1, _id: -1 },
  }),
  DEFAULT_SORT: 'newest',
  DEFAULT_USER_NAME: 'Customer',
  DEFAULT_REVIEWER_NAME: 'Verified Customer',
  DEFAULT_VEHICLE: 'Vehicle',
  DEFAULT_SERVICE_NAME: 'General Service',
  DEFAULT_REVIEWED_SERVICE: 'Verified Service',
  DEFAULT_BOOKING_SERVICE: 'Completed Service',
  DEFAULT_BOOKING_DATE: 'Recent',
});

const CATALOGUE = Object.freeze({
  OWNER_DEFAULT_CATEGORY: 'General Service',
  PUBLIC_DEFAULT_CATEGORY: 'General Maintenance',
  PUBLIC_DEFAULT_DURATION_MINS: 60,
});

const DEFAULT_WEEKDAY_HOURS = Object.freeze({ isOpen: true, openTime: '09:00', closeTime: '19:00' });

const PUBLIC_PROFILE_DEFAULTS = Object.freeze({
  CONTACT_EMAIL: 'contact@driveportz.com',
  DESCRIPTION: 'Authorized partner service center equipped with state-of-the-art diagnostic machinery and certified mechanics.',
  CERTIFICATIONS: Object.freeze(['Bosch Authorized', 'DrivePortz Verified', 'ISO 9001 Certified']),
  SPECIALIZATIONS: Object.freeze(['Periodic Service', 'Engine Overhaul', 'AC Repair', 'Denting & Painting', 'Electricals']),
  EXPERIENCE_YEARS: 8,
  PARTNER_SINCE_YEAR: 2024,
  BUSINESS_HOURS: Object.freeze({
    Monday: DEFAULT_WEEKDAY_HOURS,
    Tuesday: DEFAULT_WEEKDAY_HOURS,
    Wednesday: DEFAULT_WEEKDAY_HOURS,
    Thursday: DEFAULT_WEEKDAY_HOURS,
    Friday: DEFAULT_WEEKDAY_HOURS,
    Saturday: Object.freeze({ isOpen: true, openTime: '09:00', closeTime: '18:00' }),
    Sunday: Object.freeze({ isOpen: false, openTime: '10:00', closeTime: '16:00' }),
  }),
  FACILITIES: Object.freeze({ parkingAvailable: true, pickupDrop: true, homeService: true, emergencyService: true }),
  PAYMENT_METHODS: Object.freeze(['Cash', 'UPI', 'Credit/Debit Card', 'Net Banking']),
});

const CACHE_TTL = Object.freeze({
  // Public garage detail page. Writes on this router invalidate immediately; the TTL bounds
  // staleness for other instances and for writes made elsewhere (e.g. bookings).
  GARAGE_DETAIL_MS: TIME.MINUTE_MS,
});

module.exports = {
  BOOKING_STATUS_COMPLETED,
  PROFILE,
  UPLOADS,
  RATINGS,
  REVIEWS,
  CATALOGUE,
  PUBLIC_PROFILE_DEFAULTS,
  CACHE_TTL,
};
