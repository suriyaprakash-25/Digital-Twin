/**
 * HTTP hardening middleware: security headers, NoSQL operator-injection sanitisation,
 * size-aware JSON parsing, 404 and central error handling.
 */
const express = require('express');
const { HTTP_LIMITS } = require('../core/constants');
const { AppError, buildErrorBody } = require('../core/errors');
const { logger } = require('../services/logger');

/** Equivalent of helmet's API-relevant defaults without adding a dependency. */
function securityHeaders({ isProduction }) {
  return function applySecurityHeaders(req, res, next) {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('X-DNS-Prefetch-Control', 'off');
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // The API serves JSON (and user uploads); nothing here should ever execute script.
    res.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'");
    if (isProduction) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

const FORBIDDEN_KEY = /^\$|\./;

/**
 * Recursively removes keys starting with `$` or containing `.` so request data can never be
 * interpreted as a MongoDB query operator (e.g. {"email": {"$ne": null}}).
 * @returns {number} number of keys removed
 */
function stripMongoOperators(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 20) return 0;
  let removed = 0;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEY.test(key)) {
      delete value[key];
      removed += 1;
    } else {
      removed += stripMongoOperators(value[key], depth + 1);
    }
  }
  return removed;
}

function sanitizeRequest(req, res, next) {
  let removed = stripMongoOperators(req.body) + stripMongoOperators(req.params);
  // Express 4 exposes req.query as a getter over a parsed object; mutate in place.
  if (req.query && typeof req.query === 'object') removed += stripMongoOperators(req.query);
  if (removed > 0) {
    logger.security('Stripped MongoDB operator keys from request', { requestId: req.requestId, path: req.path, removed });
  }
  next();
}

/** Small default body limit; larger only for the endpoints that legitimately need it. */
function jsonBodyParser({ rawBodyPaths = [] } = {}) {
  const verify = (req, res, buf) => {
    if (rawBodyPaths.some((p) => req.originalUrl && req.originalUrl.startsWith(p))) req.rawBody = buf;
  };
  const small = express.json({ limit: HTTP_LIMITS.DEFAULT_JSON_BODY, verify });
  const large = express.json({ limit: HTTP_LIMITS.LARGE_JSON_BODY, verify });
  return function parseJson(req, res, next) {
    const needsLarge = HTTP_LIMITS.LARGE_BODY_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix));
    return (needsLarge ? large : small)(req, res, next);
  };
}

const INTERNAL_ERROR_FIELDS = ['error', 'stack', 'errorStack'];

/**
 * Decorates res.json so no 5xx response can leak internals: legacy handlers return
 * `{ msg, error: e.message }`; the internal fields are logged (with the request id for support)
 * and removed from the body. Client-error (4xx) bodies are untouched.
 */
function maskServerErrors(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body === 'object' && !Array.isArray(body)) {
      const leaked = INTERNAL_ERROR_FIELDS.filter((field) => body[field] !== undefined);
      if (leaked.length) {
        logger.error('Masked internal error details in 5xx response', {
          requestId: req.requestId,
          path: req.path,
          details: leaked.map((field) => String(typeof body[field] === 'object' ? JSON.stringify(body[field]) : body[field]).slice(0, 500)),
        });
        const masked = { ...body };
        leaked.forEach((field) => { delete masked[field]; });
        if (masked.requestId === undefined) masked.requestId = req.requestId || null;
        return originalJson(masked);
      }
    }
    return originalJson(body);
  };
  next();
}

function notFoundHandler(req, res) {
  res.status(404).json(buildErrorBody(new AppError(`Route not found: ${req.method} ${req.path}`, { status: 404, code: 'NOT_FOUND' }), req));
}

/** Central error middleware: never leaks stack traces; maps parser errors to 4xx. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let appError = err;
  if (!(err instanceof AppError)) {
    if (err && err.type === 'entity.too.large') {
      appError = new AppError('Request body is too large', { status: 413, code: 'PAYLOAD_TOO_LARGE' });
    } else if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      appError = new AppError('Malformed JSON request body', { status: 400, code: 'MALFORMED_JSON' });
    } else if (err && err.code === 'LIMIT_FILE_SIZE') {
      appError = new AppError('Uploaded file is too large', { status: 413, code: 'FILE_TOO_LARGE' });
    } else if (err && err.code === 'UNSUPPORTED_FILE_TYPE') {
      appError = new AppError(err.message, { status: 415, code: 'UNSUPPORTED_FILE_TYPE' });
    } else {
      appError = new AppError('Internal server error', { status: 500 });
    }
  }
  if (appError.status >= 500) {
    logger.error('Unhandled request error', { requestId: req.requestId, path: req.path, error: err && err.message, stack: err && err.stack });
  }
  if (res.headersSent) return undefined;
  return res.status(appError.status).json(buildErrorBody(appError, req));
}

module.exports = { securityHeaders, sanitizeRequest, stripMongoOperators, jsonBodyParser, maskServerErrors, notFoundHandler, errorHandler };
