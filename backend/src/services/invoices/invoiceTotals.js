/**
 * Pure invoice arithmetic for garage bill edits and finalisation. No I/O. Every amount is computed
 * in integer paise (utils/money) and converted to rupees only for the stored display fields, so
 * 0.1 + 0.2 style drift can never reach a total a customer is charged.
 */
const { toPaise, fromPaise, addPaise } = require('../../utils/money');
const { ValidationError } = require('../../core/errors');
const { DEFAULTS, LIMITS } = require('./constants');

const isItem = (value) => value !== null && typeof value === 'object';
const has = (obj, key) => obj[key] !== undefined && obj[key] !== null;

/** Non-negative paise from untrusted rupee input. Garbage counts as 0; infinities are rejected. */
function rupeesToPaise(raw) {
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return 0;
  if (!Number.isFinite(value)) throw new ValidationError('Invalid monetary amount');
  try {
    return toPaise(Math.max(0, value));
  } catch {
    throw new ValidationError('Monetary amount is too large');
  }
}

function safeTotal(paise) {
  if (!Number.isSafeInteger(paise)) throw new ValidationError('Invoice total is too large');
  return paise;
}

/** Rupees under `rupeeKey` (or `altKey`), else paise under `paiseKey`. */
function pickPaise(item, rupeeKey, altKey, paiseKey) {
  if (has(item, rupeeKey)) return rupeesToPaise(item[rupeeKey]);
  if (altKey && has(item, altKey)) return rupeesToPaise(item[altKey]);
  if (paiseKey && has(item, paiseKey)) return Math.max(0, Math.round(Number(item[paiseKey]) || 0));
  return 0;
}

function normalizePart(p) {
  const quantity = Math.max(1, parseInt(p.quantity, 10) || 1);
  const unitPricePaise = pickPaise(p, 'unitPrice', 'cost', 'unitPricePaise');
  const totalPaise = safeTotal(quantity * unitPricePaise);
  const part = {
    partName: String(p.partName || p.name || DEFAULTS.PART_NAME).trim().slice(0, LIMITS.PART_NAME_MAX),
    brand: p.brand ? String(p.brand).trim().slice(0, LIMITS.PART_NAME_MAX) : '',
    quantity,
    unitPrice: fromPaise(unitPricePaise),
    unitPricePaise,
    cost: fromPaise(totalPaise),
    total: fromPaise(totalPaise),
    totalPaise,
  };
  if (p.description) part.description = String(p.description).trim().slice(0, LIMITS.PART_NAME_MAX);
  return part;
}

/**
 * Additional charges arrive either as one rupee amount (garage billing modal) or as the itemised
 * list written at service completion. Both are kept in their own shape.
 */
function normalizeAdditionalCharges(raw) {
  if (!Array.isArray(raw)) {
    const paise = rupeesToPaise(raw || 0);
    return { additionalCharges: fromPaise(paise), additionalPaise: paise };
  }
  const items = raw.filter(isItem).map((c) => {
    const amountPaise = pickPaise(c, 'amount', null, 'amountPaise');
    return { description: String(c.description || 'Additional Charge').trim().slice(0, LIMITS.PART_NAME_MAX), amount: fromPaise(amountPaise), amountPaise };
  });
  return { additionalCharges: items, additionalPaise: safeTotal(addPaise(...items.map((c) => c.amountPaise))) };
}

/**
 * Recomputes GST on a new taxable amount with the rate frozen in the invoice's tax snapshot
 * (same rounding as services/taxService.calculateTax). Returns null when there is no usable rate.
 */
function retaxSnapshot(snapshot, taxablePaise) {
  if (!isItem(snapshot)) return null;
  const rate = Number(snapshot.rate);
  if (!Number.isFinite(rate) || rate < 0) return null;
  const exempt = Boolean(snapshot.isTaxExempt) || rate === 0 || taxablePaise <= 0;
  const intrastate = snapshot.isIntrastate !== false;
  const half = Math.round(taxablePaise * (rate / 2 / 100));
  const cgstPaise = exempt || !intrastate ? 0 : half;
  const sgstPaise = cgstPaise;
  const igstPaise = exempt || intrastate ? 0 : Math.round(taxablePaise * (rate / 100));
  const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;
  return {
    ...snapshot,
    taxablePaise,
    taxableAmount: fromPaise(taxablePaise),
    cgstPaise,
    cgstAmount: fromPaise(cgstPaise),
    sgstPaise,
    sgstAmount: fromPaise(sgstPaise),
    igstPaise,
    igstAmount: fromPaise(igstPaise),
    totalTaxPaise,
    totalTaxAmount: fromPaise(totalTaxPaise),
    grandTotalPaise: taxablePaise + totalTaxPaise,
    grandTotalAmount: fromPaise(taxablePaise + totalTaxPaise),
  };
}

