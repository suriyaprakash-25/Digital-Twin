const express = require('express');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { requireAuth, optionalAuth, normalizeRole, normalizePublicRole, invalidateAuthUser } = require('../middleware/auth');
const { upload, createUploader } = require('../utils/uploads');
const { persistUploadedFile, deletePersistedFile, removeTemporaryFile } = require('../services/persistentFileStorage');
const { limiters } = require('../infrastructure/rateLimit/rateLimiters');
const { asString, normalizeEmail } = require('../core/text');
const { AUTH, TIME } = require('../core/constants');
const { logger } = require('../services/logger');
const auth = require('../services/authService');

const documentUpload = createUploader(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const router = express.Router();

const OTP_REQUESTS_PER_HOUR = 3;
const GENERIC_LOGIN_ERROR = 'Invalid email or password';
const GENERIC_OTP_RESPONSE = 'If an account exists for this email, an OTP has been sent.';

/** Accounts created before emails were normalised may be stored in mixed case. */
async function findUserByEmail(users, rawEmail) {
  const typed = asString(rawEmail, { maxLength: 254 });
  if (!typed) return null;
  const lower = typed.toLowerCase();
  return (await users.findOne({ email: lower })) || (typed !== lower ? users.findOne({ email: typed }) : null);
}

function badRequest(res, msg, code = 'VALIDATION_ERROR') {
  return res.status(400).json({ success: false, msg, message: msg, code });
}

router.post('/signup', limiters.signup, async (req, res) => {
  const body = req.body || {};
  const name = asString(body.name, { maxLength: 100 });
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name || !email || !password) return badRequest(res, 'All fields are required');
  if (!auth.isValidEmail(email)) return badRequest(res, 'Please enter a valid email address.');
  if (auth.isBlockedEmailDomain(email)) return badRequest(res, 'Registration with dummy or disposable email domains is not allowed.');
  if (!auth.isStrongPassword(password)) return badRequest(res, auth.PASSWORD_POLICY_MESSAGE, 'WEAK_PASSWORD');
  if (body.termsAccepted !== true || body.privacyAccepted !== true) {
    return badRequest(res, 'You must accept the Terms & Conditions and Privacy Policy before registration.');
  }

  const users = getDb().collection('users');
  if (await findUserByEmail(users, email)) return badRequest(res, 'User already exists with this email', 'EMAIL_TAKEN');

  try {
    await users.insertOne({
      name,
      email,
      password: await auth.hashPassword(password),
      role: normalizePublicRole(body.role),
      tokenVersion: 0,
      createdAt: new Date(),
      ...auth.legalAcceptanceFields(),
    });
    return res.status(201).json({ success: true, msg: 'User created successfully', message: 'User created successfully' });
  } catch (e) {
    // The unique email index closes the check-then-insert race between concurrent signups.
    if (e && e.code === 11000) return badRequest(res, 'User already exists with this email', 'EMAIL_TAKEN');
    logger.error('Signup failed', { error: e.message });
    return res.status(500).json({ success: false, msg: 'Error creating user', message: 'Error creating user' });
  }
});

