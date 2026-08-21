const { getDb } = require('../db');

/**
 * Atomically generates a formatted financial alert identifier (e.g. DP-ALT-2026-000001)
 */
async function generateAlertNumber(dbInstance) {
  const db = dbInstance || getDb();
  const counters = db.collection('counters');
  const year = new Date().getFullYear();
  const sequenceKey = `financial_alert_number_${year}`;

  const result = await counters.findOneAndUpdate(
    { _id: sequenceKey },
    { $inc: { sequence_value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  const seq = (result && result.sequence_value) || (result && result.value && result.value.sequence_value) || 1;
  const paddedSeq = String(seq).padStart(6, '0');
  return `DP-ALT-${year}-${paddedSeq}`;
}

module.exports = { generateAlertNumber };
