/**
 * Comprehensive Settlement State Machine
 */
const SETTLEMENT_STATUS = {
  REQUESTED: 'REQUESTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  PROCESSING: 'PROCESSING',
  SETTLED: 'SETTLED',
  FAILED: 'FAILED',
  RETRY_PENDING: 'RETRY_PENDING',
  FAILED_PERMANENTLY: 'FAILED_PERMANENTLY',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
};

const ALLOWED_TRANSITIONS = {
  [SETTLEMENT_STATUS.REQUESTED]: [
    SETTLEMENT_STATUS.UNDER_REVIEW,
    SETTLEMENT_STATUS.APPROVED,
    SETTLEMENT_STATUS.REJECTED,
    SETTLEMENT_STATUS.CANCELLED
  ],
  [SETTLEMENT_STATUS.UNDER_REVIEW]: [
    SETTLEMENT_STATUS.APPROVED,
    SETTLEMENT_STATUS.REJECTED,
    SETTLEMENT_STATUS.CANCELLED
  ],
  [SETTLEMENT_STATUS.APPROVED]: [
    SETTLEMENT_STATUS.PROCESSING,
    SETTLEMENT_STATUS.UNDER_REVIEW,
    SETTLEMENT_STATUS.REJECTED,
    SETTLEMENT_STATUS.CANCELLED
  ],
  [SETTLEMENT_STATUS.PROCESSING]: [
    SETTLEMENT_STATUS.SETTLED,
    SETTLEMENT_STATUS.FAILED
  ],
  [SETTLEMENT_STATUS.FAILED]: [
    SETTLEMENT_STATUS.RETRY_PENDING,
    SETTLEMENT_STATUS.FAILED_PERMANENTLY
  ],
  [SETTLEMENT_STATUS.RETRY_PENDING]: [
    SETTLEMENT_STATUS.PROCESSING,
    SETTLEMENT_STATUS.FAILED_PERMANENTLY,
    SETTLEMENT_STATUS.CANCELLED
  ],
  [SETTLEMENT_STATUS.SETTLED]: [], // Terminal state
  [SETTLEMENT_STATUS.REJECTED]: [], // Terminal state
  [SETTLEMENT_STATUS.FAILED_PERMANENTLY]: [], // Terminal state
  [SETTLEMENT_STATUS.CANCELLED]: [] // Terminal state
};

/**
 * Validates if a state transition is legal
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {boolean}
 */
function canTransitionSettlementStatus(fromStatus, toStatus) {
  if (!fromStatus || !toStatus) return false;
  if (fromStatus === toStatus) return true; // Idempotent no-op

  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowed) return false;

  return allowed.includes(toStatus);
}

/**
 * Throws an error if a transition is illegal
 */
function validateSettlementTransition(fromStatus, toStatus) {
  if (!canTransitionSettlementStatus(fromStatus, toStatus)) {
    throw new Error(`Illegal settlement state transition from ${fromStatus} to ${toStatus}`);
  }
}

module.exports = {
  SETTLEMENT_STATUS,
  ALLOWED_TRANSITIONS,
  canTransitionSettlementStatus,
  validateSettlementTransition
};
