/**
 * Pure invoice arithmetic for service completion. No I/O: every function here is deterministic and
 * unit-testable. All money is computed in integer paise (utils/money) and only converted to rupees
 * for display fields, so floating-point drift can never reach a stored total.
 */
const { toPaise, fromPaise, addPaise } = require('../../utils/money');
const { ValidationError } = require('../../core/errors');
const { DEFAULTS } = require('./constants');

const asArray = (value) => (Array.isArray(value) ? value : []);
const isItem = (value) => value !== null && typeof value === 'object';
const firstNonEmpty = (...lists) => lists.map(asArray).find((list) => list.length > 0) || [];

/** Non-negative rupee amount from untrusted input; garbage counts as 0, infinities are rejected. */
function toAmount(raw) {
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return 0;
  if (!Number.isFinite(value)) throw new ValidationError('Invalid monetary amount');
  return Math.max(0, value);
}

/** Legacy clients send rupees under several names, or paise under a *Paise name. */
function pickRupees(item, rupeeKeys, paiseKey) {
  const key = rupeeKeys.find((k) => item[k] !== undefined);
  if (key) return item[key];
  return item[paiseKey] ? item[paiseKey] / 100 : 0;
}

function safeLineTotal(paise) {
  if (!Number.isSafeInteger(paise)) throw new ValidationError('Line item total is too large');
  return paise;
}

function normalizePart(p) {
  const quantity = Math.max(1, parseInt(p.quantity, 10) || 1);
  const unitPricePaise = toPaise(toAmount(pickRupees(p, ['unitPrice', 'cost'], 'unitPricePaise')));
  const totalPaise = safeLineTotal(quantity * unitPricePaise);
  return {
    partName: String(p.partName || p.name || DEFAULTS.PART_NAME).trim(),
    description: String(p.description || p.brand || '').trim(),
    quantity,
    unitPrice: fromPaise(unitPricePaise),
    unitPricePaise,
    total: fromPaise(totalPaise),
    totalPaise,
  };
}

function normalizeLabour(l) {
  const quantity = Math.max(1, parseFloat(l.quantity !== undefined ? l.quantity : (l.hours || 1)) || 1);
  const ratePaise = toPaise(toAmount(pickRupees(l, ['rate', 'cost'], 'ratePaise')));
  const totalPaise = safeLineTotal(Math.round(quantity * ratePaise));
  return {
    description: String(l.description || DEFAULTS.LABOUR_DESCRIPTION).trim(),
    quantity,
    hours: quantity,
    rate: fromPaise(ratePaise),
    ratePaise,
    total: fromPaise(totalPaise),
    totalPaise,
  };
}

function normalizeCharge(c) {
  const amountPaise = toPaise(toAmount(pickRupees(c, ['amount'], 'amountPaise')));
  return {
    description: String(c.description || DEFAULTS.ADDITIONAL_CHARGE_DESCRIPTION).trim(),
    amount: fromPaise(amountPaise),
    amountPaise,
  };
}

/**
 * Normalises the request's parts / labour / additional charges into invoice lines.
 * @param {object} input completion request body
 * @returns {{ parts: object[], labour: object[], additionalCharges: object[], partsPaise: number, labourPaise: number, additionalPaise: number }}
 */
function buildInvoiceLines(input = {}) {
  const fallbackLabour = input.laborCost ? [{ description: DEFAULTS.LABOUR_FALLBACK_DESCRIPTION, quantity: 1, rate: input.laborCost }] : [];
  const parts = firstNonEmpty(input.parts, input.partsReplaced).filter(isItem).map(normalizePart);
  const labour = firstNonEmpty(input.labour, input.labor, fallbackLabour).filter(isItem).map(normalizeLabour);
  const additionalCharges = asArray(input.additionalCharges).filter(isItem).map(normalizeCharge);
  return {
    parts,
    labour,
    additionalCharges,
    partsPaise: addPaise(...parts.map((p) => p.totalPaise)),
    labourPaise: addPaise(...labour.map((l) => l.totalPaise)),
    additionalPaise: addPaise(...additionalCharges.map((c) => c.amountPaise)),
  };
}

/**
 * Pre-tax totals. The discount is capped at the subtotal so the taxable value is never negative.
 * @param {{ partsPaise: number, labourPaise: number, additionalPaise: number }} lines
 * @param {{ discount?: number|string, discountPaise?: number }} discountInput
 */
function computeTotals(lines, { discount = 0, discountPaise = 0 } = {}) {
  const subtotalPaise = addPaise(lines.partsPaise, lines.labourPaise, lines.additionalPaise);
  const rawDiscount = discount !== undefined && discount !== 0 ? discount : (discountPaise ? discountPaise / 100 : 0);
  const appliedDiscountPaise = Math.min(subtotalPaise, toPaise(toAmount(rawDiscount)));
  return {
    subtotalPaise,
    discountPaise: appliedDiscountPaise,
    taxablePaise: Math.max(0, subtotalPaise - appliedDiscountPaise),
  };
}

/** Adds the tax snapshot (from taxService) to pre-tax totals and derives the rupee display values. */
function applyTax(totals, taxSnapshot) {
  const taxPaise = Math.round(Number(taxSnapshot && taxSnapshot.totalTaxPaise) || 0);
  const grandTotalPaise = addPaise(totals.taxablePaise, taxPaise);
  return {
    ...totals,
    taxPaise,
    grandTotalPaise,
    subtotalAmount: fromPaise(totals.subtotalPaise),
    discountAmount: fromPaise(totals.discountPaise),
    taxableAmount: fromPaise(totals.taxablePaise),
    grandTotalAmount: fromPaise(grandTotalPaise),
  };
}

module.exports = { buildInvoiceLines, computeTotals, applyTax, toAmount };
