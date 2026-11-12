/**
 * Payment gateway abstraction (Introduce Interface + Replace Conditional with Polymorphism).
 *
 * Before: routes and services called cashfreeService / razorpayService directly and branched on
 * id prefixes (`razorpayPaymentId.startsWith('pay_')`). After the Cashfree migration that branching
 * silently skipped the gateway for Cashfree payments: dispute refunds were recorded as "processed"
 * without money moving, and reconciliation never checked Cashfree at all.
 *
 * Now every consumer asks `resolveGatewayForPayment(payment)` for a `PaymentGateway` and calls the
 * same contract. Adding a provider = one new subclass + one registry entry (Open/Closed).
 */
const cashfree = require('../cashfreeService');
const { PAYMENTS } = require('../../core/constants');

const toPaise = (rupees) => Math.round((Number(rupees) || 0) * PAYMENTS.PAISE_PER_RUPEE);

/** @interface */
class PaymentGateway {
  get name() { throw new Error('not implemented'); }
  /** @returns {boolean} whether this gateway owns the given payment document */
  ownsPayment(_payment) { return false; }
  /** @returns {Promise<{ gatewayOrderId: string, sessionId: string|null, raw: object }>} */
  async createOrder(_params) { throw new Error(`${this.name}: createOrder not supported`); }
  /** @returns {Promise<{ verified: boolean, status: string, gatewayPaymentId: string|null, method: string, amountInRupees: number|null }>} */
  async verifyOrderPayment(_orderId) { throw new Error(`${this.name}: verifyOrderPayment not supported`); }
  /** @returns {Promise<{ refundId: string, gatewayRefundId: string|null, status: string, raw: object }>} */
  async refund(_params) { throw new Error(`${this.name}: refund not supported`); }
  /**
   * Normalised view used by reconciliation (amounts in paise, lowercase status).
   * @returns {Promise<{ amount: number, amount_refunded: number, status: string, currency: string }>}
   */
  async fetchPaymentSnapshot(_payment) { throw new Error(`${this.name}: fetchPaymentSnapshot not supported`); }
}

class CashfreeGateway extends PaymentGateway {
  constructor(client = cashfree) {
    super();
    this.client = client; // injectable for tests (Dependency Inversion)
  }

  get name() { return 'cashfree'; }

  ownsPayment(payment) {
    return Boolean(payment && (payment.cfOrderId || payment.cashfreeOrderId || payment.gateway === 'cashfree'));
  }

  async createOrder({ orderId, amountInRupees, customer, meta }) {
    const raw = await this.client.createCashfreeOrder({ orderId, amountInRupees, customer, meta });
    return { gatewayOrderId: raw.cf_order_id ? String(raw.cf_order_id) : orderId, sessionId: raw.payment_session_id || null, raw };
  }

  async verifyOrderPayment(orderId) {
    const result = await this.client.verifyCashfreePayment(orderId);
    return {
      verified: Boolean(result.verified),
      status: result.status,
      gatewayPaymentId: result.paymentId || null,
      method: result.method || 'ONLINE',
      amountInRupees: Number.isFinite(result.amountInRupees) ? result.amountInRupees : null,
    };
  }

  async refund({ payment, refundId, amountInRupees, reason }) {
    const raw = await this.client.createCashfreeRefund({
      cfOrderId: payment.cfOrderId || payment.cashfreeOrderId,
      refundId,
      amountInRupees,
      reason: String(reason || 'Refund').slice(0, PAYMENTS.REFUND_NOTE_MAX_LENGTH),
    });
    return { refundId: raw.refund_id || refundId, gatewayRefundId: raw.cf_refund_id ? String(raw.cf_refund_id) : null, status: raw.refund_status || 'PENDING', raw };
  }

  async fetchPaymentSnapshot(payment) {
    const orderId = payment.cfOrderId || payment.cashfreeOrderId;
    const order = await this.client.fetchCashfreeOrder(orderId);
    const refunds = await this.client.fetchOrderRefunds(orderId).catch(() => []);
    const refundedPaise = refunds
      .filter((r) => String(r.refund_status || '').toUpperCase() === 'SUCCESS')
      .reduce((sum, r) => sum + toPaise(r.refund_amount), 0);
    const amountPaise = toPaise(order.order_amount);
    let status = 'created';
    if (order.order_status === 'PAID') {
      status = refundedPaise <= 0 ? 'captured' : refundedPaise >= amountPaise ? 'refunded' : 'partially_refunded';
    } else if (['EXPIRED', 'TERMINATED'].includes(order.order_status)) {
      status = 'failed';
    }
    return { amount: amountPaise, amount_refunded: refundedPaise, status, currency: String(order.order_currency || PAYMENTS.CURRENCY).toUpperCase() };
  }
}

