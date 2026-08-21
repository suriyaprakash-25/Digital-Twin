const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, PERMISSIONS } = require('../middleware/permissionMiddleware');

/**
 * GET /api/admin/financial-audit/summary
 */
router.get('/summary', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  const db = getDb();
  const auditLogs = db.collection('financial_audit_logs');

  try {
    const totalLogs = await auditLogs.countDocuments();
    const settlementActions = await auditLogs.countDocuments({ action: { $regex: '^SETTLEMENT_' } });
    const refundActions = await auditLogs.countDocuments({ action: { $regex: '^REFUND_' } });
    const paymentActions = await auditLogs.countDocuments({ action: { $regex: '^PAYMENT_' } });
    const disputeActions = await auditLogs.countDocuments({ action: { $regex: '^DISPUTE_' } });

    return res.status(200).json({
      success: true,
      summary: {
        totalLogs,
        settlementActions,
        refundActions,
        paymentActions,
        disputeActions
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error fetching audit summary' });
  }
});

/**
 * GET /api/admin/financial-audit
 * Filterable, paginated financial audit logs
 */
router.get('/', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  const db = getDb();
  const auditLogs = db.collection('financial_audit_logs');

  try {
    const {
      page = 1,
      limit = 20,
      actorId,
      action,
      garageId,
      settlementId,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const query = {};

    if (actorId) query.actorId = actorId;
    if (action && action !== 'ALL') query.action = action;
    if (garageId) query.garageId = garageId;
    if (settlementId) query.settlementId = settlementId;

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search) {
      query.$or = [
        { action: { $regex: search, $options: 'i' } },
        { settlementId: { $regex: search, $options: 'i' } },
        { garageId: { $regex: search, $options: 'i' } },
        { actorId: { $regex: search, $options: 'i' } },
        { resourceId: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, totalCount] = await Promise.all([
      auditLogs.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).toArray(),
      auditLogs.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      auditLogs: logs,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error fetching financial audit logs:', err);
    return res.status(500).json({ success: false, message: 'Error fetching audit logs' });
  }
});

module.exports = router;
