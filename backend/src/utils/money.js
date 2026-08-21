/**
 * Financial Integer Paise Precision Utilities
 * Enforces zero-floating-point financial integrity
 */

function isSafePaiseAmount(val) {
  return typeof val === 'number' && Number.isSafeInteger(val) && val >= 0;
}

function toPaise(rupees) {
  if (rupees === null || rupees === undefined) return 0;
  const num = Number(rupees);
  if (!Number.isFinite(num)) {
    throw new TypeError(`Invalid monetary value for toPaise: ${rupees}`);
  }
  const paise = Math.round(num * 100);
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`Monetary value exceeds safe integer range: ${rupees}`);
  }
  return paise;
}

function fromPaise(paise) {
  if (paise === null || paise === undefined) return 0;
  const num = Number(paise);
  if (!Number.isFinite(num)) {
    throw new TypeError(`Invalid paise value for fromPaise: ${paise}`);
  }
  return parseFloat((num / 100).toFixed(2));
}

function addPaise(...paiseValues) {
  let sum = 0;
  for (const v of paiseValues) {
    const p = Math.round(Number(v) || 0);
    if (!Number.isSafeInteger(p)) {
      throw new RangeError(`Unsafe integer in addPaise: ${v}`);
    }
    sum += p;
  }
  return sum;
}

function subtractPaise(a, b, { allowNegative = false } = {}) {
  const pA = Math.round(Number(a) || 0);
  const pB = Math.round(Number(b) || 0);
  const diff = pA - pB;
  if (!allowNegative && diff < 0) {
    throw new RangeError(`Result cannot be negative: ${pA} - ${pB} = ${diff}`);
  }
  return diff;
}

function calculatePercentagePaise(basePaise, ratePercentage) {
  const base = Math.round(Number(basePaise) || 0);
  const rate = Number(ratePercentage) || 0;
  if (!Number.isFinite(rate)) {
    throw new TypeError(`Invalid rate percentage: ${ratePercentage}`);
  }
  return Math.round(base * (rate / 100));
}

function formatRupees(paise) {
  const rupees = fromPaise(paise);
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = {
  isSafePaiseAmount,
  toPaise,
  fromPaise,
  addPaise,
  subtractPaise,
  calculatePercentagePaise,
  formatRupees
};
