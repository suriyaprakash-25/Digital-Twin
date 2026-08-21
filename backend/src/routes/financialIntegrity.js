const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, PERMISSIONS } = require('../middleware/permissionMiddleware');
const {
  runFinancialIntegrityScan,
  resolveFinancialIntegrityIssue
} = require('../services/financialIntegrityService');

// Get integrity issues summary
router.get('/summary', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  const db = getDb();
  const issuesCollection = db.collection('financial_integrity_issues');

  try {
    const [totalIssues, openIssues, resolvedIssues] = await Promise.all([
      issuesCollection.countDocuments(),
      issuesCollection.countDocuments({ status: 'OPEN' }),
      issuesCollection.countDocuments({ status: 'RESOLVED' })
    ]);

    return res.status(200).json({
      success: true,
      summary: { totalIssues, openIssues, resolvedIssues }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load integrity summary' });
  }
});

// List paginated integrity issues
router.get('/issues', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  const { status = 'OPEN', page = 1, limit = 20 } = req.query;
  const db = getDb();
  const issuesCollection = db.collection('financial_integrity_issues');

  try {
    const query = {};
    if (status && status !== 'ALL') query.status = status;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [issues, totalCount] = await Promise.all([
      issuesCollection.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limitNum).toArray(),
      issuesCollection.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      issues,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load integrity issues' });
  }
});

// Trigger a non-destructive read-only integrity scan
router.post('/run', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  try {
    const result = await runFinancialIntegrityScan();
    return res.status(200).json({ success: true, scanResult: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Integrity scan failed: ' + err.message });
  }
});

// Resolve an integrity issue
router.post('/:id/resolve', requireAuth, requirePermission(PERMISSIONS.RECONCILIATION_RUN), async (req, res) => {
  const { resolutionNote } = req.body;
  try {
    const result = await resolveFinancialIntegrityIssue(req.params.id, {
      adminId: req.user.id,
      resolutionNote
    });
    return res.status(200).json({ success: true, result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
