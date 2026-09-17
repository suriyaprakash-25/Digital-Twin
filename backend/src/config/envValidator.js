/**
 * DrivePortz Environment & Configuration Validator
 * Ensures fail-fast behavior on missing or insecure environment settings.
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

function isPlaceholder(value) {
  if (!value) return true;
  const normalized = String(value).trim().toLowerCase();
  return normalized.includes('placeholder') ||
    normalized.includes('replace-with') ||
    normalized.includes('<username>') ||
    normalized.includes('<password>');
}

function isSecureHttpUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

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
  } else if (INSECURE_JWT_SECRETS.includes(jwtSecret.toLowerCase()) || isPlaceholder(jwtSecret)) {
    if (isStrict) {
      errors.push('Insecure or placeholder JWT_SECRET_KEY is strictly rejected in production/staging.');
    } else {
      warnings.push('JWT_SECRET_KEY is using an insecure development value.');
    }
  } else if (isStrict && jwtSecret.length < 32) {
    errors.push('JWT_SECRET_KEY must be at least 32 characters long in production/staging environments.');
  }

  // 2. Database URI
  const mongoUri = env.MONGODB_URI || env.MONGO_URI;
  if (!mongoUri && isStrict) {
    errors.push('MONGODB_URI (or MONGO_URI) is required in production/staging.');
  } else if (isStrict && isPlaceholder(mongoUri)) {
    errors.push('MONGODB_URI (or MONGO_URI) cannot use placeholder credentials in production/staging.');
  }

  // 3. Razorpay Configuration
  const razorpayKeyId = env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = env.RAZORPAY_KEY_SECRET;
  const razorpayWebhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

  if (isProduction) {
    if (!razorpayKeyId || isPlaceholder(razorpayKeyId)) errors.push('A non-placeholder RAZORPAY_KEY_ID is required in production.');
    if (!razorpayKeySecret || isPlaceholder(razorpayKeySecret)) errors.push('A non-placeholder RAZORPAY_KEY_SECRET is required in production.');
    if (!razorpayWebhookSecret || isPlaceholder(razorpayWebhookSecret)) {
      errors.push('A non-placeholder RAZORPAY_WEBHOOK_SECRET is required in production for webhook signature verification.');
    }
  } else if (!razorpayKeyId || !razorpayKeySecret) {
    warnings.push('Razorpay credentials missing or incomplete; payment-gateway calls will not work.');
  }

  // 4. Settlement Safety Gate
  const settlementMode = (env.SETTLEMENT_MODE || 'MOCK_TEST_MODE').toUpperCase();
  const settlementProvider = (env.SETTLEMENT_PROVIDER || 'mock').toLowerCase();
  const allowMockSettlementsInProduction = String(env.ALLOW_MOCK_SETTLEMENTS_IN_PRODUCTION || '').toLowerCase() === 'true';

  if (settlementMode !== 'MOCK_TEST_MODE' && settlementProvider === 'mock') {
    errors.push('Invalid configuration: live settlement mode cannot use the mock settlement provider.');
  }

  if (isProduction && settlementProvider === 'mock' && !allowMockSettlementsInProduction) {
    errors.push('SETTLEMENT_PROVIDER=mock is blocked in production unless ALLOW_MOCK_SETTLEMENTS_IN_PRODUCTION=true is explicitly set.');
  }

  if (isProduction && settlementProvider === 'mock' && allowMockSettlementsInProduction) {
    warnings.push('Production is intentionally running with mock settlements; garage payouts are not live.');
  }

  // 5. Frontend URL & CORS origin
  const frontendUrl = env.FRONTEND_URL;
  if (isProduction && (!isSecureHttpUrl(frontendUrl) || String(frontendUrl).includes('localhost'))) {
    errors.push('FRONTEND_URL must be a valid HTTPS production URL (for example https://www.driveportz.com).');
  }

  // 6. Persistent file storage
  const cloudinaryValues = [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET];
  const cloudinaryComplete = cloudinaryValues.every((value) => value && !isPlaceholder(value));
  if (isProduction && !cloudinaryComplete) {
    errors.push('Cloudinary persistence is required in production: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must all be configured.');
  }

  // 7. Google OAuth audience validation
  if (isProduction && (!env.GOOGLE_CLIENT_ID || isPlaceholder(env.GOOGLE_CLIENT_ID))) {
    errors.push('GOOGLE_CLIENT_ID is required in production so Google ID tokens are audience-validated.');
  }

  // 8. Email provider
  const emailProvider = (env.EMAIL_PROVIDER || 'mock').toLowerCase();
  if (isProduction && emailProvider === 'mock') {
    errors.push('EMAIL_PROVIDER=mock is not allowed in production because password-reset emails would not be delivered.');
  }
  if (emailProvider === 'smtp' && isStrict) {
    if (!env.SMTP_HOST) errors.push('SMTP_HOST is required when EMAIL_PROVIDER=smtp.');
    if (!env.SMTP_USER || isPlaceholder(env.SMTP_USER)) errors.push('A non-placeholder SMTP_USER is required when EMAIL_PROVIDER=smtp.');
    if (!env.SMTP_PASS || isPlaceholder(env.SMTP_PASS)) errors.push('A non-placeholder SMTP_PASS is required when EMAIL_PROVIDER=smtp.');
    if (!env.SMTP_FROM_EMAIL) errors.push('SMTP_FROM_EMAIL is required when EMAIL_PROVIDER=smtp.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    nodeEnv,
    isProduction,
    isStaging,
    settlementMode,
    settlementProvider,
    allowMockSettlementsInProduction
  };
}

module.exports = {
  INSECURE_JWT_SECRETS,
  isPlaceholder,
  validateEnvironment
};
