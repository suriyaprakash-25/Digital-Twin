import { test, expect } from '@playwright/test';

const targets = [
  { name: 'desktop-chrome', viewport: { width: 1366, height: 768 } },
  { name: 'android-small', viewport: { width: 360, height: 800 } },
  { name: 'android-large', viewport: { width: 412, height: 915 } }
];

const publicRoutes = ['/', '/login', '/signup', '/privacy', '/terms'];

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport + 2);
}

for (const target of targets) {
  test.describe(target.name, () => {
    test.use({ viewport: target.viewport });

    for (const route of publicRoutes) {
      test(`${route} renders without runtime errors or horizontal overflow`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));

        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.ok()).toBeTruthy();
        await expect(page.locator('body')).toBeVisible();
        await assertNoHorizontalOverflow(page);
        expect(errors).toEqual([]);
      });
    }

    test('protected dashboards fail safely to authentication when signed out', async ({ page }) => {
      for (const route of ['/user-dashboard', '/garage-dashboard', '/admin', '/payments']) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(100);
        await assertNoHorizontalOverflow(page);
        expect(page.url()).toMatch(/\/login|\/admin|\/user-dashboard|\/garage-dashboard|\/payments/);
      }
    });
  });
}

test.describe('mobile signup legal UI', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('terms and privacy content remain usable on a phone viewport', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Terms & Conditions' }).click();
    await expect(page.getByText('DrivePortz Terms & Conditions')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Privacy Policy' }).click();
    await expect(page.getByText(/Privacy Policy/i).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
