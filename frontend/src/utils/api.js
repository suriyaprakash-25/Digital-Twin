// The single HTTP gateway for the SPA. Every backend call goes through `apiClient`
// (directly or via the apiGet/apiPost/... helpers) so base URL, auth header, error
// shape, cookie session, silent token refresh and global 401 handling live in
// exactly one place.
import axios from 'axios';
import { API_BASE_URL, API_ROOT_URL } from './config';

export { API_BASE_URL, API_ROOT_URL };

const INVALID_TOKEN_MESSAGE = 'Missing or invalid token';
export const SESSION_ENDPOINT = '/auth/session';
export const LOGOUT_ENDPOINT = '/auth/logout';

// ── In-memory access token ──────────────────────────────────────────────────
// The short-lived (15 min) access token is NEVER persisted. The long-lived
// session is the httpOnly `dp_session` cookie, which only the backend can read;
// the access token is re-minted from it via GET /auth/session.

let accessToken = null;
const authListeners = new Set();

export function getAccessToken() {
  return accessToken;
}

/** Stores the access token in memory and notifies subscribers (AuthContext). */
export function setAccessToken(token, user) {
  accessToken = token || null;
  authListeners.forEach((listener) => listener({ token: accessToken, user }));
}

/** Subscribe to access-token changes (login, refresh, logout). Returns an unsubscribe fn. */
export function onAccessTokenChange(listener) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

/**
 * Normalise an endpoint so callers can pass `/payments/history`, `payments/history`
 * or a legacy `/api/payments/history`; absolute URLs pass through untouched.
 */
