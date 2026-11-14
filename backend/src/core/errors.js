/**
 * Typed application errors + a single error response contract.
 *
 * Response shape (backward compatible with both legacy `msg` and `message` readers):
 *   { success: false, msg, message, code, requestId, details? }
 */
class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details, expose } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
    // Client errors are safe to show; server errors are masked unless explicitly exposed.
    this.expose = expose !== undefined ? expose : status < 500;
  }
}

class ValidationError extends AppError {
  constructor(message = 'Invalid request', details) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', details });
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Missing or invalid token') {
    super(message, { status: 401, code: 'UNAUTHENTICATED' });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, { status: 403, code: 'FORBIDDEN' });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, { status: 404, code: 'NOT_FOUND' });
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, { status: 409, code });
  }
}

class UpstreamError extends AppError {
  constructor(message = 'Upstream service unavailable', code = 'UPSTREAM_UNAVAILABLE') {
    super(message, { status: 502, code, expose: true });
  }
}

function buildErrorBody(err, req) {
  const message = err.expose ? err.message : 'Internal server error';
  const body = {
    success: false,
    msg: message,
    message,
    code: err.code || 'INTERNAL_ERROR',
    requestId: (req && req.requestId) || null,
  };
  if (err.expose && err.details !== undefined) body.details = err.details;
  return body;
}

function sendError(res, err, req) {
  const appError = err instanceof AppError ? err : new AppError(err && err.message ? err.message : 'Internal server error');
  return res.status(appError.status).json(buildErrorBody(appError, req));
}

/** Wraps an async route handler so rejections reach the central error middleware. */
function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    return Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UpstreamError,
  buildErrorBody,
  sendError,
  asyncHandler,
};
