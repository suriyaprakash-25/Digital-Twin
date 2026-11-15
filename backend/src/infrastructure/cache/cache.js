/**
 * Cache abstraction (Strategy + Interface Segregation). Values must be plain, structured-cloneable
 * data (no class instances such as ObjectId) so any provider can serialise them.
 *
 * `CacheProvider` is the contract every backend honours. `MemoryCacheProvider` is an LRU+TTL
 * cache used by default; a Redis-backed provider can be added by implementing the same five
 * methods and registering it in `createCacheProvider` (Open/Closed) — no call site changes.
 *
 * Per-instance memory caching is only used for data where a short staleness window is acceptable
 * (public garage listings, knowledge base). Writes call `invalidatePrefix` so the writing instance
 * is immediately consistent; other instances converge within the TTL.
 */
const { CACHE } = require('../../core/constants');

class CacheProvider {
  async get(_key) { throw new Error('not implemented'); }
  async set(_key, _value, _ttlMs) { throw new Error('not implemented'); }
  async delete(_key) { throw new Error('not implemented'); }
  async invalidatePrefix(_prefix) { throw new Error('not implemented'); }
  async clear() { throw new Error('not implemented'); }

  /** Read-through helper: returns the cached value or computes, stores and returns it. */
  async wrap(key, ttlMs, compute) {
    const hit = await this.get(key);
    if (hit !== undefined) return hit;
    const value = await compute();
    if (value !== undefined) await this.set(key, value, ttlMs);
    return value;
  }
}

class MemoryCacheProvider extends CacheProvider {
  constructor({ maxEntries = CACHE.MAX_ENTRIES, defaultTtlMs = CACHE.DEFAULT_TTL_MS, now = () => Date.now() } = {}) {
    super();
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.now = now;
    this.store = new Map(); // insertion order == LRU order
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) { this.stats.misses += 1; return undefined; }
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      this.stats.misses += 1;
      return undefined;
    }
    // refresh LRU position
    this.store.delete(key);
    this.store.set(key, entry);
    this.stats.hits += 1;
    return structuredClone(entry.value);
  }

  async set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value: structuredClone(value), expiresAt: this.now() + ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
      this.stats.evictions += 1;
    }
  }

  async delete(key) { this.store.delete(key); }

  async invalidatePrefix(prefix) {
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  async clear() { this.store.clear(); }

  getStats() { return { ...this.stats, size: this.store.size, kind: 'memory' }; }
}

class RedisCacheProvider extends CacheProvider {
  /**
   * @param {{ client?: any, redisUrl?: string, prefix?: string, defaultTtlMs?: number }} [options]
   */
  constructor({ client, redisUrl = process.env.REDIS_URL, prefix = 'dp:cache:', defaultTtlMs = CACHE.DEFAULT_TTL_MS } = {}) {
    super();
    this.prefix = prefix;
    this.defaultTtlMs = defaultTtlMs;
    this.client = client || null;
    this.redisUrl = redisUrl;
    this.stats = { hits: 0, misses: 0, errors: 0 };
    if (!this.client && (redisUrl || process.env.REDIS_URL)) {
      this._initClient(redisUrl || process.env.REDIS_URL);
    }
  }

  _initClient(url) {
    try {
      const Redis = require('ioredis');
      this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    } catch {
      try {
        const { createClient } = require('redis');
        this.client = createClient({ url });
        if (typeof this.client.connect === 'function') {
          this.client.connect().catch(() => {});
        }
      } catch {
        // Driver not available or failed initialization; client remains null and falls back safely
      }
    }
  }

  _key(key) {
    return `${this.prefix}${key}`;
  }

  async get(key) {
    if (!this.client) {
      this.stats.misses += 1;
      return undefined;
    }
    try {
      const raw = await this.client.get(this._key(key));
      if (!raw) {
        this.stats.misses += 1;
        return undefined;
      }
      this.stats.hits += 1;
      return JSON.parse(raw);
    } catch (err) {
      this.stats.errors += 1;
      return undefined;
    }
  }

  async set(key, value, ttlMs = this.defaultTtlMs) {
    if (!this.client) return;
    try {
      const serialized = JSON.stringify(value);
      const k = this._key(key);
      if (typeof this.client.set === 'function') {
        if (ttlMs) {
          // Standard ioredis / node-redis PX option
          await this.client.set(k, serialized, 'PX', ttlMs);
        } else {
          await this.client.set(k, serialized);
        }
      }
    } catch (err) {
      this.stats.errors += 1;
    }
  }

  async delete(key) {
    if (!this.client) return;
    try {
      await this.client.del(this._key(key));
    } catch (err) {
      this.stats.errors += 1;
    }
  }

  async invalidatePrefix(prefix) {
    if (!this.client) return;
    try {
      const pattern = `${this._key(prefix)}*`;
      let keys = [];
      if (typeof this.client.scanStream === 'function') {
        const stream = this.client.scanStream({ match: pattern, count: 100 });
        for await (const chunk of stream) {
          if (chunk && chunk.length) keys.push(...chunk);
        }
      } else if (typeof this.client.keys === 'function') {
        keys = await this.client.keys(pattern);
      }
      if (keys.length && typeof this.client.del === 'function') {
        await this.client.del(...keys);
      }
    } catch (err) {
      this.stats.errors += 1;
    }
  }

  async clear() {
    return this.invalidatePrefix('');
  }

  getStats() {
    return { ...this.stats, kind: 'redis' };
  }
}

/**
 * Express middleware: after any successful non-GET request on the mounted router, drop the given
 * cache prefixes so the writing instance immediately serves fresh data.
 */
function invalidateCacheOnWrite(...prefixes) {
  return function invalidateAfterWrite(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.on('finish', () => {
        if (res.statusCode < 400) prefixes.forEach((prefix) => getCache().invalidatePrefix(prefix));
      });
    }
    next();
  };
}

function createCacheProvider(kind = process.env.CACHE_PROVIDER || 'memory', options = {}) {
  switch (String(kind).toLowerCase()) {
    case 'redis':
      return new RedisCacheProvider(options);
    case 'memory':
    default:
      return new MemoryCacheProvider(options);
  }
}

let sharedCache = null;
function getCache() {
  if (!sharedCache) sharedCache = createCacheProvider();
  return sharedCache;
}
/** Test seam (Dependency Inversion): swap the process-wide cache. */
function setCache(provider) { sharedCache = provider; }

const CACHE_KEYS = Object.freeze({
  GARAGE_LIST: 'garages:list:',
  GARAGE_DETAIL: 'garages:detail:',
  KNOWLEDGE_BASE: 'kb:',
});

module.exports = {
  CacheProvider,
  MemoryCacheProvider,
  RedisCacheProvider,
  createCacheProvider,
  getCache,
  setCache,
  invalidateCacheOnWrite,
  CACHE_KEYS,
};
