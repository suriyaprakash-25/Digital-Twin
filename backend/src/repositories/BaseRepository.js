/**
 * Repository pattern: the only layer that talks to MongoDB collections directly.
 *
 * Routes call services; services call repositories. Repositories are constructed with an injected
 * `db` (Dependency Inversion), so services can be unit-tested with a fake repository and never call
 * the global `getDb()` themselves.
 */
const { ObjectId } = require('mongodb');
const { PAGINATION } = require('../core/constants');

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  const str = String(id === undefined || id === null ? '' : id);
  return str.length === 24 && ObjectId.isValid(str) ? new ObjectId(str) : null;
}

/** Legacy rows stored ids as ObjectId, string _id, or a separate `id` field. */
function idFilter(id) {
  const objectId = toObjectId(id);
  const clauses = [{ _id: String(id) }, { id: String(id) }];
  if (objectId) clauses.unshift({ _id: objectId });
  return { $or: clauses };
}

/** Values to match a foreign-key field that may hold either a string or an ObjectId. */
function idValues(id) {
  if (id === undefined || id === null || id === '') return [];
  const objectId = toObjectId(id);
  return objectId ? [String(id), objectId] : [String(id)];
}

class BaseRepository {
  /**
   * @param {import('mongodb').Db} db
   * @param {string} collectionName
   */
  constructor(db, collectionName) {
    if (!db) throw new Error(`${this.constructor.name} requires a db instance`);
    this.db = db;
    this.collectionName = collectionName;
  }

  get collection() {
    return this.db.collection(this.collectionName);
  }

  findById(id, options = {}) {
    if (id === undefined || id === null || id === '') return Promise.resolve(null);
    return this.collection.findOne(idFilter(id), options);
  }

  findOne(filter, options = {}) {
    return this.collection.findOne(filter, options);
  }

  find(filter = {}, { sort, skip, limit, projection } = {}) {
    let cursor = this.collection.find(filter, projection ? { projection } : undefined);
    if (sort) cursor = cursor.sort(sort);
    if (skip) cursor = cursor.skip(skip);
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
  }

  /** Paged query; `page` comes from core/pagination.parsePagination. */
  async findPage(filter, page = { skip: 0, limit: PAGINATION.DEFAULT_LIMIT, page: 1 }, { sort = { createdAt: -1 }, projection } = {}) {
    const [items, total] = await Promise.all([
      this.find(filter, { sort, skip: page.skip, limit: page.limit, projection }),
      this.collection.countDocuments(filter),
    ]);
    return { items, total, page: page.page, limit: page.limit };
  }

  count(filter = {}) {
    return this.collection.countDocuments(filter);
  }

  aggregate(pipeline) {
    return this.collection.aggregate(pipeline).toArray();
  }

  insertOne(doc) {
    return this.collection.insertOne(doc);
  }

  updateOne(filter, update, options = {}) {
    return this.collection.updateOne(filter, update, options);
  }

  updateById(id, update, options = {}) {
    return this.collection.updateOne(idFilter(id), update, options);
  }

  deleteOne(filter) {
    return this.collection.deleteOne(filter);
  }
}

module.exports = { BaseRepository, toObjectId, idFilter, idValues };
