import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_ROOT_URL,
  apiClient,
  apiGet,
  apiGetPage,
  apiPost,
  attachAuthHeader,
  createIdempotencyKey,
  getErrorMessage,
  getPagination,
  idempotencyHeaders,
  isIdempotencyInProgress,
  isIdempotentReplay,
  isRateLimited,
  setAccessToken,
  setUnauthorizedHandler,
  toApiPath,
} from './api';

const originalAdapter = apiClient.defaults.adapter;
let lastConfig;

function respondWith(response) {
  apiClient.defaults.adapter = async (config) => {
    lastConfig = config;
    if (response.status >= 400) {
      const error = new Error(`Request failed with status code ${response.status}`);
      error.response = { status: response.status, data: response.data, headers: response.headers || {}, config };
      error.config = config;
      error.isAxiosError = true;
      throw error;
    }
    return { data: response.data, status: response.status || 200, statusText: 'OK', headers: response.headers || {}, config };
  };
}

beforeEach(() => {
  lastConfig = undefined;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  setUnauthorizedHandler(null);
  setAccessToken(null);
  vi.restoreAllMocks();
});

describe('toApiPath', () => {
  it('normalises relative and legacy /api-prefixed paths', () => {
    expect(toApiPath('payments/history')).toBe('/payments/history');
    expect(toApiPath('/payments/history')).toBe('/payments/history');
    expect(toApiPath('/api/payments/history')).toBe('/payments/history');
    expect(toApiPath('/apiary')).toBe('/apiary');
  });

  it('leaves absolute URLs untouched', () => {
    expect(toApiPath('https://example.com/x')).toBe('https://example.com/x');
  });
});

describe('request interceptor', () => {
  it('uses the /api base URL and attaches the bearer token', async () => {
    setAccessToken('jwt-123');
    respondWith({ data: { ok: true } });

    const data = await apiGet('/vehicles', { page: 2 });

    expect(data).toEqual({ ok: true });
    expect(lastConfig.baseURL).toBe(API_ROOT_URL);
    expect(lastConfig.url).toBe('/vehicles');
    expect(lastConfig.params).toEqual({ page: 2 });
    expect(lastConfig.headers.Authorization).toBe('Bearer jwt-123');
  });

  it('sends no Authorization header when signed out', async () => {
    respondWith({ data: {} });
    await apiGet('/public');
    expect(lastConfig.headers.Authorization).toBeUndefined();
  });

  it('never leaks the token to third-party absolute URLs', () => {
    setAccessToken('jwt-123');
    const config = attachAuthHeader({ url: 'https://third-party.example/upload', headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('passes custom headers such as Idempotency-Key through', async () => {
    respondWith({ data: { success: true } });
    await apiPost('/payments/create-order', { serviceId: 's1' }, { headers: idempotencyHeaders('key-1') });
    expect(lastConfig.headers['Idempotency-Key']).toBe('key-1');
    expect(JSON.parse(lastConfig.data)).toEqual({ serviceId: 's1' });
  });
});

describe('response interceptor (global 401)', () => {
  it('calls the unauthorized handler for an invalid/expired token', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    respondWith({ status: 401, data: { success: false, msg: 'Missing or invalid token' } });

    await expect(apiGet('/me')).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not log out on other 401s (e.g. wrong password)', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    respondWith({ status: 401, data: { success: false, message: 'Invalid credentials' } });

    await expect(apiPost('/auth/login', {})).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('pagination headers', () => {
  it('reads X-Total-Count / X-Page / X-Limit / X-Total-Pages', async () => {
    respondWith({ data: { items: [] }, headers: { 'x-total-count': '120', 'x-page': '2', 'x-limit': '50', 'x-total-pages': '3' } });
    const page = await apiGetPage('/admin/payments/all', { page: 2, limit: 50 });
    expect(page).toMatchObject({ data: { items: [] }, total: 120, page: 2, limit: 50, totalPages: 3 });
  });

  it('returns nulls when headers are absent', () => {
    expect(getPagination({})).toEqual({ total: null, page: null, limit: null, totalPages: null });
  });

  it('detects idempotent replays', () => {
    expect(isIdempotentReplay({ 'idempotent-replayed': 'true' })).toBe(true);
    expect(isIdempotentReplay({})).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('prefers the backend message, then msg', () => {
    expect(getErrorMessage({ response: { status: 400, data: { success: false, msg: 'short', message: 'Long message', code: 'X' } } })).toBe('Long message');
    expect(getErrorMessage({ response: { status: 400, data: { msg: 'Only msg' } } })).toBe('Only msg');
  });

  it('falls back for empty bodies, HTML and unknown values', () => {
    expect(getErrorMessage({ response: { status: 500, data: {} } }, 'Fallback')).toBe('Fallback');
    expect(getErrorMessage({ response: { status: 502, data: '<html>bad gateway</html>' } }, 'Fallback')).toBe('Fallback');
    expect(getErrorMessage(null, 'Fallback')).toBe('Fallback');
    expect(getErrorMessage('plain string')).toBe('plain string');
  });

  it('explains network failures', () => {
    expect(getErrorMessage({ code: 'ERR_NETWORK', request: {}, message: 'Network Error' })).toMatch(/Unable to reach the server/);
  });

  it('uses Error.message for non-HTTP errors', () => {
    expect(getErrorMessage(new Error('Boom'))).toBe('Boom');
  });
});

describe('error classification', () => {
  it('recognises concurrent idempotent duplicates and rate limits', () => {
    expect(isIdempotencyInProgress({ response: { status: 409, data: { code: 'IDEMPOTENCY_IN_PROGRESS' } } })).toBe(true);
    expect(isIdempotencyInProgress({ response: { status: 409, data: { code: 'OTHER' } } })).toBe(false);
    expect(isRateLimited({ response: { status: 429, data: { code: 'RATE_LIMIT_EXCEEDED' } } })).toBe(true);
  });
});

describe('createIdempotencyKey', () => {
  it('uses crypto.randomUUID when available', () => {
    const spy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('11111111-2222-3333-4444-555555555555');
    expect(createIdempotencyKey()).toBe('11111111-2222-3333-4444-555555555555');
    expect(createIdempotencyKey('refund')).toBe('refund-11111111-2222-3333-4444-555555555555');
    expect(spy).toHaveBeenCalled();
  });

  it('produces unique keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => createIdempotencyKey()));
    expect(keys.size).toBe(50);
  });
});
