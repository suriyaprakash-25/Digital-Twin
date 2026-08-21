const { getDb } = require('../db');

/**
 * Generates an atomic, sequential Risk Case identifier (e.g. DP-RISK-2026-000001)
 * @param {Object} [dbInstance] - MongoDB DB instance
 * @returns {Promise<string>}
 */
async function generateRiskCaseNumber(dbInstance) {
  const db = dbInstance || getDb();
  const year = new Date().getFullYear();
  const counterId = `risk_case_${year}`;

  const result = await db.collection('counters').findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  const seq = (result && result.seq) || 1;
  const padded = String(seq).padStart(6, '0');
  return `DP-RISK-${year}-${padded}`;
}

module.exports = {
  generateRiskCaseNumber
};
