const failures = [];
const warnings = [];

const apiUrl = String(process.env.VITE_API_URL || '').trim();
const legacyApiUrl = String(process.env.VITE_API_BASE_URL || '').trim();
const googleClientId = String(process.env.VITE_GOOGLE_CLIENT_ID || '').trim();

function isPlaceholder(value) {
  return !value ||
    /placeholder|replace[-_ ]?me|example\.com|your[-_ ]/i.test(value);
}

function validateHttpsUrl(value, label) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      failures.push(`${label} must use HTTPS.`);
    }
    if (['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      failures.push(`${label} cannot point to localhost in a production deployment.`);
    }
    return parsed;
  } catch {
    failures.push(`${label} must be a valid absolute URL.`);
    return null;
  }
}

if (legacyApiUrl) {
  failures.push('VITE_API_BASE_URL is deprecated. Configure only VITE_API_URL.');
}

if (!apiUrl) {
  failures.push('VITE_API_URL is required for a Vercel production build.');
} else {
  const parsed = validateHttpsUrl(apiUrl, 'VITE_API_URL');
  if (parsed && /\/api\/?$/.test(parsed.pathname)) {
    failures.push('VITE_API_URL must be the backend origin only (for example https://driveportz.onrender.com), without /api.');
  }
}

if (isPlaceholder(googleClientId)) {
  failures.push('VITE_GOOGLE_CLIENT_ID must be configured with the real Google OAuth web client ID.');
}

const firebaseKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];
const firebaseValues = firebaseKeys.map((key) => String(process.env[key] || '').trim());
const firebaseConfiguredCount = firebaseValues.filter(Boolean).length;

if (firebaseConfiguredCount > 0 && firebaseConfiguredCount !== firebaseKeys.length) {
  failures.push('Firebase web configuration is partial. Configure all core VITE_FIREBASE_* variables or none of them.');
}
if (firebaseConfiguredCount === 0) {
  warnings.push('Firebase web push is not configured for this deployment.');
}

if (process.env.VITE_RAZORPAY_KEY_ID) {
  warnings.push('VITE_RAZORPAY_KEY_ID is no longer used. Razorpay Checkout key IDs are supplied by the authenticated backend order response.');
}

if (failures.length) {
  console.error('DrivePortz production frontend environment validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('DrivePortz production frontend environment validation passed.');
console.log(`- VITE_API_URL: ${apiUrl}`);
console.log('- Google OAuth client configured: yes');
console.log(`- Firebase web config: ${firebaseConfiguredCount === firebaseKeys.length ? 'configured' : 'not configured'}`);
for (const warning of warnings) console.warn(`Warning: ${warning}`);
