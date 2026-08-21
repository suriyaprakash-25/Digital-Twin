const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { SETTLEMENT_STATUS } = require('./settlementStateMachine');

const AGING_BUCKETS = {
  BUCKET_0_1: '0-1_DAYS',
  BUCKET_2_3: '2-3_DAYS',
  BUCKET_4_7: '4-7_DAYS',
  BUCKET_8_14: '8-14_DAYS',
  BUCKET_15_30: '15-30_DAYS',
  BUCKET_30_PLUS: '30+_DAYS'
};

const SLA_CONFIG = {
  REVIEW_HOURS: parseInt(process.env.SETTLEMENT_REVIEW_SLA_HOURS, 10) || 24,
  PROCESSING_HOURS: parseInt(process.env.SETTLEMENT_PROCESSING_SLA_HOURS, 10) || 48,
  FAILURE_HOURS: parseInt(process.env.SETTLEMENT_FAILURE_SLA_HOURS, 10) || 12
};

function determineAgingBucket(ageInDays) {
  if (ageInDays <= 1) return AGING_BUCKETS.BUCKET_0_1;
  if (ageInDays <= 3) return AGING_BUCKETS.BUCKET_2_3;
  if (ageInDays <= 7) return AGING_BUCKETS.BUCKET_4_7;
  if (ageInDays <= 14) return AGING_BUCKETS.BUCKET_8_14;
  if (ageInDays <= 30) return AGING_BUCKETS.BUCKET_15_30;
  return AGING_BUCKETS.BUCKET_30_PLUS;
}

/**
 * Performs aging bucket analysis and SLA delay detection on unsettled settlements
 * @param {Object} [dbInstance]
 * @returns {Promise<Object>}
 */
async function getSettlementAgingAnalysis(dbInstance) {
  const db = dbInstance || getDb();
  const settlements = db.collection('settlements');
  const holds = db.collection('settlement_holds');
  const garages = db.collection('garages');
  const now = new Date();

  // Find all active unsettled settlements
  const openSettlements = await settlements
    .find({
      status: {
        $in: [
          SETTLEMENT_STATUS.REQUESTED,
          SETTLEMENT_STATUS.UNDER_REVIEW,
          SETTLEMENT_STATUS.APPROVED,
          SETTLEMENT_STATUS.PROCESSING,
          SETTLEMENT_STATUS.RETRY_PENDING,
          SETTLEMENT_STATUS.FAILED,
          SETTLEMENT_STATUS.FAILED_PERMANENTLY
        ]
      }
    })
    .sort({ createdAt: 1 })
    .toArray();

  const activeHolds = await holds.find({ active: true }).toArray();
  const holdMap = new Map();
  activeHolds.forEach(h => {
    if (h.settlementId) holdMap.set(String(h.settlementId), h);
    if (h.garageId) holdMap.set(String(h.garageId), h);
  });

  const bucketSummaries = {
    [AGING_BUCKETS.BUCKET_0_1]: { count: 0, amountPaise: 0, amountRupees: 0 },
    [AGING_BUCKETS.BUCKET_2_3]: { count: 0, amountPaise: 0, amountRupees: 0 },
    [AGING_BUCKETS.BUCKET_4_7]: { count: 0, amountPaise: 0, amountRupees: 0 },
    [AGING_BUCKETS.BUCKET_8_14]: { count: 0, amountPaise: 0, amountRupees: 0 },
    [AGING_BUCKETS.BUCKET_15_30]: { count: 0, amountPaise: 0, amountRupees: 0 },
    [AGING_BUCKETS.BUCKET_30_PLUS]: { count: 0, amountPaise: 0, amountRupees: 0 }
  };

  const detailedAgingRecords = [];
  const slaBreaches = [];

  for (const s of openSettlements) {
    const createdAt = new Date(s.createdAt);
    const ageMs = Math.max(0, now.getTime() - createdAt.getTime());
    const ageHours = ageMs / (1000 * 60 * 60);
    const ageDays = parseFloat((ageMs / (1000 * 60 * 60 * 24)).toFixed(1));

    const bucket = determineAgingBucket(ageDays);
    const amountPaise = s.approvedPaise !== undefined
      ? s.approvedPaise
      : (s.requestedPaise || Math.round((parseFloat(s.approvedAmount || s.requestedAmount) || 0) * 100));
    const amountRupees = amountPaise / 100;

    bucketSummaries[bucket].count++;
    bucketSummaries[bucket].amountPaise += amountPaise;
    bucketSummaries[bucket].amountRupees += amountRupees;

    // Check SLA
    let isSlaBreached = false;
    let breachType = null;

    if (s.status === SETTLEMENT_STATUS.REQUESTED && ageHours > SLA_CONFIG.REVIEW_HOURS) {
      isSlaBreached = true;
      breachType = 'REVIEW_DELAY';
    } else if (s.status === SETTLEMENT_STATUS.PROCESSING && ageHours > SLA_CONFIG.PROCESSING_HOURS) {
      isSlaBreached = true;
      breachType = 'PROCESSING_DELAY';
    } else if (s.status === SETTLEMENT_STATUS.RETRY_PENDING && ageHours > SLA_CONFIG.FAILURE_HOURS) {
      isSlaBreached = true;
      breachType = 'RETRY_DELAY';
    } else if (s.status === SETTLEMENT_STATUS.FAILED_PERMANENTLY) {
      isSlaBreached = true;
      breachType = 'PERMANENT_FAILURE';
    }

    const hold = holdMap.get(String(s.settlementId)) || holdMap.get(String(s.garageId));

    const record = {
      settlementId: s.settlementId,
      garageId: s.garageId,
      garageName: s.garageName || 'Authorized Garage Partner',
      amountPaise,
      amountRupees,
      status: s.status,
      createdAt,
      ageHours: Math.round(ageHours),
      ageDays,
      agingBucket: bucket,
      retryCount: s.retryCount || 0,
      lastFailureReason: s.lastFailureReason || s.failureReason || null,
      hasHold: Boolean(hold),
      holdReason: hold?.reason || null,
      isSlaBreached,
      breachType
    };

    detailedAgingRecords.push(record);
    if (isSlaBreached) slaBreaches.push(record);
  }

  return {
    bucketSummaries,
    totalOpenSettlements: openSettlements.length,
    slaBreachesCount: slaBreaches.length,
    slaBreaches,
    detailedAgingRecords,
    analyzedAt: now
  };
}

module.exports = {
  AGING_BUCKETS,
  SLA_CONFIG,
  determineAgingBucket,
  getSettlementAgingAnalysis
};
