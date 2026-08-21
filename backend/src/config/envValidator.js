/**
 * DrivePortz Environment & Configuration Validator
 * Ensures fail-fast behavior on missing or insecure environment settings
 */

const INSECURE_JWT_SECRETS = [
  'secret',
  '123456',
  '12345678',
  'password',
  'development',
  'changeme',
  'test',
  'jwtsecret',
  'admin'
];

function validateEnvironment(env = process.env) {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  const isProduction = nodeEnv === 'production';
  const isStaging = nodeEnv === 'staging';
  const isStrict = isProduction || isStaging;

  const errors = [];
  const warnings = [];

  // 1. JWT Secret Validation
  const jwtSecret = env.JWT_SECRET_KEY || env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push('JWT_SECRET_KEY (or JWT_SECRET) is required');
  } else if (INSECURE_JWT_SECRETS.includes(jwtSecret.toLowerCase())) {
    if (isStrict) {
      errors.push(`Insecure JWT_SECRET_KEY "${jwtSecret}" is strictly rejected in ${nodeEnv} mode.`);
    } else {
      warnings.push(`Warning: JWT_SECRET_KEY is using a weak default "${jwtSecret}".`);
    }
  } else if (isStrict && jwtSecret.length < 32) {
    errors.push('JWT_SECRET_KEY must be at least 32 characters long in production/staging environments.');
  }

  // 2. Database URI
  const mongoUri = env.MONGODB_URI || env.MONGO_URI;
  if (!mongoUri && isStrict) {
    errors.push('MONGODB_URI (or MONGO_URI) is required in production/staging.');
  }

  // 3. Razorpay Configuration
  const razorpayKeyId = env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = env.RAZORPAY_KEY_SECRET;
  const razorpayWebhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

  if (isProduction) {
    if (!razorpayKeyId) errors.push('RAZORPAY_KEY_ID is required in production.');
    if (!razorpayKeySecret) errors.push('RAZORPAY_KEY_SECRET is required in production.');
    if (!razorpayWebhookSecret) errors.push('RAZORPAY_WEBHOOK_SECRET is required in production.');
  } else if (!razorpayKeyId || !razorpayKeySecret) {
    warnings.push('Razorpay credentials missing or incomplete; running with mock payment fallbacks where applicable.');
  }

  // 4. Settlement Safety Gate
  const settlementMode = (env.SETTLEMENT_MODE || 'MOCK_TEST_MODE').toUpperCase();
  const settlementProvider = (env.SETTLEMENT_PROVIDER || 'mock').toLowerCase();

  if (settlementMode !== 'MOCK_TEST_MODE' && settlementProvider === 'mock') {
    errors.push('Invalid configuration: Cannot run in LIVE settlement mode while using mock settlement provider.');
  }

  // 5. Frontend URL & CORS Allowed Origins
  const frontendUrl = env.FRONTEND_URL;
  if (isProduction && (!frontendUrl || frontendUrl.includes('localhost'))) {
    warnings.push(`FRONTEND_URL is set to "${frontendUrl}". Ensure this points to production domain (e.g. https://www.driveportz.com).`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    nodeEnv,
    isProduction,
    isStaging,
    settlementMode,
    settlementProvider
  };
}

module.exports = {
  INSECURE_JWT_SECRETS,
  validateEnvironment
};
