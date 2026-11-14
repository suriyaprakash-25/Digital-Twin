/**
 * Admin console services, composed from injected repositories (Dependency Inversion): callers pass
 * `createRepositories(db)` in production and fake repositories in unit tests. Nothing in this
 * folder calls getDb().
 */
const { createAdminUserService } = require('./adminUserService');
const { createAdminGarageService, GARAGE_MODERATION_ACTIONS } = require('./adminGarageService');
const { createAdminDashboardService } = require('./adminDashboardService');
const { createAdminFinanceService } = require('./adminFinanceService');

/**
 * @param {ReturnType<import('../../repositories').createRepositories>} repos
 * @param {{ now?: () => Date }} [options]
 */
function createAdminServices(repos, options = {}) {
  if (!repos) throw new Error('createAdminServices requires repositories');
  return {
    users: createAdminUserService(repos),
    garages: createAdminGarageService(repos, options),
    dashboard: createAdminDashboardService(repos),
    finance: createAdminFinanceService(repos, options),
  };
}

module.exports = {
  createAdminServices,
  createAdminUserService,
  createAdminGarageService,
  createAdminDashboardService,
  createAdminFinanceService,
  GARAGE_MODERATION_ACTIONS,
};
