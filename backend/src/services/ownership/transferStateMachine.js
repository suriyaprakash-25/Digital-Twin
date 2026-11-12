/**
 * Ownership-transfer state machine (same shape as services/settlementStateMachine.js).
 *
 *   pending ──accept (buyer)──► accepted   (terminal)
 *      │────reject (buyer / system)──► rejected   (terminal)
 *      └────cancel (seller)──► cancelled  (terminal)
 *
 * Status values are the lowercase strings already stored in the `transfers` collection, so no data
 * migration is needed. Every transition is applied with a compare-and-swap on the current status
 * (TransferRepository.transitionStatus), so a transfer can leave `pending` exactly once.
 */
const { ConflictError } = require('../../core/errors');

const TRANSFER_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [TRANSFER_STATUS.PENDING]: Object.freeze([TRANSFER_STATUS.ACCEPTED, TRANSFER_STATUS.REJECTED, TRANSFER_STATUS.CANCELLED]),
  [TRANSFER_STATUS.ACCEPTED]: Object.freeze([]),
  [TRANSFER_STATUS.REJECTED]: Object.freeze([]),
  [TRANSFER_STATUS.CANCELLED]: Object.freeze([]),
});

function isKnownStatus(status) {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TRANSITIONS, status);
}

/** Unlike settlements, a self-transition is NOT a no-op here: accepting twice must never re-run. */
function canTransitionTransfer(from, to) {
  return isKnownStatus(from) && isKnownStatus(to) && ALLOWED_TRANSITIONS[from].includes(to);
}

function isTerminalTransferStatus(status) {
  return isKnownStatus(status) && ALLOWED_TRANSITIONS[status].length === 0;
}

/** @throws {ConflictError} TRANSFER_ILLEGAL_TRANSITION */
function assertTransferTransition(from, to) {
  if (!canTransitionTransfer(from, to)) {
    throw new ConflictError(`Illegal transfer state transition from ${from} to ${to}`, 'TRANSFER_ILLEGAL_TRANSITION');
  }
}

module.exports = {
  TRANSFER_STATUS,
  ALLOWED_TRANSITIONS,
  canTransitionTransfer,
  isTerminalTransferStatus,
  assertTransferTransition,
};
