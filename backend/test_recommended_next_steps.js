const assert = require('assert');

console.log('🧪 Starting Recommended Next Steps Verification Suite...\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ❌ ${name}\n     ${err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n     ') : err}`);
  }
}

// ============================================================================
// 1. Repository Migration Verification: settlementEligibilityService & settlementForecastService
// ============================================================================
async function testRepositoryMigration() {
  console.log('— Test Category 1: Repository Migration (Settlement & Earnings Services) —');

  const fs = require('fs');
  const path = require('path');

  const eligPath = path.join(__dirname, 'src/services/settlementEligibilityService.js');
  const forecastPath = path.join(__dirname, 'src/services/settlementForecastService.js');

  await test('Static Analysis: settlementEligibilityService contains zero direct db.collection() calls', () => {
    const content = fs.readFileSync(eligPath, 'utf8');
    assert.strictEqual(
      /db\.collection\(/.test(content),
      false,
      'settlementEligibilityService.js must not contain direct db.collection calls'
    );
  });

  await test('Static Analysis: settlementForecastService contains zero direct db.collection() calls', () => {
    const content = fs.readFileSync(forecastPath, 'utf8');
    assert.strictEqual(
      /db\.collection\(/.test(content),
      false,
      'settlementForecastService.js must not contain direct db.collection calls'
    );
  });

  await test('Dynamic Unit: checkSettlementEligibility routes exclusively through injected repositories', async () => {
    const { checkSettlementEligibility, ELIGIBILITY_REASON } = require('./src/services/settlementEligibilityService');

    const calls = [];
    const mockRepos = {
      garages: {
        findById: async (id) => { calls.push(['garages.findById', id]); return { _id: id, name: 'Test Garage', isActive: true, isSuspended: false }; },
        db: {
          collection: () => ({
            find: () => ({ toArray: async () => [] }),
            findOne: async () => null
          })
        }
      },
      users: {
        findById: async (id) => { calls.push(['users.findById', id]); return null; }
      },
      payoutProfiles: {
        findForGarage: async (ids) => { calls.push(['payoutProfiles.findForGarage', ids]); return { bankAccountLast4: '1234', isVerified: true, status: 'ACTIVE' }; }
      },
      settlements: {
        findActiveHold: async (ids) => { calls.push(['settlements.findActiveHold', ids]); return null; },
        findActiveSettlement: async (ids, statuses) => { calls.push(['settlements.findActiveSettlement', ids, statuses]); return null; }
      },
      earnings: {
        findAvailableForGarage: async (ids) => {
          calls.push(['earnings.findAvailableForGarage', ids]);
          return [{ netAfterRefundPaise: 100000 }]; // ₹1,000 in paise
        }
      }
    };

    const result = await checkSettlementEligibility('g1', 600, null, mockRepos);
    assert.strictEqual(result.eligible, true);
    assert.strictEqual(result.availableRupees, 1000);
    assert.strictEqual(result.requestedRupees, 600);

    const calledMethods = calls.map(c => c[0]);
    assert.ok(calledMethods.includes('garages.findById'));
    assert.ok(calledMethods.includes('payoutProfiles.findForGarage'));
    assert.ok(calledMethods.includes('settlements.findActiveHold'));
    assert.ok(calledMethods.includes('settlements.findActiveSettlement'));
    assert.ok(calledMethods.includes('earnings.findAvailableForGarage'));
  });

  await test('Dynamic Unit: getTreasuryForecast routes exclusively through injected repositories', async () => {
    const { getTreasuryForecast } = require('./src/services/settlementForecastService');

    const calls = [];
    const mockRepos = {
      earnings: {
        findAllAvailable: async () => {
          calls.push(['earnings.findAllAvailable']);
          return [{ netAfterRefundPaise: 500000 }]; // ₹5,000
        }
      },
      settlements: {
        findPending: async (group) => {
          calls.push(['settlements.findPending', group]);
          return [{ status: 'PROCESSING', approvedPaise: 200000 }]; // ₹2,000
        },
        findAllActiveHolds: async () => {
          calls.push(['settlements.findAllActiveHolds']);
          return [];
        },
        findSettledSince: async (since) => {
          calls.push(['settlements.findSettledSince', since]);
          return [{ status: 'SETTLED', approvedPaise: 300000 }]; // ₹3,000
        },
        count: async (query) => {
          calls.push(['settlements.count', query]);
          return 5;
        }
      }
    };

    const forecast = await getTreasuryForecast(null, mockRepos);
    assert.strictEqual(forecast.currentAvailableBalance, 5000);
    assert.strictEqual(forecast.processingAmount, 2000);
    assert.strictEqual(forecast.pendingSettlementAmount, 2000);

    const calledMethods = calls.map(c => c[0]);
    assert.ok(calledMethods.includes('earnings.findAllAvailable'));
    assert.ok(calledMethods.includes('settlements.findPending'));
    assert.ok(calledMethods.includes('settlements.findSettledSince'));
  });
}

// ============================================================================
// 2. Pagination Verification: X-Total-Count header pattern & Vehicle Service Records
// ============================================================================
async function testPagination() {
  console.log('\n— Test Category 2: Cursor & Bounded Pagination (Vehicle Service Records) —');

  const { parsePagination, setPaginationHeaders } = require('./src/core/pagination');
  const { createServiceRecordService } = require('./src/services/serviceRecords/serviceRecordService');

  await test('Pagination Core: parsePagination bounds page and limit against abuse', () => {
    assert.deepStrictEqual(parsePagination({}), { page: 1, limit: 50, skip: 0 });
    assert.deepStrictEqual(parsePagination({ page: '2', limit: '25' }), { page: 2, limit: 25, skip: 25 });
    assert.strictEqual(parsePagination({ limit: '999999' }).limit, 200, 'Clamped to max limit');
    assert.strictEqual(parsePagination({ page: '-5', limit: 'invalid' }).page, 1);
  });

  await test('Pagination Headers: setPaginationHeaders exposes X-Total-Count, X-Page, X-Limit, X-Total-Pages', () => {
    const headers = {};
    const mockRes = {
      set(key, val) { headers[key] = val; }
    };

    setPaginationHeaders(mockRes, { total: 135, page: 2, limit: 50 });
    assert.strictEqual(headers['X-Total-Count'], '135');
    assert.strictEqual(headers['X-Page'], '2');
    assert.strictEqual(headers['X-Limit'], '50');
    assert.strictEqual(headers['X-Total-Pages'], '3');
    assert.ok(headers['Access-Control-Expose-Headers'].includes('X-Total-Count'));
  });

  await test('Vehicle Service Records: getVehicleHistory applies bounded pagination and returns metadata', async () => {
    const vehicleId = '507f1f77bcf86cd799439011';
    const mockVehicle = { _id: vehicleId, ownerId: 'user1', currentOdometerKm: 15000 };

    const sampleRecords = Array.from({ length: 45 }, (_, i) => ({
      _id: `rec_${i}`,
      vehicleId,
      serviceDate: '2026-11-01',
      serviceType: 'Oil Change',
      serviceCategory: 'Maintenance',
      odometerKm: 10000 + i * 100,
      verifiedService: true,
      totalCost: 1500
    }));

    const mockRepos = {
      vehicles: {
        findActiveById: async (id) => (id === vehicleId ? mockVehicle : null)
      },
      serviceRecords: {
        findHistoryForVehicle: async () => sampleRecords,
        findHistoryPageForVehicle: async (vId, { skip, limit }) => ({
          items: sampleRecords.slice(skip, skip + limit),
          total: sampleRecords.length
        })
      }
    };

    const accessPolicy = {
      canAccessVehicle: async () => true,
      isOwner: () => true
    };

    const svc = createServiceRecordService({ repos: mockRepos, accessPolicy });

    // Request page 2, limit 10
    const res = await svc.getVehicleHistory({ id: 'user1', role: 'USER' }, vehicleId, { page: '2', limit: '10' });
    assert.strictEqual(res.records.length, 10);
    assert.deepStrictEqual(res.pagination, { total: 45, page: 2, limit: 10 });
    assert.strictEqual(res.records[0].odometerKm, 11000); // 10th index record
  });
}

// ============================================================================
// 3. Horizontal Cache Provider: RedisCacheProvider implements CacheProvider
// ============================================================================
async function testRedisCacheProvider() {
  console.log('\n— Test Category 3: Horizontal Cache Provider (RedisCacheProvider) —');

  const {
    CacheProvider,
    MemoryCacheProvider,
    RedisCacheProvider,
    createCacheProvider,
    getCache,
    setCache
  } = require('./src/infrastructure/cache/cache');

  await test('Cache Contract: RedisCacheProvider extends CacheProvider interface', () => {
    const provider = new RedisCacheProvider();
    assert.ok(provider instanceof CacheProvider, 'Must inherit from CacheProvider');
    assert.strictEqual(typeof provider.get, 'function');
    assert.strictEqual(typeof provider.set, 'function');
    assert.strictEqual(typeof provider.delete, 'function');
    assert.strictEqual(typeof provider.invalidatePrefix, 'function');
    assert.strictEqual(typeof provider.clear, 'function');
    assert.strictEqual(typeof provider.wrap, 'function');
  });

  await test('RedisCacheProvider: get/set/delete and prefix invalidation with fake Redis client', async () => {
    const memoryBackend = new Map();
    const mockRedisClient = {
      async get(key) { return memoryBackend.get(key) || null; },
      async set(key, val, mode, ttl) { memoryBackend.set(key, val); },
      async del(...keys) {
        let count = 0;
        keys.forEach(k => { if (memoryBackend.delete(k)) count++; });
        return count;
      },
      async keys(pattern) {
        const prefix = pattern.replace(/\*$/, '');
        return [...memoryBackend.keys()].filter(k => k.startsWith(prefix));
      }
    };

    const cache = new RedisCacheProvider({ client: mockRedisClient, prefix: 'dp:test:' });

    // 1. Set and Get
    await cache.set('garage:123', { name: 'AutoCare', rating: 4.8 }, 60000);
    const retrieved = await cache.get('garage:123');
    assert.deepStrictEqual(retrieved, { name: 'AutoCare', rating: 4.8 });

    // 2. Read-Through Wrap
    let computeCount = 0;
    const computed = await cache.wrap('garage:123', 60000, async () => {
      computeCount++;
      return { name: 'Ignored' };
    });
    assert.strictEqual(computeCount, 0, 'Must return cached value without computing');
    assert.deepStrictEqual(computed, { name: 'AutoCare', rating: 4.8 });

    // 3. Prefix Invalidation
    await cache.set('garage:456', { name: 'SpeedyGarage' });
    await cache.set('user:999', { name: 'John' });

    await cache.invalidatePrefix('garage:');
    assert.strictEqual(await cache.get('garage:123'), undefined);
    assert.strictEqual(await cache.get('garage:456'), undefined);
    assert.deepStrictEqual(await cache.get('user:999'), { name: 'John' }, 'Unmatched prefix remains intact');

    // 4. Clear all
    await cache.clear();
    assert.strictEqual(await cache.get('user:999'), undefined);
  });

  await test('RedisCacheProvider: graceful fallback when Redis throws or fails', async () => {
    const faultyRedisClient = {
      async get() { throw new Error('Redis ECONNREFUSED'); },
      async set() { throw new Error('Redis ECONNREFUSED'); },
      async del() { throw new Error('Redis ECONNREFUSED'); },
      async keys() { throw new Error('Redis ECONNREFUSED'); }
    };

    const cache = new RedisCacheProvider({ client: faultyRedisClient });

    // Must not crash the app, must return undefined on get
    assert.strictEqual(await cache.get('key'), undefined);
    await assert.doesNotReject(cache.set('key', { val: 1 }));
    await assert.doesNotReject(cache.delete('key'));
    await assert.doesNotReject(cache.invalidatePrefix('pre'));

    const stats = cache.getStats();
    assert.strictEqual(stats.kind, 'redis');
    assert.ok(stats.errors > 0, 'Error counter increments on failures');
  });

  await test('createCacheProvider: factory instantiates requested provider type', () => {
    const mem = createCacheProvider('memory');
    assert.ok(mem instanceof MemoryCacheProvider);

    const redis = createCacheProvider('redis');
    assert.ok(redis instanceof RedisCacheProvider);
  });
}

// ============================================================================
// Runner
// ============================================================================
async function runAll() {
  await testRepositoryMigration();
  await testPagination();
  await testRedisCacheProvider();

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
