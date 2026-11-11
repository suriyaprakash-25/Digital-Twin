const crypto = require('crypto');
const axios = require('axios');
const { loadConfig } = require('../config');

/**
 * Returns base URL and headers for the Cashfree Payments API.
 * Docs: https://docs.cashfree.com/reference/pg-new-apis-endpoint
 */
function getCashfreeConfig() {
  const config = loadConfig();
  const appId         = config.cashfree?.appId         || process.env.CASHFREE_APP_ID         || '';
  const secretKey     = config.cashfree?.secretKey     || process.env.CASHFREE_SECRET_KEY     || '';
  const webhookSecret = config.cashfree?.webhookSecret || process.env.CASHFREE_WEBHOOK_SECRET || secretKey;
  const env           = config.cashfree?.env           || process.env.CASHFREE_ENV            || 'TEST';
  const version       = config.cashfree?.version       || process.env.CASHFREE_API_VERSION     || '2023-08-01';

  if (!appId || !secretKey) {
    console.warn('⚠️  Cashfree credentials not fully configured in environment (CASHFREE_APP_ID / CASHFREE_SECRET_KEY).');
  }

  const baseUrl = env.toUpperCase() === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  return {
    appId,
    secretKey,
    webhookSecret,
    baseUrl,
    version,
    headers: {
      'x-client-id':      appId,
      'x-client-secret':  secretKey,
      'x-api-version':    version,
      'Content-Type':     'application/json',
      'Accept':           'application/json'
    }
  };
}

/**
 * Creates a Cashfree Order via POST /pg/orders
 * @param {Object} params
 * @param {number} params.amountInRupees - Order amount in INR (Cashfree uses INR directly, not paise)
 * @param {string} params.orderId        - Unique internal order/receipt ID
 * @param {Object} params.customer       - { id, name, email, phone }
 * @param {Object} [params.meta]         - Extra metadata attached to order
 * @returns {Promise<Object>}            - Cashfree order response (includes payment_session_id)
 */
async function createCashfreeOrder({ amountInRupees, orderId, customer = {}, meta = {} }) {
  if (!amountInRupees || amountInRupees <= 0) {
    throw new Error('Invalid payment amount. Amount must be greater than 0.');
  }

  const { baseUrl, headers } = getCashfreeConfig();

  const payload = {
    order_id:       String(orderId),
    order_amount:   parseFloat(amountInRupees.toFixed(2)),
    order_currency: 'INR',
    customer_details: {
      customer_id:    customer.id    || `cust_${Date.now()}`,
      customer_name:  customer.name  || 'DrivePortz Customer',
      customer_email: customer.email || '',
      customer_phone: customer.phone || '9999999999'
    },
    order_meta: {
      ...meta,
      return_url:    meta.returnUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-return?order_id={order_id}`,
      notify_url:    meta.notifyUrl || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/cashfree-webhook`,
      payment_methods: 'upi,nb,cc,dc,emi,paylater,app'
    },
    order_note: meta.note || 'DrivePortz Automotive Service Payment'
  };

  const response = await axios.post(`${baseUrl}/orders`, payload, { headers });
  return response.data; // includes cf_order_id, order_status, payment_session_id
}

/**
 * Fetches order details from Cashfree GET /pg/orders/:orderId
 * @param {string} cfOrderId - Our internal order ID
 */
async function fetchCashfreeOrder(cfOrderId) {
  const { baseUrl, headers } = getCashfreeConfig();
  const response = await axios.get(`${baseUrl}/orders/${encodeURIComponent(cfOrderId)}`, { headers });
  return response.data;
}

/**
 * Fetches payments made against a Cashfree order
 * GET /pg/orders/:orderId/payments
 */
async function fetchOrderPayments(cfOrderId) {
  const { baseUrl, headers } = getCashfreeConfig();
  const response = await axios.get(`${baseUrl}/orders/${encodeURIComponent(cfOrderId)}/payments`, { headers });
  return response.data; // Array of payment objects
}

