/**
 * Read side of payment disputes: role-scoped lists, the detail view with its timeline, and the
 * admin KPI summary (a single aggregation, core/aggregation).
 */
const { ForbiddenError, NotFoundError } = require('../../core/errors');
const { parsePagination } = require('../../core/pagination');
const { safeSearchRegex, asString } = require('../../core/text');
const { countWhere, inList, equals, num } = require('../../core/aggregation');
const { DISPUTE_STATUS, IN_REVIEW_STATUSES, REFUND_CATEGORIES, LIST, ACTOR_ROLES, MSG } = require('./constants');
const { toUserListItem, toGarageListItem, toAdminListItem, toListBody, toDetailBody } = require('./presenters');

/** Optional exact-match filter; 'ALL' or empty means no filter. */
function optionalEquals(value) {
  const text = asString(value);
  return text && text !== LIST.ALL ? text : null;
}

/** Builds the Mongo filter for a list from the scope filter and ?status/?category/?search. */
function buildListFilter(scope, query = {}, searchFields, { withCategory = false } = {}) {
  const filter = { ...scope };
  const status = optionalEquals(query.status);
  if (status) filter.status = status;
  const category = withCategory ? optionalEquals(query.category) : null;
  if (category) filter.category = category;
  const regex = safeSearchRegex(query.search);
  if (regex) filter.$or = searchFields.map((field) => ({ [field]: regex }));
  return filter;
}

const parseListPage = (query) => parsePagination(query, { defaultLimit: LIST.DEFAULT_LIMIT, maxLimit: LIST.MAX_LIMIT });

function createDisputeQueryService({ repos }) {
  const { disputes, disputeEvents, garages } = repos;

  async function list(scope, query, searchFields, present, options) {
    const page = parseListPage(query);
    const result = await disputes.findPage(buildListFilter(scope, query, searchFields, options), page);
    return { body: toListBody(result.items, present, result), pagination: { total: result.total, page: page.page, limit: page.limit } };
  }

  const listForUser = (userId, query) => list({ userId: String(userId) }, query, LIST.SEARCH_FIELDS.USER, toUserListItem);

  /** Disputes reference the garage document id (current payments) or the owner's user id (legacy). */
  async function listForGarage(userId, query) {
    const garageIds = await garages.findIdsByOwner(userId);
    return list({ garageId: { $in: garageIds } }, query, LIST.SEARCH_FIELDS.GARAGE, toGarageListItem);
  }

  const listForAdmin = (query) => list({}, query, LIST.SEARCH_FIELDS.ADMIN, toAdminListItem, { withCategory: true });

  async function requireDispute(idOrNumber, notFoundMessage) {
    const dispute = await disputes.findByIdOrNumber(idOrNumber);
    if (!dispute) throw new NotFoundError(notFoundMessage);
    return dispute;
  }

  /** True when `user` is the garage the dispute is about. */
  async function isDisputeGarage(user, dispute) {
    if (user.role !== ACTOR_ROLES.GARAGE || !dispute.garageId) return false;
    return (await garages.findIdsByOwner(user.id)).includes(String(dispute.garageId));
  }

  /** The raising customer, the garage concerned, or an admin. */
  async function assertParticipant(user, dispute) {
    if (user.role === ACTOR_ROLES.ADMIN || String(dispute.userId) === String(user.id)) return;
    if (await isDisputeGarage(user, dispute)) return;
    throw new ForbiddenError(MSG.FORBIDDEN);
  }

  async function detail(dispute) {
    return toDetailBody(dispute, await disputeEvents.listForDispute(dispute._id));
  }

  async function getForParticipant(user, idOrNumber) {
    const dispute = await requireDispute(idOrNumber, MSG.DISPUTE_RECORD_NOT_FOUND);
    await assertParticipant(user, dispute);
    return detail(dispute);
  }

  async function getForAdmin(idOrNumber) {
    return detail(await requireDispute(idOrNumber, MSG.DISPUTE_NOT_FOUND));
  }

  async function summary() {
    const k = await disputes.kpis({
      open: countWhere(equals('$status', DISPUTE_STATUS.OPEN)),
      underReview: countWhere(inList('$status', IN_REVIEW_STATUSES)),
      resolved: countWhere(equals('$status', DISPUTE_STATUS.RESOLVED)),
      rejected: countWhere(equals('$status', DISPUTE_STATUS.REJECTED)),
      refundDisputes: countWhere(inList('$category', REFUND_CATEGORIES)),
      totalDisputedVolume: { $sum: num('$disputedAmount') },
    });
    return {
      totalDisputes: k.total,
      open: k.open,
      underReview: k.underReview,
      resolved: k.resolved,
      rejected: k.rejected,
      refundDisputes: k.refundDisputes,
      totalDisputedVolume: k.totalDisputedVolume,
    };
  }

  return { listForUser, listForGarage, listForAdmin, getForParticipant, getForAdmin, summary, isDisputeGarage, requireDispute };
}

module.exports = { createDisputeQueryService, buildListFilter };