/** Legacy provider: payments captured before the Cashfree migration still refund/reconcile via Razorpay. */
class RazorpayGateway extends PaymentGateway {
  constructor(clientLoader = () => require('../razorpayService')) {
    super();
    this.loadClient = clientLoader; // lazy: the Razorpay SDK is only needed for legacy records
  }

  get name() { return 'razorpay'; }

  ownsPayment(payment) {
    return Boolean(payment && typeof payment.razorpayPaymentId === 'string' && payment.razorpayPaymentId.startsWith('pay_'));
  }

  async refund({ payment, refundId, amountInRupees, reason }) {
    const raw = await this.loadClient().createRazorpayRefund({
      paymentId: payment.razorpayPaymentId,
      amountInPaise: toPaise(amountInRupees),
      receipt: refundId,
      notes: { reason: String(reason || 'Refund').slice(0, PAYMENTS.REFUND_NOTE_MAX_LENGTH) },
    });
    return { refundId: raw.id || refundId, gatewayRefundId: raw.id || null, status: String(raw.status || 'pending').toUpperCase(), raw };
  }

  async fetchPaymentSnapshot(payment) {
    const raw = await this.loadClient().fetchPaymentDetails(payment.razorpayPaymentId);
    return { amount: Number(raw.amount) || 0, amount_refunded: Number(raw.amount_refunded) || 0, status: String(raw.status || '').toLowerCase(), currency: String(raw.currency || PAYMENTS.CURRENCY).toUpperCase() };
  }
}

/**
 * Deterministic in-process gateway for local development and browser end-to-end tests
 * (PAYMENT_GATEWAY=mock). Every order "succeeds" for the exact amount it was created with.
 * Registered only outside production; envValidator also rejects PAYMENT_GATEWAY=mock in production.
 */
class MockGateway extends PaymentGateway {
  constructor() {
    super();
    this.orders = new Map(); // orderId -> amountInRupees
  }

  get name() { return 'mock'; }

  ownsPayment(payment) {
    return Boolean(payment && payment.gateway === 'mock');
  }

  async createOrder({ orderId, amountInRupees }) {
    this.orders.set(orderId, amountInRupees);
    return { gatewayOrderId: `mock_${orderId}`, sessionId: `mock_session_${orderId}`, raw: { mock: true } };
  }

  async verifyOrderPayment(orderId) {
    if (!this.orders.has(orderId)) return { verified: false, status: 'NOT_FOUND', gatewayPaymentId: null, method: 'MOCK', amountInRupees: null };
    return { verified: true, status: 'PAID', gatewayPaymentId: `mockpay_${orderId}`, method: 'MOCK', amountInRupees: this.orders.get(orderId) };
  }

  async refund({ refundId }) {
    return { refundId, gatewayRefundId: `mockrefund_${refundId}`, status: 'SUCCESS', raw: { mock: true } };
  }

  async fetchPaymentSnapshot(payment) {
    const amount = toPaise(payment.amount);
    const refunded = toPaise(payment.totalRefundedAmount);
    const status = refunded <= 0 ? 'captured' : refunded >= amount ? 'refunded' : 'partially_refunded';
    return { amount, amount_refunded: refunded, status, currency: PAYMENTS.CURRENCY };
  }
}

const registry = new Map();
function registerGateway(gateway) { registry.set(gateway.name, gateway); }
function getGateway(name) {
  const gateway = registry.get(String(name || '').toLowerCase());
  if (!gateway) throw new Error(`Unknown payment gateway: ${name}`);
  return gateway;
}
/** Primary gateway for NEW orders. */
function getDefaultGateway() { return getGateway(process.env.PAYMENT_GATEWAY || 'cashfree'); }
/** Gateway that owns an EXISTING payment, or null for offline/manual records with no gateway leg. */
function resolveGatewayForPayment(payment) {
  for (const gateway of registry.values()) {
    if (gateway.ownsPayment(payment)) return gateway;
  }
  return null;
}
function isProductionEnv() {
  return ['production', 'staging'].includes(String(process.env.NODE_ENV || '').toLowerCase());
}

function defaultGateways() {
  const gateways = [new CashfreeGateway(), new RazorpayGateway()];
  if (!isProductionEnv()) gateways.push(new MockGateway());
  return gateways;
}

/** Test seam. */
function resetGateways(gateways = defaultGateways()) {
  registry.clear();
  gateways.forEach(registerGateway);
}

resetGateways();

module.exports = {
  PaymentGateway,
  CashfreeGateway,
  RazorpayGateway,
  MockGateway,
  registerGateway,
  getGateway,
  getDefaultGateway,
  resolveGatewayForPayment,
  resetGateways,
  toPaise,
};
