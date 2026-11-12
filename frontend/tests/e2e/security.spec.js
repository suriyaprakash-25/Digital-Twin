// Browser-level security checks against the real backend: role gating, credential errors and
// "the access token is never persisted" (session = httpOnly cookie + in-memory access token).
import { test, expect, loginViaUi, logoutViaUi } from './support/browser.js';
import { ACCOUNTS, API_URL } from './support/env.js';

test.describe('browser security', () => {
  test('a USER is redirected away from /admin', async ({ page }) => {
    await loginViaUi(page, ACCOUNTS.owner);

    // Client-side navigation and a full page load (session restored from the cookie) both bounce.
    await page.evaluate(() => { window.history.pushState({}, '', '/admin'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await expect(page).toHaveURL(/\/user-dashboard$/);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/user-dashboard$/);
    await page.goto('/admin/payments');
    await expect(page).toHaveURL(/\/user-dashboard$/);
  });

  test('the Login form shows the backend error on wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(ACCOUNTS.owner.email);
    await page.getByLabel('Password', { exact: true }).fill('Wrong-password-123');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url() === `${API_URL}/api/auth/login` && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Sign In' }).click(),
    ]);
    expect(response.status()).toBe(401);
    const { message } = await response.json();
    expect(message).toBe('Invalid email or password');

    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('localStorage never holds a token key, during or after a session', async ({ page, context }) => {
    // Record every key the app ever writes to Web Storage, across navigations and reloads.
    const writtenKeys = new Set();
    await context.exposeBinding('__e2eStorageWrite', (_source, key) => { writtenKeys.add(String(key)); });
    await context.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        try { window.__e2eStorageWrite(key); } catch { /* binding not ready yet */ }
        return original.call(this, key, value);
      };
    });
    const storageKeys = () => page.evaluate(() => ({ local: Object.keys(window.localStorage), session: Object.keys(window.sessionStorage) }));

    await loginViaUi(page, ACCOUNTS.owner);
    const afterLogin = await storageKeys();
    expect(afterLogin.local).not.toContain('token');
    expect(afterLogin.session).not.toContain('token');

    await page.reload();
    await expect(page).toHaveURL(/\/user-dashboard$/);
    expect((await storageKeys()).local).not.toContain('token');

    await logoutViaUi(page);
    const afterLogout = await storageKeys();
    expect(afterLogout.local).not.toContain('token');
    expect(afterLogout.session).not.toContain('token');
    expect(afterLogout.local, 'cached profile is cleared on logout').not.toContain('user');

    expect([...writtenKeys]).not.toContain('token');
    // Nothing that looks like a JWT was left behind under any key either.
    const jwtLike = await page.evaluate(() => Object.values(window.localStorage).filter((v) => /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v)));
    expect(jwtLike).toEqual([]);
  });
});
