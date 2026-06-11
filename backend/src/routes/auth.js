const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { loadConfig } = require('../config');
const { requireAuth, normalizeRole } = require('../middleware/auth');
const { upload, removeUploadByUrl } = require('../utils/uploads');

const router = express.Router();
const config = loadConfig();

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

module.exports = router;
