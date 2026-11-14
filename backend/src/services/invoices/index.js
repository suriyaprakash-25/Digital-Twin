/**
 * Composition root for the invoice module (routes/invoices.js): wires repositories, the garage id
 * resolver, the checkout lock and the invoice-number sequence into the three services. This is the
 * only place in the module that knows about the live database connection.
 */
const { getDb } = require('../../db');
const { createRepositories } = require('../../repositories');
const { resolveGarageIds } = require('../../utils/garageResolver');
const { generateInvoiceNumber } = require('../../utils/invoiceNumber');
const { hasOpenPaymentForService } = require('../payments/paymentCaptureService');
const { createInvoiceQueryService } = require('./invoiceQueryService');
const { createInvoiceCommandService } = require('./invoiceCommandService');
const { createGarageRevenueService } = require('./garageRevenueService');

const cache = new WeakMap();

function buildInvoiceModule(db) {
  const deps = {
    repos: createRepositories(db),
    resolveGarageIds: (userId) => resolveGarageIds(userId, db),
  };
  return {
    queries: createInvoiceQueryService(deps),
    commands: createInvoiceCommandService({
      ...deps,
      hasOpenPayment: (serviceId) => hasOpenPaymentForService(db, serviceId),
      nextInvoiceNumber: () => generateInvoiceNumber(db),
    }),
    revenue: createGarageRevenueService(deps),
  };
}

/** Services bound to the connected database (memoised per Db instance). */
function getInvoiceModule(db = getDb()) {
  if (!cache.has(db)) cache.set(db, buildInvoiceModule(db));
  return cache.get(db);
}

module.exports = { getInvoiceModule, buildInvoiceModule };
