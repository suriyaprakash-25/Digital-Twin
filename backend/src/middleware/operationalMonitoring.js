const { recordOperationalEvent } = require('../services/operationalMonitoringService');

function safelyRecord(event) {
  recordOperationalEvent(event).catch((err) => {
    try {
      process.stderr.write(`Operational monitoring persistence failed: ${err.message || err}\n`);
    } catch {}
  });
}

function operationalMonitoringMiddleware(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;

    if (res.statusCode >= 500) {
      safelyRecord({
        kind: 'HTTP_5XX',
        severity: 'ERROR',
        message: `${req.method} ${req.originalUrl || req.url} returned ${res.statusCode}`,
        requestId: req.requestId || null,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs,
        actorId: req.user?.id || null,
        actorRole: req.user?.role || null
      });
      return;
    }

    if (durationMs >= 5000) {
      safelyRecord({
        kind: 'SLOW_REQUEST',
        severity: 'WARN',
        message: `${req.method} ${req.originalUrl || req.url} exceeded 5s`,
        requestId: req.requestId || null,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs,
        actorId: req.user?.id || null,
        actorRole: req.user?.role || null
      });
    }
  });

  next();
}

let processHandlersRegistered = false;

function registerProcessErrorMonitoring() {
  if (processHandlersRegistered) return;
  processHandlersRegistered = true;

  process.on('unhandledRejection', (reason) => {
    safelyRecord({
      kind: 'UNHANDLED_REJECTION',
      severity: 'ERROR',
      message: reason?.message || String(reason || 'Unhandled promise rejection'),
      stack: reason?.stack || null
    });
  });

  process.on('uncaughtExceptionMonitor', (err) => {
    safelyRecord({
      kind: 'UNCAUGHT_EXCEPTION',
      severity: 'ERROR',
      message: err?.message || String(err || 'Uncaught exception'),
      stack: err?.stack || null
    });
  });
}

module.exports = {
  operationalMonitoringMiddleware,
  registerProcessErrorMonitoring
};
