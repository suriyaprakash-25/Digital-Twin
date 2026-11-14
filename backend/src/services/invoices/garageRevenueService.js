/**
 * Garage revenue read models: payment list, revenue KPIs and the daily revenue trend.
 * Every figure is an aggregation inside MongoDB summed in integer paise; nothing loads the
 * garage's whole payment or service history into memory.
 */
const { parsePagination } = require('../../core/pagination');
const { LISTING, ANALYTICS_PERIOD_DAYS, DEFAULT_ANALYTICS_DAYS, REPORTING } = require('./constants');
const { toGaragePaymentRow, toRevenueSummary, toTrend } = require('./invoicePresenters');
const { startOfBusinessDay, startOfBusinessMonth, businessDaysAgo } = require('./reportingCalendar');

const DEFAULT_PERIOD = '7days';

/**
 * @param {{ repos: object, resolveGarageIds: Function, now?: () => Date }} deps
 */
function createGarageRevenueService({ repos, resolveGarageIds, now = () => new Date() }) {
  /** Payments belong to a garage through one of its services or one of its ids. */
  async function paymentScope(user) {
    const [serviceIds, garageIds] = await Promise.all([
      repos.serviceRecords.findIdsForGarage(String(user.id)),
      resolveGarageIds(String(user.id)),
    ]);
    return { serviceIds, garageIds };
  }

  async function listPayments(user, query = {}) {
    const page = parsePagination(query, { defaultLimit: LISTING.PAYMENTS_DEFAULT_LIMIT, maxLimit: LISTING.PAYMENTS_MAX_LIMIT });
    const { items, total } = await repos.payments.findPageForGarage(await paymentScope(user), page);
    return { body: { success: true, payments: items.map(toGaragePaymentRow) }, pagination: { total, page: page.page, limit: page.limit } };
  }

  async function getRevenueSummary(user) {
    const at = now();
    const todayStart = startOfBusinessDay(at);
    const monthStart = startOfBusinessMonth(at);
    const [kpis, billing] = await Promise.all([
      paymentScope(user).then((scope) => repos.payments.getGarageRevenueKpis(scope, { todayStart, monthStart })),
      repos.serviceRecords.garageBillingKpis(String(user.id)),
    ]);
    return toRevenueSummary(kpis, billing);
  }

  async function getPaymentAnalytics(user, query = {}) {
    const period = typeof query.period === 'string' && query.period ? query.period : DEFAULT_PERIOD;
    const days = ANALYTICS_PERIOD_DAYS[period] || DEFAULT_ANALYTICS_DAYS;
    const startDate = businessDaysAgo(now(), days);
    const rows = await repos.payments.dailyTrendForGarage(await paymentScope(user), startDate, REPORTING.TIMEZONE);
    return { period, trends: toTrend(rows, startDate, days) };
  }

  return { listPayments, getRevenueSummary, getPaymentAnalytics };
}

module.exports = { createGarageRevenueService };
