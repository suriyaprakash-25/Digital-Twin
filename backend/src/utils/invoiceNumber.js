const { getDb } = require('../db');

/**
 * Atomically generates a unique human-readable invoice number.
 * Format: DP-INV-YYYY-XXXXXX (e.g. DP-INV-2026-000001)
 * @param {Object} [dbInstance] - Optional MongoDB db instance
 * @returns {Promise<string>} Unique invoice number
 */
async function generateInvoiceNumber(dbInstance) {
  const db = dbInstance || getDb();
  const counters = db.collection('counters');
  const year = new Date().getFullYear();
  const counterId = `invoice_${year}`;

  const result = await counters.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  const seq = (result && result.value ? result.value.seq : result?.seq) || 1;
  const seqPadded = String(seq).padStart(6, '0');

  return `DP-INV-${year}-${seqPadded}`;
}

module.exports = {
  generateInvoiceNumber
};
