const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission, PERMISSIONS } = require('../middleware/permissionMiddleware');
const { logFinancialAudit } = require('../services/auditService');
const { placeSettlementHold } = require('../services/settlementGovernanceService');
const { getDb } = require('../db');

function safeObjectId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

/**
 * GET /api/admin/risk-cases
 * List and filter multi-entity financial risk cases
 */
router.get('/', requireAuth, requirePermission(PERMISSIONS.RISK_MANAGE), async (req, res) => {
  const db = getDb();
  const riskCases = db.collection('risk_cases');
  const { page = 1, limit = 20, status = 'ALL', level = 'ALL', search = '' } = req.query;

  try {
    const query = {};
    if (status !== 'ALL') query.status = status;
    if (level !== 'ALL') query.riskLevel = level;
    if (search) {
      query.$or = [
        { riskCaseNumber: { $regex: search, $options: 'i' } },
        { 'entities.garageId': { $regex: search, $options: 'i' } },
        { 'entities.userId': { $regex: search, $options: 'i' } },
        { 'entities.paymentId': { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [cases, totalCount] = await Promise.all([
      riskCases.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).toArray(),
      riskCases.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      riskCases: cases,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error fetching risk cases:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch risk cases' });
  }
});

/**
 * GET /api/admin/risk-cases/:id
 * Retrieve full case dossier
 */
router.get('/:id', requireAuth, requirePermission(PERMISSIONS.RISK_MANAGE), async (req, res) => {
  const db = getDb();
  const riskCases = db.collection('risk_cases');
  const { id } = req.params;

  try {
    const cId = safeObjectId(id);
    const riskCase = cId
      ? await riskCases.findOne({ _id: cId })
      : await riskCases.findOne({ riskCaseNumber: id });

    if (!riskCase) {
      return res.status(404).json({ success: false, message: 'Risk case not found' });
    }

    return res.status(200).json({ success: true, riskCase });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error retrieving risk case' });
  }
});

/**
 * POST /api/admin/risk-cases/:id/action
 * Execute a recommended or discretionary risk action (e.g. HOLD_SETTLEMENT, ESCALATE)
 */
router.post('/:id/action', requireAuth, requirePermission(PERMISSIONS.RISK_MANAGE), async (req, res) => {
  const db = getDb();
  const riskCases = db.collection('risk_cases');
  const { id } = req.params;
  const { action, note } = req.body;
  const now = new Date();

  try {
    const cId = safeObjectId(id);
    const riskCase = cId
      ? await riskCases.findOne({ _id: cId })
      : await riskCases.findOne({ riskCaseNumber: id });

    if (!riskCase) {
      return res.status(404).json({ success: false, message: 'Risk case not found' });
    }

    const actionRecord = {
      action,
      note: note || 'Action executed by risk admin',
      executedBy: String(req.user.id),
      timestamp: now
    };

    let updatedStatus = riskCase.status;
    if (action === 'ESCALATE') updatedStatus = 'ESCALATED';

    // If action is HOLD_SETTLEMENT and garageId exists: place hold
    if (action === 'HOLD_SETTLEMENT' && riskCase.entities?.garageId) {
      await placeSettlementHold({
        settlementId: riskCase.entities?.settlementId,
        garageId: riskCase.entities?.garageId,
        reason: 'RISK_REVIEW',
        note: `Hold placed via Risk Case ${riskCase.riskCaseNumber}: ${note || 'High Risk Score'}`,
        adminId: req.user.id,
        dbInstance: db
      });
    }

    await riskCases.updateOne(
      { _id: riskCase._id },
      {
        $set: { status: updatedStatus, updatedAt: now },
        $push: { actionsTaken: actionRecord }
      }
    );

    await logFinancialAudit({
      actorId: String(req.user.id),
      actorRole: 'ADMIN',
      garageId: riskCase.entities?.garageId,
      action: `RISK_ACTION_${action}`,
      resourceType: 'RISK_CASE',
      resourceId: riskCase.riskCaseNumber,
      afterState: { action, note, status: updatedStatus },
      dbInstance: db
    });

    return res.status(200).json({ success: true, message: `Risk action ${action} executed successfully` });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/risk-cases/:id/assign
 * Assign an administrator to investigate the case
 */
router.post('/:id/assign', requireAuth, requirePermission(PERMISSIONS.RISK_MANAGE), async (req, res) => {
  const db = getDb();
  const riskCases = db.collection('risk_cases');
  const { id } = req.params;
  const { adminId } = req.body;
  const now = new Date();

  try {
    const cId = safeObjectId(id);
    const riskCase = cId
      ? await riskCases.findOne({ _id: cId })
      : await riskCases.findOne({ riskCaseNumber: id });

    if (!riskCase) {
      return res.status(404).json({ success: false, message: 'Risk case not found' });
    }

    await riskCases.updateOne(
      { _id: riskCase._id },
      {
        $set: {
          assignedAdmin: String(adminId || req.user.id),
          status: 'UNDER_REVIEW',
          updatedAt: now
        }
      }
    );

    return res.status(200).json({ success: true, message: 'Risk case assigned' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/risk-cases/:id/resolve
 * Resolve a risk case (CLEARED, CONFIRMED, FALSE_POSITIVE)
 */
router.post('/:id/resolve', requireAuth, requirePermission(PERMISSIONS.RISK_MANAGE), async (req, res) => {
  const db = getDb();
  const riskCases = db.collection('risk_cases');
  const { id } = req.params;
  const { resolutionStatus = 'CLEARED', resolutionNote = '' } = req.body;
  const now = new Date();

  try {
    const cId = safeObjectId(id);
    const riskCase = cId
      ? await riskCases.findOne({ _id: cId })
      : await riskCases.findOne({ riskCaseNumber: id });

    if (!riskCase) {
      return res.status(404).json({ success: false, message: 'Risk case not found' });
    }

    await riskCases.updateOne(
      { _id: riskCase._id },
      {
        $set: {
          status: resolutionStatus,
          resolutionNote,
          resolvedBy: String(req.user.id),
          resolvedAt: now,
          updatedAt: now
        }
      }
    );

    await logFinancialAudit({
      actorId: String(req.user.id),
      actorRole: 'ADMIN',
      garageId: riskCase.entities?.garageId,
      action: 'RISK_CASE_RESOLVED',
      resourceType: 'RISK_CASE',
      resourceId: riskCase.riskCaseNumber,
      afterState: { resolutionStatus, resolutionNote },
      dbInstance: db
    });

    return res.status(200).json({ success: true, message: `Risk case resolved as ${resolutionStatus}` });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
