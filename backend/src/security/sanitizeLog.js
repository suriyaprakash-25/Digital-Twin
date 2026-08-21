/**
 * Sensitive Data Masking and Log Sanitization Utility
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /jwt/i,
  /card_?number/i,
  /cvv/i,
  /cvc/i,
  /bank_?account/i,
  /account_?number/i,
  /pan/i,
  /aadhaar/i,
  /api_?key/i,
  /webhook_?secret/i
];

/**
 * Masks a string value preserving last 4 digits where useful
 */
function maskValue(val) {
  if (val === null || val === undefined) return val;
  const str = String(val);
  if (str.length <= 4) return '••••';
  const last4 = str.slice(-4);
  return `•••• •••• ${last4}`;
}

/**
 * Recursively sanitizes any object or array by masking sensitive keys and patterns
 */
function sanitizeForLogging(obj, depth = 0) {
  if (depth > 8 || obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Check if looks like a raw JWT or card/account
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(obj)) {
      return '[JWT_REDACTED]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      const isPasswordOrSecret = /password|secret|token|authorization|jwt|api_?key/i.test(key);
      const isCardOrBank = /card_?number|bank_?account|account_?number|pan|aadhaar/i.test(key);

      if (isPasswordOrSecret) {
        clean[key] = '••••';
      } else if (isCardOrBank) {
        clean[key] = maskValue(value);
      } else if (typeof value === 'object' && value !== null) {
        clean[key] = sanitizeForLogging(value, depth + 1);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  return obj;
}

module.exports = {
  maskValue,
  sanitizeForLogging
};
