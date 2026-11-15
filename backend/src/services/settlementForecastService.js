const { SETTLEMENT_STATUS } = require('./settlementStateMachine');
const { SETTLEMENT_STATUS_GROUPS } = require('../repositories/SettlementRepository');
const { createRepositories } = require('../repositories');
const { resolveGarageIds } = require('../utils/garageResolver');

/**
 * Calculates platform-wide treasury forecasting in integer paise
 * Routed completely through repositories (SettlementRepository, EarningsRepository)
 * @param {Object} [dbInstance]
 * @param {Object} [injectedRepos]
 * @returns {Promise<Object>}
 */
async function getTreasuryForecast(dbInstance, injectedRepos) {
  const repos = injectedRepos || createRepositories(dbInstance);
  const now = new Date();

  // 1. Current Available Garage Balances in Integer Paise
  const availableEarningsDocs = await repos.earnings.findAllAvailable();

  let availablePaise = 0;
  availableEarningsDocs.forEach(e => {
    const net = e.netAfterRefundPaise !== undefined
      ? e.netAfterRefundPaise
      : (e.garageNetPaise || Math.round((parseFloat(e.garageNetAmount) || 0) * 100));
    availablePaise += net;
  });

  // 2. Pending, Under Review, and Processing Settlements
  const pendingSettlementsDocs = await repos.settlements.findPending(SETTLEMENT_STATUS_GROUPS.PENDING);

  let pendingPaise = 0;
  let processingPaise = 0;
  let underReviewPaise = 0;

  pendingSettlementsDocs.forEach(s => {
    const amtPaise = s.approvedPaise !== undefined
      ? s.approvedPaise
      : (s.requestedPaise || Math.round((parseFloat(s.approvedAmount || s.requestedAmount) || 0) * 100));

    if (s.status === SETTLEMENT_STATUS.PROCESSING) {
      processingPaise += amtPaise;
    } else if (s.status === SETTLEMENT_STATUS.UNDER_REVIEW) {
      underReviewPaise += amtPaise;
    }
    pendingPaise += amtPaise;
  });

  // 3. Locked Hold Funds
  const activeHolds = await repos.settlements.findAllActiveHolds();

  // 4. Historical Payouts in last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  const past30SettledDocs = await repos.settlements.findSettledSince(thirtyDaysAgo);

  let past30TotalPaise = 0;
  past30SettledDocs.forEach(s => {
    const amtPaise = s.approvedPaise !== undefined
      ? s.approvedPaise
      : (s.requestedPaise || Math.round((parseFloat(s.approvedAmount || s.requestedAmount) || 0) * 100));
    past30TotalPaise += amtPaise;
  });

  const settledCount30Days = past30SettledDocs.length;
  const averageSettlementPaise = settledCount30Days > 0
    ? Math.round(past30TotalPaise / settledCount30Days)
    : 0;

  const settlementsPerDay = parseFloat((settledCount30Days / 30).toFixed(2));
  const dailyPayoutAveragePaise = Math.round(past30TotalPaise / 30);

  // Projections
  const projected7DayPayoutPaise = dailyPayoutAveragePaise * 7;
  const projected30DayPayoutPaise = dailyPayoutAveragePaise * 30;

  // Failure Rate Calculation
  const totalCompletedOrFailed = await repos.settlements.count({
    createdAt: { $gte: thirtyDaysAgo },
    status: { $in: [SETTLEMENT_STATUS.SETTLED, 'COMPLETED', SETTLEMENT_STATUS.FAILED, SETTLEMENT_STATUS.FAILED_PERMANENTLY] }
  });
  const failedCount = await repos.settlements.count({
    createdAt: { $gte: thirtyDaysAgo },
    status: { $in: [SETTLEMENT_STATUS.FAILED, SETTLEMENT_STATUS.FAILED_PERMANENTLY] }
  });

  const failedSettlementRate = totalCompletedOrFailed > 0
    ? parseFloat(((failedCount / totalCompletedOrFailed) * 100).toFixed(2))
    : 0;

  return {
    currentAvailablePaise: availablePaise,
    currentAvailableBalance: availablePaise / 100,
    pendingSettlementPaise: pendingPaise,
    pendingSettlementAmount: pendingPaise / 100,
    processingPaise,
    processingAmount: processingPaise / 100,
    underReviewPaise,
    underReviewAmount: underReviewPaise / 100,
    projected7DayPayoutPaise,
    projected7DayPayout: projected7DayPayoutPaise / 100,
    projected30DayPayoutPaise,
    projected30DayPayout: projected30DayPayoutPaise / 100,
    averageSettlementPaise,
    averageSettlementAmount: averageSettlementPaise / 100,
    settlementVelocity: settlementsPerDay,
    failedSettlementRate,
    activeHoldsCount: activeHolds.length,
    settledCount30Days,
    calculatedAt: now
  };
}

