/**
 * Invoice reads: detail, paid receipt and the garage's paged invoice list.
 * Collaborators are injected; nothing here touches the global db.
 */
const { NotFoundError, ValidationError } = require('../../core/errors');
const { parsePagination } = require('../../core/pagination');
const { safeSearchRegex } = require('../../core/text');
const { MSG, LISTING, LIST_STATUS_FILTERS, SERVICE_PAYMENT_STATUS } = require('./constants');
const { toInvoiceDetail, toReceipt, toGarageInvoiceRow } = require('./invoicePresenters');
const { createInvoiceAccess } = require('./invoiceAccess');

/**
 * @param {{ repos: object, resolveGarageIds: Function, now?: () => Date }} deps
 */
function createInvoiceQueryService({ repos, resolveGarageIds, now = () => new Date() }) {
  const access = createInvoiceAccess({ repos, resolveGarageIds });

  /** Service record by id / invoice number, falling back to the invoices collection's link. */
  async function findInvoiceService(ref) {
    const service = await repos.serviceRecords.findActiveByReference(ref);
    if (service) return service;
    const invoice = await repos.invoices.findByReference(ref);
    return invoice && invoice.serviceId ? repos.serviceRecords.findActive(invoice.serviceId) : null;
  }

  async function getInvoice(user, ref) {
    const service = await findInvoiceService(ref);
    if (!service) throw new NotFoundError(MSG.INVOICE_NOT_FOUND);
    const { vehicle, garage, customer } = await access.loadParties(user, service, MSG.FORBIDDEN_INVOICE);
    return toInvoiceDetail({ service, vehicle, garage, customer });
  }

  async function getReceipt(user, serviceId) {
    const service = await repos.serviceRecords.findActive(serviceId);
    if (!service) throw new NotFoundError(MSG.RECEIPT_NOT_FOUND);
    // Authorise before revealing whether the invoice is paid.
    const { vehicle, garage, customer } = await access.loadParties(user, service, MSG.FORBIDDEN);
    if (service.paymentStatus !== SERVICE_PAYMENT_STATUS.PAID) throw new ValidationError(MSG.RECEIPT_UNPAID);
    const payment = await repos.payments.findForReceipt(service);
    return toReceipt({ service, payment, vehicle, garage, customer, now: now() });
  }

  /** @returns {Promise<{ body: object, pagination: { total: number, page: number, limit: number } }>} */
  async function listGarageInvoices(user, query = {}) {
    const page = parsePagination(query, { defaultLimit: LISTING.INVOICES_DEFAULT_LIMIT, maxLimit: LISTING.INVOICES_MAX_LIMIT });
    const statusMatch = LIST_STATUS_FILTERS[String(query.status || '')] || {};
    const { items, total } = await repos.serviceRecords.listInvoicesForGarage({
      createdBy: String(user.id),
      statusMatch,
      searchRegex: safeSearchRegex(query.search),
      skip: page.skip,
      limit: page.limit,
    });
    return {
      body: {
        success: true,
        invoices: items.map(toGarageInvoiceRow),
        totalCount: total,
        totalPages: Math.ceil(total / page.limit),
        currentPage: page.page,
      },
      pagination: { total, page: page.page, limit: page.limit },
    };
  }

  return { getInvoice, getReceipt, listGarageInvoices };
}

module.exports = { createInvoiceQueryService };
