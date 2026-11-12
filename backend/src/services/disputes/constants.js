/**
 * Named values for the payment-dispute domain (previously inline in routes/disputes.js and
 * services/disputeService.js).
 */
const { DISPUTE_STATUS, DISPUTE_RESOLUTION, DISPUTE_CATEGORY } = require('../../models/Dispute');
const { ACTIVE_DISPUTE_STATUSES } = require('../../repositories/DisputeRepository');

const IN_REVIEW_STATUSES = Object.freeze([DISPUTE_STATUS.UNDER_REVIEW, DISPUTE_STATUS.WAITING_FOR_GARAGE, DISPUTE_STATUS.WAITING_FOR_USER]);
const TERMINAL_STATUSES = Object.freeze([DISPUTE_STATUS.RESOLVED, DISPUTE_STATUS.REJECTED, DISPUTE_STATUS.CANCELLED]);
const REFUND_CATEGORIES = Object.freeze([DISPUTE_CATEGORY.REFUND_NOT_RECEIVED, DISPUTE_CATEGORY.WRONG_REFUND_AMOUNT]);
const REFUND_RESOLUTIONS = Object.freeze([DISPUTE_RESOLUTION.REFUND_FULL, DISPUTE_RESOLUTION.REFUND_PARTIAL]);

const LIST = Object.freeze({
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  ALL: 'ALL',
  // Search fields per audience (each list has always searched a slightly different set).
  SEARCH_FIELDS: Object.freeze({
    USER: Object.freeze(['disputeNumber', 'invoiceNumber', 'subject', 'garageName']),
    GARAGE: Object.freeze(['disputeNumber', 'invoiceNumber', 'subject', 'vehicleNumber']),
    ADMIN: Object.freeze(['disputeNumber', 'invoiceNumber', 'garageName', 'subject', 'vehicleNumber']),
  }),
});

const EVIDENCE = Object.freeze({
  // Type-allowlisted and magic-byte verified by utils/uploads.createUploader.
  MIME_TYPES: Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  MAX_BYTES: 10 * 1024 * 1024,
  FIELD: 'evidence',
  FOLDER: 'driveportz/disputes',
  RESOURCE_TYPE: 'auto',
});

const LIMITS = Object.freeze({
  SUBJECT_MAX_LENGTH: 200,
  TEXT_MAX_LENGTH: 5000,
});

const DEFAULTS = Object.freeze({
  CATEGORY: DISPUTE_CATEGORY.OTHER,
  SUBJECT: 'Payment Dispute',
  GARAGE_NAME: 'Authorized Service Center',
  SERVICE_TYPE: 'Automotive Service',
  NOT_AVAILABLE: 'N/A',
  DASH: '—',
  REJECTION_NOTE: 'Dispute rejected after review',
});

const ACTOR_ROLES = Object.freeze({ USER: 'USER', GARAGE: 'GARAGE', ADMIN: 'ADMIN', SYSTEM: 'SYSTEM' });

const MSG = Object.freeze({
  PAYMENT_AND_DESCRIPTION_REQUIRED: 'Payment ID and description are required',
  PAYMENT_NOT_FOUND: 'Payment record not found',
  PAYMENT_NOT_OWNED: 'Unauthorized: Payment does not belong to this user account',
  INVALID_AMOUNT: 'Please provide a valid disputed amount',
  INVALID_CATEGORY: 'Invalid dispute category',
  DISPUTE_RECORD_NOT_FOUND: 'Dispute record not found',
  DISPUTE_NOT_FOUND: 'Dispute not found',
  FORBIDDEN: 'Forbidden',
  GARAGE_FORBIDDEN: 'Forbidden: You do not own this service dispute',
  MESSAGE_REQUIRED: 'Message is required',
  RESPONSE_REQUIRED: 'Response explanation is required',
  CANNOT_CANCEL: 'Cannot cancel a dispute that is under review or resolved',
  DISPUTE_CLOSED: 'This dispute is closed and can no longer be updated',
  BEING_RESOLVED: 'Dispute is already being resolved by another administrator',
  INVALID_RESOLUTION: 'Invalid resolution',
  REFUND_PAYMENT_NOT_FOUND: 'Original payment record not found for refund processing',
});

module.exports = {
  DISPUTE_STATUS,
  DISPUTE_RESOLUTION,
  DISPUTE_CATEGORY,
  ACTIVE_DISPUTE_STATUSES,
  IN_REVIEW_STATUSES,
  TERMINAL_STATUSES,
  REFUND_CATEGORIES,
  REFUND_RESOLUTIONS,
  LIST,
  EVIDENCE,
  LIMITS,
  DEFAULTS,
  ACTOR_ROLES,
  MSG,
};
