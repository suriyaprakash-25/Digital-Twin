/**
 * Pure settlement arithmetic (no I/O), all in integer paise.
 *
 * Earnings are indivisible ledger rows, and a settlement pays exactly the sum of the rows it locks
 * (settlementReconciliationService checks this). The old code kept locking rows until it had
 * covered the request, so asking for ₹500 against a single ₹800 row locked ₹800 but paid ₹500, and
 * the extra ₹300 was then marked SETTLED without ever being paid. Selection now never exceeds the
 * requested amount, and the settlement amount is the locked sum.
 */
const { toPaise, fromPaise } = require('../../utils/money');
const { ValidationError } = require('../../core/errors');

const isSet = (v) => v !== undefined && v !== null;

/**
 * Optional `amount` from the request body, in rupees.
 * @returns {number|undefined} undefined means "the full available balance"
 * @throws {ValidationError} for non-numeric, non-finite, zero or negative input
 */
function parseRequestedAmount(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'number' && typeof raw !== 'string') throw new ValidationError('Settlement amount must be a positive number');
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new ValidationError('Settlement amount must be a positive number');
  try {
    toPaise(value);
  } catch {
    throw new ValidationError('Settlement amount is too large');
  }
  return value;
}

/** Net (after refunds) of one earnings row in paise; mirrors EarningsRepository NET_PAISE. */
function earningNetPaise(e) {
  if (isSet(e.netAfterRefundPaise)) return Math.round(Number(e.netAfterRefundPaise) || 0);
  if (isSet(e.netAfterRefund)) return Math.round((Number(e.netAfterRefund) || 0) * 100);
  if (isSet(e.garageNetPaise)) return Math.round(Number(e.garageNetPaise) || 0);
  return Math.round((Number(e.garageNetAmount) || 0) * 100);
}

/**
 * Chooses the rows to lock for a payout.
 *  - No cap (full balance): every available row.
 *  - With a cap: negative refund adjustments are always included (they are owed back), then
 *    positive rows oldest-first while the running total stays within the cap.
 * @param {object[]} docs available rows, oldest first
 * @param {number|null} capPaise requested amount, or null for everything
 * @returns {{ selected: object[], totalPaise: number }}
 */
function selectEarningsForPayout(docs, capPaise) {
  if (capPaise === null || capPaise === undefined) {
    return { selected: [...docs], totalPaise: docs.reduce((sum, d) => sum + earningNetPaise(d), 0) };
  }
  const negatives = docs.filter((d) => earningNetPaise(d) < 0);
  let totalPaise = negatives.reduce((sum, d) => sum + earningNetPaise(d), 0);
  const selected = [...negatives];
  for (const doc of docs) {
    const net = earningNetPaise(doc);
    if (net >= 0 && totalPaise + net <= capPaise) {
      selected.push(doc);
      totalPaise += net;
    }
  }
  return { selected, totalPaise };
}

/** Human-readable rupees for messages, e.g. 1234.5 -> "1,234.5". */
function rupeesLabel(paise, locale) {
  return fromPaise(paise).toLocaleString(locale);
}

module.exports = { parseRequestedAmount, earningNetPaise, selectEarningsForPayout, rupeesLabel };
