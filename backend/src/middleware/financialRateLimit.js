const rateLimit = require('express-rate-limit');

/**
 * Creates a rate limiter with standardized JSON error responses
 */
function createFinancialLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      return res.status(429).json({
        success: false,
        message: message || 'Too many financial requests. Please wait a few minutes before trying again.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }
  });
}

// 20 payment order creations per 15 mins
const paymentCreationLimiter = createFinancialLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Payment order creation limit exceeded. Please wait a few moments before trying again.'
});

// 15 refunds per 15 mins
const refundLimiter = createFinancialLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Refund request limit exceeded. Please try again later.'
});

// 10 dispute submissions per 15 mins
const disputeLimiter = createFinancialLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Dispute submission limit reached. Please wait before submitting additional disputes.'
});

// 10 settlement requests per 15 mins
const settlementLimiter = createFinancialLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Settlement request limit exceeded. Please wait before requesting another withdrawal.'
});

module.exports = {
  paymentCreationLimiter,
  refundLimiter,
  disputeLimiter,
  settlementLimiter
};
