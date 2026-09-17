const assert = require('assert');
const {
  normalizeOrigin,
  parseExtraOrigins,
  createCorsPolicy
} = require('./src/security/corsPolicy');
const { validateEnvironment } = require('./src/config/envValidator');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(error.message);
    failed += 1;
  }
}

test('normalizes valid origins and strips paths', () => {
  assert.strictEqual(normalizeOrigin('https://www.driveportz.com/path?q=1'), 'https://www.driveportz.com');
});

test('rejects unsupported origin schemes', () => {
  assert.strictEqual(normalizeOrigin('javascript:alert(1)'), null);
});

test('parses explicit preview origins only', () => {
  assert.deepStrictEqual(
    parseExtraOrigins('https://preview.vercel.app, https://staging.onrender.com'),
    ['https://preview.vercel.app', 'https://staging.onrender.com']
  );
});

test('allows DrivePortz production origins', () => {
  const policy = createCorsPolicy({
    nodeEnv: 'production',
    frontendUrl: 'https://www.driveportz.com'
  });

  assert.strictEqual(policy.isAllowed('https://www.driveportz.com'), true);
  assert.strictEqual(policy.isAllowed('https://driveportz.com'), true);
});

test('rejects untrusted production origins', () => {
  const policy = createCorsPolicy({
    nodeEnv: 'production',
    frontendUrl: 'https://www.driveportz.com'
  });

  assert.strictEqual(policy.isAllowed('https://attacker.example'), false);
  assert.strictEqual(policy.isAllowed('https://driveportz.com.attacker.example'), false);
  assert.strictEqual(policy.isAllowed('https://random-project.vercel.app'), false);
  assert.strictEqual(policy.isAllowed('https://random-service.onrender.com'), false);
});

test('allows explicitly configured preview origins', () => {
  const policy = createCorsPolicy({
    nodeEnv: 'production',
    frontendUrl: 'https://www.driveportz.com',
    extraOrigins: 'https://driveportz-preview.vercel.app'
  });

  assert.strictEqual(policy.isAllowed('https://driveportz-preview.vercel.app'), true);
});

test('allows local dev origins outside production', () => {
  const policy = createCorsPolicy({ nodeEnv: 'development' });
  assert.strictEqual(policy.isAllowed('http://localhost:5173'), true);
});

test('allows requests without an Origin header', () => {
  const policy = createCorsPolicy({ nodeEnv: 'production' });
  assert.strictEqual(policy.isAllowed(undefined), true);
});

test('production environment validation rejects insecure JWT secrets', () => {
  const result = validateEnvironment({
    NODE_ENV: 'production',
    JWT_SECRET_KEY: 'secret',
    MONGO_URI: 'mongodb://localhost:27017/driveportz',
    FRONTEND_URL: 'https://www.driveportz.com',
    RAZORPAY_KEY_ID: 'rzp_live_example',
    RAZORPAY_KEY_SECRET: 'example-secret',
    RAZORPAY_WEBHOOK_SECRET: 'example-webhook-secret',
    SETTLEMENT_MODE: 'MOCK_TEST_MODE',
    SETTLEMENT_PROVIDER: 'mock'
  });

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Insecure JWT_SECRET_KEY')));
});

console.log(`\nProduction hardening suite: ${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
