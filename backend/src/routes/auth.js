const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { loadConfig } = require('../config');
const { requireAuth, normalizeRole } = require('../middleware/auth');
const { upload, removeUploadByUrl } = require('../utils/uploads');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const config = loadConfig();

// Generic Auth Rate Limiter (e.g. max 20 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { msg: 'Too many requests from this IP, please try again after 15 minutes' }
});

router.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ msg: 'All fields are required' });
  }

  const db = getDb();
  const users = db.collection('users');

  const existing = await users.findOne({ email });
  if (existing) {
    return res.status(400).json({ msg: 'User already exists with this email' });
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);

  const normalizedRole = normalizeRole(role);

  const newUser = {
    name,
    email,
    password: hashedPassword,
    role: normalizedRole,
    createdAt: new Date()
  };

  try {
    await users.insertOne(newUser);
    return res.status(201).json({ msg: 'User created successfully' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error creating user', error: String(e && e.message ? e.message : e) });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ msg: 'Email and password are required' });
  }

  const db = getDb();
  const users = db.collection('users');

  const user = await users.findOne({ email });
  if (!user) {
    return res.status(401).json({ msg: 'Invalid email or password' });
  }

  const ok = await bcrypt.compare(String(password), String(user.password || ''));
  if (!ok) {
    return res.status(401).json({ msg: 'Invalid email or password' });
  }

  const token = jwt.sign(
    {
      role: normalizeRole(user.role)
    },
    config.jwtSecret,
    {
      subject: String(user._id),
      expiresIn: config.jwtExpiresIn
    }
  );

  return res.status(200).json({
    msg: 'Login successful',
    token,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      phone: user.phone || '',
      city: user.city || '',
      bio: user.bio || '',
      photoUrl: user.photoUrl || null,
      licenseDocumentUrl: user.licenseDocumentUrl || null,
      createdAt: user.createdAt || null
    }
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

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ msg: 'Only image files (JPEG, PNG, WebP) are allowed' });
  }

  const db = getDb();
  const users = db.collection('users');

  try {
    const user = await users.findOne({ _id: new ObjectId(String(req.user.id)) });
    if (!user) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ msg: 'User not found' });
    }

    if (user.photoUrl) {
      removeUploadByUrl(user.photoUrl);
    }

    const photoUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    await users.updateOne({ _id: user._id }, { $set: { photoUrl, updatedAt: new Date() } });

    return res.status(200).json({ msg: 'Photo uploaded', photoUrl });
  } catch (e) {
    return res.status(500).json({ msg: 'Error uploading photo', error: String(e && e.message ? e.message : e) });
  }
});

router.post('/me/license', requireAuth, upload.single('license'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No license document uploaded' });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ msg: 'Only PDF or image files are allowed for the license document' });
  }

  const db = getDb();
  const users = db.collection('users');

  try {
    const user = await users.findOne({ _id: new ObjectId(String(req.user.id)) });
    if (!user) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ msg: 'User not found' });
    }

    if (user.licenseDocumentUrl) {
      removeUploadByUrl(user.licenseDocumentUrl);
    }

    const licenseDocumentUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    await users.updateOne({ _id: user._id }, { $set: { licenseDocumentUrl, updatedAt: new Date() } });

    return res.status(200).json({ msg: 'License uploaded', licenseDocumentUrl });
  } catch (e) {
    return res.status(500).json({ msg: 'Error uploading license', error: String(e && e.message ? e.message : e) });
  }
});

router.post('/google', async (req, res) => {
  const { credential, role } = req.body || {};
  if (!credential) {
    return res.status(400).json({ msg: 'Google credential token is required' });
  }

  try {
    const https = require('https');
    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    
    const googlePayload = await new Promise((resolve, reject) => {
      https.get(tokenInfoUrl, (googleRes) => {
        let data = '';
        googleRes.on('data', (chunk) => { data += chunk; });
        googleRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (googleRes.statusCode === 200) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error_description || 'Invalid token'));
            }
          } catch (e) {
            reject(new Error('Failed to parse Google API response'));
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    });

    if (!googlePayload.email) {
      return res.status(400).json({ msg: 'Google token does not contain email' });
    }

    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && googlePayload.aud !== expectedClientId) {
      return res.status(401).json({ msg: 'Token audience mismatch. Unrecognized client ID.' });
    }

    const email = String(googlePayload.email).trim().toLowerCase();
    const name = googlePayload.name || googlePayload.given_name || 'Google User';
    const photoUrl = googlePayload.picture || null;

    const db = getDb();
    const users = db.collection('users');

    let user = await users.findOne({ email });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const normalizedRole = normalizeRole(role || 'USER');
      const randomPassword = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
      user = {
        name,
        email,
        password: randomPassword,
        role: normalizedRole,
        photoUrl,
        createdAt: new Date()
      };
      const result = await users.insertOne(user);
      user._id = result.insertedId;
    }

    const token = jwt.sign(
      {
        role: normalizeRole(user.role)
      },
      config.jwtSecret,
      {
        subject: String(user._id),
        expiresIn: config.jwtExpiresIn
      }
    );

    return res.status(200).json({
      msg: isNewUser ? 'Signup successful' : 'Login successful',
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: normalizeRole(user.role),
        phone: user.phone || '',
        city: user.city || '',
        bio: user.bio || '',
        photoUrl: user.photoUrl || photoUrl || null,
        licenseDocumentUrl: user.licenseDocumentUrl || null,
        createdAt: user.createdAt || null
      }
    });
  } catch (err) {
    console.error('Google Sign In Error:', err.message);
    return res.status(401).json({ msg: 'Google authentication failed', error: err.message });
  }
});

