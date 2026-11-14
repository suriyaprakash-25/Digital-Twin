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

/** Legacy rows written by the old admin router used COMPLETED for the terminal paid-out state. */
const LEGACY_STATUS_ALIASES = Object.freeze({ COMPLETED: SETTLEMENT_STATUS.SETTLED });

function normalizeSettlementStatus(status) {
  return LEGACY_STATUS_ALIASES[status] || status;
}

class SettlementTransitionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SettlementTransitionError';
    this.code = code;
    this.status = code === 'SETTLEMENT_CONCURRENT_MODIFICATION' ? 409 : 400;
  }
}

/**
 * The ONLY sanctioned way to change a settlement's status.
 *
 * Validates the transition against ALLOWED_TRANSITIONS and applies it with a compare-and-swap on
 * the current status, so two concurrent operators (or a retry racing a manual action) can never
 * both move the same settlement — e.g. two "process" clicks cannot both trigger a payout.
 *
 * @returns {Promise<object>} the updated settlement document
 */
async function transitionSettlement({ collection, settlement, to, set = {}, session }) {
  const from = normalizeSettlementStatus(settlement.status);
  if (!canTransitionSettlementStatus(from, to)) {
    throw new SettlementTransitionError(`Illegal settlement state transition from ${from} to ${to}`, 'ILLEGAL_SETTLEMENT_TRANSITION');
  }
  const now = new Date();
  const updated = await collection.findOneAndUpdate(
    { _id: settlement._id, status: settlement.status },
    {
      $set: { ...set, status: to, updatedAt: now },
      $push: { statusHistory: { from, to, at: now } },
    },
    { returnDocument: 'after', ...(session ? { session } : {}) }
  );
  if (!updated) {
    throw new SettlementTransitionError('Settlement was modified concurrently; reload and retry', 'SETTLEMENT_CONCURRENT_MODIFICATION');
  }
  return updated;
}

module.exports = {
  SETTLEMENT_STATUS,
  ALLOWED_TRANSITIONS,
  LEGACY_STATUS_ALIASES,
  SettlementTransitionError,
  canTransitionSettlementStatus,
  validateSettlementTransition,
  normalizeSettlementStatus,
  transitionSettlement
};
