const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { logFinancialAudit } = require('../services/auditService');

const router = express.Router();

function safeObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/risk/summary
 * KPI summary of risk events
 */
router.get('/summary', requireAdmin, async (req, res) => {
  const db = getDb();
  const riskEvents = db.collection('payment_risk_events');

  try {
    const all = await riskEvents.find({}).toArray();

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let openCount = 0;
    let reviewedCount = 0;

    all.forEach(r => {
      if (r.riskLevel === 'CRITICAL') criticalCount++;
      else if (r.riskLevel === 'HIGH') highCount++;
      else if (r.riskLevel === 'MEDIUM') mediumCount++;

      if (r.status === 'OPEN') openCount++;
      else reviewedCount++;
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalFlagged: all.length,
        criticalCount,
        highCount,
        mediumCount,
        openCount,
        reviewedCount
      }
    });
  } catch (err) {
    console.error('Error fetching risk summary:', err);
    return res.status(500).json({ success: false, message: 'Error loading risk summary' });
  }
});

/**
 * GET /api/admin/risk
 * List paginated risk events
 */
router.get('/', requireAdmin, async (req, res) => {
  const { page = 1, limit = 20, level = 'ALL', status = 'ALL', search = '' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const riskEvents = db.collection('payment_risk_events');

  try {
    const query = {};
    if (level && level !== 'ALL') query.riskLevel = level;
    if (status && status !== 'ALL') query.status = status;

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { paymentId: regex },
        { orderId: regex },
        { invoiceId: regex },
        { userId: regex },
        { garageId: regex }
      ];
    }

    const totalCount = await riskEvents.countDocuments(query);
    const rawList = await riskEvents
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const formatted = rawList.map(r => ({
      id: String(r._id),
      paymentId: r.paymentId,
      userId: r.userId,
      garageId: r.garageId,
      invoiceId: r.invoiceId,
      operation: r.operation,
      amount: r.amount,
      riskScore: r.riskScore,
      riskLevel: r.riskLevel,
      riskFlags: r.riskFlags || [],
      status: r.status || 'OPEN',
      reviewedAt: r.reviewedAt,
      reviewedBy: r.reviewedBy,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt
    }));

    return res.status(200).json({
      success: true,
      riskEvents: formatted,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error loading risk events:', err);
    return res.status(500).json({ success: false, message: 'Error loading risk events' });
  }
});

/**
 * GET /api/admin/risk/:id
 * Single risk event dossier
 */
router.get('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const riskEvents = db.collection('payment_risk_events');
  const payments = db.collection('payments');

  try {
    const rId = safeObjectId(id);
    const event = rId ? await riskEvents.findOne({ _id: rId }) : null;

    if (!event) {
      return res.status(404).json({ success: false, message: 'Risk event not found' });
    }

    let paymentDoc = null;
    if (event.paymentId) {
      paymentDoc = await payments.findOne({
        $or: [{ _id: event.paymentId }, { paymentId: event.paymentId }, { razorpayPaymentId: event.paymentId }]
      });
    }

    return res.status(200).json({
      success: true,
      riskEvent: {
        id: String(event._id),
        ...event,
        paymentDetails: paymentDoc
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading risk event' });
  }
});

/**
 * POST /api/admin/risk/:id/action
 * Admin resolves, clears, or escalates risk event
 */
router.post('/:id/action', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { action = 'MARK_REVIEWED', reviewNote } = req.body || {};

  const db = getDb();
  const riskEvents = db.collection('payment_risk_events');

  try {
    const rId = safeObjectId(id);
    const event = rId ? await riskEvents.findOne({ _id: rId }) : null;

    if (!event) {
      return res.status(404).json({ success: false, message: 'Risk event not found' });
    }

    let newStatus = 'REVIEWED';
    if (action === 'CLEAR_RISK') newStatus = 'CLEARED';
    else if (action === 'ESCALATE') newStatus = 'ESCALATED';

    const now = new Date();

    await riskEvents.updateOne(
      { _id: event._id },
      {
        $set: {
          status: newStatus,
          reviewedAt: now,
          reviewedBy: String(req.user.id),
          reviewNote: String(reviewNote || '').trim(),
          updatedAt: now
        }
      }
    );

    // Financial audit log
    await logFinancialAudit({
      actorId: req.user.id,
      actorRole: 'ADMIN',
      action: `RISK_${action}`,
      resourceType: 'RISK_EVENT',
      resourceId: String(event._id),
      beforeState: { status: event.status },
      afterState: { status: newStatus, reviewNote },
      req,
      dbInstance: db
    });

    return res.status(200).json({
      success: true,
      message: `Risk event updated to ${newStatus}`
    });
  } catch (err) {
    console.error('Error handling risk event action:', err);
    return res.status(500).json({ success: false, message: 'Error updating risk event' });
  }
});

module.exports = router;
