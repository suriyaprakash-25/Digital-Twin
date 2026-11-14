import { useCallback, useEffect, useMemo, useState } from 'react';
import { AUTH_STATUS, AuthContext } from './authContextCore';
import { USER_KEY, cacheUser, clearCachedUser, getCachedUser, purgeLegacyToken } from '../utils/authStorage';
import { normalizeRole } from '../utils/roles';
import { msUntilExpiry } from '../utils/jwt';
import {
  LOGOUT_ENDPOINT,
  apiPost,
  getAccessToken,
  onAccessTokenChange,
  refreshSession,
  setAccessToken,
  setUnauthorizedHandler,
} from '../utils/api';

// Refresh the 15-minute access token this long before it expires.
const REFRESH_LEAD_MS = 60 * 1000;
const MIN_REFRESH_DELAY_MS = 5 * 1000;

/**
 * Session state for the SPA.
 *
 * - On load it restores the session from the httpOnly cookie via GET /auth/session.
 *   Until that settles `isBootstrapping` is true and ProtectedRoute shows a loader.
 * - The access token lives only in memory (utils/api.js); this provider mirrors it.
 * - The cached `user` is for first paint only; the session response replaces it.
 */
export const AuthProvider = ({ children }) => {
  const [state, setState] = useState(() => ({
    status: AUTH_STATUS.BOOTSTRAPPING,
    token: null,
    user: getCachedUser(),
  }));

  const clearLocalSession = useCallback(() => {
    clearCachedUser();
    setAccessToken(null);
    setState({ status: AUTH_STATUS.ANONYMOUS, token: null, user: null });
  }, []);

  // Mirror the api layer's in-memory token (login, silent refresh, logout).
  useEffect(() => onAccessTokenChange(({ token, user }) => {
    if (user) cacheUser(user);
    setState((prev) => {
      if (!token) return { ...prev, token: null };
      return { status: AUTH_STATUS.AUTHENTICATED, token, user: user || prev.user };
    });
  }), []);

  // Bootstrap: migrate away from the persisted token, then restore from the cookie.
  useEffect(() => {
    purgeLegacyToken();
    let cancelled = false;
    refreshSession()
      .then(({ token, user }) => {
        if (cancelled) return;
        setState({ status: AUTH_STATUS.AUTHENTICATED, token, user: user || null });
      })
      .catch(() => {
        if (cancelled) return;
        clearCachedUser();
        setState({ status: AUTH_STATUS.ANONYMOUS, token: null, user: null });
      });
    return () => { cancelled = true; };
  }, []);

  // Proactive refresh about a minute before the access token expires.
  useEffect(() => {
    if (!state.token) return undefined;
    const remaining = msUntilExpiry(state.token);
    if (remaining === null) return undefined;
    const delay = Math.max(remaining - REFRESH_LEAD_MS, MIN_REFRESH_DELAY_MS);
    // A failed proactive refresh is left to the next request's 401 handling.
    const timer = setTimeout(() => { refreshSession().catch(() => {}); }, delay);
    return () => clearTimeout(timer);
  }, [state.token]);

  // Unrecoverable 401 anywhere: drop the session and go to /login.
  useEffect(() => setUnauthorizedHandler(() => {
    clearLocalSession();
    if (window.location.pathname !== '/login') window.location.href = '/login';
  }), [clearLocalSession]);

  // Another tab logged out (it cleared the cached profile): drop our in-memory session.
  useEffect(() => {
    const onStorage = (event) => {
      if ((event.key === USER_KEY || event.key === null) && !event.newValue && getAccessToken()) {
        clearLocalSession();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [clearLocalSession]);

  /** After POST /auth/login or /auth/google: the cookie is set by the server. */
  const login = useCallback(({ token, user }) => {
    if (user) cacheUser(user);
    setAccessToken(token, user);
    setState({ status: AUTH_STATUS.AUTHENTICATED, token: token || null, user: user || null });
  }, []);

  /** Ends the server session (cookie) and clears memory. Errors are ignored. */
  const logout = useCallback(async ({ allDevices = false } = {}) => {
    try {
      await apiPost(LOGOUT_ENDPOINT, allDevices ? { allDevices: true } : {});
    } catch {
      // Logging out must always succeed locally.
    }
    clearLocalSession();
  }, [clearLocalSession]);

  const updateUser = useCallback((patch) => {
    setState((prev) => {
      const nextUser = { ...(prev.user || {}), ...(patch || {}) };
      cacheUser(nextUser);
      return { ...prev, user: nextUser };
    });
  }, []);

  const value = useMemo(() => {
    const isAuthenticated = state.status === AUTH_STATUS.AUTHENTICATED;
    return {
      status: state.status,
      isBootstrapping: state.status === AUTH_STATUS.BOOTSTRAPPING,
      isAuthenticated,
      token: state.token,
      user: state.user,
      // Authorization decisions only ever use the session-verified user.
      role: isAuthenticated && state.user ? normalizeRole(state.user.role) : null,
      login,
      logout,
      updateUser,
    };
  }, [state, login, logout, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
