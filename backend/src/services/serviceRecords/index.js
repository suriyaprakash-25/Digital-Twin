/**
 * Composition root for the service-records module: wires repositories, the vehicle access policy
 * and the tax / invoice-number / audit / notification collaborators into the two services.
 * This is the only place in the module that knows about the live database connection.
 */
const { getDb, getMongoClient } = require('../../db');
const { createRepositories } = require('../../repositories');
const { canAccessVehicle, garageHasRelationship, isOwner } = require('../../security/vehicleAccess');
const { resolveGarageIds } = require('../../utils/garageResolver');
const { createTaxSnapshot } = require('../taxService');
const { generateInvoiceNumber } = require('../../utils/invoiceNumber');
const { logFinancialAudit } = require('../auditService');
const { notifyUser } = require('../notifications');
const { createServiceRecordService } = require('./serviceRecordService');
const { createServiceCompletionService } = require('./serviceCompletionService');

const cache = new WeakMap();

function buildServiceRecordModule(db, client) {
  const repos = createRepositories(db);
  return {
    records: createServiceRecordService({
      repos,
      accessPolicy: {
        canAccessVehicle: (user, vehicle) => canAccessVehicle(db, user, vehicle),
        garageHasRelationship: (garageUserId, vehicleId) => garageHasRelationship(db, garageUserId, vehicleId),
        isOwner,
      },
    }),
    completion: createServiceCompletionService({
      repos,
      client,
      resolveGarageIds: (userId) => resolveGarageIds(userId, db),
      createTaxSnapshot: (params) => createTaxSnapshot({ ...params, dbInstance: db }),
      nextInvoiceNumber: () => generateInvoiceNumber(db),
      logAudit: (entry) => logFinancialAudit({ ...entry, dbInstance: db }),
      notifyUser,
    }),
  };
}

/** Services bound to the connected database (memoised per Db instance). */
function getServiceRecordModule(db = getDb(), client = getMongoClient()) {
  if (!cache.has(db)) cache.set(db, buildServiceRecordModule(db, client));
  return cache.get(db);
}

module.exports = { getServiceRecordModule, buildServiceRecordModule };