/**
 * Calculates garage-specific settlement forecast with strict isolation
 * Routed completely through repositories (SettlementRepository, EarningsRepository)
 * @param {string} garageId
 * @param {Object} [dbInstance]
 * @param {Object} [injectedRepos]
 * @returns {Promise<Object>}
 */
async function getGarageSettlementForecast(garageId, dbInstance, injectedRepos) {
  const repos = injectedRepos || createRepositories(dbInstance);
  const db = dbInstance || repos.settlements.db;
  const now = new Date();

  const garageIds = await resolveGarageIds(garageId, db);

  // 1. Available balance in integer paise
  const availableEarnings = await repos.earnings.findAvailableForGarage(garageIds);

  let availablePaise = 0;
  availableEarnings.forEach(e => {
    const net = e.netAfterRefundPaise !== undefined
      ? e.netAfterRefundPaise
      : (e.garageNetPaise || Math.round((parseFloat(e.garageNetAmount) || 0) * 100));
    availablePaise += net;
  });

  // 2. Pending settlements for this garage
  const pendingSettlements = await repos.settlements.findPendingForGarage(garageIds, SETTLEMENT_STATUS_GROUPS.PENDING);

  let pendingPaise = 0;
  pendingSettlements.forEach(s => {
    const amt = s.approvedPaise !== undefined ? s.approvedPaise : (s.requestedPaise || Math.round((parseFloat(s.approvedAmount || s.requestedAmount) || 0) * 100));
    pendingPaise += amt;
  });

  // 3. Historical Settled Average
  const pastSettled = await repos.settlements.findPastSettledForGarage(garageIds, 10);

  let pastTotalPaise = 0;
  pastSettled.forEach(s => {
    const amt = s.approvedPaise !== undefined ? s.approvedPaise : (s.requestedPaise || Math.round((parseFloat(s.approvedAmount || s.requestedAmount) || 0) * 100));
    pastTotalPaise += amt;
  });

  const averagePayoutPaise = pastSettled.length > 0
    ? Math.round(pastTotalPaise / pastSettled.length)
    : 0;

  // 4. Schedule & Hold info
  const scheduleDoc = await repos.settlements.findSchedule(garageIds);
  const activeHold = await repos.settlements.findActiveHold(garageIds);

  const estimatedPayoutDate = scheduleDoc?.nextRunAt || new Date(now.getTime() + (24 * 60 * 60 * 1000));

  return {
    garageId: String(garageId),
    availablePaise,
    currentAvailableBalance: availablePaise / 100,
    pendingSettlementPaise: pendingPaise,
    pendingSettlementAmount: pendingPaise / 100,
    pendingSettlementsCount: pendingSettlements.length,
    expectedNextPayoutPaise: availablePaise,
    expectedNextPayout: availablePaise / 100,
    historicalAveragePaise: averagePayoutPaise,
    historicalAveragePayout: averagePayoutPaise / 100,
    estimatedPayoutDate,
    hasActiveHold: Boolean(activeHold),
    holdReason: activeHold?.reason || null,
    settlementStatus: pendingSettlements.length > 0 ? pendingSettlements[0].status : (activeHold ? 'ON_HOLD' : 'READY_FOR_SETTLEMENT')
  };
}

module.exports = {
  getTreasuryForecast,
  getGarageSettlementForecast
};
