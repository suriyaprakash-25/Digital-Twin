/**
 * A garage's request to withdraw its available earnings (creates a REQUESTED settlement).
 *
 * Concurrency: two requests from the same garage are serialised by a per-garage lock whose
 * uniqueness is enforced by MongoDB (a unique _id), so the loser gets a 409 instead of both passing
 * the "no active settlement" eligibility check. The earnings rows are then locked with a
 * compare-and-swap on their status; if any row was taken in the meantime (e.g. by the settlement
 * scheduler) every row this request locked is released and the request fails with 409.
 *
 * Money: the settlement pays exactly the integer-paise sum of the rows it locks, never more than
 * the requested amount, and never more than the available balance.
 * Status changes after creation belong to settlementStateMachine.transitionSettlement.
 */
const crypto = require('crypto');
const { AppError, ConflictError } = require('../../core/errors');
const { asString } = require('../../core/text');
const { toPaise, fromPaise } = require('../../utils/money');
const { SETTLEMENT_STATUS } = require('../settlementStateMachine');
const { SETTLEMENT_REQUEST, REASON_CODES, ERROR_CODES, MSG, minSettlementPaise } = require('./constants');
const { parseRequestedAmount, selectEarningsForPayout, rupeesLabel } = require('./settlementSelection');

/** 400 with the eligibility reason code (`{ success:false, reasonCode, message }`). */
class SettlementIneligibleError extends AppError {
  constructor(message, reasonCode) {
    super(message, { status: 400, code: reasonCode, details: { reasonCode } });
  }
}

const label = (paise) => rupeesLabel(paise, SETTLEMENT_REQUEST.LOCALE);

/**
 * @param {object} deps
 * @param {object} deps.repos
 * @param {(userId: string) => Promise<string[]>} deps.resolveGarageIds
 * @param {(userId: string, amountRupees?: number) => Promise<object>} deps.checkEligibility
 * @param {() => Promise<string>} deps.nextSettlementNumber
 * @param {(userId: string, message: object) => Promise<any>} deps.notifyUser
 * @param {(entry: object) => Promise<any>} deps.logAudit
 * @param {number} deps.highValueThresholdRupees
 * @param {() => Date} [deps.now]
 * @param {() => string} [deps.newToken]
 * @param {{ warn: Function, error: Function }} [deps.log]
 */
