const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { logFinancialAudit } = require('./auditService');

const INTEGRITY_DISCREPANCY_TYPE = {
  ORPHAN_PAYMENT: 'ORPHAN_PAYMENT',
  ORPHAN_EARNINGS: 'ORPHAN_EARNINGS',
  ORPHAN_SETTLEMENT: 'ORPHAN_SETTLEMENT',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  COMMISSION_MISMATCH: 'COMMISSION_MISMATCH',
  REFUND_MISMATCH: 'REFUND_MISMATCH',
  SETTLEMENT_MISMATCH: 'SETTLEMENT_MISMATCH',
  TAX_MISMATCH: 'TAX_MISMATCH',
  CREDIT_NOTE_MISMATCH: 'CREDIT_NOTE_MISMATCH',
  DUPLICATE_FINANCIAL_RECORD: 'DUPLICATE_FINANCIAL_RECORD',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION'
};

function safeObjectId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

/**
 * Runs a non-destructive read-only financial integrity scan across all collections
 */
async function runFinancialIntegrityScan(dbInstance) {
  const db = dbInstance || getDb();
  const payments = db.collection('payments');
  const invoices = db.collection('invoices');
  const earnings = db.collection('garage_earnings');
  const settlements = db.collection('settlements');
  const creditNotes = db.collection('credit_notes');
  const issuesCollection = db.collection('financial_integrity_issues');
  const now = new Date();

  const detectedIssues = [];

  // 1. Check Payments vs Invoices
  const allPayments = await payments.find({ status: 'CAPTURED' }).toArray();
  for (const pay of allPayments) {
    if (pay.invoiceId) {
      const inv = await invoices.findOne({
        $or: [{ _id: safeObjectId(pay.invoiceId) }, { invoiceNumber: pay.invoiceId }]
      });

      if (!inv) {
        detectedIssues.push({
          type: INTEGRITY_DISCREPANCY_TYPE.ORPHAN_PAYMENT,
          severity: 'HIGH',
          entityType: 'PAYMENT',
          entityId: String(pay._id),
          paymentId: pay.paymentId || String(pay._id),
          description: `Captured payment references non-existent invoice ${pay.invoiceId}`,
          detectedAt: now
        });
      } else {
        const payPaise = pay.amountPaise || Math.round((parseFloat(pay.amount) || 0) * 100);
        const invPaise = inv.amountPaise || Math.round((parseFloat(inv.grandTotal || inv.amount || 0)) * 100);

        if (payPaise !== invPaise) {
          detectedIssues.push({
            type: INTEGRITY_DISCREPANCY_TYPE.AMOUNT_MISMATCH,
            severity: 'HIGH',
            entityType: 'PAYMENT',
            entityId: String(pay._id),
            paymentId: pay.paymentId || String(pay._id),
            invoiceNumber: inv.invoiceNumber,
            description: `Payment amount (${payPaise} paise) does not match invoice total (${invPaise} paise)`,
            detectedAt: now
          });
        }
      }
    }
  }

  // 2. Check Earnings Commission Math
  const allEarnings = await earnings.find().toArray();
  for (const earn of allEarnings) {
    const gross = earn.grossPaise !== undefined ? earn.grossPaise : Math.round((parseFloat(earn.grossAmount) || 0) * 100);
    const comm = earn.platformCommissionPaise !== undefined ? earn.platformCommissionPaise : Math.round((parseFloat(earn.platformCommission) || 0) * 100);
    const net = earn.garageNetPaise !== undefined ? earn.garageNetPaise : Math.round((parseFloat(earn.garageNetAmount) || 0) * 100);

    if (gross - comm !== net) {
      detectedIssues.push({
        type: INTEGRITY_DISCREPANCY_TYPE.COMMISSION_MISMATCH,
        severity: 'MEDIUM',
        entityType: 'GARAGE_EARNINGS',
        entityId: String(earn._id),
        garageId: earn.garageId,
        description: `Earnings calculation mismatch: Gross (${gross}) - Comm (${comm}) != Net (${net})`,
        detectedAt: now
      });
    }
  }

  // 3. Check Credit Notes Math
  const allCreditNotes = await creditNotes.find().toArray();
  for (const cn of allCreditNotes) {
    const total = cn.totalCreditPaise || Math.round((parseFloat(cn.totalCreditAmount) || 0) * 100);
    const taxable = cn.taxableCreditPaise || Math.round((parseFloat(cn.taxableCreditAmount) || 0) * 100);
    const taxAdj = cn.taxAdjustmentPaise || Math.round((parseFloat(cn.taxAdjustmentAmount) || 0) * 100);

    if (taxable + taxAdj !== total) {
      detectedIssues.push({
        type: INTEGRITY_DISCREPANCY_TYPE.CREDIT_NOTE_MISMATCH,
        severity: 'HIGH',
        entityType: 'CREDIT_NOTE',
        entityId: String(cn._id),
        creditNoteNumber: cn.creditNoteNumber,
        description: `Credit note math mismatch: Taxable (${taxable}) + TaxAdj (${taxAdj}) != Total (${total})`,
        detectedAt: now
      });
    }
  }

  // Upsert detected issues into collection
  for (const issue of detectedIssues) {
    await issuesCollection.updateOne(
      { entityType: issue.entityType, entityId: issue.entityId, type: issue.type },
      { $set: { ...issue, status: 'OPEN', updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
  }

  return {
    scannedAt: now,
    totalIssuesFound: detectedIssues.length,
    issues: detectedIssues
  };
}

/**
 * Resolves a financial integrity issue with an append-only audit log
 */
async function resolveFinancialIntegrityIssue(issueId, { resolutionNote, adminId, dbInstance } = {}) {
  const db = dbInstance || getDb();
  const issuesCollection = db.collection('financial_integrity_issues');
  const now = new Date();

  const objId = safeObjectId(issueId);
  const issue = objId
    ? await issuesCollection.findOne({ _id: objId })
    : await issuesCollection.findOne({ entityId: String(issueId) });

  if (!issue) {
    throw new Error(`Financial integrity issue ${issueId} not found`);
  }

  await issuesCollection.updateOne(
    { _id: issue._id },
    {
      $set: {
        status: 'RESOLVED',
        resolutionNote: resolutionNote || 'Resolved by administrative review',
        resolvedBy: String(adminId || 'ADMIN'),
        resolvedAt: now,
        updatedAt: now
      }
    }
  );

  await logFinancialAudit({
    actorId: String(adminId || 'ADMIN'),
    actorRole: 'ADMIN',
    action: 'FINANCIAL_INTEGRITY_RESOLVED',
    resourceType: 'INTEGRITY_ISSUE',
    resourceId: String(issue._id),
    afterState: { issueType: issue.type, resolutionNote, status: 'RESOLVED' },
    dbInstance: db
  });

  return { success: true, issueId: String(issue._id), status: 'RESOLVED' };
}

module.exports = {
  INTEGRITY_DISCREPANCY_TYPE,
  runFinancialIntegrityScan,
  resolveFinancialIntegrityIssue
};