router.post('/login', limiters.login, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return badRequest(res, 'Email and password are required');
  }

  const user = await findUserByEmail(getDb().collection('users'), email);
  // Same response for unknown email and wrong password (no account enumeration).
  if (!user || !(await auth.verifyPassword(password, user.password)) || user.isDisabled === true) {
    return res.status(401).json({ success: false, msg: GENERIC_LOGIN_ERROR, message: GENERIC_LOGIN_ERROR, code: 'INVALID_CREDENTIALS' });
  }

  return res.status(200).json({
    msg: 'Login successful',
    token: auth.startSession(res, user, normalizeRole),
    user: auth.toUserView(user, normalizeRole),
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const db = getDb();
  const users = db.collection('users');

  try {
    const user = await users.findOne({ _id: new ObjectId(String(req.user.id)) });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    return res.status(200).json({
      id: String(user._id),
      name: user.name || '',
      email: user.email || '',
      role: normalizeRole(user.role),
      phone: user.phone || '',
      city: user.city || '',
      bio: user.bio || '',
      photoUrl: user.photoUrl || null,
      licenseDocumentUrl: user.licenseDocumentUrl || null,
      createdAt: user.createdAt || null,
      updatedAt: user.updatedAt || null
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading profile', error: String(e && e.message ? e.message : e) });
  }
});

router.put('/me', requireAuth, async (req, res) => {
  const db = getDb();
  const users = db.collection('users');
  const { name, email, phone, city, bio } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ msg: 'Name and email are required' });
  }

  try {
    const currentUser = await users.findOne({ _id: new ObjectId(String(req.user.id)) });
    if (!currentUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const conflict = await users.findOne({ email: normalizedEmail, _id: { $ne: currentUser._id } });
    if (conflict) {
      return res.status(400).json({ msg: 'Another user already uses this email' });
    }

    const update = {
      name: String(name).trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : '',
      city: city ? String(city).trim() : '',
      bio: bio ? String(bio).trim().slice(0, 500) : '',
      updatedAt: new Date()
    };

    await users.updateOne({ _id: currentUser._id }, { $set: update });

    return res.status(200).json({
      msg: 'Profile updated successfully',
      user: {
        id: String(currentUser._id),
        role: normalizeRole(currentUser.role),
        photoUrl: currentUser.photoUrl || null,
        licenseDocumentUrl: currentUser.licenseDocumentUrl || null,
        createdAt: currentUser.createdAt || null,
        ...update
      }
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error updating profile', error: String(e && e.message ? e.message : e) });
  }
});

router.post('/me/photo', requireAuth, upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No photo uploaded' });
  }

  const db = getDb();
  const users = db.collection('users');
  let persisted = null;
  let stored = false;

  try {
    const user = await users.findOne({ _id: new ObjectId(String(req.user.id)) });
    if (!user) {
      removeTemporaryFile(req.file);
      return res.status(404).json({ msg: 'User not found' });
    }

    persisted = await persistUploadedFile(req.file, {
      folder: 'driveportz/users/profile',
      resourceType: 'image'
    });

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          photoUrl: persisted.url,
          photoStorageProvider: persisted.storageProvider,
          photoStorageKey: persisted.storageKey,
          photoResourceType: persisted.resourceType || 'image',
          updatedAt: new Date()
        }
      }
    );
    stored = true;

    if (user.photoUrl && user.photoUrl !== persisted.url) {
      await deletePersistedFile({
        url: user.photoUrl,
        storageProvider: user.photoStorageProvider,
        storageKey: user.photoStorageKey,
        resourceType: user.photoResourceType || 'image'
      });
    }

    return res.status(200).json({ msg: 'Photo uploaded', photoUrl: persisted.url });
  } catch (e) {
    if (!stored && persisted) await deletePersistedFile(persisted);
    if (!persisted) removeTemporaryFile(req.file);
    console.error('Profile photo upload failed:', e.message);
    return res.status(500).json({ msg: 'Error uploading photo' });
  }
});

router.post('/me/license', requireAuth, documentUpload.single('license'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No license document uploaded' });
  }

  const db = getDb();
  const users = db.collection('users');
  let persisted = null;
  let stored = false;

  try {
    const user = await users.findOne({ _id: new ObjectId(String(req.user.id)) });
    if (!user) {
      removeTemporaryFile(req.file);
      return res.status(404).json({ msg: 'User not found' });
    }

    persisted = await persistUploadedFile(req.file, {
      folder: 'driveportz/users/licenses',
      resourceType: 'auto'
    });

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          licenseDocumentUrl: persisted.url,
          licenseStorageProvider: persisted.storageProvider,
          licenseStorageKey: persisted.storageKey,
          licenseResourceType: persisted.resourceType || 'auto',
          updatedAt: new Date()
        }
      }
    );
    stored = true;

    if (user.licenseDocumentUrl && user.licenseDocumentUrl !== persisted.url) {
      await deletePersistedFile({
        url: user.licenseDocumentUrl,
        storageProvider: user.licenseStorageProvider,
        storageKey: user.licenseStorageKey,
        resourceType: user.licenseResourceType || 'image'
      });
    }

    return res.status(200).json({ msg: 'License uploaded', licenseDocumentUrl: persisted.url });
  } catch (e) {
    if (!stored && persisted) await deletePersistedFile(persisted);
    if (!persisted) removeTemporaryFile(req.file);
    console.error('License upload failed:', e.message);
    return res.status(500).json({ msg: 'Error uploading license' });
  }
});

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_TIMEOUT_MS = 8 * TIME.SECOND_MS;
const VALID_GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

async function fetchGoogleTokenInfo(credential) {
  const { createResilientClient } = require('../infrastructure/http/resilientHttp');
  const http = createResilientClient('google-oauth', { timeoutMs: GOOGLE_TIMEOUT_MS });
  const response = await http.get(GOOGLE_TOKENINFO_URL, { params: { id_token: credential } });
  return response.data;
}