// POST /forgot-password - Phase 1 & 4: Send OTP with Limits
router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ msg: 'Email is required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ msg: 'Valid email format required' });
  }

  try {
    const db = getDb();
    const users = db.collection('users');

    const user = await users.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: 'Email not found' });
    }

    // Phase 4: Maximum 3 OTP requests per hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    // Reset window if it's been more than an hour since the last request window started
    let requestCount = user.otpRequestCount || 0;
    let requestWindow = user.otpRequestWindow || Date.now();

    if (requestWindow < oneHourAgo) {
      requestCount = 0;
      requestWindow = Date.now();
    }

    if (requestCount >= 3) {
      return res.status(429).json({ msg: 'Maximum OTP requests reached. Please try again after an hour.' });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP and increment request count, reset attempts
    await users.updateOne(
      { _id: user._id },
      { 
        $set: { 
          otp, 
          otpExpiry,
          otpRequestCount: requestCount + 1,
          otpRequestWindow: requestWindow,
          otpAttempts: 0 // reset failed attempts on new OTP
        } 
      }
    );

    // Send email
    const { sendOtpEmail } = require('../services/emailService');
    await sendOtpEmail(email, otp);

    res.status(200).json({ success: true, message: 'OTP sent to your email.' });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ msg: 'Server error while processing forgot password' });
  }
});

// POST /verify-otp - Phase 2 & 4: Verify OTP with Max Attempts
router.post('/verify-otp', authLimiter, async (req, res) => {
  const { email, otp } = req.body || {};

  if (!email || !otp) {
    return res.status(400).json({ msg: 'Email and OTP are required' });
  }

  try {
    const db = getDb();
    const users = db.collection('users');

    const user = await users.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: 'Email not found' });
    }

    const attempts = user.otpAttempts || 0;
    if (attempts >= 5) {
      return res.status(429).json({ msg: 'Maximum OTP attempts reached. Please request a new OTP.' });
    }

    if (user.otp !== otp) {
      await users.updateOne({ _id: user._id }, { $inc: { otpAttempts: 1 } });
      return res.status(400).json({ msg: 'Invalid OTP.' });
    }

    if (!user.otpExpiry || Date.now() > new Date(user.otpExpiry).getTime()) {
      return res.status(400).json({ msg: 'OTP expired.' });
    }

    res.status(200).json({ success: true, msg: 'OTP verified successfully.' });
  } catch (error) {
    console.error('Error in verify-otp:', error);
    res.status(500).json({ msg: 'Server error while verifying OTP' });
  }
});

// POST /reset-password - Phase 3 & 4: Reset Password
router.post('/reset-password', authLimiter, async (req, res) => {
  const { email, otp, newPassword } = req.body || {};

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ msg: 'Email, OTP, and new password are required' });
  }

  // Password complexity regex: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ 
      msg: 'Password must be at least 8 characters long, include one uppercase letter, one lowercase letter, one number, and one special character.' 
    });
  }

  try {
    const db = getDb();
    const users = db.collection('users');

    const user = await users.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: 'Email not found' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP.' });
    }

    if (!user.otpExpiry || Date.now() > new Date(user.otpExpiry).getTime()) {
      return res.status(400).json({ msg: 'OTP expired.' });
    }

    // OTP is valid. Hash new password and update.
    const hashedPassword = await bcrypt.hash(String(newPassword), 10);

    await users.updateOne(
      { _id: user._id },
      { 
        $set: { password: hashedPassword },
        $unset: { otp: "", otpExpiry: "" } 
      }
    );

    res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Error in reset-password:', error);
    res.status(500).json({ msg: 'Server error while resetting password' });
  }
});

module.exports = router;