export function toApiPath(endpoint = '') {
  const value = String(endpoint);
  if (/^https?:\/\//i.test(value)) return value;
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.replace(/^\/api(?=\/|$)/, '') || '/';
}

function defaultUnauthorizedHandler() {
  setAccessToken(null);
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

let unauthorizedHandler = defaultUnauthorizedHandler;

/** Lets the AuthProvider replace the hard redirect with an in-app logout. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : defaultUnauthorizedHandler;
  return () => { unauthorizedHandler = defaultUnauthorizedHandler; };
}

export function isInvalidSessionError(error) {
  const response = error?.response;
  if (!response || response.status !== 401) return false;
  const body = response.data || {};
  return body.msg === INVALID_TOKEN_MESSAGE || body.message === INVALID_TOKEN_MESSAGE;
}

function isFirstPartyUrl(url = '') {
  return !/^https?:\/\//i.test(url) || url.startsWith(`${API_BASE_URL}/`);
}

function pathOf(url = '') {
  const value = String(url);
  const relative = value.startsWith(API_ROOT_URL) ? value.slice(API_ROOT_URL.length) : value;
  return toApiPath(relative).split('?')[0];
}

// A 401 from these means "bad credentials" or "no session" — never refresh-and-retry.
const NO_REFRESH_PATHS = new Set([
  '/auth/login',
  '/auth/google',
  SESSION_ENDPOINT,
  LOGOUT_ENDPOINT,
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/verify-otp',
  '/auth/reset-password',
]);

function setHeader(headers, name, value) {
  if (typeof headers.set === 'function') headers.set(name, value);
  else headers[name] = value;
}

function hasHeader(headers, name) {
  return typeof headers.has === 'function' ? headers.has(name) : Boolean(headers[name]);
}

function deleteHeader(headers, name) {
  if (!headers) return;
  if (typeof headers.delete === 'function') headers.delete(name);
  else delete headers[name];
}

export function attachAuthHeader(config) {
  const headers = config.headers || {};
  if (isFirstPartyUrl(config.url)) {
    // Cookie session + CSRF header for our API only; never for third-party URLs.
    config.withCredentials = true;
    setHeader(headers, 'X-Requested-With', 'XMLHttpRequest');
    const isSessionCall = pathOf(config.url) === SESSION_ENDPOINT;
    if (accessToken && !isSessionCall && !hasHeader(headers, 'Authorization')) {
      setHeader(headers, 'Authorization', `Bearer ${accessToken}`);
    }
  } else {
    config.withCredentials = false;
  }
  config.headers = headers;
  if (config.url) config.url = toApiPath(config.url);
  return config;
}

// ── Silent refresh (single-flight) ──────────────────────────────────────────

let refreshPromise = null;

/**
 * GET /auth/session using the httpOnly cookie. Concurrent callers share one
 * request. Resolves to `{ token, user }` and stores the token in memory.
 */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .get(SESSION_ENDPOINT, { _skipAuthRefresh: true })
      .then((response) => {
        const { token, user } = response.data || {};
        if (!token) throw new Error('Session response did not include an access token');
        setAccessToken(token, user);
        return { token, user };
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function handleResponseError(error) {
  const config = error?.config;
  const status = error?.response?.status;
  const refreshable = status === 401
    && config
    && !config._retried
    && !config._skipAuthRefresh
    && isFirstPartyUrl(config.url)
    && !NO_REFRESH_PATHS.has(pathOf(config.url));

  if (!refreshable) {
    // The retried request still failed auth: the session is unusable.
    if (status === 401 && config?._retried) unauthorizedHandler(error);
    return Promise.reject(error);
  }

  const hadSession = Boolean(accessToken);
  try {
    await refreshSession();
  } catch {
    if (hadSession || isInvalidSessionError(error)) unauthorizedHandler(error);
    else setAccessToken(null);
    return Promise.reject(error);
  }

  config._retried = true;
  deleteHeader(config.headers, 'Authorization'); // re-attached with the fresh token
  return apiClient.request(config);
}

export const apiClient = axios.create({ baseURL: API_ROOT_URL, withCredentials: true });
apiClient.interceptors.request.use(attachAuthHeader);
apiClient.interceptors.response.use((response) => response, handleResponseError);

/** Full response: `{ data, headers, status }`. Use when you need headers (pagination). */
export async function apiRequest(config) {
  const response = await apiClient.request(config);
  return { data: response.data, headers: response.headers || {}, status: response.status };
}

export async function apiGet(endpoint, params = {}, config = {}) {
  const response = await apiClient.get(endpoint, { ...config, params: { ...(config.params || {}), ...params } });
  return response.data;
}

export async function apiPost(endpoint, body = {}, config = {}) {
  const response = await apiClient.post(endpoint, body, config);
  return response.data;
}

export async function apiPut(endpoint, body = {}, config = {}) {
  const response = await apiClient.put(endpoint, body, config);
  return response.data;
}

export async function apiPatch(endpoint, body = {}, config = {}) {
  const response = await apiClient.patch(endpoint, body, config);
  return response.data;
}

export async function apiDelete(endpoint, config = {}) {
  const response = await apiClient.delete(endpoint, config);
  return response.data;
}

/**
 * Multipart upload. `formData` must be a FormData; axios leaves Content-Type to the
 * browser so the multipart boundary is set correctly.
 */
export async function apiUpload(endpoint, formData, { method = 'post', onUploadProgress, ...config } = {}) {
  const response = await apiClient.request({
    ...config,
    url: endpoint,
    method,
    data: formData,
    onUploadProgress,
  });
  return response.data;
}

function readHeader(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') {
    const value = headers.get(name);
    if (value !== undefined && value !== null) return value;
  }
  return headers[name] ?? headers[name.toLowerCase()];
}

function toNumberOrNull(value) {
  const n = Number(value);
  return value === undefined || value === null || value === '' || Number.isNaN(n) ? null : n;
}

/** Reads the backend pagination headers (X-Total-Count, X-Page, X-Limit, X-Total-Pages). */
export function getPagination(headers) {
  return {
    total: toNumberOrNull(readHeader(headers, 'X-Total-Count')),
    page: toNumberOrNull(readHeader(headers, 'X-Page')),
    limit: toNumberOrNull(readHeader(headers, 'X-Limit')),
    totalPages: toNumberOrNull(readHeader(headers, 'X-Total-Pages')),
  };
}

/** True when the backend answered from its idempotency cache (`Idempotent-Replayed: true`). */
export function isIdempotentReplay(headers) {
  return String(readHeader(headers, 'Idempotent-Replayed') || '').toLowerCase() === 'true';
}

/** GET with pagination: `{ data, total, page, limit, totalPages, headers }`. */
export async function apiGetPage(endpoint, params = {}, config = {}) {
  const { data, headers } = await apiRequest({ ...config, method: 'get', url: endpoint, params });
  return { data, headers, ...getPagination(headers) };
}

/** Header for financial mutations; the backend de-duplicates on this key. */
export function createIdempotencyKey(prefix = '') {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  const id = cryptoApi?.randomUUID
    ? cryptoApi.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * Human readable message for any thrown value. Understands the backend error
 * shape `{ success:false, msg, message, code, requestId }`.
 */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  const body = error.response?.data;
  if (body && typeof body === 'object') {
    const candidate = body.message || body.msg || body.error;
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  } else if (typeof body === 'string' && body.trim() && !body.trim().startsWith('<')) {
    return body;
  }
  if (error.code === 'ERR_NETWORK' || (error.request && !error.response)) {
    return 'Unable to reach the server. Check your connection and try again.';
  }
  if (!error.response && typeof error.message === 'string' && error.message.trim()) return error.message;
  return fallback;
}

export function getErrorCode(error) {
  return error?.response?.data?.code || null;
}

/**
 * A concurrent duplicate of an idempotent mutation (409 IDEMPOTENCY_IN_PROGRESS).
 * Callers should treat it as "already processing", not as a failure.
 */
export function isIdempotencyInProgress(error) {
  return error?.response?.status === 409 && getErrorCode(error) === 'IDEMPOTENCY_IN_PROGRESS';
}

export function isRateLimited(error) {
  return error?.response?.status === 429 || getErrorCode(error) === 'RATE_LIMIT_EXCEEDED';
}

/** Header object for a financial mutation: `{ headers: idempotencyHeaders(key) }`. */
export function idempotencyHeaders(key) {
  return { 'Idempotency-Key': key };
}

export function getRequestId(error) {
  return error?.response?.data?.requestId || null;
}
