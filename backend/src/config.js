const path = require('path');
const dotenv = require('dotenv');

function loadConfig() {
  // Always load the backend .env (so starting the server from repo root still works)
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

  const jwtSecret = process.env.JWT_SECRET_KEY;
  if (!jwtSecret) {
    throw new Error('Missing required env var: JWT_SECRET_KEY');
  }

  const firebaseServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || null;

  return {
    mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017',
    // Default to digital_twin so Mongo doesn't fall back to the 'test' database
    mongoDbName: process.env.MONGO_DB_NAME || 'digital_twin',
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    firebaseServiceAccountPath,
    port: Number(process.env.PORT || 5000)
  };
}

module.exports = { loadConfig };
