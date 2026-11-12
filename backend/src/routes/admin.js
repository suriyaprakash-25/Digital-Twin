/**
 * Admin console HTTP adapters, mounted at /api/admin. Each handler parses input, calls an admin
 * service (services/admin) and formats the response; all data access is in repositories.
 *
 * Error bodies keep the legacy contract the React admin pages read:
 *   directory/analytics routes: 4xx -> { msg }, 5xx -> { msg, error }
 *   finance routes:             5xx -> { success: false, message }
 */
const express = require('express');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { invalidateCacheOnWrite, CACHE_KEYS } = require('../infrastructure/cache/cache');
const { asyncHandler, AppError } = require('../core/errors');
const { parsePagination, setPaginationHeaders } = require('../core/pagination');
const { createRepositories } = require('../repositories');
const { createAdminServices } = require('../services/admin');
const { ADMIN_PAGINATION } = require('../services/admin/adminConstants');

/** Production composition root: repositories bound to the connected database, per request. */
const defaultServices = () => createAdminServices(createRepositories());

const pageOf = (query) => parsePagination(query, {
  defaultLimit: ADMIN_PAGINATION.DEFAULT_LIMIT,
  maxLimit: ADMIN_PAGINATION.MAX_LIMIT,
});

const totalPagesOf = ({ total, limit }) => Math.ceil(total / limit);

const errorText = (err) => String(err && err.message ? err.message : err);

/** Directory/analytics error contract: client errors -> { msg }, anything else -> 500 { msg, error }. */
function legacyErrors(failureMsg) {
  return (err, res) => (err instanceof AppError && err.expose
    ? res.status(err.status).json({ msg: err.message })
    : res.status(500).json({ msg: failureMsg, error: errorText(err) }));
}

/** Finance error contract: log the cause, answer 500 { success: false, message }. */
function financeErrors(logLabel, message) {
  return (err, res) => {
    console.error(`${logLabel}:`, err);
    return res.status(500).json({ success: false, message });
  };
}

/** asyncHandler + the route's own error contract (anything thrown by onError reaches errorHandler). */
function handle(onError, handler) {
  return asyncHandler(async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      return onError(err, res);
    }
  });
}

/** Paged list body used by the users and garages directories. */
function directoryPage(res, result) {
  setPaginationHeaders(res, result);
  return res.status(200).json({
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: totalPagesOf(result),
  });
}

/** Paged finance list body: `{ success, [key]: items, ...extra, totalCount, totalPages, currentPage }`. */
function financePage(res, key, result, extra = {}) {
  setPaginationHeaders(res, result);
  return res.status(200).json({
    success: true,
    [key]: result.items,
    ...extra,
    totalCount: result.total,
    totalPages: totalPagesOf(result),
    currentPage: result.page,
  });
}

const listInput = (req) => ({ search: req.query.search, status: req.query.status, page: pageOf(req.query) });

/** Success message and failure message per garage moderation action. */
const GARAGE_ACTION_MESSAGES = Object.freeze({
  verify: ['Garage verified successfully', 'Error verifying garage'],
  unverify: ['Garage unverified', 'Error updating garage'],
  suspend: ['Garage suspended', 'Error suspending garage'],
  activate: ['Garage activated', 'Error activating garage'],
});

/**
 * @param {{ getServices?: (req: import('express').Request) => ReturnType<typeof createAdminServices> }} [deps]
 *   injectable service factory (tests pass fakes); defaults to services over the live database.
 */
function createAdminRouter({ getServices = defaultServices } = {}) {
  const router = express.Router();
  router.use(invalidateCacheOnWrite(CACHE_KEYS.GARAGE_LIST, CACHE_KEYS.GARAGE_DETAIL));

  // ── Dashboard & analytics ──
  router.get('/dashboard', requireAdmin, handle(legacyErrors('Error loading dashboard'), async (req, res) => {
    res.status(200).json(await getServices(req).dashboard.getDashboard());
  }));

  router.get('/revenue', requireAdmin, handle(legacyErrors('Error loading revenue'), async (req, res) => {
    res.status(200).json(await getServices(req).dashboard.getRevenue());
  }));

  router.get('/analytics', requireAdmin, handle(legacyErrors('Error loading analytics'), async (req, res) => {
    res.status(200).json(await getServices(req).dashboard.getAnalytics());
  }));

  // ── Users ──
  router.get('/users', requireAdmin, handle(legacyErrors('Error loading users'), async (req, res) => {
    const result = await getServices(req).users.listUsers({ search: req.query.search, page: pageOf(req.query) });
    directoryPage(res, result);
  }));

  router.get('/users/:id', requireAdmin, handle(legacyErrors('Error loading user'), async (req, res) => {
    res.status(200).json(await getServices(req).users.getUserDetail(req.params.id));
  }));

  // ── Garages ──
  router.get('/garages', requireAdmin, handle(legacyErrors('Error loading garages'), async (req, res) => {
    const result = await getServices(req).garages.listGarages({ search: req.query.search, page: pageOf(req.query) });
    directoryPage(res, result);
  }));

  // PATCH /garages/:id/verify | unverify | suspend | activate
  Object.entries(GARAGE_ACTION_MESSAGES).forEach(([action, [successMsg, failureMsg]]) => {
    router.patch(`/garages/:id/${action}`, requireAdmin, handle(legacyErrors(failureMsg), async (req, res) => {
      await getServices(req).garages.moderateGarage(req.params.id, action);
      res.status(200).json({ msg: successMsg });
    }));
  });

  // ── Payments ──
  router.get('/payments/summary', requireAdmin, handle(
    financeErrors('Error loading admin payment summary', 'Error loading admin payment summary'),
    async (req, res) => {
      res.status(200).json({ success: true, summary: await getServices(req).finance.getPaymentSummary() });
    }
  ));

  router.get('/payments/all', requireAdmin, handle(
    financeErrors('Error loading admin payments', 'Error loading admin payments'),
    async (req, res) => financePage(res, 'payments', await getServices(req).finance.listPayments(listInput(req)))
  ));

  // ── Commissions ──
  router.get('/commissions/summary', requireAdmin, handle(
    financeErrors('Error loading admin commissions summary', 'Error loading commission metrics'),
    async (req, res) => {
      res.status(200).json({ success: true, summary: await getServices(req).finance.getCommissionSummary() });
    }
  ));

  router.get('/commissions/all', requireAdmin, handle(
    financeErrors('Error loading admin commissions', 'Error loading commission records'),
    async (req, res) => financePage(res, 'commissions', await getServices(req).finance.listCommissions(listInput(req)))
  ));

  // ── Settlements (read-only) ──
  // Settlement mutations (approve / second-approve / reject / hold / process / retry) live in
  // routes/financialOperations.js, mounted at /api/admin/settlements, where they are guarded by
  // granular permissions, idempotency keys, rate limits and the settlement state machine.
  router.get('/settlements', requireAdmin, handle(
    financeErrors('Error loading admin settlements', 'Error loading admin settlements'),
    async (req, res) => {
      const result = await getServices(req).finance.listSettlements(listInput(req));
      financePage(res, 'settlements', result, { summary: result.summary });
    }
  ));

  return router;
}

module.exports = createAdminRouter();
module.exports.createAdminRouter = createAdminRouter;
