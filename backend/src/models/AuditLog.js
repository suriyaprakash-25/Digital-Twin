const { getDb } = require('../db');

/**
 * Ensures indexes for financial_audit_logs and report_export_logs
 */
async function ensureAuditIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const auditLogs = db.collection('financial_audit_logs');
    const exportLogs = db.collection('report_export_logs');

    await auditLogs.createIndex({ actorId: 1, createdAt: -1 });
    await auditLogs.createIndex({ resourceType: 1, resourceId: 1 });
    await auditLogs.createIndex({ action: 1, createdAt: -1 });
    await auditLogs.createIndex({ createdAt: -1 });

    await exportLogs.createIndex({ exportId: 1 }, { unique: true, sparse: true });
    await exportLogs.createIndex({ actorId: 1, createdAt: -1 });
    await exportLogs.createIndex({ reportType: 1, createdAt: -1 });

    console.log('✅ Financial Audit and Report Export collection indexes verified.');
  } catch (err) {
    console.error('Error ensuring audit indexes:', err.message);
  }
}

module.exports = {
  ensureAuditIndexes
};
