const express = require('express');
const router = express.Router();
const { getDb, getMongoStatus } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, PERMISSIONS } = require('../middleware/financialRbac');

// Liveness Probe (process is alive)
router.get('/live', (req, res) => {
  return res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Readiness Probe (can safely serve traffic)
router.get('/ready', async (req, res) => {
  const mongoStatus = getMongoStatus();
  let dbOk = false;

  try {
    if (mongoStatus.connected) {
      await getDb().command({ ping: 1 });
      dbOk = true;
    }
  } catch (err) {
    dbOk = false;
  }

  const isReady = mongoStatus.connected && dbOk;

  return res.status(isReady ? 200 : 503).json({
    status: isReady ? 'READY' : 'NOT_READY',
    timestamp: new Date().toISOString(),
    database: {
      connected: mongoStatus.connected,
      pingOk: dbOk
    }
  });
});

// Top-level standard health check
router.get('/', async (req, res) => {
  const mongoStatus = getMongoStatus();
  let dbOk = false;

  try {
    if (mongoStatus.connected) {
      await getDb().command({ ping: 1 });
      dbOk = true;
    }
  } catch (err) {
    dbOk = false;
  }

  const healthy = mongoStatus.connected && dbOk;

  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: healthy ? 'healthy' : 'degraded',
      razorpay: process.env.RAZORPAY_KEY_ID ? 'configured' : 'mock_fallback',
      settlement: process.env.SETTLEMENT_PROVIDER || 'mock',
      scheduler: 'active'
    }
  });
});

// Detailed Admin Diagnostic Health Endpoint
router.get('/detailed', requireAuth, requirePermission(PERMISSIONS.FINANCIAL_REPORT_READ), async (req, res) => {
  const db = getDb();
  const mongoStatus = getMongoStatus();

  let dbStats = null;
  try {
    dbStats = await db.stats();
  } catch {}

  const [settlementCount, alertCount, riskCaseCount] = await Promise.all([
    db.collection('settlements').countDocuments(),
    db.collection('financial_alerts').countDocuments({ status: 'OPEN' }),
    db.collection('risk_cases').countDocuments({ status: 'OPEN' })
  ]);

  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
    database: {
      connected: mongoStatus.connected,
      dbName: mongoStatus.dbName,
      collections: dbStats?.collections || 0,
      objects: dbStats?.objects || 0
    },
    financialMetrics: {
      totalSettlements: settlementCount,
      openAlerts: alertCount,
      openRiskCases: riskCaseCount
    },
    configuration: {
      nodeEnv: process.env.NODE_ENV || 'development',
      settlementMode: process.env.SETTLEMENT_MODE || 'MOCK_TEST_MODE',
      settlementProvider: process.env.SETTLEMENT_PROVIDER || 'mock',
      minSettlementAmount: process.env.MIN_SETTLEMENT_AMOUNT || 500,
      highValueThreshold: process.env.HIGH_VALUE_SETTLEMENT_THRESHOLD || 50000
    }
  });
});

module.exports = router;
