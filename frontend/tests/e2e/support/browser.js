import { test as base, expect } from '@playwright/test';
import { API_URL, BASE_URL } from './env.js';

const CASHFREE_SDK = /^https:\/\/sdk\.cashfree\.com\//;
const LOCAL_ORIGINS = [new URL(BASE_URL).origin, new URL(API_URL).origin];

/**
 * Stand-in for Cashfree Drop.js v3. The app calls `Cashfree({ mode }).checkout({ paymentSessionId,
 * redirectTarget: '_modal' })` and then POSTs /payments/verify (hooks/useCashfreeCheckout.js).
 * This fake resolves the checkout as a completed modal payment; the backend MockGateway
 * (PAYMENT_GATEWAY=mock) then confirms the order for the amount it was created with.
 * Calls are recorded on window.__e2eCashfreeCalls so the spec can assert what the app sent.
 */
const FAKE_CASHFREE_SDK = `
(function () {
  window.__e2eCashfreeCalls = window.__e2eCashfreeCalls || [];
  window.Cashfree = function Cashfree(options) {
    var mode = options && options.mode;
    return {
      checkout: function checkout(args) {
        window.__e2eCashfreeCalls.push({ mode: mode, paymentSessionId: args && args.paymentSessionId, redirectTarget: args && args.redirectTarget });
        return Promise.resolve({ paymentDetails: { paymentMessage: 'Payment finished. Check status.' } });
      }
    };
  };
})();
`;

/**
 * Hermetic network: the app may only talk to the preview server and the E2E backend. The Cashfree
 * SDK is replaced by the fake above; every other third-party request (Google sign-in, fonts,
 * Firebase) is aborted so the run never depends on the internet or on real credentials.
 */
export async function installNetworkPolicy(context) {
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (CASHFREE_SDK.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: FAKE_CASHFREE_SDK });
    }
    if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    let origin = '';
    try { origin = new URL(url).origin; } catch { /* unparsable: abort below */ }
    return LOCAL_ORIGINS.includes(origin) ? route.continue() : route.abort('blockedbyclient');
  });
}

/** New isolated browser context (separate cookie jar = separate signed-in user). */
export async function newRoleContext(browser) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 900 } });
  await installNetworkPolicy(context);
  return context;
}

/** Signs in through the real Login page and waits for the role's home page. */
export async function loginViaUi(page, account) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url() === `${API_URL}/api/auth/login` && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Sign In' }).click(),
  ]);
  expect(response.status(), `login for ${account.email} failed: ${await response.text()}`).toBe(200);
  await expect(page).toHaveURL(new RegExp(`${account.home}$`));
}

/** Clicks an entry in the signed-in sidebar ("Main navigation"). */
export async function openFromSidebar(page, name, path) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

/** Signs out with the top-bar Logout button (MainLayout), which ends the cookie session. */
export async function logoutViaUi(page) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url() === `${API_URL}/api/auth/logout` && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Logout', exact: true }).first().click(),
  ]);
  expect(response.ok(), `logout failed: ${response.status()}`).toBeTruthy();
  // MainLayout replaces the location with the landing page after logout.
  await expect(page).toHaveURL(`${BASE_URL}/`);
}

/** GET an API path from inside the page, authenticated only by the httpOnly session cookie. */
export async function apiGetFromPage(page, path) {
  return page.evaluate(async ({ url }) => {
    const res = await fetch(url, { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' } });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body };
  }, { url: `${API_URL}/api${path}` });
}

/** `test` whose default page/context use the hermetic network policy. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await installNetworkPolicy(context);
    await use(context);
  },
});

export { expect };
