const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { getDb } = require('../db');
const { loadConfig } = require('../config');

const router = express.Router();
const config = loadConfig();

router.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password || !role) {
    return res.status(400).json({ msg: 'All fields are required' });
  }

  const db = getDb();
  const users = db.collection('users');

  const existing = await users.findOne({ email });
  if (existing) {
    return res.status(400).json({ msg: 'User already exists with this email' });
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);

  const newUser = {
    name,
    email,
    password: hashedPassword,
    role,
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
      role: user.role
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
      role: user.role
    }
  });
});

module.exports = router;
