const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { generateCreditNoteNumber } = require('../utils/creditNoteNumber');
const { logFinancialAudit } = require('./auditService');
const { parseDateRange } = require('./financialReportService');

function safeObjectId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

/**
 * Creates an immutable, compliant Credit Note for refund or invoice adjustment
 */
async function createCreditNote({
  invoiceNumber,
  paymentId = null,
  refundId = null,
  disputeId = null,
  garageId,
  customerId = null,
  amountPaise,
  taxRate = 18,
  reason = 'Customer Refund Adjustment',
  createdBy = 'SYSTEM',
  ip = null,
  userAgent = null,
  dbInstance
}) {
  const db = dbInstance || getDb();
  const creditNotes = db.collection('credit_notes');
  const now = new Date();

  const creditNoteNumber = await generateCreditNoteNumber(db);
  const totalCreditPaise = Math.round(Number(amountPaise) || 0);

  // Compute Tax Adjustment portion in paise
  // taxable = total / (1 + rate/100)
  const taxableCreditPaise = Math.round(totalCreditPaise / (1 + (taxRate / 100)));
  const taxAdjustmentPaise = totalCreditPaise - taxableCreditPaise;

  const creditNoteDoc = {
    creditNoteNumber,
    invoiceNumber: String(invoiceNumber || ''),
    paymentId: paymentId ? String(paymentId) : null,
    refundId: refundId ? String(refundId) : null,
    disputeId: disputeId ? String(disputeId) : null,
    garageId: String(garageId),
    customerId: customerId ? String(customerId) : null,
    totalCreditPaise,
    totalCreditAmount: totalCreditPaise / 100,
    taxableCreditPaise,
    taxableCreditAmount: taxableCreditPaise / 100,
    taxAdjustmentPaise,
    taxAdjustmentAmount: taxAdjustmentPaise / 100,
    taxRate,
    reason,
    createdBy: String(createdBy),
    createdAt: now,
    updatedAt: now
  };

  const insertRes = await creditNotes.insertOne(creditNoteDoc);

  await logFinancialAudit({
    actorId: String(createdBy),
    actorRole: 'SYSTEM',
    garageId: String(garageId),
    action: 'CREDIT_NOTE_CREATED',
    resourceType: 'CREDIT_NOTE',
    resourceId: String(insertRes.insertedId),
    ip,
    userAgent,
    afterState: {
      creditNoteNumber,
      invoiceNumber,
      totalCreditAmount: totalCreditPaise / 100,
      taxAdjustmentAmount: taxAdjustmentPaise / 100
    },
    dbInstance: db
  });

  return { success: true, creditNoteNumber, creditNote: creditNoteDoc };
}

/**
 * Calculates authoritative tax summary report in integer paise
 */
async function getTaxReportSummary({ garageId = null, period = '30_DAYS', dateFrom, dateTo, dbInstance }) {
  const db = dbInstance || getDb();
  const invoices = db.collection('invoices');
  const creditNotes = db.collection('credit_notes');

  const { from, to } = parseDateRange(period, dateFrom, dateTo);

  const invoiceMatch = {
    status: { $in: ['PAID', 'FINALIZED', 'COMPLETED'] },
    createdAt: { $gte: from, $lte: to }
  };
  if (garageId) invoiceMatch.garageId = String(garageId);

  const invoiceDocs = await invoices.find(invoiceMatch).toArray();

  let grossInvoicePaise = 0;
  let taxablePaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  let totalTaxPaise = 0;

  invoiceDocs.forEach(inv => {
    const gross = inv.amountPaise !== undefined ? inv.amountPaise : Math.round((parseFloat(inv.grandTotal || inv.amount || inv.totalAmount) || 0) * 100);
    grossInvoicePaise += gross;

    if (inv.taxSnapshot) {
      taxablePaise += inv.taxSnapshot.taxablePaise || Math.round((parseFloat(inv.taxSnapshot.taxableAmount) || 0) * 100);
      cgstPaise += inv.taxSnapshot.cgstPaise || Math.round((parseFloat(inv.taxSnapshot.cgstAmount) || 0) * 100);
      sgstPaise += inv.taxSnapshot.sgstPaise || Math.round((parseFloat(inv.taxSnapshot.sgstAmount) || 0) * 100);
      igstPaise += inv.taxSnapshot.igstPaise || Math.round((parseFloat(inv.taxSnapshot.igstAmount) || 0) * 100);
      totalTaxPaise += inv.taxSnapshot.totalTaxPaise || Math.round((parseFloat(inv.taxSnapshot.totalTaxAmount) || 0) * 100);
    } else {
      // Default fallback: 18% GST calculation in paise
      const taxable = Math.round(gross / 1.18);
      const tax = gross - taxable;
      taxablePaise += taxable;
      cgstPaise += Math.round(tax / 2);
      sgstPaise += Math.round(tax / 2);
      totalTaxPaise += tax;
    }
  });

  // Credit notes adjustment in period
  const cnMatch = { createdAt: { $gte: from, $lte: to } };
  if (garageId) cnMatch.garageId = String(garageId);

  const cnDocs = await creditNotes.find(cnMatch).toArray();
  let creditNotesTotalPaise = 0;
  let creditNotesTaxablePaise = 0;
  let creditNotesTaxAdjustmentPaise = 0;

  cnDocs.forEach(cn => {
    creditNotesTotalPaise += cn.totalCreditPaise || Math.round((parseFloat(cn.totalCreditAmount) || 0) * 100);
    creditNotesTaxablePaise += cn.taxableCreditPaise || Math.round((parseFloat(cn.taxableCreditAmount) || 0) * 100);
    creditNotesTaxAdjustmentPaise += cn.taxAdjustmentPaise || Math.round((parseFloat(cn.taxAdjustmentAmount) || 0) * 100);
  });

  const netTaxablePaise = Math.max(0, taxablePaise - creditNotesTaxablePaise);
  const netTaxLiabilityPaise = Math.max(0, totalTaxPaise - creditNotesTaxAdjustmentPaise);

  return {
    period,
    dateFrom: from,
    dateTo: to,
    invoiceCount: invoiceDocs.length,
    creditNoteCount: cnDocs.length,
    grossInvoiceAmount: grossInvoicePaise / 100,
    grossInvoicePaise,
    taxableAmount: taxablePaise / 100,
    taxablePaise,
    cgstAmount: cgstPaise / 100,
    cgstPaise,
    sgstAmount: sgstPaise / 100,
    sgstPaise,
    igstAmount: igstPaise / 100,
    igstPaise,
    totalTaxAmount: totalTaxPaise / 100,
    totalTaxPaise,
    creditNotesTotalAmount: creditNotesTotalPaise / 100,
    creditNotesTotalPaise,
    creditNotesTaxAdjustmentAmount: creditNotesTaxAdjustmentPaise / 100,
    creditNotesTaxAdjustmentPaise,
    netTaxableAmount: netTaxablePaise / 100,
    netTaxablePaise,
    netTaxLiabilityAmount: netTaxLiabilityPaise / 100,
    netTaxLiabilityPaise
  };
}

module.exports = {
  createCreditNote,
  getTaxReportSummary
};
