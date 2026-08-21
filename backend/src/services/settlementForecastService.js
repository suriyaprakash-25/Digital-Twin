const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { SETTLEMENT_STATUS } = require('./settlementStateMachine');

function safeObjectId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

/**
 * Calculates platform-wide treasury forecasting in integer paise
 * @param {Object} [dbInstance]
 * @returns {Promise<Object>}
 */
async function getTreasuryForecast(dbInstance) {
  const db = dbInstance || getDb();
  const earnings = db.collection('garage_earnings');
  const settlements = db.collection('settlements');
  const holds = db.collection('settlement_holds');
  const now = new Date();

  // 1. Current Available Garage Balances in Integer Paise
  const availableEarningsDocs = await earnings
    .find({ status: { $in: ['AVAILABLE', 'REFUND_ADJUSTMENT'] } })
    .toArray();

  let availablePaise = 0;
  availableEarningsDocs.forEach(e => {
    const net = e.netAfterRefundPaise !== undefined
      ? e.netAfterRefundPaise
      : (e.garageNetPaise || Math.round((parseFloat(e.garageNetAmount) || 0) * 100));
    availablePaise += net;
  });

  // 2. Pending, Under Review, and Processing Settlements
  const pendingSettlementsDocs = await settlements
    .find({
      status: {
        $in: [
          SETTLEMENT_STATUS.REQUESTED,
          SETTLEMENT_STATUS.UNDER_REVIEW,
          SETTLEMENT_STATUS.APPROVED,
          SETTLEMENT_STATUS.PROCESSING,
          SETTLEMENT_STATUS.RETRY_PENDING
        ]
      }
    })
    .toArray();

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
  const activeHolds = await holds.find({ active: true }).toArray();

  // 4. Historical Payouts in last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  const past30SettledDocs = await settlements
    .find({
      status: { $in: [SETTLEMENT_STATUS.SETTLED, 'COMPLETED'] },
      createdAt: { $gte: thirtyDaysAgo }
    })
    .toArray();

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
  const totalCompletedOrFailed = await settlements.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
    status: { $in: [SETTLEMENT_STATUS.SETTLED, 'COMPLETED', SETTLEMENT_STATUS.FAILED, SETTLEMENT_STATUS.FAILED_PERMANENTLY] }
  });
  const failedCount = await settlements.countDocuments({
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
 * @param {string} garageId
 * @param {Object} [dbInstance]
 * @returns {Promise<Object>}
 */
async function getGarageSettlementForecast(garageId, dbInstance) {
  const db = dbInstance || getDb();
  const earnings = db.collection('garage_earnings');
  const settlements = db.collection('settlements');
  const schedules = db.collection('settlement_schedules');
  const holds = db.collection('settlement_holds');
  const now = new Date();

  // 1. Available balance in integer paise
  const availableEarnings = await earnings
    .find({
      garageId: String(garageId),
      status: { $in: ['AVAILABLE', 'REFUND_ADJUSTMENT'] }
    })
    .toArray();

  let availablePaise = 0;
  availableEarnings.forEach(e => {
    const net = e.netAfterRefundPaise !== undefined
      ? e.netAfterRefundPaise
      : (e.garageNetPaise || Math.round((parseFloat(e.garageNetAmount) || 0) * 100));
    availablePaise += net;
  });

  // 2. Pending settlements for this garage
  const pendingSettlements = await settlements
    .find({
      garageId: String(garageId),
      status: {
        $in: [
          SETTLEMENT_STATUS.REQUESTED,
          SETTLEMENT_STATUS.UNDER_REVIEW,
          SETTLEMENT_STATUS.APPROVED,
          SETTLEMENT_STATUS.PROCESSING,
          SETTLEMENT_STATUS.RETRY_PENDING
        ]
      }
    })
    .toArray();

  let pendingPaise = 0;
  pendingSettlements.forEach(s => {
    const amt = s.approvedPaise !== undefined ? s.approvedPaise : (s.requestedPaise || Math.round((parseFloat(s.approvedAmount || s.requestedAmount) || 0) * 100));
    pendingPaise += amt;
  });

  // 3. Historical Settled Average
  const pastSettled = await settlements
    .find({
      garageId: String(garageId),
      status: { $in: [SETTLEMENT_STATUS.SETTLED, 'COMPLETED'] }
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  let pastTotalPaise = 0;
  pastSettled.forEach(s => {
    const amt = s.approvedPaise !== undefined ? s.approvedPaise : (s.requestedPaise || Math.round((parseFloat(s.approvedAmount || s.requestedAmount) || 0) * 100));
    pastTotalPaise += amt;
  });

  const averagePayoutPaise = pastSettled.length > 0
    ? Math.round(pastTotalPaise / pastSettled.length)
    : 0;

  // 4. Schedule & Hold info
  const scheduleDoc = await schedules.findOne({ garageId: String(garageId) });
  const activeHold = await holds.findOne({ garageId: String(garageId), active: true });

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