router.post('/google', limiters.login, async (req, res) => {
  const { credential, role, termsAccepted, privacyAccepted } = req.body || {};
  if (typeof credential !== 'string' || !credential) {
    return badRequest(res, 'Google credential token is required');
  }

  let googlePayload;
  try {
    googlePayload = await fetchGoogleTokenInfo(credential);
  } catch (err) {
    logger.warn('Google token verification failed', { error: err.message });
    return res.status(401).json({ success: false, msg: 'Google authentication failed', message: 'Google authentication failed', code: 'GOOGLE_AUTH_FAILED' });
  }

  const expectedClientId = process.env.GOOGLE_CLIENT_ID;
  if (expectedClientId && googlePayload.aud !== expectedClientId) {
    return res.status(401).json({ success: false, msg: 'Token audience mismatch. Unrecognized client ID.', message: 'Token audience mismatch. Unrecognized client ID.', code: 'GOOGLE_AUDIENCE_MISMATCH' });
  }
  if (googlePayload.iss && !VALID_GOOGLE_ISSUERS.has(googlePayload.iss)) {
    return res.status(401).json({ success: false, msg: 'Untrusted token issuer', message: 'Untrusted token issuer', code: 'GOOGLE_ISSUER_INVALID' });
  }
  // Linking a Google login to an existing (possibly admin) account requires a verified mailbox.
  const emailVerified = googlePayload.email_verified === true || googlePayload.email_verified === 'true';
  if (!googlePayload.email || !emailVerified) {
    return res.status(401).json({ success: false, msg: 'Google account email is not verified', message: 'Google account email is not verified', code: 'GOOGLE_EMAIL_UNVERIFIED' });
  }

  const email = normalizeEmail(googlePayload.email);
  const photoUrl = googlePayload.picture || null;
  const users = getDb().collection('users');

  let user = await findUserByEmail(users, email);
  const isNewUser = !user;
  if (isNewUser) {
    if (termsAccepted !== true || privacyAccepted !== true) {
      return badRequest(res, 'You must accept the Terms & Conditions and Privacy Policy before registration.');
    }
    user = {
      name: asString(googlePayload.name || googlePayload.given_name, { maxLength: 100 }) || 'Google User',
      email,
      password: await auth.randomPasswordHash(),
      role: normalizePublicRole(role),
      photoUrl,
      tokenVersion: 0,
      createdAt: new Date(),
      ...auth.legalAcceptanceFields(),
    };
    try {
      const result = await users.insertOne(user);
      user._id = result.insertedId;
    } catch (e) {
      if (!e || e.code !== 11000) throw e;
      user = await findUserByEmail(users, email); // concurrent first login created it
    }
  }
  if (user.isDisabled === true) {
    return res.status(401).json({ success: false, msg: GENERIC_LOGIN_ERROR, message: GENERIC_LOGIN_ERROR, code: 'INVALID_CREDENTIALS' });
  }

  return res.status(200).json({
    msg: isNewUser ? 'Signup successful' : 'Login successful',
    token: auth.startSession(res, user, normalizeRole),
    user: auth.toUserView(user, normalizeRole, { photoUrl }),
  });
});

// POST /forgot-password — always answers the same way (no account enumeration).
router.post('/forgot-password', limiters.otp, async (req, res) => {
  const email = normalizeEmail((req.body || {}).email);
  if (!auth.isValidEmail(email)) return badRequest(res, 'Valid email format required');

  try {
    const users = getDb().collection('users');
    const user = await findUserByEmail(users, email);
    if (!user) return res.status(200).json({ success: true, message: GENERIC_OTP_RESPONSE });

    const windowStart = Date.now() - TIME.HOUR_MS;
    let requestCount = user.otpRequestCount || 0;
    let requestWindow = user.otpRequestWindow || Date.now();
    if (requestWindow < windowStart) {
      requestCount = 0;
      requestWindow = Date.now();
    }
    if (requestCount >= OTP_REQUESTS_PER_HOUR) {
      return res.status(429).json({ success: false, msg: 'Maximum OTP requests reached. Please try again after an hour.', message: 'Maximum OTP requests reached. Please try again after an hour.', code: 'OTP_REQUEST_LIMIT' });
    }

    const otp = auth.generateOtp();
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          otpHash: auth.hashOtp(otp),
          otpExpiry: new Date(Date.now() + AUTH.OTP_TTL_MS),
          otpRequestCount: requestCount + 1,
          otpRequestWindow: requestWindow,
          otpAttempts: 0,
        },
        $unset: { otp: '' },
      }
    );

    const { sendOtpEmail } = require('../services/emailService');
    await sendOtpEmail(user.email, otp);
    return res.status(200).json({ success: true, message: GENERIC_OTP_RESPONSE });
  } catch (error) {
    logger.error('Error in forgot-password', { error: error.message });
    return res.status(500).json({ success: false, msg: 'Server error while processing forgot password', message: 'Server error while processing forgot password' });
  }
});

