const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { RECONCILIATION_STATUS, MISMATCH_TYPE } = require('../models/Reconciliation');
const { reconcilePayment, runBatchReconciliation } = require('../services/reconciliationService');

const router = express.Router();

function safeObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/reconciliation/summary
 * Returns global payment reconciliation KPIs
 */
router.get('/summary', requireAdmin, async (req, res) => {
  const db = getDb();
  const reconciliations = db.collection('payment_reconciliations');

  try {
    const all = await reconciliations.find({}).toArray();

    let matched = 0;
    let mismatched = 0;
    let missing = 0;
    let pending = 0;
    let resolved = 0;
    let totalMismatchAmount = 0;

    all.forEach(r => {
      if (r.reconciliationStatus === RECONCILIATION_STATUS.MATCHED) matched++;
      else if (r.reconciliationStatus === RECONCILIATION_STATUS.MISMATCH) mismatched++;
      else if (r.reconciliationStatus === RECONCILIATION_STATUS.MISSING) missing++;
      else if (r.reconciliationStatus === RECONCILIATION_STATUS.PENDING) pending++;
      else if (r.reconciliationStatus === RECONCILIATION_STATUS.RESOLVED) resolved++;

      if (r.reconciliationStatus === RECONCILIATION_STATUS.MISMATCH && r.amountDifference) {
        totalMismatchAmount += parseFloat(r.amountDifference) || 0;
      }
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalChecked: all.length,
        matched,
        mismatched,
        missing,
        pending,
        resolved,
        totalMismatchAmount
      }
    });
  } catch (err) {
    console.error('Error fetching reconciliation summary:', err);
    return res.status(500).json({ success: false, message: 'Error loading reconciliation summary' });
  }
});

/**
 * GET /api/admin/reconciliation
 * Paginated, filterable, and searchable list of reconciliation records
 */
