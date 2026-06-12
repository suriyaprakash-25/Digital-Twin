/**
 * One-time script to seed an admin user into MongoDB.
 * Run from the backend directory: node scripts/seed-admin.js
 */
const bcrypt = require('bcryptjs');
const { loadConfig } = require('../src/config');
const { connectToMongo, getDb } = require('../src/db');

(async () => {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();
  const users = db.collection('users');

  const email = 'admin123@gmail.com';
  const password = 'driveportz';
  const name = 'Admin';

  // Check if already exists
  const existing = await users.findOne({ email });
  if (existing) {
    // Update role to admin if not already
    await users.updateOne({ _id: existing._id }, { $set: { role: 'ADMIN' } });
    console.log(`✅ User "${email}" already exists — role updated to ADMIN.`);
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await users.insertOne({
    name,
    email,
    password: hashedPassword,
    role: 'ADMIN',
    createdAt: new Date()
  });

  console.log(`✅ Admin user created: ${email}`);
  process.exit(0);
})().catch((err) => {
  console.error('❌ Failed:', err.message || err);
  process.exit(1);
});
