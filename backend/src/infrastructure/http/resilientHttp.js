/**
 * Resilient outbound HTTP for third-party dependencies (payment gateways, AI providers).
 *
 * - Every call has a hard timeout (axios' default is "wait forever").
 * - A per-dependency circuit breaker (State pattern: CLOSED -> OPEN -> HALF_OPEN) fails fast while
 *   the dependency is down, so a slow gateway cannot exhaust our connection pool / event loop.
 * - Only idempotent requests (GET) are retried automatically; non-idempotent POSTs are not retried
 *   here because the gateway may have applied them (callers use idempotency keys/order ids).
 */
const axios = require('axios');
const { CIRCUIT_BREAKER, PAYMENTS } = require('../../core/constants');
const { UpstreamError } = require('../../core/errors');

const BREAKER_STATE = Object.freeze({ CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' });

class CircuitBreaker {
  constructor(name, { failureThreshold = CIRCUIT_BREAKER.FAILURE_THRESHOLD, resetTimeoutMs = CIRCUIT_BREAKER.RESET_TIMEOUT_MS, now = () => Date.now() } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.now = now;
    this.state = BREAKER_STATE.CLOSED;
    this.failures = 0;
    this.openedAt = 0;
  }

  canRequest() {
    if (this.state === BREAKER_STATE.OPEN && this.now() - this.openedAt >= this.resetTimeoutMs) {
      this.state = BREAKER_STATE.HALF_OPEN; // allow one trial request
    }
    return this.state !== BREAKER_STATE.OPEN;
  }

  onSuccess() {
    this.failures = 0;
    this.state = BREAKER_STATE.CLOSED;
  }

  onFailure() {
    this.failures += 1;
    if (this.state === BREAKER_STATE.HALF_OPEN || this.failures >= this.failureThreshold) {
      this.state = BREAKER_STATE.OPEN;
      this.openedAt = this.now();
    }
  }

  async execute(operation) {
    if (!this.canRequest()) {
      throw new UpstreamError(`${this.name} is temporarily unavailable (circuit open)`, 'CIRCUIT_OPEN');
    }
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (err) {
      // 4xx responses mean the dependency is healthy and rejected our input: don't trip the breaker.
      const status = err && err.response && err.response.status;
      if (!status || status >= 500 || status === 429) this.onFailure();
      throw err;
    }
  }

  snapshot() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

const breakers = new Map();
function getBreaker(name) {
  if (!breakers.has(name)) breakers.set(name, new CircuitBreaker(name));
  return breakers.get(name);
}

function breakerSnapshots() {
  return [...breakers.values()].map((breaker) => breaker.snapshot());
}

/**
 * Creates an axios-like client bound to one dependency's breaker and timeout.
 * @param {string} name dependency name used for the breaker
 */
function createResilientClient(name, { timeoutMs = PAYMENTS.GATEWAY_TIMEOUT_MS, getRetries = 1 } = {}) {
  const instance = axios.create({ timeout: timeoutMs });
  const breaker = getBreaker(name);

  async function request(config) {
    const method = String(config.method || 'get').toLowerCase();
    const retries = method === 'get' ? getRetries : 0;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await breaker.execute(() => instance.request(config));
      } catch (err) {
        lastError = err;
        const status = err && err.response && err.response.status;
        const retryable = !status || status >= 500;
        if (!retryable || attempt === retries || (err && err.code === 'CIRCUIT_OPEN')) break;
      }
    }
    throw lastError;
  }

  return {
    breaker,
    request,
    get: (url, config = {}) => request({ ...config, method: 'get', url }),
    post: (url, data, config = {}) => request({ ...config, method: 'post', url, data }),
  };
}

module.exports = { CircuitBreaker, BREAKER_STATE, createResilientClient, getBreaker, breakerSnapshots };
