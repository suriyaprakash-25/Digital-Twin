// Shared display formatters (INR currency, numbers).

const inrFormatters = new Map();

function getInrFormatter(options) {
  const key = JSON.stringify(options);
  if (!inrFormatters.has(key)) {
    inrFormatters.set(key, new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', ...options }));
  }
  return inrFormatters.get(key);
}

function toNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formats a rupee amount, e.g. `formatCurrency(1234.5)` -> "₹1,234.5".
 * Options: `decimals` (max fraction digits, default 2), `significant` (max
 * significant digits, used by the analytics/resale summaries).
 */
export function formatCurrency(value, { decimals = 2, significant } = {}) {
  const options = significant
    ? { maximumSignificantDigits: significant }
    : { minimumFractionDigits: 0, maximumFractionDigits: decimals };
  return getInrFormatter(options).format(toNumber(value));
}

/** Plain grouped number in the Indian system, e.g. 1234567 -> "12,34,567". */
export function formatNumber(value, { decimals = 2 } = {}) {
  return toNumber(value).toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

/**
 * Locale date for display; a missing value falls back to today (matching the
 * legacy tables). Kept outside components so render stays pure.
 */
export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', options);
}
