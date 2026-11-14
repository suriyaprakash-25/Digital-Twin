/**
 * Which party may move a dispute, from which states, to which state.
 *
 * Previously "respond" set UNDER_REVIEW unconditionally (re-opening RESOLVED, REJECTED and
 * CANCELLED disputes) and "cancel" checked the status and then wrote without a condition. Every
 * participant action now goes through `applyDisputeAction`: a compare-and-swap that applies only
 * while the dispute is still in an allowed source state and no administrator holds the resolution
 * claim. Admin resolution uses DisputeRepository.claimResolution (same idea, plus a refund).
 */
const { AppError } = require('../../core/errors');
const { DISPUTE_STATUS, ACTIVE_DISPUTE_STATUSES, MSG } = require('./constants');

const DISPUTE_ACTIONS = Object.freeze({
  USER_RESPOND: Object.freeze({ from: ACTIVE_DISPUTE_STATUSES, to: DISPUTE_STATUS.UNDER_REVIEW, rejectMessage: MSG.DISPUTE_CLOSED, rejectStatus: 409 }),
  GARAGE_RESPOND: Object.freeze({ from: ACTIVE_DISPUTE_STATUSES, to: DISPUTE_STATUS.UNDER_REVIEW, rejectMessage: MSG.DISPUTE_CLOSED, rejectStatus: 409 }),
  // 400 + this message is what the cancel endpoint has always returned for a non-cancellable dispute.
  CANCEL: Object.freeze({ from: Object.freeze([DISPUTE_STATUS.OPEN, DISPUTE_STATUS.WAITING_FOR_USER]), to: DISPUTE_STATUS.CANCELLED, rejectMessage: MSG.CANNOT_CANCEL, rejectStatus: 400 }),
});

class DisputeTransitionError extends AppError {
  constructor(message, { status = 409, code = 'ILLEGAL_DISPUTE_TRANSITION' } = {}) {
    super(message, { status, code });
    this.name = 'DisputeTransitionError';
  }
}

const canApply = (action, dispute) => Boolean(dispute && action.from.includes(dispute.status) && dispute.resolutionInProgress !== true);

/**
 * @param {{ disputes: { transitionFrom: Function }, dispute: object, action: object, fields?: object, now: Date }} args
 * @returns {Promise<object>} the updated dispute
 */
async function applyDisputeAction({ disputes, dispute, action, fields = {}, now }) {
  if (dispute.resolutionInProgress === true) {
    throw new DisputeTransitionError(MSG.BEING_RESOLVED, { code: 'DISPUTE_BEING_RESOLVED' });
  }
  if (!canApply(action, dispute)) {
    throw new DisputeTransitionError(action.rejectMessage, { status: action.rejectStatus });
  }
  const updated = await disputes.transitionFrom(dispute._id, action.from, { ...fields, status: action.to, updatedAt: now });
  if (!updated) {
    throw new DisputeTransitionError('Dispute was modified concurrently; reload and retry', { code: 'DISPUTE_CONCURRENT_MODIFICATION' });
  }
  return updated;
}

module.exports = { DISPUTE_ACTIONS, DisputeTransitionError, applyDisputeAction, canApply };
