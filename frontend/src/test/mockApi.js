// Test helper: replaces the axios adapter of the shared apiClient so requests still go
// through the real interceptors (auth header, cookie flags, silent refresh).
import { apiClient } from '../utils/api';

const originalAdapter = apiClient.defaults.adapter;

function headerValue(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  return headers[name];
}

/**
 * `handler(request)` returns `{ status, data, headers }` (or a promise of it), where
 * request = `{ method, url, data, authorization, withCredentials, requestedWith, config }`.
 * Returns the list of recorded requests.
 */
export function mockApi(handler) {
  const calls = [];
  apiClient.defaults.adapter = async (config) => {
    const request = {
      method: (config.method || 'get').toLowerCase(),
      url: config.url,
      data: typeof config.data === 'string' ? JSON.parse(config.data || 'null') : config.data,
      authorization: headerValue(config.headers, 'Authorization'),
      requestedWith: headerValue(config.headers, 'X-Requested-With'),
      withCredentials: config.withCredentials,
      config,
    };
    calls.push(request);
    const result = (await handler(request)) || { status: 404, data: {} };
    const response = { data: result.data, status: result.status || 200, statusText: '', headers: result.headers || {}, config };
    if (response.status >= 400) {
      const error = new Error(`Request failed with status code ${response.status}`);
      error.response = response;
      error.config = config;
      error.isAxiosError = true;
      throw error;
    }
    return response;
  };
  return calls;
}

export function restoreApi() {
  apiClient.defaults.adapter = originalAdapter;
}

/** Unsigned JWT-shaped string with an `exp` claim (enough for the refresh timer). */
export function fakeAccessToken(expSecondsFromNow = 900, extra = {}) {
  const encode = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ typ: 'access', exp, ...extra })}.sig`;
}
