// Pure helpers for the Cashfree Drop.js checkout flow (no React). The stateful flow
// lives in hooks/useCashfreeCheckout.js.

const VALID_MODES = new Set(['sandbox', 'production']);

function normaliseMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return VALID_MODES.has(mode) ? mode : null;
}

/**
 * Cashfree SDK mode, in priority order:
 *  1. `cashfreeMode` from the create-order response (the backend knows its account),
 *  2. VITE_CASHFREE_MODE,
 *  3. 'production' for production builds, otherwise 'sandbox'.
 */
export function resolveCashfreeMode(orderResponse, env = import.meta.env) {
  return (
    normaliseMode(orderResponse?.cashfreeMode)
    || normaliseMode(orderResponse?.order?.cashfreeMode)
    || normaliseMode(env?.VITE_CASHFREE_MODE)
    || (env?.PROD ? 'production' : 'sandbox')
  );
}

/** Normalises the create-order response (legacy and nested `order` shapes). */
export function extractCheckoutOrder(orderResponse) {
  const order = orderResponse?.order || {};
  return {
    cfOrderId: orderResponse?.cfOrderId || orderResponse?.orderId || order.cfOrderId || order.orderId || null,
    paymentSessionId: orderResponse?.paymentSessionId || order.paymentSessionId || null,
    mode: resolveCashfreeMode(orderResponse),
  };
}

/** Body for POST /payments/create-order. */
export function buildCreateOrderBody({ serviceId, invoiceId }) {
  return { serviceId, invoiceId: invoiceId || serviceId };
}

/** Body for POST /payments/verify. */
export function buildVerifyBody({ cfOrderId, serviceId, invoiceNumber }) {
  return { cfOrderId, orderId: cfOrderId, serviceId, invoiceNumber };
}
