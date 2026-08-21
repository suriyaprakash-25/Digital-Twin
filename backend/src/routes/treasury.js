const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission, PERMISSIONS } = require('../middleware/permissionMiddleware');
const { getTreasuryForecast, getGarageSettlementForecast } = require('../services/settlementForecastService');
const { getSettlementAgingAnalysis } = require('../services/settlementAgingService');
const { getDb } = require('../db');

/**
 * GET /api/admin/treasury/forecast
 * Admin-only treasury liquidity & payout forecasting
 */
router.get('/forecast', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  try {
    const forecast = await getTreasuryForecast(getDb());
    return res.status(200).json({ success: true, forecast });
  } catch (err) {
    console.error('Error calculating treasury forecast:', err);
    return res.status(500).json({ success: false, message: 'Failed to calculate treasury forecast' });
  }
});

/**
 * GET /api/admin/treasury/aging
 * Admin-only settlement aging buckets & SLA monitoring
 */
router.get('/aging', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  try {
    const aging = await getSettlementAgingAnalysis(getDb());
    return res.status(200).json({ success: true, aging });
  } catch (err) {
    console.error('Error analyzing settlement aging:', err);
    return res.status(500).json({ success: false, message: 'Failed to analyze settlement aging' });
  }
});

module.exports = router;
