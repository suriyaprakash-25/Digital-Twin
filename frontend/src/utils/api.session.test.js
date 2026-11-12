import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost, getAccessToken, refreshSession, setAccessToken, setUnauthorizedHandler } from './api';
import { mockApi, restoreApi } from '../test/mockApi';

afterEach(() => {
  restoreApi();
  setAccessToken(null);
  setUnauthorizedHandler(null);
});

const isSession = (req) => req.url === '/auth/session';

describe('transport defaults', () => {
  it('sends credentials and X-Requested-With on every API request', async () => {
    const calls = mockApi(() => ({ data: { ok: true } }));
    await apiGet('/vehicles');
    await apiPost('/bookings', { a: 1 });
    for (const call of calls) {
      expect(call.withCredentials).toBe(true);
      expect(call.requestedWith).toBe('XMLHttpRequest');
    }
  });

  it('adds the in-memory bearer token, but not to the session endpoint', async () => {
    setAccessToken('access-1');
    const calls = mockApi((req) => (isSession(req) ? { data: { token: 'access-2', user: {} } } : { data: {} }));
    await apiGet('/vehicles');
    await refreshSession();
    expect(calls[0].authorization).toBe('Bearer access-1');
    expect(calls[1].url).toBe('/auth/session');
    expect(calls[1].authorization).toBeUndefined();
    expect(getAccessToken()).toBe('access-2');
  });

  it('never sends cookies or the token to third-party URLs', async () => {
    setAccessToken('access-1');
    const calls = mockApi(() => ({ data: {} }));
    await apiGet('https://third-party.example/resource');
    expect(calls[0].withCredentials).toBe(false);
    expect(calls[0].authorization).toBeUndefined();
    expect(calls[0].requestedWith).toBeUndefined();
  });

  it('never writes the token to web storage', async () => {
    mockApi((req) => (isSession(req) ? { data: { token: 'access-9', user: { role: 'USER' } } } : { data: {} }));
    setAccessToken('access-1');
    await refreshSession();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('access-');
  });
});

describe('silent refresh', () => {
  it('two parallel 401s trigger exactly one /auth/session call, then both retry', async () => {
    setAccessToken('expired');
    const calls = mockApi((req) => {
      if (isSession(req)) return { data: { success: true, token: 'fresh', user: { role: 'USER' } } };
      return req.authorization === 'Bearer fresh' ? { data: { url: req.url } } : { status: 401, data: { code: 'UNAUTHENTICATED' } };
    });

    const [a, b] = await Promise.all([apiGet('/vehicles'), apiGet('/bookings')]);

    expect(a).toEqual({ url: '/vehicles' });
    expect(b).toEqual({ url: '/bookings' });
    expect(calls.filter(isSession)).toHaveLength(1);
    expect(calls.filter((c) => c.url === '/vehicles')).toHaveLength(2);
    expect(calls.filter((c) => c.url === '/bookings')).toHaveLength(2);
    expect(getAccessToken()).toBe('fresh');
  });

  it('refresh failure triggers the global logout handler', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    setAccessToken('expired');
    const calls = mockApi((req) => (isSession(req)
      ? { status: 401, data: { code: 'SESSION_REQUIRED' } }
      : { status: 401, data: { code: 'UNAUTHENTICATED' } }));

    await expect(apiGet('/vehicles')).rejects.toMatchObject({ response: { status: 401 } });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(calls.filter(isSession)).toHaveLength(1);
    expect(calls.filter((c) => c.url === '/vehicles')).toHaveLength(1);
  });

  it('retries at most once', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    const calls = mockApi((req) => (isSession(req) ? { data: { token: 'fresh', user: {} } } : { status: 401, data: {} }));

    await expect(apiGet('/vehicles')).rejects.toBeTruthy();
    expect(calls.filter((c) => c.url === '/vehicles')).toHaveLength(2);
    expect(calls.filter(isSession)).toHaveLength(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it.each(['/auth/login', '/auth/google', '/auth/logout'])('does not refresh on a 401 from %s', async (url) => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    const calls = mockApi(() => ({ status: 401, data: { message: 'Invalid credentials' } }));

    await expect(apiPost(url, {})).rejects.toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not redirect a signed-out visitor whose public request 401s', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockApi(() => ({ status: 401, data: { code: 'UNAUTHENTICATED' } }));

    await expect(apiGet('/marketplace')).rejects.toBeTruthy();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
