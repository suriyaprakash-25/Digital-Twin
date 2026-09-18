process.env.EMAIL_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'pilot-notification-test-secret-key-32-chars';

const assert = require('assert');
const { MongoClient } = require('mongodb');
const MockEmailProvider = require('./src/services/email/MockEmailProvider');
const { setEmailProvider, sendEmail } = require('./src/services/emailService');

async function main() {
  const mock = new MockEmailProvider();
  setEmailProvider(mock);

  const mail = await sendEmail({
    to: 'pilot-recipient@example.org',
    subject: 'Pilot verification',
    text: 'Verification',
    html: '<p>Verification</p>'
  });

  assert.strictEqual(mail.success, true);
  assert.strictEqual(mock.getSentEmails().length, 1);
  assert.strictEqual(mock.getSentEmails()[0].subject, 'Pilot verification');

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(`${process.env.MONGO_DB_NAME || 'driveportz_ci'}_pilot_notifications`);

  try {
    const notifications = db.collection('notifications');
    const doc = {
      userId: 'pilot-user-1',
      title: 'Booking update',
      body: 'Your pilot booking has been accepted.',
      data: { type: 'BOOKING_ACCEPTED' },
      channel: 'push',
      read: false,
      createdAt: new Date()
    };
    await notifications.insertOne(doc);

    const stored = await notifications.findOne({
      userId: 'pilot-user-1',
      'data.type': 'BOOKING_ACCEPTED'
    });

    assert(stored);
    assert.strictEqual(stored.read, false);
    assert.strictEqual(stored.title, 'Booking update');
    console.log('✅ Pilot email + in-app notification verification suite passed.');
  } finally {
    await db.dropDatabase();
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Pilot notification suite failed:', err);
  process.exit(1);
});
