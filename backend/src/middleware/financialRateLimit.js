/**
 * Backward-compatible exports for the financial limiters. The implementations now live in
 * infrastructure/rateLimit/rateLimiters.js and share a MongoDB-backed store across instances.
 */
const { limiters } = require('../infrastructure/rateLimit/rateLimiters');

module.exports = {
  paymentCreationLimiter: limiters.paymentCreation,
  refundLimiter: limiters.refund,
  disputeLimiter: limiters.dispute,
  settlementLimiter: limiters.settlement,
  financialMutationLimiter: limiters.financialMutation,
};
