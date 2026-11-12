// DrivePortz Backend Server — composition root.
// Wires configuration, middleware (in security-significant order), routes, background workers and
// graceful shutdown. Business logic lives in src/services; nothing domain-specific belongs here.
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const { loadConfig } = require('./src/config');
const { connectToMongo, getMongoStatus, getDb, closeMongo } = require('./src/db');
const { initFirebase, getFirebaseInitError } = require('./src/firebase');
const { createCorsPolicy } = require('./src/security/corsPolicy');
const { securityHeaders, sanitizeRequest, jsonBodyParser, maskServerErrors, notFoundHandler, errorHandler } = require('./src/security/httpHardening');
const { requestCorrelationMiddleware } = require('./src/middleware/requestCorrelation');
const { operationalMonitoringMiddleware, registerProcessErrorMonitoring } = require('./src/middleware/operationalMonitoring');
const { HTTP_LIMITS, SHUTDOWN } = require('./src/core/constants');
const { JobWorker, ensureJobQueueIndexes } = require('./src/infrastructure/messaging/jobQueue');
const { ensureRateLimitIndexes } = require('./src/infrastructure/rateLimit/rateLimiters');
const { breakerSnapshots } = require('./src/infrastructure/http/resilientHttp');
const { getCache } = require('./src/infrastructure/cache/cache');
const { registerPaymentNotifications } = require('./src/services/payments/paymentNotifications');
const { logger } = require('./src/services/logger');

const { userDisputeRouter, garageDisputeRouter, adminDisputeRouter } = require('./src/routes/disputes');
const { garageReportsRouter, adminReportsRouter } = require('./src/routes/reports');
const { garageTaxRouter, adminTaxRouter } = require('./src/routes/tax');

// Order matters: Express matches mounts in sequence and a router that has no matching route falls
// through to the next mount (e.g. /api/admin -> /api/admin/settlements).
const ROUTES = [
  ['/api/auth', require('./src/routes/auth')],
  ['/api/vehicles', require('./src/routes/vehicles')],
  ['/api/services', require('./src/routes/services')],
  ['/api/health', require('./src/routes/systemHealth')],
  ['/api/vehicle-health', require('./src/routes/health')],
  ['/api/reminders', require('./src/routes/reminders')],
  ['/api/resale', require('./src/routes/resale')],
  ['/api/garage', require('./src/routes/garage')],
  ['/api/garage/availability', require('./src/routes/garageAvailabilityRoutes')],
  ['/api/analytics', require('./src/routes/analytics')],
  ['/api/marketplace', require('./src/routes/marketplace')],
  ['/api/garages', require('./src/routes/garages')],
  ['/api/bookings', require('./src/routes/bookings')],
  ['/api/notifications', require('./src/routes/notifications')],
  ['/api/admin', require('./src/routes/admin')],
  ['/api/passport', require('./src/routes/passport')],
  ['/api/insurance', require('./src/routes/insurance')],
  ['/api/ownership', require('./src/routes/ownership')],
  ['/api/vehicle-doctor', require('./src/routes/vehicleDoctorRoutes')],
  ['/api/copilot', require('./src/routes/copilotRoutes')],
  ['/api/feedback', require('./src/routes/feedbackRoutes')],
  ['/api/admin/feedback', require('./src/routes/adminFeedbackRoutes')],
  ['/api/payments', require('./src/routes/payments')],
  ['/api/invoices', require('./src/routes/invoices')],
  ['/api/garage/invoices', require('./src/routes/invoices')],
  ['/api/garage', require('./src/routes/earnings')],
  ['/api/garage/earnings', require('./src/routes/earnings')],
  ['/api/admin/reconciliation', require('./src/routes/reconciliation')],
  ['/api/disputes', userDisputeRouter],
  ['/api/garage/disputes', garageDisputeRouter],
  ['/api/admin/disputes', adminDisputeRouter],
  ['/api/admin/risk', require('./src/routes/risk')],
  ['/api/garage/reports', garageReportsRouter],
  ['/api/admin/reports', adminReportsRouter],
  ['/api/admin/financial-operations', require('./src/routes/financialOperations')],
  ['/api/admin/settlements', require('./src/routes/financialOperations')],
  ['/api/admin/financial-audit', require('./src/routes/financialAudit')],
  ['/api/admin/treasury', require('./src/routes/treasury')],
  ['/api/garage/tax', garageTaxRouter],
  ['/api/admin/tax', adminTaxRouter],
  ['/api/admin/risk-cases', require('./src/routes/riskCases')],
  ['/api/admin/alerts', require('./src/routes/financialAlerts')],
  ['/api/admin/financial-integrity', require('./src/routes/financialIntegrity')],
  ['/api/admin/monitoring', require('./src/routes/operationalMonitoring')],
  ['/api/admin/pilot', require('./src/routes/pilotAdminRoutes')],
  ['/api/media', require('./src/routes/media')],
];

