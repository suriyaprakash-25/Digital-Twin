/**
 * Pure response mappers for invoices, receipts and garage revenue views. They keep the exact JSON
 * shapes the React billing pages (InvoiceModal, ReceiptModal, GaragePayments, garage dashboard)
 * already consume.
 */
const { fromPaise } = require('../../utils/money');
const { DEFAULTS, INVOICE_STATUS, SERVICE_PAYMENT_STATUS, REPORTING } = require('./constants');
const { safeInvoiceTotals } = require('./invoiceTotals');
const { dayKey, dayLabel } = require('./reportingCalendar');

const firstDefined = (...values) => values.find((v) => v !== undefined);
const shortId = (id, n) => String(id).slice(-n).toUpperCase();

function invoiceNumberOf(s) {
  return s.invoiceNumber || `${DEFAULTS.INVOICE_NUMBER_PREFIX}${shortId(s._id, 6)}`;
}

function amountOf(s) {
  return s.totalAmount !== undefined ? s.totalAmount : (s.totalCost || 0);
}

const billPhotos = (s) => (Array.isArray(s.billPhotoUrls) ? s.billPhotoUrls : (s.billPhotoUrl ? [s.billPhotoUrl] : []));

const ANONYMOUS_CUSTOMER = Object.freeze({ name: DEFAULTS.CUSTOMER_NAME, email: '', phone: '' });

/**
 * Customer block. `visible` is false when the viewer reached the invoice only through current
 * vehicle ownership and is not the billed customer (e.g. an invoice from before a transfer).
 */
function toCustomer(userDoc, { visible = true } = {}) {
  if (!visible) return { name: DEFAULTS.PREVIOUS_OWNER_NAME, email: '', phone: '' };
  if (!userDoc) return { ...ANONYMOUS_CUSTOMER };
  return { name: userDoc.name || DEFAULTS.CUSTOMER_NAME, email: userDoc.email || '', phone: userDoc.phone || '' };
}

function toGarageBlock(garage, service, { withCity = true } = {}) {
  const block = {
    name: (garage && garage.name) || service.garageName || DEFAULTS.GARAGE_NAME,
    address: (garage && garage.address) || service.location || '',
    phone: (garage && garage.phone) || '',
  };
  if (withCity) block.city = (garage && garage.city) || '';
  return block;
}

/** GET /api/invoices/:serviceId body.invoice */
function toInvoiceDetail({ service, vehicle, garage, customer }) {
  const totals = safeInvoiceTotals(service, { taxSnapshot: null });
  return {
    id: String(service._id),
    invoiceNumber: invoiceNumberOf(service),
    invoiceStatus: service.invoiceStatus || INVOICE_STATUS.FINALIZED,
    paymentStatus: service.paymentStatus || SERVICE_PAYMENT_STATUS.UNPAID,
    serviceDate: service.serviceDate,
    serviceCategory: service.serviceCategory || DEFAULTS.SERVICE_CATEGORY,
    serviceType: service.serviceType || DEFAULTS.SERVICE_TYPE,
    mechanicNotes: service.mechanicNotes || '',
    partsReplaced: service.partsReplaced || totals.partsReplaced,
    partsAmount: firstDefined(service.partsAmount, totals.partsAmount),
    laborCharges: service.laborCharges || [],
    laborAmount: service.laborAmount !== undefined ? service.laborAmount : (service.laborCost || totals.laborAmount),
    additionalCharges: service.additionalCharges || totals.additionalCharges,
    discountAmount: firstDefined(service.discountAmount, totals.discountAmount),
    taxableAmount: firstDefined(service.taxableAmount, totals.taxableAmount),
    taxAmount: firstDefined(service.taxAmount, totals.taxAmount),
    taxSnapshot: service.taxSnapshot || null,
    subtotal: firstDefined(service.subtotalAmount, totals.subtotal),
    totalAmount: service.totalAmount !== undefined ? service.totalAmount : (service.totalCost || totals.totalAmount),
    paidAt: service.paidAt,
    paymentId: service.paymentId,
    paymentMethod: service.paymentMethod,
    razorpayOrderId: service.razorpayOrderId,
    garage: toGarageBlock(garage, service),
    vehicle: vehicle ? {
      id: String(vehicle._id),
      brand: vehicle.brand,
      model: vehicle.model,
      registrationNumber: vehicle.vehicleNumber || vehicle.registrationNumber,
      year: vehicle.year,
    } : null,
    customer: customer || { ...ANONYMOUS_CUSTOMER },
    billPhotoUrls: billPhotos(service),
    createdAt: service.createdAt,
    invoiceFinalizedAt: service.invoiceFinalizedAt,
  };
}

