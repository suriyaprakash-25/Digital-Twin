/**
 * Legacy facade over services/disputes (same exported names and signatures as before).
 * New code should use services/disputes directly; `dbInstance` selects the database as before.
 */
const { getDisputeModule } = require('./disputes');

const moduleFor = (dbInstance) => (dbInstance ? getDisputeModule(dbInstance) : getDisputeModule());

/** Logs an append-only event to the dispute timeline. */
async function logDisputeEvent({ disputeId, actorId, actorRole, action, message, metadata = {}, dbInstance }) {
  return moduleFor(dbInstance).commands.logEvent({ disputeId, actorId, actorRole, action, message, metadata });
}

/** Creates a new payment dispute for a payment the user made (one active dispute per payment). */
async function createDispute({ userId, paymentId, category, subject, description, disputedAmount, evidence = [], dbInstance }) {
  return moduleFor(dbInstance).commands.create({
    userId,
    input: { paymentId, category, subject, description, disputedAmount },
    evidence,
  });
}

/** Resolves a dispute with administrative actions (including full/partial refunds). */
async function resolveDispute({ disputeId, adminId, resolution, resolutionNote, refundAmount, dbInstance }) {
  return moduleFor(dbInstance).commands.resolve({ disputeId, adminId, resolution, resolutionNote, refundAmount });
}

module.exports = {
  createDispute,
  logDisputeEvent,
  resolveDispute
};
