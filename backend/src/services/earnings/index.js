/**
 * Composition root for the garage earnings module (routes/earnings.js): wires repositories, the
 * garage id resolver, eligibility, the settlement-number sequence, notifications and the audit log.
 * This is the only place in the module that knows about the live database connection.
 */
const { getDb } = require('../../db');
const { createRepositories } = require('../../repositories');
const { resolveGarageIds } = require('../../utils/garageResolver');
const { generateSettlementNumber } = require('../../utils/settlementNumber');
const { checkSettlementEligibility } = require('../settlementEligibilityService');
const { getGarageSettlementForecast } = require('../settlementForecastService');
const { HIGH_VALUE_THRESHOLD_RUPEES } = require('../settlementGovernanceService');
const { notifyUser } = require('../notifications');
const { logFinancialAudit } = require('../auditService');
const { createEarningsQueryService } = require('./earningsQueryService');
const { createSettlementRequestService } = require('./settlementRequestService');
const { createPayoutProfileService } = require('./payoutProfileService');

const cache = new WeakMap();

function buildEarningsModule(db) {
  const deps = { repos: createRepositories(db), resolveGarageIds: (userId) => resolveGarageIds(userId, db) };
  return {
    queries: createEarningsQueryService({ ...deps, forecast: (userId) => getGarageSettlementForecast(userId, db) }),
    settlements: createSettlementRequestService({
      ...deps,
      checkEligibility: (userId, amount) => checkSettlementEligibility(userId, amount, db),
      nextSettlementNumber: () => generateSettlementNumber(db),
      notifyUser,
      logAudit: (entry) => logFinancialAudit({ ...entry, dbInstance: db }),
      highValueThresholdRupees: HIGH_VALUE_THRESHOLD_RUPEES,
    }),
    payoutProfile: createPayoutProfileService(deps),
  };
}

/** Services bound to the connected database (memoised per Db instance). */
function getEarningsModule(db = getDb()) {
  if (!cache.has(db)) cache.set(db, buildEarningsModule(db));
  return cache.get(db);
}

module.exports = { getEarningsModule, buildEarningsModule };
