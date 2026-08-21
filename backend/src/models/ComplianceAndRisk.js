const { getDb } = require('../db');

/**
 * Ensures indexes for Tax, Compliance, Credit Notes, and Risk Cases
 */
async function ensureComplianceAndRiskIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const taxConfigs = db.collection('tax_configurations');
    const creditNotes = db.collection('credit_notes');
    const riskCases = db.collection('risk_cases');

    await taxConfigs.createIndex({ taxType: 1, stateCode: 1, active: 1 });
    await taxConfigs.createIndex({ effectiveFrom: 1, effectiveTo: 1 });

    await creditNotes.createIndex({ creditNoteNumber: 1 }, { unique: true });
    await creditNotes.createIndex({ invoiceNumber: 1 });
    await creditNotes.createIndex({ garageId: 1, createdAt: -1 });
    await creditNotes.createIndex({ customerId: 1, createdAt: -1 });

    await riskCases.createIndex({ riskCaseNumber: 1 }, { unique: true });
    await riskCases.createIndex({ riskLevel: 1, status: 1, createdAt: -1 });
    await riskCases.createIndex({ 'entities.garageId': 1 });
    await riskCases.createIndex({ 'entities.userId': 1 });
    await riskCases.createIndex({ 'entities.paymentId': 1 });

    console.log('✅ Tax, Credit Notes, and Risk Cases collection indexes verified.');
  } catch (err) {
    console.error('Error ensuring compliance & risk indexes:', err.message);
  }
}

module.exports = {
  ensureComplianceAndRiskIndexes
};
