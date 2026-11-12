/**
 * Authentication domain logic (Extract Class from routes/auth.js + middleware/auth.js).
 * Single place for token issuing/verification, password policy, OTP handling and the user view.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { loadConfig } = require('../config');
const { AUTH } = require('../core/constants');

const config = loadConfig();

const LEGAL_VERSION = 'pilot-2026-09-v1';
const PASSWORD_POLICY_MESSAGE = `Password must be at least ${AUTH.PASSWORD_MIN_LENGTH} characters and include at least one letter and one number.`;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BLOCKED_EMAIL_DOMAINS = new Set(['example.com', 'test.com', 'driveportz.com', 'tempmail.com', 'yopmail.com', 'mailinator.com']);

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_PATTERN.test(email);
}

function isBlockedEmailDomain(email) {
  const domain = String(email).split('@')[1];
  return BLOCKED_EMAIL_DOMAINS.has(String(domain || '').toLowerCase().trim());
}

function isStrongPassword(password) {
  return typeof password === 'string'
    && password.length >= AUTH.PASSWORD_MIN_LENGTH
    && password.length <= 128
    && /[A-Za-z]/.test(password)
    && /\d/.test(password);
}

function hashPassword(password) {
  return bcrypt.hash(String(password), AUTH.BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(String(password), String(hash || ''));
}

const TOKEN_TYPE = Object.freeze({ SESSION: 'session', ACCESS: 'access' });

/**
 * Issues a JWT. `tv` (token version) lets us revoke every existing session of a user by
 * incrementing `users.tokenVersion` (done on password reset and "log out everywhere").
 *  - SESSION (default): long-lived, delivered ONLY as an httpOnly cookie.
 *  - ACCESS: short-lived (AUTH.ACCESS_TOKEN_TTL), returned in the body for in-memory use.
 */
function issueToken(user, normalizeRole, { type = TOKEN_TYPE.SESSION } = {}) {
  return jwt.sign(
    { role: normalizeRole(user.role), tv: Number(user.tokenVersion || 0), typ: type },
    config.jwtSecret,
    {
      subject: String(user._id),
      expiresIn: type === TOKEN_TYPE.ACCESS ? AUTH.ACCESS_TOKEN_TTL : config.jwtExpiresIn,
      algorithm: AUTH.JWT_ALGORITHM,
    }
  );
}

/** Tokens issued before typed tokens existed carry no `typ`; they were 7-day sessions. */
function isSessionToken(payload) {
  return !payload.typ || payload.typ === TOKEN_TYPE.SESSION;
}

function durationToMs(value) {
  const match = /^(\d+)\s*([smhd])?$/.exec(String(value).trim());
  if (!match) return 7 * 24 * 3600 * 1000;
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2] || 's'];
  return Number(match[1]) * unit;
}

/**
 * Session cookie attributes. Production frontend (www.driveportz.com) and API (onrender.com) are
 * cross-site today, which requires SameSite=None; Secure. Once the API is served from a same-site
 * host (api.driveportz.com) set AUTH_COOKIE_SAMESITE=lax for stronger CSRF isolation.
 */
function sessionCookieOptions() {
  const isProduction = ['production', 'staging'].includes(String(config.nodeEnv).toLowerCase());
  const sameSite = String(process.env.AUTH_COOKIE_SAMESITE || (isProduction ? 'none' : 'lax')).toLowerCase();
  return {
    httpOnly: true,
    secure: isProduction || sameSite === 'none' || process.env.AUTH_COOKIE_SECURE === 'true',
    sameSite,
    path: AUTH.SESSION_COOKIE_PATH,
    maxAge: durationToMs(config.jwtExpiresIn),
  };
}

/** Minimal Cookie header parser (avoids a dependency). */
function readCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

/** Sets the httpOnly session cookie and returns the short-lived access token for the body. */
function startSession(res, user, normalizeRole) {
  res.cookie(AUTH.SESSION_COOKIE_NAME, issueToken(user, normalizeRole, { type: TOKEN_TYPE.SESSION }), sessionCookieOptions());
  return issueToken(user, normalizeRole, { type: TOKEN_TYPE.ACCESS });
}

function endSession(res) {
  const { maxAge, ...options } = sessionCookieOptions();
  res.clearCookie(AUTH.SESSION_COOKIE_NAME, options);
}

/** Verifies signature + expiry with the algorithm pinned (prevents alg-confusion). */
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: [AUTH.JWT_ALGORITHM] });
}

function isTokenCurrent(payload, user) {
  return Number(payload.tv || 0) === Number(user.tokenVersion || 0);
}

function toUserView(user, normalizeRole, overrides = {}) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    phone: user.phone || '',
    city: user.city || '',
    bio: user.bio || '',
    photoUrl: user.photoUrl || overrides.photoUrl || null,
    licenseDocumentUrl: user.licenseDocumentUrl || null,
    createdAt: user.createdAt || null,
  };
}

function legalAcceptanceFields(now = new Date()) {
  return {
    termsAccepted: true,
    privacyAccepted: true,
    termsAcceptedAt: now,
    privacyAcceptedAt: now,
    termsVersionAccepted: LEGAL_VERSION,
    privacyVersionAccepted: LEGAL_VERSION,
    legalVersionAccepted: LEGAL_VERSION,
  };
}

/** Cryptographically secure numeric OTP (Math.random is predictable). */
function generateOtp() {
  const max = 10 ** AUTH.OTP_LENGTH;
  return String(crypto.randomInt(max / 10, max));
}

/** OTPs are stored hashed (HMAC with the server secret), so a DB read does not reveal live codes. */
function hashOtp(otp) {
  return crypto.createHmac('sha256', config.jwtSecret).update(String(otp)).digest('hex');
}

function otpMatches(user, otp) {
  if (typeof otp !== 'string' && typeof otp !== 'number') return false;
  const candidate = String(otp);
  if (user.otpHash) {
    const expected = Buffer.from(user.otpHash, 'hex');
    const actual = Buffer.from(hashOtp(candidate), 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  return Boolean(user.otp) && user.otp === candidate; // legacy rows issued before hashing
}

function isOtpExpired(user, now = Date.now()) {
  return !user.otpExpiry || now > new Date(user.otpExpiry).getTime();
}

/** Random unusable password for federated (Google) accounts. */
async function randomPasswordHash() {
  return hashPassword(crypto.randomBytes(24).toString('base64url'));
}

module.exports = {
  PASSWORD_POLICY_MESSAGE,
  isValidEmail,
  isBlockedEmailDomain,
  isStrongPassword,
  hashPassword,
  verifyPassword,
  TOKEN_TYPE,
  issueToken,
  isSessionToken,
  sessionCookieOptions,
  readCookie,
  startSession,
  endSession,
  durationToMs,
  verifyToken,
  isTokenCurrent,
  toUserView,
  legalAcceptanceFields,
  generateOtp,
  hashOtp,
  otpMatches,
  isOtpExpired,
  randomPasswordHash,
};