/**
 * Shared OTP check for verify-otp and reset-password. Counts EVERY failed attempt (reset-password
 * previously skipped the attempt limit, allowing a brute force of the 6-digit code).
 * @returns {Promise<{ ok: true, user: object } | { ok: false, status: number, msg: string }>}
 */
async function checkOtp(users, email, otp) {
  const user = await findUserByEmail(users, email);
  if (!user || (!user.otpHash && !user.otp)) return { ok: false, status: 400, msg: 'Invalid or expired OTP.' };
  if ((user.otpAttempts || 0) >= AUTH.OTP_MAX_ATTEMPTS) {
    return { ok: false, status: 429, msg: 'Maximum OTP attempts reached. Please request a new OTP.' };
  }
  if (auth.isOtpExpired(user)) return { ok: false, status: 400, msg: 'OTP expired.' };
  if (!auth.otpMatches(user, otp)) {
    await users.updateOne({ _id: user._id }, { $inc: { otpAttempts: 1 } });
    return { ok: false, status: 400, msg: 'Invalid OTP.' };
  }
  return { ok: true, user };
}

router.post('/verify-otp', limiters.otp, async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) return badRequest(res, 'Email and OTP are required');
  try {
    const result = await checkOtp(getDb().collection('users'), email, otp);
    if (!result.ok) return res.status(result.status).json({ success: false, msg: result.msg, message: result.msg });
    return res.status(200).json({ success: true, msg: 'OTP verified successfully.' });
  } catch (error) {
    logger.error('Error in verify-otp', { error: error.message });
    return res.status(500).json({ success: false, msg: 'Server error while verifying OTP', message: 'Server error while verifying OTP' });
  }
});

// Strong policy for resets (unchanged contract): upper, lower, digit, special, >= 8.
const RESET_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;

router.post('/reset-password', limiters.otp, async (req, res) => {
  const { email, otp, newPassword } = req.body || {};
  if (!email || !otp || !newPassword) return badRequest(res, 'Email, OTP, and new password are required');
  if (typeof newPassword !== 'string' || !RESET_PASSWORD_PATTERN.test(newPassword)) {
    return badRequest(res, 'Password must be at least 8 characters long, include one uppercase letter, one lowercase letter, one number, and one special character.', 'WEAK_PASSWORD');
  }

  try {
    const users = getDb().collection('users');
    const result = await checkOtp(users, email, otp);
    if (!result.ok) return res.status(result.status).json({ success: false, msg: result.msg, message: result.msg });

    await users.updateOne(
      { _id: result.user._id },
      {
        $set: { password: await auth.hashPassword(newPassword), passwordChangedAt: new Date() },
        // Revoke every existing session: tokens carry the old tokenVersion.
        $inc: { tokenVersion: 1 },
        $unset: { otp: '', otpHash: '', otpExpiry: '', otpAttempts: '' },
      }
    );
    await invalidateAuthUser(result.user._id);
    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    logger.error('Error in reset-password', { error: error.message });
    return res.status(500).json({ success: false, msg: 'Server error while resetting password', message: 'Server error while resetting password' });
  }
});

/**
 * GET /api/auth/session — restores a session on page load and refreshes the short-lived access
 * token. Only a SESSION credential (the httpOnly cookie, or a legacy 7-day bearer) may refresh;
 * a stolen 15-minute access token cannot be used to mint new ones.
 */
router.get('/session', requireAuth, async (req, res) => {
  if (req.auth && req.auth.tokenType === auth.TOKEN_TYPE.ACCESS) {
    return res.status(401).json({ success: false, msg: 'Session expired. Please sign in again.', message: 'Session expired. Please sign in again.', code: 'SESSION_REQUIRED' });
  }
  const user = await getDb().collection('users').findOne({ _id: new ObjectId(req.user.id) }, { projection: { password: 0, otp: 0, otpHash: 0 } });
  if (!user) return res.status(401).json({ success: false, msg: 'Missing or invalid token', message: 'Missing or invalid token', code: 'UNAUTHENTICATED' });
  return res.status(200).json({
    success: true,
    token: auth.issueToken(user, normalizeRole, { type: auth.TOKEN_TYPE.ACCESS }),
    user: auth.toUserView(user, normalizeRole),
  });
});

/**
 * POST /api/auth/logout — clears the session cookie. { allDevices: true } also revokes every
 * other session by bumping tokenVersion.
 */
router.post('/logout', optionalAuth, async (req, res) => {
  if (req.user && req.body && req.body.allDevices === true) {
    await getDb().collection('users').updateOne({ _id: new ObjectId(req.user.id) }, { $inc: { tokenVersion: 1 } });
    await invalidateAuthUser(req.user.id);
  }
  auth.endSession(res);
  return res.status(200).json({ success: true, message: 'Signed out' });
});

module.exports = router;