router.get('/', requireAdmin, async (req, res) => {
  const { page = 1, limit = 20, status = 'ALL', mismatchType = 'ALL', search = '' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const reconciliations = db.collection('payment_reconciliations');

  try {
    const query = {};

    if (status && status !== 'ALL') {
      query.reconciliationStatus = status;
    }

    if (mismatchType && mismatchType !== 'ALL') {
      query.mismatchType = mismatchType;
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { invoiceNumber: regex },
        { paymentId: regex },
        { razorpayPaymentId: regex },
        { garageName: regex },
        { vehicleNumber: regex }
      ];
    }

    const totalCount = await reconciliations.countDocuments(query);
    const rawList = await reconciliations
      .find(query)
      .sort({ checkedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const formatted = rawList.map(r => ({
      id: String(r._id),
      paymentId: r.paymentId,
      razorpayPaymentId: r.razorpayPaymentId,
      razorpayOrderId: r.razorpayOrderId,
      invoiceNumber: r.invoiceNumber,
      garageName: r.garageName,
      serviceType: r.serviceType,
      vehicleNumber: r.vehicleNumber,
      expectedAmount: r.expectedAmount,
      razorpayAmount: r.razorpayAmount,
      amountDifference: r.amountDifference,
      expectedPaymentStatus: r.expectedPaymentStatus,
      razorpayPaymentStatus: r.razorpayPaymentStatus,
      expectedRefundAmount: r.expectedRefundAmount,
      razorpayRefundAmount: r.razorpayRefundAmount,
      reconciliationStatus: r.reconciliationStatus,
      mismatchType: r.mismatchType,
      mismatchDetails: r.mismatchDetails || [],
      checkedAt: r.checkedAt,
      resolvedAt: r.resolvedAt,
      resolutionNote: r.resolutionNote
    }));

    return res.status(200).json({
      success: true,
      reconciliations: formatted,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error fetching reconciliation list:', err);
    return res.status(500).json({ success: false, message: 'Error loading reconciliations' });
  }
});

/**
 * GET /api/admin/reconciliation/:id
 * Single reconciliation full audit details
 */
router.get('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const reconciliations = db.collection('payment_reconciliations');

  try {
    const rId = safeObjectId(id);
    const doc = rId
      ? await reconciliations.findOne({ _id: rId })
      : await reconciliations.findOne({ paymentId: id });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Reconciliation record not found' });
    }

    return res.status(200).json({
      success: true,
      reconciliation: {
        id: String(doc._id),
        ...doc
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading reconciliation record' });
  }
});

/**
 * POST /api/admin/reconciliation/run
 * Trigger manual single or batch reconciliation
 */
router.post('/run', requireAdmin, async (req, res) => {
  const { paymentId, mode = 'recent', hours = 24, limit = 50 } = req.body || {};
  const db = getDb();
  const payments = db.collection('payments');

  try {
    if (paymentId) {
      const pId = safeObjectId(paymentId);
      const paymentDoc = pId
        ? await payments.findOne({ _id: pId })
        : await payments.findOne({ $or: [{ paymentId }, { razorpayPaymentId: paymentId }] });

      if (!paymentDoc) {
        return res.status(404).json({ success: false, message: 'Payment record not found' });
      }

      const result = await reconcilePayment({ payment: paymentDoc, dbInstance: db });
      return res.status(200).json({
        success: true,
        message: `Reconciliation completed: status ${result.reconciliationStatus}`,
        reconciliation: result
      });
    }

    // Batch mode
    const batchResult = await runBatchReconciliation({
      hours: parseInt(hours, 10) || 24,
      limit: parseInt(limit, 10) || 50,
      dbInstance: db
    });

    // Record audit event
    await db.collection('admin_audit_logs').insertOne({
      adminId: String(req.user.id),
      action: 'RECONCILIATION_RUN',
      metadata: {
        hours,
        totalChecked: batchResult.totalChecked,
        matched: batchResult.matched,
        mismatched: batchResult.mismatched,
        missing: batchResult.missing
      },
      timestamp: new Date()
    });

    return res.status(200).json({
      success: true,
      message: `Batch reconciliation finished for ${batchResult.totalChecked} payments`,
      summary: batchResult
    });
  } catch (err) {
    console.error('Error running reconciliation:', err);
    return res.status(500).json({ success: false, message: 'Error running reconciliation' });
  }
});

/**
 * POST /api/admin/reconciliation/:id/resolve
 * Manually mark a reconciliation discrepancy as resolved with note
 */
router.post('/:id/resolve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { resolutionNote, resolutionAction = 'MARK_RESOLVED' } = req.body || {};

  if (!resolutionNote || resolutionNote.trim() === '') {
    return res.status(400).json({ success: false, message: 'A resolution note is required' });
  }

  const db = getDb();
  const reconciliations = db.collection('payment_reconciliations');
  const auditLogs = db.collection('reconciliation_audit_logs');

  try {
    const rId = safeObjectId(id);
    const doc = rId
      ? await reconciliations.findOne({ _id: rId })
      : await reconciliations.findOne({ paymentId: id });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Reconciliation record not found' });
    }

    const now = new Date();

    await reconciliations.updateOne(
      { _id: doc._id },
      {
        $set: {
          reconciliationStatus: RECONCILIATION_STATUS.RESOLVED,
          resolvedAt: now,
          resolvedBy: String(req.user.id),
          resolutionNote: String(resolutionNote).trim(),
          resolutionAction,
          updatedAt: now
        }
      }
    );

    // Audit log
    await auditLogs.insertOne({
      reconciliationId: String(doc._id),
      paymentId: doc.paymentId,
      adminId: String(req.user.id),
      action: 'RECONCILIATION_RESOLVED',
      previousStatus: doc.reconciliationStatus,
      newStatus: RECONCILIATION_STATUS.RESOLVED,
      resolutionNote: String(resolutionNote).trim(),
      resolutionAction,
      createdAt: now
    });

    return res.status(200).json({
      success: true,
      message: 'Reconciliation marked as resolved successfully'
    });
  } catch (err) {
    console.error('Error resolving reconciliation:', err);
    return res.status(500).json({ success: false, message: 'Error resolving reconciliation' });
  }
});

module.exports = router;
