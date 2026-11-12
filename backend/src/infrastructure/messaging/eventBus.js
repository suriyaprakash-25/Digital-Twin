/**
 * Domain event bus (Observer pattern).
 *
 * Producers (payment capture, refunds, bookings) publish facts; subscribers react without the
 * producer knowing about them. Subscribers that do slow or failure-prone work (push, email) do not
 * run inline: they enqueue a durable job (see jobQueue.js), so a crashed instance never loses the
 * side effect and the HTTP request is never blocked on it.
 */
const { logger } = require('../../services/logger');

const DOMAIN_EVENTS = Object.freeze({
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_FAILED: 'payment.failed',
  REFUND_INITIATED: 'refund.initiated',
  REFUND_SETTLED: 'refund.settled',
});

class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  subscribe(eventName, handler) {
    if (!this.handlers.has(eventName)) this.handlers.set(eventName, new Set());
    this.handlers.get(eventName).add(handler);
    return () => this.handlers.get(eventName).delete(handler);
  }

  /**
   * Awaits all handlers but isolates their failures: one broken subscriber can never fail the
   * producer's business transaction.
   */
  async publish(eventName, payload) {
    const handlers = [...(this.handlers.get(eventName) || [])];
    const results = await Promise.allSettled(handlers.map((handler) => handler(payload)));
    results.forEach((result) => {
      if (result.status === 'rejected') {
        logger.error(`Event handler failed for ${eventName}`, { error: String(result.reason && result.reason.message || result.reason) });
      }
    });
    return results;
  }

  clear() { this.handlers.clear(); }
}

const eventBus = new EventBus();

module.exports = { EventBus, eventBus, DOMAIN_EVENTS };
