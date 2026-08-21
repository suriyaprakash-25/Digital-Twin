const { getDb } = require('../db');

/**
 * Generates an atomic, sequential Credit Note number (e.g. DP-CN-2026-000001)
 * @param {Object} [dbInstance] - MongoDB DB instance
 * @returns {Promise<string>}
 */
async function generateCreditNoteNumber(dbInstance) {
  const db = dbInstance || getDb();
  const year = new Date().getFullYear();
  const counterId = `credit_note_${year}`;

  const result = await db.collection('counters').findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  const seq = (result && result.seq) || 1;
  const padded = String(seq).padStart(6, '0');
  return `DP-CN-${year}-${padded}`;
}

module.exports = {
  generateCreditNoteNumber
};