const INDEX_INITIALISERS = [
  require('./src/models/Payment').ensurePaymentIndexes,
  require('./src/models/Earnings').ensureEarningsIndexes,
  require('./src/models/Reconciliation').ensureReconciliationIndexes,
  require('./src/models/Dispute').ensureDisputeIndexes,
  require('./src/models/RiskEvent').ensureRiskIndexes,
  require('./src/models/AuditLog').ensureAuditIndexes,
  require('./src/models/SettlementSchedule').ensureSettlementOperationIndexes,
  require('./src/models/ComplianceAndRisk').ensureComplianceAndRiskIndexes,
  require('./src/models/PaymentWebhookEvent').ensureWebhookEventIndexes,
  require('./src/models/CoreIndexes').ensureCoreIndexes,
  require('./src/services/garages').ensureGarageIndexes,
  require('./src/jobs/jobRegistry').ensureJobRegistryIndexes,
  require('./src/services/financialAlertService').ensureFinancialAlertIndexes,
  require('./src/services/financialNotificationService').ensureFinancialNotificationIndexes,
  require('./src/services/operationalMonitoringService').ensureOperationalMonitoringIndexes,
  () => ensureJobQueueIndexes(),
  () => ensureRateLimitIndexes(),
];

const config = loadConfig();
const isProduction = ['production', 'staging'].includes(String(config.nodeEnv).toLowerCase());

function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  // Render/Vercel sit behind one proxy hop; without this every client shares the proxy's IP and
  // IP-keyed rate limits would lock out all users at once.
  app.set('trust proxy', process.env.TRUST_PROXY !== undefined ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : (isProduction ? 1 : false));

  app.use(requestCorrelationMiddleware);
  app.use(operationalMonitoringMiddleware);
  app.use(securityHeaders({ isProduction }));
  app.use(maskServerErrors);

  // Strict CORS: unknown browser origins are rejected before any handler runs. Requests with no
  // Origin header (webhooks, health checks, native clients) remain valid.
  const corsPolicy = createCorsPolicy({ nodeEnv: config.nodeEnv, frontendUrl: config.frontendUrl, extraOrigins: process.env.CORS_ALLOWED_ORIGINS });
  app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && !corsPolicy.isAllowed(origin)) {
      return res.status(403).json({ success: false, msg: 'CORS origin not allowed', message: 'CORS origin not allowed', code: 'CORS_REJECTED', requestId: req.requestId || null });
    }
    return next();
  });
  app.use(cors({
    origin: (origin, callback) => callback(null, corsPolicy.isAllowed(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-webhook-signature', 'x-webhook-timestamp', 'Idempotency-Key', 'X-Idempotency-Key'],
    exposedHeaders: ['X-Request-ID', 'X-Total-Count', 'X-Page', 'X-Limit', 'X-Total-Pages', 'Idempotent-Replayed', 'RateLimit', 'RateLimit-Policy'],
  }));

  // Small JSON limit by default; raw body retained for webhook HMAC verification.
  app.use(jsonBodyParser({ rawBodyPaths: ['/api/payments/cashfree-webhook'] }));
  app.use(express.urlencoded({ extended: true, limit: HTTP_LIMITS.DEFAULT_JSON_BODY }));
  app.use(sanitizeRequest);

  // Local uploads (development fallback; production uses Cloudinary). Served as inert files:
  // `sandbox` CSP + nosniff mean an uploaded .html/.svg can never execute on the API origin.
  const uploadsDir = path.join(__dirname, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir, {
    dotfiles: 'deny',
    index: false,
    setHeaders: (res) => {
      res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
      res.set('X-Content-Type-Options', 'nosniff');
    },
  }));

  app.get('/', (req, res) => res.send('Mobility Driveportz API is running!'));

  // Readiness probe used by Render health checks / load balancer.
  app.get('/api/status', async (req, res) => {
    const status = getMongoStatus();
    let pingOk = false;
    try {
      if (status.connected) {
        await getDb().command({ ping: 1 });
        pingOk = true;
      }
    } catch {
      pingOk = false;
    }
    const ok = status.connected && pingOk;
    const body = { ok, mongo: { connected: status.connected, pingOk }, dependencies: breakerSnapshots() };
    if (!isProduction) {
      body.mongo.dbName = status.dbName;
      body.mongo.lastError = status.lastError;
      body.firebase = { initialized: Boolean(initFirebase(config)), lastError: getFirebaseInitError() };
      body.cache = getCache().getStats ? getCache().getStats() : undefined;
    }
    res.status(ok ? 200 : 503).json(body);
  });

  ROUTES.forEach(([mountPath, router]) => app.use(mountPath, router));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

async function start() {
  await connectToMongo(config);
  for (const ensureIndexes of INDEX_INITIALISERS) {
    await ensureIndexes();
  }
  registerProcessErrorMonitoring();

  const worker = new JobWorker({ handlers: { ...registerPaymentNotifications() } });
  if (process.env.JOB_WORKER_ENABLED !== 'false') worker.start();

  const server = app.listen(config.port, () => {
    logger.info(`Backend listening on http://localhost:${config.port}`);
  });
  server.requestTimeout = HTTP_LIMITS.REQUEST_TIMEOUT_MS;
  server.headersTimeout = HTTP_LIMITS.REQUEST_TIMEOUT_MS + 5000;

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received: draining connections`);
    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, SHUTDOWN.GRACE_PERIOD_MS);
    forceExit.unref();
    try {
      await new Promise((resolve) => server.close(resolve)); // stop accepting, finish in-flight requests
      await worker.stop(); // finish the in-flight job batch
      await closeMongo();
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { error: err.message });
      process.exit(1);
    }
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, buildApp, start };
