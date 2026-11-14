/** Text helpers shared by routes and services. */

const MAX_SEARCH_LENGTH = 100;

/** Escapes user input so it can be embedded in a RegExp literally (prevents ReDoS / regex injection). */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a safe, bounded, case-insensitive "contains" matcher for Mongo `$regex` from user search text. */
function safeSearchRegex(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim().slice(0, MAX_SEARCH_LENGTH);
  if (!trimmed) return null;
  return new RegExp(escapeRegex(trimmed), 'i');
}

/** Coerces untrusted input to a trimmed string (rejecting objects/arrays used for operator injection). */
function asString(value, { maxLength = 500 } = {}) {
  if (typeof value === 'string') return value.trim().slice(0, maxLength);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function normalizeEmail(value) {
  return asString(value, { maxLength: 254 }).toLowerCase();
}

module.exports = { escapeRegex, safeSearchRegex, asString, normalizeEmail, MAX_SEARCH_LENGTH };
