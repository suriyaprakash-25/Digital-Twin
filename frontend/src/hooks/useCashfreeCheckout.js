import { useCallback, useRef, useState } from 'react';
import { apiPost, getErrorMessage, idempotencyHeaders, isIdempotencyInProgress } from '../utils/api';
import { loadCashfreeScript } from '../utils/loadCashfree';
import { buildCreateOrderBody, buildVerifyBody, extractCheckoutOrder } from '../services/cashfreeCheckout';
import { useIdempotencyKeys } from './useIdempotencyKeys';

export const CHECKOUT_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING_SDK: 'loading_sdk',
  CREATING_ORDER: 'creating_order',
  AWAITING_PAYMENT: 'awaiting_payment',
  VERIFYING: 'verifying',
  SUCCESS: 'success',
  PENDING: 'pending',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
});

const BUSY = new Set([
  CHECKOUT_STATUS.LOADING_SDK,
  CHECKOUT_STATUS.CREATING_ORDER,
  CHECKOUT_STATUS.AWAITING_PAYMENT,
  CHECKOUT_STATUS.VERIFYING,
]);

const defaultGetCashfree = () => (typeof window !== 'undefined' ? window.Cashfree : undefined);

/**
 * Shared Cashfree Drop.js checkout used by PaymentCenter and PaymentButton.
 *
 * `startCheckout({ id, serviceId, invoiceId, invoiceNumber })` loads the SDK, creates
 * the order (with an Idempotency-Key), opens the modal and verifies with the backend.
 * It resolves to `{ status, payment?, error? }` and never throws, so callers decide how
 * to present the outcome (toast, inline error, optimistic update).
 *
 * Idempotency: one key per payable item (`id`), reused across retries of the same
 * attempt so a double click or network retry replays the same order. It is released
 * only after a terminal result: verified success, or a definitive create-order failure.
 * A dismissed modal or a pending verification keeps the key, so trying again reopens
 * the same order instead of creating a duplicate.
 */
export function useCashfreeCheckout({ loadSdk = loadCashfreeScript, getCashfree = defaultGetCashfree } = {}) {
  const [state, setState] = useState({ status: CHECKOUT_STATUS.IDLE, error: null, activeId: null });
  const inFlightRef = useRef(false);
  const keys = useIdempotencyKeys();

  const update = (status, activeId, error = null) => setState({ status, activeId, error });

  const startCheckout = useCallback(async ({ id, serviceId, invoiceId, invoiceNumber }) => {
    if (inFlightRef.current) return { status: 'ignored' };
    inFlightRef.current = true;
    const itemId = id || serviceId;
    const scope = `checkout:${itemId}`;
    const finish = (status, extra = {}) => {
      update(status, itemId, extra.error || null);
      return { status, ...extra };
    };

    try {
      update(CHECKOUT_STATUS.LOADING_SDK, itemId);
      const loaded = await loadSdk();
      const Cashfree = getCashfree();
      if (!loaded || typeof Cashfree !== 'function') {
        return finish(CHECKOUT_STATUS.FAILED, {
          error: 'Failed to load the payment gateway. Please check your internet connection.',
        });
      }

      update(CHECKOUT_STATUS.CREATING_ORDER, itemId);
      let orderResponse;
      try {
        orderResponse = await apiPost(
          '/payments/create-order',
          buildCreateOrderBody({ serviceId, invoiceId }),
          { headers: idempotencyHeaders(keys.keyFor(scope)) },
        );
      } catch (err) {
        if (isIdempotencyInProgress(err)) {
          return finish(CHECKOUT_STATUS.PENDING, { error: 'This payment is already being processed. Please wait a moment.' });
        }
        keys.settle(scope, err);
        return finish(CHECKOUT_STATUS.FAILED, { error: getErrorMessage(err, 'Unable to initialize payment') });
      }

      if (!orderResponse?.success) {
        keys.release(scope);
        return finish(CHECKOUT_STATUS.FAILED, { error: orderResponse?.message || 'Failed to initialize payment order' });
      }

      const { cfOrderId, paymentSessionId, mode } = extractCheckoutOrder(orderResponse);
      if (!paymentSessionId) {
        keys.release(scope);
        return finish(CHECKOUT_STATUS.FAILED, { error: 'Payment session configuration is unavailable. Please contact support.' });
      }

      update(CHECKOUT_STATUS.AWAITING_PAYMENT, itemId);
      let checkoutResult;
      try {
        checkoutResult = await Cashfree({ mode }).checkout({ paymentSessionId, redirectTarget: '_modal' });
      } catch (err) {
        checkoutResult = { error: err };
      }
      const dismissed = Boolean(checkoutResult?.error);

      update(CHECKOUT_STATUS.VERIFYING, itemId);
      try {
        const verify = await apiPost('/payments/verify', buildVerifyBody({ cfOrderId, serviceId, invoiceNumber }));
        if (verify?.success) {
          keys.release(scope);
          return finish(CHECKOUT_STATUS.SUCCESS, { payment: verify.payment || null });
        }
        if (dismissed) return finish(CHECKOUT_STATUS.CANCELLED);
        return finish(CHECKOUT_STATUS.PENDING, { error: 'Payment verification pending. Please check again in a moment.' });
      } catch (err) {
        if (dismissed) return finish(CHECKOUT_STATUS.CANCELLED);
        return finish(CHECKOUT_STATUS.FAILED, { error: getErrorMessage(err, 'Payment verification could not be completed') });
      }
    } catch (err) {
      return finish(CHECKOUT_STATUS.FAILED, { error: getErrorMessage(err, 'Unable to initialize payment') });
    } finally {
      inFlightRef.current = false;
    }
  }, [keys, loadSdk, getCashfree]);

  const reset = useCallback(() => update(CHECKOUT_STATUS.IDLE, null), []);

  return {
    ...state,
    isBusy: BUSY.has(state.status),
    isBusyFor: (itemId) => BUSY.has(state.status) && state.activeId === itemId,
    startCheckout,
    reset,
  };
}

export default useCashfreeCheckout;
