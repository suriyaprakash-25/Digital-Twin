// Persisted, NON-authoritative profile cache used only for an instant first paint.
//
// The access token is never stored here (it lives in memory in utils/api.js) and the
// session itself is the httpOnly `dp_session` cookie. Nothing read from this cache
// may be used for authorization: AuthContext replaces it with the user returned by
// GET /auth/session before any protected route renders.

export const USER_KEY = 'user';
const LEGACY_TOKEN_KEY = 'token';

function storageOf(name) {
  try {
    return typeof window !== 'undefined' ? window[name] : null;
  } catch {
    return null;
  }
}

function safeCall(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

export function getCachedUser() {
  const raw = safeCall(() => storageOf('localStorage')?.getItem(USER_KEY));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function cacheUser(user) {
  if (!user) return;
  safeCall(() => storageOf('localStorage')?.setItem(USER_KEY, JSON.stringify(user)));
}

export function clearCachedUser() {
  safeCall(() => storageOf('localStorage')?.removeItem(USER_KEY));
}

/** One-time migration: earlier builds persisted the JWT. Remove it everywhere. */
export function purgeLegacyToken() {
  safeCall(() => storageOf('localStorage')?.removeItem(LEGACY_TOKEN_KEY));
  safeCall(() => storageOf('sessionStorage')?.removeItem(LEGACY_TOKEN_KEY));
}
