const crypto = require('crypto');
const Razorpay = require('razorpay');
const { loadConfig } = require('../config');

let razorpayClient = null;

function getRazorpayInstance() {
  if (razorpayClient) return razorpayClient;

  const config = loadConfig();
  const keyId = config.razorpay?.keyId || process.env.RAZORPAY_KEY_ID;
  const keySecret = config.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.warn('⚠️ Razorpay credentials not fully configured in environment.');
  }

  razorpayClient = new Razorpay({
    key_id: keyId || 'rzp_test_placeholder',
    key_secret: keySecret || 'placeholder_secret'
  });

  return razorpayClient;
}

/**
 * Creates a server-side Razorpay Order
 * @param {Object} params
 * @param {number} params.amountInPaise - Authoritative amount in paise (1 INR = 100 paise)
 * @param {string} params.receipt - Unique internal receipt/payment ID
 * @param {Object} [params.notes] - Safe metadata notes
 * @returns {Promise<Object>} Razorpay order object
 */
async function createRazorpayOrder({ amountInPaise, receipt, notes = {} }) {
  if (!amountInPaise || amountInPaise <= 0) {
    throw new Error('Invalid payment amount. Amount must be greater than 0.');
  }

  const razorpay = getRazorpayInstance();
  const options = {
    amount: Math.round(amountInPaise),
    currency: 'INR',
    receipt: String(receipt).slice(0, 40),
    notes: {
      ...notes,
      platform: 'DrivePortz'
    },
    payment_capture: 1 // Automatic capture
  };

  const order = await razorpay.orders.create(options);
  return order;
}

/**
 * Validates the checkout callback signature using timing-safe comparison
 * @param {Object} params
 * @param {string} params.orderId - Server stored order ID
 * @param {string} params.paymentId - Razorpay payment ID
 * @param {string} params.signature - Razorpay signature returned by checkout
 * @returns {boolean}
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const config = loadConfig();
  const keySecret = config.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    console.error('Missing RAZORPAY_KEY_SECRET for signature verification');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (err) {
    console.error('Error comparing payment signature:', err);
    return false;
  }
}

/**
 * Validates the raw webhook signature using timing-safe comparison
 * @param {Object} params
 * @param {Buffer|string} params.rawBody - Raw unparsed webhook body
 * @param {string} params.signature - Value of X-Razorpay-Signature header
 * @returns {boolean}
 */
function verifyWebhookSignature({ rawBody, signature }) {
  if (!rawBody || !signature) {
    return false;
  }

  const config = loadConfig();
  const webhookSecret = config.razorpay?.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Missing RAZORPAY_WEBHOOK_SECRET for webhook verification');
    return false;
  }

  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (err) {
    console.error('Error comparing webhook signature:', err);
    return false;
  }
}

/**
 * Fetches payment details directly from Razorpay API
 * @param {string} paymentId 
 */
async function fetchPaymentDetails(paymentId) {
  const razorpay = getRazorpayInstance();
  return await razorpay.payments.fetch(paymentId);
}

module.exports = {
  getRazorpayInstance,
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPaymentDetails
};
