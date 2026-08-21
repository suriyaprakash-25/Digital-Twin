const path = require('path');
const dotenv = require('dotenv');
const { validateEnvironment } = require('./config/envValidator');

function loadConfig() {
  // Always load the backend .env (so starting the server from repo root still works)
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

  const validation = validateEnvironment(process.env);
  if (!validation.valid && (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging')) {
    throw new Error(`Production Configuration Validation Failed:\n- ${validation.errors.join('\n- ')}`);
  }

  const jwtSecret = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('Missing required env var: JWT_SECRET_KEY');
  }

  const firebaseServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || null;

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
    // Default to digital_twin so Mongo doesn't fall back to the 'test' database
    mongoDbName: process.env.MONGO_DB_NAME || 'digital_twin',
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    frontendUrl: process.env.FRONTEND_URL || 'https://www.driveportz.com',
    firebaseServiceAccountPath,
    port: Number(process.env.PORT || 5000),
    groqApiKey: process.env.GROQ_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET
    },
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER
    },
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID || '',
      keySecret: process.env.RAZORPAY_KEY_SECRET || '',
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || ''
    },
    settlement: {
      mode: (process.env.SETTLEMENT_MODE || 'MOCK_TEST_MODE').toUpperCase(),
      provider: (process.env.SETTLEMENT_PROVIDER || 'mock').toLowerCase(),
      minAmountRupees: Number(process.env.MIN_SETTLEMENT_AMOUNT || 500),
      highValueThresholdRupees: Number(process.env.HIGH_VALUE_SETTLEMENT_THRESHOLD || 50000),
      maxRetries: Number(process.env.MAX_SETTLEMENT_RETRIES || 5)
    },
    commission: {
      rate: Number(process.env.PLATFORM_COMMISSION_RATE || 5),
      type: process.env.PLATFORM_COMMISSION_TYPE || 'PERCENTAGE',
      minSettlementAmount: Number(process.env.MIN_SETTLEMENT_AMOUNT || 500)
    },
    sla: {
      reviewHours: Number(process.env.SETTLEMENT_REVIEW_SLA_HOURS || 24),
      processingHours: Number(process.env.SETTLEMENT_PROCESSING_SLA_HOURS || 48),
      failureHours: Number(process.env.SETTLEMENT_FAILURE_SLA_HOURS || 12)
    },
    validation
  };
}

module.exports = { loadConfig, validateEnvironment };