/**
 * Authoritative totals for an invoice.
 * @param {object} input        line items: partsReplaced, laborAmount|laborCost, additionalCharges,
 *                              discountAmount, taxAmount (taxAmount is used only without a snapshot)
 * @param {{ taxSnapshot?: object }} [options] when the invoice carries a GST snapshot, tax is
 *                              recomputed from its rate and never taken from the client
 */
function calculateInvoiceTotals(input = {}, { taxSnapshot } = {}) {
  const partsReplaced = (Array.isArray(input.partsReplaced) ? input.partsReplaced : []).filter(isItem).map(normalizePart);
  const partsPaise = safeTotal(addPaise(...partsReplaced.map((p) => p.totalPaise)));
  const laborPaise = has(input, 'laborAmount') ? rupeesToPaise(input.laborAmount) : rupeesToPaise(input.laborCost || 0);
  const { additionalCharges, additionalPaise } = normalizeAdditionalCharges(input.additionalCharges);
  const subtotalPaise = safeTotal(partsPaise + laborPaise + additionalPaise);
  const discountPaise = Math.min(subtotalPaise, rupeesToPaise(input.discountAmount || 0));
  const taxablePaise = subtotalPaise - discountPaise;
  const snapshot = retaxSnapshot(taxSnapshot, taxablePaise);
  const taxPaise = snapshot ? snapshot.totalTaxPaise : rupeesToPaise(input.taxAmount || 0);
  const totalPaise = safeTotal(taxablePaise + taxPaise);

  return {
    partsReplaced,
    additionalCharges,
    partsPaise,
    laborPaise,
    additionalPaise,
    subtotalPaise,
    discountPaise,
    taxablePaise,
    taxPaise,
    totalPaise,
    taxSnapshot: snapshot,
    partsAmount: fromPaise(partsPaise),
    laborAmount: fromPaise(laborPaise),
    discountAmount: fromPaise(discountPaise),
    taxAmount: fromPaise(taxPaise),
    subtotal: fromPaise(subtotalPaise),
    taxableAmount: fromPaise(taxablePaise),
    totalAmount: fromPaise(totalPaise),
  };
}

/** Same as calculateInvoiceTotals but never throws (read paths over legacy rows). */
function safeInvoiceTotals(input, options) {
  try {
    return calculateInvoiceTotals(input, options);
  } catch {
    return calculateInvoiceTotals({}, {});
  }
}

/**
 * Fields persisted on the service record for a bill edit/finalise. Keeps the legacy field names
 * (subtotal, totalCost, laborCost) and the paise/amount fields written at completion in sync.
 */
function toStoredTotals(t) {
  const fields = {
    partsReplaced: t.partsReplaced,
    partsAmount: t.partsAmount,
    laborCost: t.laborAmount,
    laborAmount: t.laborAmount,
    additionalCharges: t.additionalCharges,
    discountAmount: t.discountAmount,
    taxAmount: t.taxAmount,
    subtotal: t.subtotal,
    totalCost: t.totalAmount,
    totalAmount: t.totalAmount,
    subtotalAmount: t.subtotal,
    subtotalPaise: t.subtotalPaise,
    discountPaise: t.discountPaise,
    taxableAmount: t.taxableAmount,
    taxablePaise: t.taxablePaise,
    taxAmountPaise: t.taxPaise,
    grandTotalPaise: t.totalPaise,
  };
  if (t.taxSnapshot) fields.taxSnapshot = t.taxSnapshot;
  return fields;
}

/** Fields mirrored onto the `invoices` collection document. */
function toInvoiceDocTotals(t) {
  const fields = {
    parts: t.partsReplaced,
    additionalCharges: t.additionalCharges,
    subtotalAmount: t.subtotal,
    subtotalPaise: t.subtotalPaise,
    discountAmount: t.discountAmount,
    discountPaise: t.discountPaise,
    grandTotalAmount: t.totalAmount,
    grandTotalPaise: t.totalPaise,
  };
  if (t.taxSnapshot) fields.taxSnapshot = t.taxSnapshot;
  return fields;
}

module.exports = { calculateInvoiceTotals, safeInvoiceTotals, retaxSnapshot, toStoredTotals, toInvoiceDocTotals, rupeesToPaise };
