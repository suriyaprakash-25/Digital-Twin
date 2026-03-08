const fs = require('fs');
const admin = require('firebase-admin');

let firebaseApp;
let firebaseInitError;

function initFirebase(config) {
  if (firebaseApp) return firebaseApp;
  if (firebaseInitError) return null;

  try {
    const serviceAccountPath = config && config.firebaseServiceAccountPath;

    if (!serviceAccountPath) {
      throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_PATH');
    }

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Firebase service account not found at: ${serviceAccountPath}`);
    }

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const serviceAccount = require(serviceAccountPath);

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('✅ Firebase Admin initialized');
    return firebaseApp;
  } catch (e) {
    firebaseInitError = e;
    console.warn('⚠️ Firebase Admin not initialized:', e && e.message ? e.message : e);
    return null;
  }
}

function getFirebaseInitError() {
  return firebaseInitError ? String(firebaseInitError && firebaseInitError.message ? firebaseInitError.message : firebaseInitError) : null;
}

async function sendToTokens(tokens, message) {
  if (!tokens || tokens.length === 0) {
    return { ok: true, skipped: true, reason: 'no_tokens' };
  }

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: message.notification,
      data: message.data
    });

    return {
      ok: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

module.exports = { initFirebase, getFirebaseInitError, sendToTokens };
