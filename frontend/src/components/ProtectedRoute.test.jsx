import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './admin/AdminRoute';
import { AuthProvider } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import { setAccessToken } from '../utils/api';
import { fakeAccessToken, mockApi, restoreApi } from '../test/mockApi';

afterEach(() => {
  restoreApi();
  setAccessToken(null);
});

// No session cookie unless a test signs in.
function mockApiAnonymous() {
  mockApi(() => ({ status: 401, data: { code: 'SESSION_REQUIRED' } }));
}

/** The session endpoint (the only source of truth) returns this user. */
function signIn(role) {
  mockApi((req) => (req.url === '/auth/session'
    ? { data: { success: true, token: fakeAccessToken(), user: { name: 'Test', role } } }
    : { status: 404, data: {} }));
}

function renderAt(path) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/admin" element={<AdminRoute><p>admin page</p></AdminRoute>} />
          <Route path="/user-dashboard" element={<p>user home</p>} />
          <Route path="/garage-dashboard" element={<ProtectedRoute allowedRoles={[ROLES.GARAGE]}><p>garage home</p></ProtectedRoute>} />
          <Route path="/my-vehicles" element={<ProtectedRoute allowedRoles={[ROLES.USER]}><p>my vehicles</p></ProtectedRoute>} />
          <Route path="/help" element={<ProtectedRoute><p>shared help</p></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(mockApiAnonymous);

  it('shows the loading state, not a redirect, while the session is being restored', async () => {
    let release;
    mockApi(() => new Promise((resolve) => { release = resolve; }));
    renderAt('/garage-dashboard');

    expect(screen.getByRole('status').textContent).toMatch(/Restoring your session/);
    expect(screen.queryByText('login page')).toBeNull();
    expect(screen.queryByText('user home')).toBeNull();

    await waitFor(() => expect(typeof release).toBe('function'));
    expect(screen.queryByText('login page')).toBeNull();
    release({ data: { token: fakeAccessToken(), user: { role: 'garage' } } });
    expect(await screen.findByText('garage home')).toBeTruthy();
  });

  it('redirects signed-out users to /login', async () => {
    renderAt('/help');
    expect(await screen.findByText('login page')).toBeTruthy();
  });

  it('lets any signed-in role through when no roles are required', async () => {
    signIn('customer');
    renderAt('/help');
    expect(await screen.findByText('shared help')).toBeTruthy();
  });

  it('allows a garage (any alias) onto garage-only routes', async () => {
    signIn('service centre');
    renderAt('/garage-dashboard');
    expect(await screen.findByText('garage home')).toBeTruthy();
  });

  it('sends a vehicle owner away from garage-only routes to their home', async () => {
    signIn('vehicle_owner');
    renderAt('/garage-dashboard');
    expect(await screen.findByText('user home')).toBeTruthy();
  });

  it('sends a garage away from owner-only routes to the garage home', async () => {
    signIn('garage');
    renderAt('/my-vehicles');
    expect(await screen.findByText('garage home')).toBeTruthy();
  });
});

describe('AdminRoute', () => {
  beforeEach(mockApiAnonymous);

  it('admits normalised admin aliases', async () => {
    signIn('Administrator');
    renderAt('/admin');
    expect(await screen.findByText('admin page')).toBeTruthy();
  });

  it('rejects non-admins', async () => {
    signIn('customer');
    renderAt('/admin');
    expect(await screen.findByText('user home')).toBeTruthy();
  });

  it('requires sign-in', async () => {
    renderAt('/admin');
    expect(await screen.findByText('login page')).toBeTruthy();
  });
});
