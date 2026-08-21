const { getDb } = require('../db');
const { SCHEDULE_TYPE } = require('../models/SettlementSchedule');

/**
 * Calculates the next schedule run date based on frequency
 * @param {string} scheduleType
 * @param {Date} [fromDate]
 * @returns {Date}
 */
function calculateNextRunDate(scheduleType, fromDate = new Date()) {
  const next = new Date(fromDate);
  if (scheduleType === SCHEDULE_TYPE.DAILY) {
    next.setDate(next.getDate() + 1);
    next.setHours(2, 0, 0, 0); // Run at 2:00 AM next day
  } else if (scheduleType === SCHEDULE_TYPE.WEEKLY) {
    next.setDate(next.getDate() + 7);
    next.setHours(3, 0, 0, 0); // Run at 3:00 AM in 7 days
  } else {
    // MANUAL
    next.setFullYear(next.getFullYear() + 10); // Far future
  }
  return next;
}

/**
 * Configure or update a garage's settlement schedule
 */
async function setGarageSettlementSchedule({
  garageId,
  scheduleType = SCHEDULE_TYPE.DAILY,
  enabled = true,
  minimumAmountPaise = 50000,
  dbInstance
}) {
  const db = dbInstance || getDb();
  const schedules = db.collection('settlement_schedules');
  const now = new Date();

  const nextRunAt = calculateNextRunDate(scheduleType, now);

  const updateDoc = {
    garageId: String(garageId),
    scheduleType,
    enabled: Boolean(enabled),
    minimumAmountPaise: Number(minimumAmountPaise),
    nextRunAt,
    updatedAt: now
  };

  const res = await schedules.updateOne(
    { garageId: String(garageId) },
    {
      $set: updateDoc,
      $setOnInsert: { createdAt: now, lastRunAt: null, lastResult: null }
    },
    { upsert: true }
  );

  return { success: true, schedule: { ...updateDoc, _id: res.upsertedId } };
}

/**
 * Get garage settlement schedule
 */
async function getGarageSettlementSchedule(garageId, dbInstance) {
  const db = dbInstance || getDb();
  const schedules = db.collection('settlement_schedules');
  return schedules.findOne({ garageId: String(garageId) });
}

module.exports = {
  calculateNextRunDate,
  setGarageSettlementSchedule,
  getGarageSettlementSchedule
};
