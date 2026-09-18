process.env.NODE_ENV = 'development';
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'pilot-failure-mode-secret-key-32-characters';
process.env.EMAIL_PROVIDER = 'mock';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('./src/middleware/auth');
const { withTimeout } = require('./src/utils/resilience');
const { parseSelectedSymptoms } = require('./src/controllers/vehicleDoctorController');

async function testExpiredJwt() {
  const token = jwt.sign(
    { role: 'USER' },
    process.env.JWT_SECRET_KEY,
    { subject: '507f1f77bcf86cd799439011', expiresIn: -1 }
  );

  const req = { headers: { authorization: `Bearer ${token}` } };
  let statusCode = null;
  let body = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; }
  };

  await requireAuth(req, res, () => {
    throw new Error('Expired JWT must not call next()');
  });

  assert.strictEqual(statusCode, 401);
  assert.strictEqual(body.msg, 'Missing or invalid token');
}

async function testTimeout() {
  let error = null;
  try {
    await withTimeout(new Promise((resolve) => setTimeout(resolve, 50)), 10, 'Pilot AI provider');
  } catch (err) {
    error = err;
  }
  assert(error);
  assert.match(error.message, /timed out/);
}

function testInvalidAiInput() {
  assert.strictEqual(parseSelectedSymptoms('{bad json'), null);
  assert.deepStrictEqual(parseSelectedSymptoms('["noise","vibration"]'), ['noise', 'vibration']);
}

async function testInterruptedProductionUploadFailsClosed() {
  const original = { ...process.env };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'driveportz-pilot-upload-'));
  const tempFile = path.join(tempDir, 'policy.pdf');
  fs.writeFileSync(tempFile, 'pilot');

  try {
    process.env.NODE_ENV = 'production';
    process.env.ENFORCE_PRODUCTION_READINESS = 'false';
    process.env.JWT_SECRET_KEY = 'pilot-production-secret-key-at-least-32-characters';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/driveportz_ci';
    process.env.FRONTEND_URL = 'https://www.driveportz.com';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_pilot_failure_modes';
    process.env.RAZORPAY_KEY_SECRET = 'pilot_failure_mode_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'pilot_failure_mode_webhook_secret';
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    const { persistUploadedFile } = require('./src/services/persistentFileStorage');
    let error = null;
    try {
      await persistUploadedFile({
        path: tempFile,
        filename: 'policy.pdf',
        originalname: 'policy.pdf',
        mimetype: 'application/pdf',
        size: 5
      }, { folder: 'pilot/failure', resourceType: 'auto' });
    } catch (err) {
      error = err;
    }

    assert(error, 'Production upload must fail when persistent storage is unavailable');
    assert.match(error.message, /Persistent file storage is unavailable/);
    assert.strictEqual(fs.existsSync(tempFile), false, 'Temporary file must be cleaned up');
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    Object.assign(process.env, original);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  await testExpiredJwt();
  await testTimeout();
  testInvalidAiInput();
  await testInterruptedProductionUploadFailsClosed();

  console.log('✅ Pilot failure-mode suite passed: expired JWT, provider timeout, invalid AI input, fail-closed interrupted upload.');
  console.log('ℹ️ Duplicate payment webhook and failed-payment retry remain covered by the existing payment-security and service-payment CI suites.');
}

main().catch((err) => {
  console.error('❌ Pilot failure-mode suite failed:', err);
  process.exit(1);
});