function createSettlementRequestService({
  repos, resolveGarageIds, checkEligibility, nextSettlementNumber, notifyUser, logAudit,
  highValueThresholdRupees, now = () => new Date(), newToken = () => crypto.randomUUID(), log = console,
}) {
  function buildSettlementDoc({ user, settlementId, totalPaise, requestedPaise, selected, eligibility, notes, at }) {
    const amount = fromPaise(totalPaise);
    const isHighValue = totalPaise >= toPaise(highValueThresholdRupees);
    const profile = eligibility.payoutProfile;
    return {
      settlementId,
      garageId: String(user.id),
      requestedAmount: amount,
      requestedPaise: totalPaise,
      approvedAmount: amount,
      approvedPaise: totalPaise,
      garageRequestedPaise: requestedPaise,
      currency: SETTLEMENT_REQUEST.CURRENCY,
      status: SETTLEMENT_STATUS.REQUESTED,
      earningsIds: selected.map((d) => String(d._id)),
      payoutProfile: profile,
      destinationAccountId: profile && profile.bankAccountLast4 ? `Account ending in ${profile.bankAccountLast4}` : SETTLEMENT_REQUEST.DEFAULT_DESTINATION,
      notes: asString(notes, { maxLength: SETTLEMENT_REQUEST.NOTES_MAX }) || SETTLEMENT_REQUEST.DEFAULT_NOTES,
      requestedBy: String(user.id),
      isHighValue,
      requiredApprovalCount: isHighValue ? SETTLEMENT_REQUEST.HIGH_VALUE_APPROVALS : SETTLEMENT_REQUEST.STANDARD_APPROVALS,
      approvalCount: 0,
      approvals: [],
      requestedAt: at,
      approvedAt: null,
      processedAt: null,
      completedAt: null,
      createdAt: at,
      updatedAt: at,
    };
  }

  /** Eligibility + row selection + CAS lock + insert, all while holding the garage lock. */
  async function createLocked(user, amountRupees, notes) {
    const eligibility = await checkEligibility(String(user.id), amountRupees);
    if (!eligibility.eligible) throw new SettlementIneligibleError(eligibility.reason, eligibility.reasonCode);

    const garageIds = await resolveGarageIds(String(user.id));
    const available = await repos.earnings.findAvailableForGarage(garageIds);
    const capPaise = amountRupees === undefined ? null : toPaise(amountRupees);
    const { selected, totalPaise } = selectEarningsForPayout(available, capPaise);
    if (totalPaise <= 0 || totalPaise < minSettlementPaise() || (capPaise !== null && totalPaise > capPaise)) {
      throw new SettlementIneligibleError(
        `Earnings are paid out whole. The largest payout not above ₹${label(capPaise || 0)} is ₹${label(Math.max(0, totalPaise))}, below the minimum of ₹${label(minSettlementPaise())}. Request a larger amount or your full balance.`,
        REASON_CODES.NO_MATCHING_EARNINGS,
      );
    }

    const at = now();
    const settlementId = await nextSettlementNumber();
    const claimed = await repos.earnings.claimForSettlement(selected.map((d) => d._id), settlementId, at);
    if (claimed !== selected.length) {
      await repos.earnings.releaseSettlementClaim(settlementId, selected, at);
      throw new ConflictError(MSG.EARNINGS_CHANGED, ERROR_CODES.EARNINGS_CHANGED);
    }

    const doc = buildSettlementDoc({ user, settlementId, totalPaise, requestedPaise: capPaise === null ? totalPaise : capPaise, selected, eligibility, notes, at });
    try {
      const result = await repos.settlements.insertRequested(doc);
      if (!doc._id && result && result.insertedId) doc._id = result.insertedId;
    } catch (err) {
      await repos.earnings.releaseSettlementClaim(settlementId, selected, at);
      throw err;
    }
    return doc;
  }

  /**
   * @returns {Promise<{ settlement: object, message: string }>}
   */
  async function requestSettlement({ user, body = {}, req }) {
    const amountRupees = parseRequestedAmount(body.amount);
    const lockKey = `garage:${String(user.id)}`;
    const token = newToken();
    const locked = await repos.settlements.acquireRequestLock(lockKey, token, { now: now(), ttlMs: SETTLEMENT_REQUEST.LOCK_TTL_MS });
    if (!locked) throw new ConflictError(MSG.REQUEST_IN_PROGRESS, ERROR_CODES.REQUEST_IN_PROGRESS);

    let doc;
    try {
      doc = await createLocked(user, amountRupees, body.notes);
    } finally {
      await repos.settlements.releaseRequestLock(lockKey, token);
    }

    const amountLabel = label(doc.requestedPaise);
    // Side effects never fail a request whose money state is already committed.
    try {
      await notifyUser(String(user.id), {
        title: 'Settlement Requested',
        body: `Settlement request ${doc.settlementId} for ₹${amountLabel} has been submitted for review.`,
        data: { type: 'SETTLEMENT_REQUESTED', settlementId: doc.settlementId, amount: String(doc.requestedAmount) },
      });
    } catch (err) {
      log.warn('Error sending settlement notification:', err && err.message);
    }
    try {
      await logAudit({
        actorId: user.id,
        actorRole: 'GARAGE',
        action: 'SETTLEMENT_REQUESTED',
        resourceType: 'SETTLEMENT',
        resourceId: doc.settlementId,
        afterState: { requestedAmount: doc.requestedAmount, requestedPaise: doc.requestedPaise, settlementId: doc.settlementId, status: doc.status },
        req,
      });
    } catch (err) {
      log.error('Settlement audit log failed (settlement was created):', err && err.message);
    }

    return {
      settlement: { id: String(doc._id), ...doc },
      message: `Settlement request ${doc.settlementId} for ₹${amountLabel} submitted successfully`,
    };
  }

  return { requestSettlement };
}

module.exports = { createSettlementRequestService, SettlementIneligibleError };
