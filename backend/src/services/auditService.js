const { getDb } = require('../db');

/**
 * Appends an immutable audit log entry for any financial state transition
 * @param {Object} params
 * @param {string} params.actorId
 * @param {string} params.actorRole - 'USER' | 'GARAGE' | 'ADMIN' | 'SYSTEM'
 * @param {string} params.action - e.g. 'PAYMENT_ORDER_CREATED', 'PAYMENT_VERIFIED', 'REFUND_COMPLETED'
 * @param {string} params.resourceType - 'PAYMENT' | 'INVOICE' | 'SETTLEMENT' | 'DISPUTE' | 'RECONCILIATION' | 'REPORT'
 * @param {string} params.resourceId
 * @param {Object} [params.beforeState]
 * @param {Object} [params.afterState]
 * @param {Object} [params.req] - Express request object for IP and User-Agent capture
 * @param {Object} [params.metadata]
 * @param {Object} [params.dbInstance]
 */
async function logFinancialAudit({
  actorId,
  actorRole = 'SYSTEM',
  action,
  resourceType,
  resourceId,
  settlementId = null,
  garageId = null,
  beforeState = null,
  afterState = null,
  ip = null,
  userAgent = null,
  req = null,
  metadata = {},
  dbInstance
}) {
  const db = dbInstance || getDb();
  if (!db) return null;

  const auditLogs = db.collection('financial_audit_logs');

  let ipAddress = ip || 'internal';
  let clientUserAgent = userAgent || 'server';

  if (req) {
    ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ipAddress;
    clientUserAgent = req.headers['user-agent'] || clientUserAgent;
  }

  const auditDoc = {
    actorId: String(actorId || 'system'),
    actorRole: String(actorRole).toUpperCase(),
    action,
    resourceType,
    resourceId: String(resourceId || ''),
    settlementId: settlementId || null,
    garageId: garageId || null,
    beforeState,
    afterState,
    ip: ipAddress,
    ipAddress,
    userAgent: clientUserAgent,
    metadata,
    createdAt: new Date()
  };

  try {
    await auditLogs.insertOne(auditDoc);
    return auditDoc;
  } catch (err) {
    console.warn('Error recording financial audit log:', err.message);
    return null;
  }
}

module.exports = {
  logFinancialAudit
};
