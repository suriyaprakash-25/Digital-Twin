/**
 * Composition root for the payment-dispute module: wires repositories, evidence storage, the
 * dispute-number generator, the gateway-neutral refund service, notifications and the admin audit
 * log into the query and command services. This is the only place in the module that knows about
 * the live database connection; tests call createDisputeServices with fakes.
 */
const { getDb } = require('../../db');
const { createRepositories } = require('../../repositories');
const { BaseRepository } = require('../../repositories/BaseRepository');
const persistentFileStorage = require('../persistentFileStorage');
const { generateDisputeNumber } = require('../../utils/disputeNumber');
const { initiateRefund: initiateGatewayRefund } = require('../payments/refundService');
const { notifyUser: defaultNotifyUser } = require('../notifications');
const { createDisputeQueryService } = require('./disputeQueryService');
const { createDisputeCommandService } = require('./disputeCommandService');

/**
 * @param {{ repos: object, storage?: object, nextDisputeNumber: Function, initiateRefund: Function,
 *           notifyUser?: Function, auditLog?: Function, now?: () => Date }} deps
 */
function createDisputeServices({ repos, storage = persistentFileStorage, nextDisputeNumber, initiateRefund, notifyUser = defaultNotifyUser, auditLog = async () => {}, now }) {
  const queries = createDisputeQueryService({ repos });
  const commands = createDisputeCommandService({ repos, queries, storage, nextDisputeNumber, initiateRefund, notifyUser, auditLog, now });
  return { queries, commands };
}

function buildDisputeModule(db) {
  const adminAuditLogs = new BaseRepository(db, 'admin_audit_logs');
  return createDisputeServices({
    repos: createRepositories(db),
    nextDisputeNumber: () => generateDisputeNumber(db),
    initiateRefund: (params) => initiateGatewayRefund({ ...params, db }),
    auditLog: (entry) => adminAuditLogs.insertOne(entry),
  });
}

const cache = new WeakMap();

/** Services bound to the connected database (memoised per Db instance). */
function getDisputeModule(db = getDb()) {
  if (!cache.has(db)) cache.set(db, buildDisputeModule(db));
  return cache.get(db);
}

module.exports = { createDisputeServices, getDisputeModule, buildDisputeModule };
