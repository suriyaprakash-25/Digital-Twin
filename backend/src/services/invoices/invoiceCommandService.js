/**
 * Garage bill mutations: edit line items, finalise (assign the GST invoice number) and cancel.
 *
 * Safety rules:
 *  - only the issuing garage may change its invoice;
 *  - nothing changes once money has been taken (PAID / PARTIALLY_PAID / refunded) or after cancel;
 *  - nothing changes while the customer has a checkout open (the capture would be stale);
 *  - every write is a compare-and-swap on those conditions, so a capture or cancel that lands
 *    between the checks and the write is never overwritten;
 *  - exactly one concurrent finalize assigns an invoice number (no burned numbers).
 */
const crypto = require('crypto');
const { NotFoundError, ForbiddenError, ValidationError, ConflictError } = require('../../core/errors');
const { asString } = require('../../core/text');
const { MSG, ERROR_CODES, INVOICE_STATUS, SERVICE_PAYMENT_STATUS, LOCKED_PAYMENT_STATUSES, FINALIZE, LIMITS } = require('./constants');
const { calculateInvoiceTotals, toStoredTotals, toInvoiceDocTotals } = require('./invoiceTotals');
const { toDraftUpdateView } = require('./invoicePresenters');

const isLocked = (service) => LOCKED_PAYMENT_STATUSES.includes(service.paymentStatus);
const isCancelled = (service) => service.invoiceStatus === INVOICE_STATUS.CANCELLED;
const changedConcurrently = () => new ConflictError(MSG.CHANGED_CONCURRENTLY, ERROR_CODES.INVOICE_CHANGED);

/**
 * @param {object} deps
 * @param {object} deps.repos                       createRepositories(db)
 * @param {(serviceId: any) => Promise<boolean>} deps.hasOpenPayment   open checkout for this service?
 * @param {() => Promise<string>} deps.nextInvoiceNumber               atomic invoice number sequence
 * @param {() => Date} [deps.now]
 * @param {() => string} [deps.newToken]
 */
function createInvoiceCommandService({ repos, hasOpenPayment, nextInvoiceNumber, now = () => new Date(), newToken = () => crypto.randomUUID() }) {
  async function loadOwnService(user, serviceId, forbiddenMessage) {
    const service = await repos.serviceRecords.findActive(serviceId);
    if (!service) throw new NotFoundError(MSG.SERVICE_NOT_FOUND);
    if (String(service.createdBy) !== String(user.id) && user.role !== 'ADMIN') throw new ForbiddenError(forbiddenMessage);
    return service;
  }

  /** The customer is paying the current total right now; changing it would make the capture stale. */
  async function assertNoOpenCheckout(service) {
    if (await hasOpenPayment(service._id)) throw new ConflictError(MSG.CHECKOUT_IN_PROGRESS, ERROR_CODES.CHECKOUT_IN_PROGRESS);
  }

  function writeOpenInvoice(service, set, options = {}) {
    return repos.serviceRecords.updateOpenInvoice(service._id, { set, lockedPaymentStatuses: LOCKED_PAYMENT_STATUSES, ...options });
  }

  async function updateDraft(user, serviceId, body = {}) {
    const service = await loadOwnService(user, serviceId, MSG.FORBIDDEN_EDIT);
    if (isLocked(service)) throw new ValidationError(MSG.EDIT_PAID);
    if (isCancelled(service)) throw new ValidationError(MSG.EDIT_CANCELLED);
    await assertNoOpenCheckout(service);

    const totals = calculateInvoiceTotals(body, { taxSnapshot: service.taxSnapshot });
    const stored = toStoredTotals(totals);
    const mechanicNotes = body.mechanicNotes !== undefined ? asString(body.mechanicNotes, { maxLength: LIMITS.MECHANIC_NOTES_MAX }) : service.mechanicNotes;
    const at = now();
    if (!(await writeOpenInvoice(service, { ...stored, mechanicNotes, updatedAt: at }))) throw changedConcurrently();
    await repos.invoices.syncFromService(service.invoiceNumber, toInvoiceDocTotals(totals), at);
    return { invoice: toDraftUpdateView(service._id, stored, mechanicNotes, at) };
  }

  async function finalize(user, serviceId, body = {}) {
    const service = await loadOwnService(user, serviceId, MSG.FORBIDDEN_FINALIZE);
    if (isLocked(service)) throw new ValidationError(MSG.FINALIZE_PAID);
    if (isCancelled(service)) throw new ValidationError(MSG.FINALIZE_CANCELLED);
    await assertNoOpenCheckout(service);

    // Validate the amounts before claiming a number so a bad request cannot burn one.
    const totals = calculateInvoiceTotals({ ...service, ...body }, { taxSnapshot: service.taxSnapshot });
    const at = now();
    let invoiceNumber = service.invoiceNumber;
    let claimToken = null;
    if (!invoiceNumber) {
      claimToken = newToken();
      const claimed = await repos.serviceRecords.claimInvoiceNumber(service._id, claimToken, { now: at, leaseMs: FINALIZE.NUMBER_CLAIM_LEASE_MS });
      if (!claimed) throw new ConflictError(MSG.FINALIZE_IN_PROGRESS, ERROR_CODES.FINALIZE_IN_PROGRESS);
    }

    try {
      if (claimToken) invoiceNumber = await nextInvoiceNumber();
      const set = {
        invoiceNumber,
        invoiceStatus: INVOICE_STATUS.FINALIZED,
        paymentStatus: service.paymentStatus || SERVICE_PAYMENT_STATUS.UNPAID,
        ...toStoredTotals(totals),
        invoiceFinalizedAt: at,
        updatedAt: at,
      };
      const guard = claimToken ? { invoiceFinalizeToken: claimToken } : { invoiceNumber };
      const unset = claimToken ? { invoiceFinalizeToken: '', invoiceFinalizeLockUntil: '' } : undefined;
      if (!(await writeOpenInvoice(service, set, { guard, unset }))) throw changedConcurrently();
      claimToken = null; // consumed by the write
    } finally {
      if (claimToken) await repos.serviceRecords.releaseInvoiceNumberClaim(service._id, claimToken);
    }

    await repos.invoices.syncFromService(invoiceNumber, toInvoiceDocTotals(totals), at);
    return { invoiceNumber, totalAmount: totals.totalAmount, invoiceStatus: INVOICE_STATUS.FINALIZED };
  }

  async function cancel(user, serviceId) {
    const service = await loadOwnService(user, serviceId, MSG.FORBIDDEN);
    if (isLocked(service)) throw new ValidationError(MSG.CANCEL_PAID);
    if (isCancelled(service)) return { alreadyCancelled: true }; // idempotent, as before
    await assertNoOpenCheckout(service);
    const at = now();
    if (!(await writeOpenInvoice(service, { invoiceStatus: INVOICE_STATUS.CANCELLED, updatedAt: at }))) throw changedConcurrently();
    await repos.invoices.syncFromService(service.invoiceNumber, { invoiceStatus: INVOICE_STATUS.CANCELLED }, at);
    return { alreadyCancelled: false };
  }

  return { updateDraft, finalize, cancel };
}

module.exports = { createInvoiceCommandService };
