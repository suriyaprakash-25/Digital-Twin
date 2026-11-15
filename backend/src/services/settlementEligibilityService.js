const { SETTLEMENT_STATUS } = require('./settlementStateMachine');
const { loadConfig } = require('../config');
const { createRepositories } = require('../repositories');
const { resolveGarageIds } = require('../utils/garageResolver');

const ELIGIBILITY_REASON = {
  GARAGE_NOT_FOUND: 'GARAGE_NOT_FOUND',
  GARAGE_INACTIVE: 'GARAGE_INACTIVE',
  PAYOUT_PROFILE_MISSING: 'PAYOUT_PROFILE_MISSING',
  PAYOUT_PROFILE_UNVERIFIED: 'PAYOUT_PROFILE_UNVERIFIED',
  SETTLEMENT_HOLD: 'SETTLEMENT_HOLD',
  FINANCIAL_SUSPENSION: 'FINANCIAL_SUSPENSION',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  BELOW_MINIMUM_THRESHOLD: 'BELOW_MINIMUM_THRESHOLD',
  ACTIVE_SETTLEMENT_EXISTS: 'ACTIVE_SETTLEMENT_EXISTS',
  EARNINGS_ALREADY_LOCKED: 'EARNINGS_ALREADY_LOCKED',
  RISK_HOLD: 'RISK_HOLD',
  RECONCILIATION_HOLD: 'RECONCILIATION_HOLD'
};

/**
 * Deterministically checks whether a garage is eligible for a settlement payout
 * Routed completely through repositories (SettlementRepository, EarningsRepository, PayoutProfileRepository, GarageRepository, UserRepository)
 * @param {string} garageId
 * @param {number} [amount] - In Rupees
 * @param {Object} [dbInstance]
 * @param {Object} [injectedRepos]
 * @returns {Promise<Object>} Eligibility evaluation
 */
async function checkSettlementEligibility(garageId, amount, dbInstance, injectedRepos) {
  const repos = injectedRepos || createRepositories(dbInstance);

  const config = loadConfig();
  const minSettlementRupees = parseFloat(process.env.MIN_SETTLEMENT_AMOUNT) || 500;
  const minSettlementPaise = Math.round(minSettlementRupees * 100);

  // 1. Garage Exists
  const garageDoc = await repos.garages.findById(garageId);
  const userDoc = await repos.users.findById(garageId);

  if (!garageDoc && !userDoc) {
    return {
      eligible: false,
      reasonCode: ELIGIBILITY_REASON.GARAGE_NOT_FOUND,
      reason: 'Garage partner record was not found in the system.'
    };
  }

  // 2. Active Account Check
  const isActive = (garageDoc && garageDoc.isActive !== false) || (userDoc && userDoc.isActive !== false);
  if (!isActive) {
    return {
      eligible: false,
      reasonCode: ELIGIBILITY_REASON.GARAGE_INACTIVE,
      reason: 'Garage partner account is inactive or disabled.'
    };
  }

  // 3. Financial Suspension Check
  const isSuspended = (garageDoc && garageDoc.isSuspended === true) || (userDoc && userDoc.isSuspended === true);
  if (isSuspended) {
    return {
      eligible: false,
      reasonCode: ELIGIBILITY_REASON.FINANCIAL_SUSPENSION,
      reason: 'Garage partner has an active financial suspension.'
    };
  }

  const db = dbInstance || repos.garages.db;
  const garageIds = await resolveGarageIds(garageId, db);

  // 4. Payout Profile Check
  const payoutProfile = await repos.payoutProfiles.findForGarage(garageIds);
  if (!payoutProfile || !payoutProfile.bankAccountLast4) {
    return {
      eligible: false,
      reasonCode: ELIGIBILITY_REASON.PAYOUT_PROFILE_MISSING,
      reason: 'Garage linked bank account payout profile is not configured.'
    };
  }

  // 5. Payout Profile Verified Check
  if (payoutProfile.isVerified === false || payoutProfile.status === 'REJECTED') {
    return {
      eligible: false,
      reasonCode: ELIGIBILITY_REASON.PAYOUT_PROFILE_UNVERIFIED,
      reason: 'Garage payout profile is pending verification or rejected.'
    };
  }

  // 6. Active Holds Check
  const activeHold = await repos.settlements.findActiveHold(garageIds);
  if (activeHold) {
    return {
      eligible: false,
      reasonCode: ELIGIBILITY_REASON.SETTLEMENT_HOLD,
      reason: `Settlement is on hold: ${activeHold.reason || 'Active administrative hold'} (${activeHold.note || 'Contact Support'})`
    };
  }

  // 7. Active Processing Settlement Check
  const activeSettlement = await repos.settlements.findActiveSettlement(garageIds, [
    SETTLEMENT_STATUS.REQUESTED,
    SETTLEMENT_STATUS.UNDER_REVIEW,
    SETTLEMENT_STATUS.APPROVED,
    SETTLEMENT_STATUS.PROCESSING,
    SETTLEMENT_STATUS.RETRY_PENDING
  ]);

  if (activeSettlement) {
    return {
      eligible: false,
      reasonCode: ELIGIBILITY_REASON.ACTIVE_SETTLEMENT_EXISTS,
      reason: `An active settlement (${activeSettlement.settlementId}) is already in progress.`
    };
  }

  // 8. Calculate Authoritative Available Balance in Integer Paise
  const availableEarningsDocs = await repos.earnings.findAvailableForGarage(garageIds);

  let availablePaise = 0;
  availableEarningsDocs.forEach(e => {
    const net = e.netAfterRefundPaise !== undefined ? e.netAfterRefundPaise : (e.garageNetPaise || Math.round((parseFloat(e.garageNetAmount) || 0) * 100));
    availablePaise += net;
  });

  const availableRupees = availablePaise / 100;
  const requestedRupees = amount !== undefined ? parseFloat(amount) : availableRupees;
  const requestedPaise = Math.round(requestedRupees * 100);

  // 9. Minimum Threshold Check
  if (requestedPaise < minSettlementPaise) {
    return {
      eligible: false,
      reasonCode: ELIGIBILITY_REASON.BELOW_MINIMUM_THRESHOLD,
      reason: `Requested amount ₹${requestedRupees.toLocaleString('en-IN')} is below the minimum settlement threshold of ₹${minSettlementRupees.toLocaleString('en-IN')}.`,
      availablePaise,
      requestedPaise,
      availableRupees,
      requestedRupees
    };
  }

  // 10. Sufficient Balance Check
  if (requestedPaise > availablePaise || availablePaise <= 0) {
    return {
      eligible: false,
      reasonCode: ELIGIBILITY_REASON.INSUFFICIENT_BALANCE,
      reason: `Requested amount ₹${requestedRupees.toLocaleString('en-IN')} exceeds available balance of ₹${availableRupees.toLocaleString('en-IN')}.`,
      availablePaise,
      requestedPaise,
      availableRupees,
      requestedRupees
    };
  }

  return {
    eligible: true,
    reasonCode: 'ELIGIBLE',
    reason: 'Garage partner is fully eligible for settlement payout.',
    availablePaise,
    requestedPaise,
    availableRupees,
    requestedRupees,
    payoutProfile: {
      bankAccountLast4: payoutProfile.bankAccountLast4,
      ifscMasked: payoutProfile.ifscMasked || 'XXXX000XXXX',
      accountHolderName: payoutProfile.accountHolderName || garageDoc?.name || 'Partner'
    }
  };
}

module.exports = {
  ELIGIBILITY_REASON,
  checkSettlementEligibility
};