/** GET /api/invoices/:serviceId/receipt body.receipt */
function toReceipt({ service, payment, vehicle, garage, customer, now }) {
  const p = payment || {};
  return {
    receiptNumber: `${DEFAULTS.RECEIPT_NUMBER_PREFIX}${shortId(service._id, 8)}`,
    invoiceNumber: invoiceNumberOf(service),
    paymentId: service.paymentId || p.razorpayPaymentId || p.cashfreePaymentId || DEFAULTS.RECEIPT_PAYMENT_ID,
    orderId: service.razorpayOrderId || p.razorpayOrderId || p.cfOrderId,
    amount: service.totalAmount !== undefined ? service.totalAmount : service.totalCost,
    currency: DEFAULTS.CURRENCY,
    paymentMethod: service.paymentMethod || p.paymentMethod || DEFAULTS.RECEIPT_PAYMENT_METHOD,
    paidAt: service.paidAt || p.paidAt || now,
    serviceType: service.serviceType,
    garage: toGarageBlock(garage, service, { withCity: false }),
    vehicle: vehicle ? {
      brand: vehicle.brand,
      model: vehicle.model,
      registrationNumber: vehicle.vehicleNumber || vehicle.registrationNumber,
    } : null,
    customer: customer || { name: DEFAULTS.CUSTOMER_NAME, email: '' },
  };
}

/** One row of GET /garage/all */
function toGarageInvoiceRow(s) {
  return {
    id: String(s._id),
    invoiceNumber: invoiceNumberOf(s),
    invoiceStatus: s.invoiceStatus || INVOICE_STATUS.FINALIZED,
    paymentStatus: s.paymentStatus || SERVICE_PAYMENT_STATUS.UNPAID,
    serviceDate: s.serviceDate,
    serviceType: s.serviceType,
    serviceCategory: s.serviceCategory,
    totalAmount: amountOf(s),
    paidAt: s.paidAt,
    paymentId: s.paymentId,
    vehicle: s.vehicleDetails ? {
      brand: s.vehicleDetails.brand || s.vehicleDetails.make,
      model: s.vehicleDetails.model,
      registrationNumber: s.vehicleDetails.vehicleNumber || s.vehicleDetails.registrationNumber,
    } : null,
    customer: s.ownerDetails ? { name: s.ownerDetails.name, email: s.ownerDetails.email, phone: s.ownerDetails.phone } : null,
    createdAt: s.createdAt,
  };
}

/** One row of GET /garage/payments/all */
function toGaragePaymentRow(p) {
  return {
    id: String(p._id),
    invoiceNumber: p.invoiceNumber || DEFAULTS.NONE,
    orderId: p.razorpayOrderId || p.cfOrderId,
    paymentId: p.razorpayPaymentId || p.cashfreePaymentId || DEFAULTS.NONE,
    amount: p.amount,
    currency: p.currency || DEFAULTS.CURRENCY,
    serviceType: p.serviceType || DEFAULTS.SERVICE_TYPE,
    vehicleNumber: p.vehicleNumber || DEFAULTS.VEHICLE_NUMBER,
    status: p.status,
    paymentMethod: p.paymentMethod || DEFAULTS.PAYMENT_METHOD,
    date: p.paidAt || p.createdAt,
  };
}

/** GET /garage/revenue/summary body.summary (amounts converted from paise once, at the edge). */
function toRevenueSummary(kpis, billing) {
  return {
    totalRevenue: fromPaise(kpis.revenuePaise),
    paidInvoices: kpis.capturedCount,
    pendingPayments: fromPaise(billing.pendingPaise),
    todayRevenue: fromPaise(kpis.todayPaise),
    monthRevenue: fromPaise(kpis.monthPaise),
    refundedAmount: fromPaise(kpis.refundedPaise),
    failedPayments: kpis.failedCount,
    totalServicesLogged: billing.total,
  };
}

/**
 * Daily trend buckets from `startDate` for `days`+1 business days, with the aggregated paise rows
 * (keyed by business-day 'YYYY-MM-DD') merged in.
 */
function toTrend(rows, startDate, days) {
  const byDay = new Map(rows.map((r) => [r._id, r]));
  const trend = [];
  for (let i = 0; i <= days; i += 1) {
    const d = new Date(startDate.getTime() + i * REPORTING.DAY_MS);
    const key = dayKey(d);
    const row = byDay.get(key);
    trend.push({
      date: key,
      label: dayLabel(d),
      revenue: row ? fromPaise(row.revenuePaise) : 0,
      refunds: row ? fromPaise(row.refundsPaise) : 0,
      count: row ? row.count : 0,
    });
  }
  return trend;
}

/** Response `invoice` of PUT /garage/:serviceId (the legacy key set). */
function toDraftUpdateView(serviceId, stored, mechanicNotes, updatedAt) {
  return {
    id: String(serviceId),
    partsReplaced: stored.partsReplaced,
    partsAmount: stored.partsAmount,
    laborCost: stored.laborCost,
    laborAmount: stored.laborAmount,
    additionalCharges: stored.additionalCharges,
    discountAmount: stored.discountAmount,
    taxAmount: stored.taxAmount,
    subtotal: stored.subtotal,
    totalCost: stored.totalCost,
    totalAmount: stored.totalAmount,
    mechanicNotes,
    updatedAt,
  };
}

module.exports = {
  invoiceNumberOf,
  toCustomer,
  toInvoiceDetail,
  toReceipt,
  toGarageInvoiceRow,
  toGaragePaymentRow,
  toRevenueSummary,
  toTrend,
  toDraftUpdateView,
};