/**
 * Verifies a Cashfree webhook signature (HMAC-SHA256).
 * Cashfree posts: x-webhook-signature, x-webhook-timestamp headers.
 * Signed payload = timestamp + rawBody
 *
 * @param {Object} params
 * @param {Buffer|string} params.rawBody    - Raw unparsed POST body
 * @param {string}        params.timestamp  - x-webhook-timestamp header value
 * @param {string}        params.signature  - x-webhook-signature header value
 * @returns {boolean}
 */
function verifyCashfreeWebhook({ rawBody, timestamp, signature }) {
  if (!rawBody || !timestamp || !signature) return false;

  const { secretKey, webhookSecret } = getCashfreeConfig();
  const signingKey = webhookSecret || secretKey;
  if (!signingKey) {
    console.error('Missing CASHFREE_SECRET_KEY for webhook verification');
    return false;
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const signedData = `${timestamp}${body}`;

  const expectedSignature = crypto
    .createHmac('sha256', signingKey)
    .update(signedData)
    .digest('base64');

  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');
    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (err) {
    console.error('Error comparing Cashfree webhook signature:', err);
    return false;
  }
}

/**
 * Verifies the payment status returned from the frontend after checkout.
 * Cashfree sends: orderId in return_url params.
 * We refetch the order & payment from API as source-of-truth.
 *
 * @param {string} cfOrderId - Our internal order ID (equals Cashfree order_id)
 * @returns {{ verified: boolean, paymentId: string|null, method: string, status: string }}
 */
async function verifyCashfreePayment(cfOrderId) {
  if (!cfOrderId) return { verified: false, paymentId: null, method: 'Unknown', status: 'FAILED' };

  try {
    const order = await fetchCashfreeOrder(cfOrderId);
    if (!order || order.order_status !== 'PAID') {
      return { verified: false, paymentId: null, method: 'Unknown', status: order?.order_status || 'FAILED' };
    }

    // Fetch individual payment record(s) to get payment method
    let paymentId = null;
    let method = 'ONLINE / CASHFREE';
    try {
      const payments = await fetchOrderPayments(cfOrderId);
      const successPayment = Array.isArray(payments)
        ? payments.find(p => p.payment_status === 'SUCCESS')
        : null;
      if (successPayment) {
        paymentId = successPayment.cf_payment_id ? String(successPayment.cf_payment_id) : null;
        method = (successPayment.payment_method?.type || 'ONLINE').toUpperCase();
      }
    } catch (_) {
      // non-critical: proceed without payment method detail
    }

    return { verified: true, paymentId, method, status: 'PAID' };
  } catch (err) {
    console.error('Cashfree order verification error:', err?.response?.data || err.message);
    return { verified: false, paymentId: null, method: 'Unknown', status: 'FAILED' };
  }
}

/**
 * Initiates a Cashfree refund via POST /pg/orders/:orderId/refunds
 * @param {Object} params
 * @param {string} params.cfOrderId     - Our internal order ID (Cashfree order_id)
 * @param {string} params.refundId      - Unique refund reference
 * @param {number} params.amountInRupees
 * @param {string} [params.reason]
 */
async function createCashfreeRefund({ cfOrderId, refundId, amountInRupees, reason = 'Customer requested refund' }) {
  if (!cfOrderId || !amountInRupees || amountInRupees <= 0) {
    throw new Error('Missing cfOrderId or invalid refund amount');
  }

  const { baseUrl, headers } = getCashfreeConfig();
  const payload = {
    refund_id:     String(refundId),
    refund_amount: parseFloat(amountInRupees.toFixed(2)),
    refund_note:   String(reason).slice(0, 100)
  };

  const response = await axios.post(
    `${baseUrl}/orders/${encodeURIComponent(cfOrderId)}/refunds`,
    payload,
    { headers }
  );
  return response.data; // { refund_id, refund_status, refund_amount, ... }
}

module.exports = {
  getCashfreeConfig,
  createCashfreeOrder,
  fetchCashfreeOrder,
  fetchOrderPayments,
  verifyCashfreeWebhook,
  verifyCashfreePayment,
  createCashfreeRefund
};

