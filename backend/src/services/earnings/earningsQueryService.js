/**
 * Garage-facing ledger reads: earnings summary, forecast, earnings list/detail, settlement
 * list/detail. Ownership is always checked against every id alias of the garage (user id and
 * garage _id), so settlements created by the scheduler under the garage _id stay visible to it.
 */
const { NotFoundError, ForbiddenError } = require('../../core/errors');
const { parsePagination } = require('../../core/pagination');
const { safeSearchRegex } = require('../../core/text');
const { LISTING, ALL_STATUSES, MSG } = require('./constants');
const { toEarningsSummary, toEarningRow, toSettlementRow, toSettlementDetail, toPagedBody } = require('./earningsPresenters');

const statusFilter = (status) => (status && status !== ALL_STATUSES ? String(status) : null);

/**
 * @param {{ repos: object, resolveGarageIds: Function, forecast: (userId: string) => Promise<object> }} deps
 */
function createEarningsQueryService({ repos, resolveGarageIds, forecast }) {
  const garageIdsOf = (user) => resolveGarageIds(String(user.id));

  async function assertOwns(user, garageId) {
    if (user.role === 'ADMIN') return;
    const ids = await garageIdsOf(user);
    if (!ids.includes(String(garageId))) throw new ForbiddenError(MSG.FORBIDDEN);
  }

  async function getSummary(user) {
    return toEarningsSummary(await repos.earnings.getGarageSummaryKpis(await garageIdsOf(user)));
  }

  function getForecast(user) {
    return forecast(String(user.id));
  }

  async function listEarnings(user, query = {}) {
    const page = parsePagination(query, { defaultLimit: LISTING.EARNINGS_DEFAULT_LIMIT, maxLimit: LISTING.EARNINGS_MAX_LIMIT });
    const { items, total } = await repos.earnings.findPageForGarage(
      await garageIdsOf(user),
      { status: statusFilter(query.status), searchRegex: safeSearchRegex(query.search) },
      page,
    );
    return { body: toPagedBody('earnings', items.map(toEarningRow), total, page), pagination: { total, page: page.page, limit: page.limit } };
  }

  async function getEarning(user, ref) {
    const earning = await repos.earnings.findByReference(ref);
    if (!earning) throw new NotFoundError(MSG.EARNING_NOT_FOUND);
    await assertOwns(user, earning.garageId);
    return { id: String(earning._id), ...earning };
  }

  async function listSettlements(user, query = {}) {
    const page = parsePagination(query, { defaultLimit: LISTING.SETTLEMENTS_DEFAULT_LIMIT, maxLimit: LISTING.SETTLEMENTS_MAX_LIMIT });
    const { items, total } = await repos.settlements.findPageForGarage(await garageIdsOf(user), { status: statusFilter(query.status) }, page);
    return { body: toPagedBody('settlements', items.map(toSettlementRow), total, page), pagination: { total, page: page.page, limit: page.limit } };
  }

  async function getSettlement(user, ref) {
    const settlement = await repos.settlements.findByReference(ref);
    if (!settlement) throw new NotFoundError(MSG.SETTLEMENT_NOT_FOUND);
    await assertOwns(user, settlement.garageId);
    const included = await repos.earnings.findByIds(settlement.earningsIds || []);
    return toSettlementDetail(settlement, included);
  }

  return { getSummary, getForecast, listEarnings, getEarning, listSettlements, getSettlement };
}

module.exports = { createEarningsQueryService };
