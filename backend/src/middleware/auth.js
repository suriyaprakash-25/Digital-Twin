const { ObjectId } = require('mongodb');

const ROLE_ALIASES = Object.freeze({
  GARAGE: ['garage', 'service_center', 'servicecenter', 'service centre', 'service center'],
  USER: ['vehicle_owner', 'vehicle owner', 'user', 'customer', 'owner'],
  ADMIN: ['admin', 'administrator'],
});
// NOTE: frontend/src/utils/roles.js mirrors this table; keep them in sync.
const ALIAS_TO_ROLE = new Map(Object.entries(ROLE_ALIASES).flatMap(([role, aliases]) => aliases.map((alias) => [alias, role])));

function normalizeRole(role) {
  const key = String(role || '').trim().toLowerCase();
  return ALIAS_TO_ROLE.get(key) || String(role || 'USER');
}

/**
 * Normalize a role supplied by an unauthenticated registration flow.
 * Public callers can choose between the two customer-facing account types,
 * but can never self-register an administrative or unknown privileged role.
 */
function normalizePublicRole(role) {
  return normalizeRole(role) === 'GARAGE' ? 'GARAGE' : 'USER';
}

function readBearerToken(req) {
  const parts = String(req.headers.authorization || '').split(' ');
  return parts.length === 2 && parts[0] === 'Bearer' && parts[1] ? parts[1] : null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Where the credential came from. Bearer tokens are never sent automatically by browsers, so only
 * cookie-authenticated requests need CSRF protection.
 * @returns {{ token: string, method: 'bearer'|'cookie' } | null}
 */
function readCredential(req) {
  const bearer = readBearerToken(req);
  if (bearer) return { token: bearer, method: 'bearer' };
  const { readCookie } = require('../services/authService');
  const { AUTH } = require('../core/constants');
  const cookie = readCookie(req, AUTH.SESSION_COOKIE_NAME);
  return cookie ? { token: cookie, method: 'cookie' } : null;
}

/**
 * CSRF defence for cookie sessions (OWASP "custom request header"): state-changing requests must
 * carry X-Requested-With. Cross-site pages cannot add custom headers without a CORS preflight,
 * which our strict origin allowlist rejects; SameSite cookies add a second layer.
 */
function passesCsrfCheck(req, credential) {
  if (credential.method !== 'cookie' || SAFE_METHODS.has(req.method)) return true;
  const { AUTH } = require('../core/constants');
  return Boolean(req.headers[AUTH.CSRF_HEADER]);
}

function toRequestUser(user) {
  return {
    id: String(user._id),
    role: normalizeRole(user.role),
    adminRole: user.adminRole || undefined,
    email: user.email || '',
    name: user.name || '',
    phone: user.phone || '',
  };
}

const AUTH_USER_CACHE_PREFIX = 'auth:user:';
const AUTH_USER_CACHE_TTL_MS = 30 * 1000;
const AUTH_USER_PROJECTION = Object.freeze({ role: 1, adminRole: 1, email: 1, name: 1, phone: 1, tokenVersion: 1, isDisabled: 1 });

/**
 * Loads the fields auth needs, read-through cached for AUTH_USER_CACHE_TTL_MS. This was the hottest
 * query in the system (one users lookup per authenticated request). Revocation stays sound:
 * the instance that bumps tokenVersion invalidates immediately (invalidateAuthUser) and every other
 * instance converges within the TTL.
 */
async function loadAuthUser(userId) {
  const { getCache } = require('../infrastructure/cache/cache');
  const { getDb } = require('../db');
  const cached = await getCache().wrap(`${AUTH_USER_CACHE_PREFIX}${userId}`, AUTH_USER_CACHE_TTL_MS, async () => {
    const user = await getDb().collection('users').findOne({ _id: new ObjectId(userId) }, { projection: AUTH_USER_PROJECTION });
    // Cache values must be plain data: store the id as a string, and cache misses as null.
    return user ? { ...user, _id: String(user._id) } : null;
  });
  return cached || null;
}

/** Call after any change to a user's role, tokenVersion or disabled flag. */
async function invalidateAuthUser(userId) {
  const { getCache } = require('../infrastructure/cache/cache');
  await getCache().delete(`${AUTH_USER_CACHE_PREFIX}${String(userId)}`);
}

/**
 * Resolves the authenticated user, or null. The user is re-loaded on every request, so role
 * changes, deletions and session revocation (tokenVersion bump on password reset) apply instantly.
 */
async function resolveUser(req) {
  const credential = readCredential(req);
  if (!credential) return null;
  if (!passesCsrfCheck(req, credential)) {
    req.authFailure = 'CSRF_CHECK_FAILED';
    return null;
  }
  // Lazy requires keep this module free of config/db side effects at import time.
  const { verifyToken, isTokenCurrent } = require('../services/authService');
  try {
    const payload = verifyToken(credential.token);
    req.auth = { method: credential.method, tokenType: payload.typ || 'session' };
    if (!payload.sub || !ObjectId.isValid(String(payload.sub))) return null;
    const user = await loadAuthUser(String(payload.sub));
    if (!user || !isTokenCurrent(payload, user) || user.isDisabled === true) return null;
    return toRequestUser(user);
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const user = await resolveUser(req);
  if (!user) {
    if (req.authFailure === 'CSRF_CHECK_FAILED') {
      return res.status(403).json({ success: false, msg: 'Missing CSRF header', message: 'Missing CSRF header', code: 'CSRF_CHECK_FAILED' });
    }
    return res.status(401).json({ success: false, msg: 'Missing or invalid token', message: 'Missing or invalid token', code: 'UNAUTHENTICATED' });
  }
  req.user = user;
  return next();
}

async function optionalAuth(req, res, next) {
  req.user = await resolveUser(req);
  return next();
}

function requireRole(allowedRoles) {
  const allowed = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map(normalizeRole);
  return function roleMiddleware(req, res, next) {
    if (!allowed.includes(normalizeRole(req.user && req.user.role))) {
      return res.status(403).json({ success: false, msg: 'Forbidden', message: 'Forbidden', code: 'FORBIDDEN' });
    }
    return next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole, normalizeRole, normalizePublicRole, invalidateAuthUser, ROLE_ALIASES };
