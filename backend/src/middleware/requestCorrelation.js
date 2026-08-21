const crypto = require('crypto');
const { logger } = require('../services/logger');

const SLOW_REQUEST_THRESHOLD_MS = parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS, 10) || 1000;

function generateRequestId() {
  return `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Request correlation & latency monitoring middleware
 */
function requestCorrelationMiddleware(req, res, next) {
  // Extract or generate sanitized Request ID
  let incomingId = req.headers['x-request-id'];
  if (incomingId && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingId)) {
    req.requestId = incomingId;
  } else {
    req.requestId = generateRequestId();
  }

  res.setHeader('X-Request-ID', req.requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn(`Slow Request Detected: ${req.method} ${req.originalUrl} (${durationMs}ms)`, {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        actorId: req.user?.id || null
      });
    }
  });

  next();
}

module.exports = {
  requestCorrelationMiddleware
};
