const { PAGINATION } = require('./constants');

/**
 * Parses `?page=&limit=` into a bounded { page, limit, skip }.
 * Pagination is metadata-in-headers (X-Total-Count, X-Page, X-Limit, Link-less) so existing
 * array-shaped responses stay backward compatible while no endpoint can return unbounded data.
 */
function parsePagination(query = {}, { defaultLimit = PAGINATION.DEFAULT_LIMIT, maxLimit = PAGINATION.MAX_LIMIT } = {}) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

function setPaginationHeaders(res, { total, page, limit }) {
  res.set('X-Total-Count', String(total));
  res.set('X-Page', String(page));
  res.set('X-Limit', String(limit));
  res.set('X-Total-Pages', String(Math.max(1, Math.ceil(total / limit))));
  res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Limit, X-Total-Pages, X-Request-ID');
}

/**
 * Runs a paged find + count in parallel on a collection.
 * @returns {Promise<{ items: any[], total: number, page: number, limit: number }>}
 */
async function findPage(collection, filter, { page, limit, skip }, { sort = { createdAt: -1 }, projection } = {}) {
  const cursor = collection.find(filter, projection ? { projection } : undefined).sort(sort).skip(skip).limit(limit);
  const [items, total] = await Promise.all([cursor.toArray(), collection.countDocuments(filter)]);
  return { items, total, page, limit };
}

module.exports = { parsePagination, setPaginationHeaders, findPage };
