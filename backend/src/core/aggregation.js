/**
 * Builders for KPI aggregation pipelines (Extract Method).
 *
 * Admin summaries used to load whole collections into Node memory and loop over them. These
 * helpers express the same counts/sums as a single `$group` stage executed inside MongoDB, so the
 * cost no longer grows with collection size on the API server.
 */

/** Numeric value of a field that may be stored as string/number/null in legacy rows. */
function num(field) {
  return { $convert: { input: field, to: 'double', onError: 0, onNull: 0 } };
}

/** Accumulator: number of documents where `condition` (an aggregation expression) is true. */
function countWhere(condition) {
  return { $sum: { $cond: [condition, 1, 0] } };
}

/** Accumulator: sum of `field` over documents where `condition` is true. */
function sumWhere(condition, field) {
  return { $sum: { $cond: [condition, num(field), 0] } };
}

const inList = (field, values) => ({ $in: [field, values] });
const equals = (field, value) => ({ $eq: [field, value] });

/**
 * Runs a single-group KPI aggregation and returns the accumulated fields with zero defaults.
 * @param {import('mongodb').Collection} collection
 * @param {Record<string, object>} accumulators  e.g. { open: countWhere(equals('$status','OPEN')) }
 * @param {object} [match] optional $match filter applied first
 */
async function aggregateKpis(collection, accumulators, match) {
  const pipeline = [];
  if (match) pipeline.push({ $match: match });
  pipeline.push({ $group: { _id: null, total: { $sum: 1 }, ...accumulators } });
  const [row] = await collection.aggregate(pipeline).toArray();
  const result = { total: 0 };
  Object.keys(accumulators).forEach((key) => { result[key] = 0; });
  if (row) {
    Object.keys(result).forEach((key) => { result[key] = row[key] || 0; });
  }
  return result;
}

/** Count of documents per value of `field`, returned as a plain object. */
async function countBy(collection, field, match) {
  const pipeline = [];
  if (match) pipeline.push({ $match: match });
  pipeline.push({ $group: { _id: `$${field}`, count: { $sum: 1 } } });
  const rows = await collection.aggregate(pipeline).toArray();
  return Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
}

module.exports = { num, countWhere, sumWhere, inList, equals, aggregateKpis, countBy };
