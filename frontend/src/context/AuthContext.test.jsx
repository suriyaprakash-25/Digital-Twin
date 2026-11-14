import { afterEach, describe, expect, it } from 'vitest';
import { useEffect } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { useAuth } from './authContextCore';
import { getAccessToken, setAccessToken, setUnauthorizedHandler } from '../utils/api';
import { fakeAccessToken, mockApi, restoreApi } from '../test/mockApi';

afterEach(() => {
  restoreApi();
  setAccessToken(null);
  setUnauthorizedHandler(null);
});

// Latest context value, captured from an effect (not during render).
const latest = { current: null };
const Probe = () => {
  const auth = useAuth();
  useEffect(() => { latest.current = auth; });
  return <p>status:{auth.status} user:{auth.user?.name || '-'} role:{auth.role || '-'}</p>;
};

const renderProvider = () => render(<AuthProvider><Probe /></AuthProvider>);
const isSession = (req) => req.url === '/auth/session';

describe('AuthProvider', () => {
  it('bootstraps the user and in-memory token from GET /auth/session', async () => {
    const token = fakeAccessToken();
    mockApi((req) => (isSession(req) ? { data: { success: true, token, user: { name: 'Asha', role: 'garage' } } } : null));

    renderProvider();
    expect(screen.getByText(/status:bootstrapping/)).toBeTruthy();

    await screen.findByText('status:authenticated user:Asha role:GARAGE');
    expect(latest.current.token).toBe(token);
    expect(getAccessToken()).toBe(token);
    expect(window.localStorage.getItem('token')).toBeNull();
  });

  it('ends anonymous when there is no session, and ignores a stale cached profile for roles', async () => {
    window.localStorage.setItem('user', JSON.stringify({ name: 'Stale', role: 'admin' }));
    mockApi(() => ({ status: 401, data: { code: 'SESSION_REQUIRED' } }));

    renderProvider();
    expect(screen.getByText(/role:-/)).toBeTruthy(); // cached role is never trusted

    await screen.findByText('status:anonymous user:- role:-');
    expect(window.localStorage.getItem('user')).toBeNull();
  });

  it('deletes a legacy persisted token on startup', async () => {
    window.localStorage.setItem('token', 'old-jwt');
    window.sessionStorage.setItem('token', 'old-jwt');
    mockApi(() => ({ status: 401, data: {} }));

    renderProvider();
    await screen.findByText(/status:anonymous/);
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
  });

  it('login keeps the token in memory only', async () => {
    mockApi(() => ({ status: 401, data: {} }));
    renderProvider();
    await screen.findByText(/status:anonymous/);

    const token = fakeAccessToken();
    act(() => latest.current.login({ token, user: { name: 'Ravi', role: 'customer' } }));

    await screen.findByText('status:authenticated user:Ravi role:USER');
    expect(getAccessToken()).toBe(token);
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
    const everything = Object.keys(window.localStorage).map((k) => window.localStorage.getItem(k)).join('|');
    expect(everything).not.toContain(token);
  });

  it('logout calls POST /auth/logout (allDevices when asked) and clears memory, even if it fails', async () => {
    const token = fakeAccessToken();
    const calls = mockApi((req) => {
      if (isSession(req)) return { data: { token, user: { name: 'Asha', role: 'USER' } } };
      if (req.url === '/auth/logout') return { status: 500, data: {} };
      return null;
    });
    renderProvider();
    await screen.findByText(/status:authenticated/);

    await act(async () => { await latest.current.logout({ allDevices: true }); });

    const logoutCall = calls.find((c) => c.url === '/auth/logout');
    expect(logoutCall.method).toBe('post');
    expect(logoutCall.data).toEqual({ allDevices: true });
    expect(logoutCall.requestedWith).toBe('XMLHttpRequest');
    await waitFor(() => expect(screen.getByText('status:anonymous user:- role:-')).toBeTruthy());
    expect(getAccessToken()).toBeNull();
  });
});
