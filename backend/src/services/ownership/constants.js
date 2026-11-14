/**
 * Named constants for the ownership-transfer domain (previously string literals in routes/ownership.js).
 * Client-facing messages are kept verbatim because the React pages display them.
 */

const MSG = Object.freeze({
  INITIATE_REQUIRED: 'Vehicle ID and buyer email are required',
  INVALID_VEHICLE_ID: 'Invalid vehicle ID',
  INVALID_TRANSFER_ID: 'Invalid transfer ID',
  TRANSFER_ID_REQUIRED: 'Transfer ID is required',
  VEHICLE_NOT_OWNED: 'Vehicle not found or unauthorized',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  SELF_TRANSFER: 'You cannot transfer ownership to yourself',
  BUYER_NOT_FOUND: 'Buyer with this email is not registered on Driveportz',
  ALREADY_PENDING: 'There is already a pending transfer request for this vehicle',
  PENDING_NOT_FOUND: 'Pending transfer request not found',
  NOT_BUYER_ACCEPT: 'Unauthorized: You are not the designated buyer for this transfer',
  NOT_BUYER_REJECT: 'Unauthorized: You are not the designated buyer',
  NOT_SELLER_CANCEL: 'Unauthorized: Only the seller can cancel this transfer',
  NO_LONGER_PENDING: 'This transfer request is no longer pending',
  ACCEPT_IN_PROGRESS: 'This transfer is already being accepted',
  OWNERSHIP_CHANGED: 'The vehicle is no longer owned by the seller, so this transfer cannot be completed',
  OPEN_BOOKINGS: 'This vehicle has an open garage booking. The seller must complete or cancel it before the transfer can be accepted',
  INITIATED: 'Transfer request initiated successfully',
  ACCEPTED: 'Ownership transferred successfully',
  REJECTED: 'Ownership transfer request rejected',
  CANCELLED: 'Ownership transfer request cancelled',
});

const REASONS = Object.freeze({
  ANOTHER_ACCEPTED: 'Another transfer was accepted',
  OWNERSHIP_CHANGED: 'Vehicle ownership changed before acceptance',
});

const DEFAULT_NAMES = Object.freeze({
  SELLER: 'Current Owner',
  SELLER_SHORT: 'Seller',
  BUYER: 'New Owner',
  BUYER_SHORT: 'Buyer',
  ORIGINAL_OWNER: 'Original Owner',
});

const NOTIFICATION_TYPES = Object.freeze({
  REQUEST: 'transfer_request',
  ACCEPTED: 'transfer_accepted',
  REJECTED: 'transfer_rejected',
  CANCELLED: 'transfer_cancelled',
});

/**
 * Bookings that are still open with a garage. Completing one bills the vehicle's CURRENT owner, so a
 * transfer accepted while one is open would bill the buyer for a job the seller booked.
 */
const OPEN_BOOKING_STATUSES = Object.freeze(['REQUESTED', 'ACCEPTED', 'IN_PROGRESS']);

const ACCEPTANCE = Object.freeze({
  // An `accepted` transfer whose follow-up writes never finished (crash between writes on a
  // standalone mongod, where there are no transactions) may be re-driven after this grace period.
  RECOVERY_GRACE_MS: 30 * 1000,
});

// Used when a vehicle predates ownership-history tracking (no rows): a synthetic first entry.
const LEGACY_HISTORY_EPOCH = new Date(2024, 0, 1);

const MONGO_DUPLICATE_KEY = 11000;

module.exports = {
  MSG,
  REASONS,
  DEFAULT_NAMES,
  NOTIFICATION_TYPES,
  OPEN_BOOKING_STATUSES,
  ACCEPTANCE,
  LEGACY_HISTORY_EPOCH,
  MONGO_DUPLICATE_KEY,
};
