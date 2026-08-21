const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { generateAlertNumber } = require('../utils/alertNumber');
const { logFinancialAudit } = require('./auditService');
const { logger } = require('./logger');

const FINANCIAL_ALERT_TYPE = {
  HIGH_RISK_PAYMENT: 'HIGH_RISK_PAYMENT',
  PAYMENT_RECONCILIATION_MISMATCH: 'PAYMENT_RECONCILIATION_MISMATCH',
  SETTLEMENT_FAILURE: 'SETTLEMENT_FAILURE',
  SETTLEMENT_SLA_BREACH: 'SETTLEMENT_SLA_BREACH',
  HIGH_REFUND_RATE: 'HIGH_REFUND_RATE',
  HIGH_DISPUTE_RATE: 'HIGH_DISPUTE_RATE',
  TREASURY_BALANCE_LOW: 'TREASURY_BALANCE_LOW',
  PAYOUT_FAILURE: 'PAYOUT_FAILURE',
  TAX_CONFIGURATION_ERROR: 'TAX_CONFIGURATION_ERROR',
  WEBHOOK_PROCESSING_FAILURE: 'WEBHOOK_PROCESSING_FAILURE',
  FINANCIAL_INTEGRITY_FAILURE: 'FINANCIAL_INTEGRITY_FAILURE'
};

const ALERT_SEVERITY = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

const ALERT_STATUS = {
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED'
};

/**
 * Ensures indexes for financial_alerts collection
 */
async function ensureFinancialAlertIndexes(dbInstance) {
  try {
    const db = dbInstance || getDb();
    const alerts = db.collection('financial_alerts');

    await alerts.createIndex({ alertNumber: 1 }, { unique: true });
    await alerts.createIndex({ alertType: 1, createdAt: -1 });
    await alerts.createIndex({ severity: 1, status: 1 });
    await alerts.createIndex({ entityType: 1, entityId: 1 });

    console.log('✅ Financial Alert collection indexes verified.');
  } catch (err) {
    console.error('Error ensuring financial alert indexes:', err.message);
  }
}

/**
 * Creates a financial alert
 */
async function createFinancialAlert({
  alertType,
  severity = ALERT_SEVERITY.HIGH,
  entityType = null,
  entityId = null,
  message,
  metadata = {},
  dbInstance
}) {
  const db = dbInstance || getDb();
  const alerts = db.collection('financial_alerts');
  const now = new Date();

  const alertNumber = await generateAlertNumber(db);

  const alertDoc = {
    alertNumber,
    alertType: String(alertType),
    severity: String(severity),
    status: ALERT_STATUS.OPEN,
    entityType: entityType ? String(entityType) : null,
    entityId: entityId ? String(entityId) : null,
    message: String(message),
    metadata,
    createdAt: now,
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null
  };

  await alerts.insertOne(alertDoc);

  logger.warn(`[FINANCIAL ALERT] ${alertNumber} [${severity}] ${alertType}: ${message}`, {
    alertNumber,
    alertType,
    severity
  });

  return alertDoc;
}

/**
 * Retrieves alerts with filtering and pagination
 */
async function getAlerts({
  status,
  severity,
  alertType,
  page = 1,
  limit = 20,
  dbInstance
} = {}) {
  const db = dbInstance || getDb();
  const alerts = db.collection('financial_alerts');

  const query = {};
  if (status && status !== 'ALL') query.status = status;
  if (severity && severity !== 'ALL') query.severity = severity;
  if (alertType && alertType !== 'ALL') query.alertType = alertType;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [alertList, totalCount] = await Promise.all([
    alerts.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).toArray(),
    alerts.countDocuments(query)
  ]);

  return {
    alerts: alertList,
    totalCount,
    totalPages: Math.ceil(totalCount / limitNum),
    currentPage: pageNum
  };
}

/**
 * Acknowledges a financial alert
 */
async function acknowledgeAlert(alertIdOrNumber, { adminId, dbInstance } = {}) {
  const db = dbInstance || getDb();
  const alerts = db.collection('financial_alerts');
  const now = new Date();

  let query = { alertNumber: String(alertIdOrNumber) };
  try {
    if (ObjectId.isValid(alertIdOrNumber)) {
      query = { $or: [{ alertNumber: String(alertIdOrNumber) }, { _id: new ObjectId(alertIdOrNumber) }] };
    }
  } catch {}

  const result = await alerts.findOneAndUpdate(
    query,
    {
      $set: {
        status: ALERT_STATUS.ACKNOWLEDGED,
        acknowledgedAt: now,
        acknowledgedBy: String(adminId || 'ADMIN')
      }
    },
    { returnDocument: 'after' }
  );

  const doc = result?.value || result;
  if (!doc) throw new Error(`Alert ${alertIdOrNumber} not found`);

  return doc;
}

/**
 * Resolves a financial alert
 */
async function resolveAlert(alertIdOrNumber, { adminId, resolutionNote, dbInstance } = {}) {
  const db = dbInstance || getDb();
  const alerts = db.collection('financial_alerts');
  const now = new Date();

  let query = { alertNumber: String(alertIdOrNumber) };
  try {
    if (ObjectId.isValid(alertIdOrNumber)) {
      query = { $or: [{ alertNumber: String(alertIdOrNumber) }, { _id: new ObjectId(alertIdOrNumber) }] };
    }
  } catch {}

  const result = await alerts.findOneAndUpdate(
    query,
    {
      $set: {
        status: ALERT_STATUS.RESOLVED,
        resolvedAt: now,
        resolvedBy: String(adminId || 'ADMIN'),
        resolutionNote: resolutionNote || 'Resolved'
      }
    },
    { returnDocument: 'after' }
  );

  const doc = result?.value || result;
  if (!doc) throw new Error(`Alert ${alertIdOrNumber} not found`);

  await logFinancialAudit({
    actorId: String(adminId || 'ADMIN'),
    actorRole: 'ADMIN',
    action: 'FINANCIAL_ALERT_RESOLVED',
    resourceType: 'ALERT',
    resourceId: doc.alertNumber,
    afterState: { alertNumber: doc.alertNumber, status: 'RESOLVED', resolutionNote },
    dbInstance: db
  });

  return doc;
}

/**
 * Retrieves summary metrics for active financial alerts
 */
async function getAlertsSummary(dbInstance) {
  const db = dbInstance || getDb();
  const alerts = db.collection('financial_alerts');

  const [openCount, criticalCount, highCount, ackCount] = await Promise.all([
    alerts.countDocuments({ status: ALERT_STATUS.OPEN }),
    alerts.countDocuments({ status: ALERT_STATUS.OPEN, severity: ALERT_SEVERITY.CRITICAL }),
    alerts.countDocuments({ status: ALERT_STATUS.OPEN, severity: ALERT_SEVERITY.HIGH }),
    alerts.countDocuments({ status: ALERT_STATUS.ACKNOWLEDGED })
  ]);

  return {
    openAlerts: openCount,
    criticalAlerts: criticalCount,
    highAlerts: highCount,
    acknowledgedAlerts: ackCount
  };
}

module.exports = {
  FINANCIAL_ALERT_TYPE,
  ALERT_SEVERITY,
  ALERT_STATUS,
  ensureFinancialAlertIndexes,
  createFinancialAlert,
  getAlerts,
  acknowledgeAlert,
  resolveAlert,
  getAlertsSummary
};
