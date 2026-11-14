import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../utils/api', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, apiPost: vi.fn() };
});

import { apiPost } from '../utils/api';
import { CHECKOUT_STATUS, useCashfreeCheckout } from './useCashfreeCheckout';
import { resolveCashfreeMode } from '../services/cashfreeCheckout';

const ITEM = { id: 'pay-1', serviceId: 'svc-1', invoiceId: 'INV-1', invoiceNumber: 'INV-1' };
const ORDER = { success: true, cfOrderId: 'order_1', paymentSessionId: 'session_1', cashfreeMode: 'production' };

function setup({ loaded = true, checkoutResult = {} } = {}) {
  const checkout = vi.fn().mockResolvedValue(checkoutResult);
  const Cashfree = vi.fn(() => ({ checkout }));
  const loadSdk = vi.fn().mockResolvedValue(loaded);
  const hook = renderHook(() => useCashfreeCheckout({ loadSdk, getCashfree: () => Cashfree }));
  return { ...hook, Cashfree, checkout, loadSdk };
}

const createOrderCalls = () => apiPost.mock.calls.filter(([url]) => url === '/payments/create-order');
const keyOf = (call) => call[2].headers['Idempotency-Key'];

beforeEach(() => {
  apiPost.mockReset();
});

describe('useCashfreeCheckout', () => {
  it('runs create-order -> checkout -> verify and reports success', async () => {
    apiPost.mockResolvedValueOnce(ORDER).mockResolvedValueOnce({ success: true, payment: { id: 'p' } });
    const { result, Cashfree, checkout } = setup();

    let outcome;
    await act(async () => { outcome = await result.current.startCheckout(ITEM); });

    expect(outcome).toEqual({ status: CHECKOUT_STATUS.SUCCESS, payment: { id: 'p' } });
    expect(result.current.status).toBe(CHECKOUT_STATUS.SUCCESS);
    expect(result.current.isBusy).toBe(false);
    expect(Cashfree).toHaveBeenCalledWith({ mode: 'production' });
    expect(checkout).toHaveBeenCalledWith({ paymentSessionId: 'session_1', redirectTarget: '_modal' });
    expect(apiPost).toHaveBeenNthCalledWith(1, '/payments/create-order', { serviceId: 'svc-1', invoiceId: 'INV-1' }, expect.objectContaining({ headers: expect.any(Object) }));
    expect(apiPost).toHaveBeenNthCalledWith(2, '/payments/verify', { cfOrderId: 'order_1', orderId: 'order_1', serviceId: 'svc-1', invoiceNumber: 'INV-1' });
  });

  it('is busy while in flight and ignores a second start (double click)', async () => {
    let resolveOrder;
    apiPost.mockImplementationOnce(() => new Promise((r) => { resolveOrder = r; }));
    apiPost.mockResolvedValueOnce({ success: true });
    const { result } = setup();

    let first;
    await act(async () => { first = result.current.startCheckout(ITEM); await Promise.resolve(); });
    expect(result.current.isBusy).toBe(true);
    expect(result.current.isBusyFor('pay-1')).toBe(true);

    let second;
    await act(async () => { second = await result.current.startCheckout(ITEM); });
    expect(second).toEqual({ status: 'ignored' });

    await act(async () => { resolveOrder(ORDER); await first; });
    expect(createOrderCalls()).toHaveLength(1);
  });

  it('fails cleanly when the SDK cannot load (no order is created)', async () => {
    const { result } = setup({ loaded: false });
    let outcome;
    await act(async () => { outcome = await result.current.startCheckout(ITEM); });
    expect(outcome.status).toBe(CHECKOUT_STATUS.FAILED);
    expect(outcome.error).toMatch(/payment gateway/i);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('reports a dismissed modal as cancelled and reuses the same idempotency key on retry', async () => {
    apiPost
      .mockResolvedValueOnce(ORDER).mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce(ORDER).mockResolvedValueOnce({ success: true });
    const { result, checkout } = setup();
    checkout.mockResolvedValueOnce({ error: { message: 'closed' } }).mockResolvedValueOnce({});

    let outcome;
    await act(async () => { outcome = await result.current.startCheckout(ITEM); });
    expect(outcome.status).toBe(CHECKOUT_STATUS.CANCELLED);

    await act(async () => { outcome = await result.current.startCheckout(ITEM); });
    expect(outcome.status).toBe(CHECKOUT_STATUS.SUCCESS);

    const [a, b] = createOrderCalls();
    expect(keyOf(a)).toBeTruthy();
    expect(keyOf(a)).toBe(keyOf(b));
  });

  it('issues a fresh key after a terminal success', async () => {
    apiPost
      .mockResolvedValueOnce(ORDER).mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce(ORDER).mockResolvedValueOnce({ success: true });
    const { result } = setup();

    await act(async () => { await result.current.startCheckout(ITEM); });
    await act(async () => { await result.current.startCheckout(ITEM); });

    const [a, b] = createOrderCalls();
    expect(keyOf(a)).not.toBe(keyOf(b));
  });

  it('keeps the key after a retryable (5xx) create-order failure and drops it after a 4xx', async () => {
    const serverError = { response: { status: 503, data: { message: 'Gateway busy' } } };
    const badRequest = { response: { status: 400, data: { message: 'Invoice already paid' } } };
    apiPost.mockRejectedValueOnce(serverError).mockRejectedValueOnce(badRequest).mockRejectedValueOnce(badRequest);
    const { result } = setup();

    let outcome;
    await act(async () => { outcome = await result.current.startCheckout(ITEM); });
    expect(outcome).toMatchObject({ status: CHECKOUT_STATUS.FAILED, error: 'Gateway busy' });
    await act(async () => { outcome = await result.current.startCheckout(ITEM); });
    expect(outcome).toMatchObject({ status: CHECKOUT_STATUS.FAILED, error: 'Invoice already paid' });
    await act(async () => { await result.current.startCheckout(ITEM); });

    const [a, b, c] = createOrderCalls();
    expect(keyOf(a)).toBe(keyOf(b));
    expect(keyOf(c)).not.toBe(keyOf(b));
  });

  it('treats 409 IDEMPOTENCY_IN_PROGRESS as pending, not as a failure', async () => {
    apiPost.mockRejectedValueOnce({ response: { status: 409, data: { code: 'IDEMPOTENCY_IN_PROGRESS', message: 'busy' } } });
    const { result } = setup();
    let outcome;
    await act(async () => { outcome = await result.current.startCheckout(ITEM); });
    expect(outcome.status).toBe(CHECKOUT_STATUS.PENDING);
    expect(outcome.error).toMatch(/already being processed/);
  });

  it('reports pending when verification is not yet confirmed', async () => {
    apiPost.mockResolvedValueOnce(ORDER).mockResolvedValueOnce({ success: false });
    const { result } = setup({ checkoutResult: {} });
    let outcome;
    await act(async () => { outcome = await result.current.startCheckout(ITEM); });
    expect(outcome.status).toBe(CHECKOUT_STATUS.PENDING);
  });

  it('fails when the server returns no payment session', async () => {
    apiPost.mockResolvedValueOnce({ success: true, cfOrderId: 'o' });
    const { result, Cashfree } = setup();
    let outcome;
    await act(async () => { outcome = await result.current.startCheckout(ITEM); });
    expect(outcome.status).toBe(CHECKOUT_STATUS.FAILED);
    expect(Cashfree).not.toHaveBeenCalled();
  });
});

describe('resolveCashfreeMode', () => {
  it('prefers the create-order response, then env, then the build mode', () => {
    expect(resolveCashfreeMode({ cashfreeMode: 'sandbox' }, { VITE_CASHFREE_MODE: 'production', PROD: true })).toBe('sandbox');
    expect(resolveCashfreeMode({ order: { cashfreeMode: 'production' } }, {})).toBe('production');
    expect(resolveCashfreeMode({}, { VITE_CASHFREE_MODE: 'production' })).toBe('production');
    expect(resolveCashfreeMode({ cashfreeMode: 'bogus' }, { PROD: true })).toBe('production');
    expect(resolveCashfreeMode(null, { PROD: false })).toBe('sandbox');
  });
});
