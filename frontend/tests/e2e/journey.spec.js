// Cross-role journey through the real UI against the real backend and a throwaway MongoDB:
// owner adds a vehicle and books the seeded garage -> garage accepts, starts and completes the job
// (invoice generated) -> owner pays it (fake Cashfree SDK + backend MockGateway) -> session survives
// a reload -> sign-out locks the protected pages again.
//
// Serial: every step depends on the previous one, so a failure skips the rest.
import { test, expect } from '@playwright/test';
import { ACCOUNTS, API_URL, SEEDED_GARAGE } from './support/env.js';
import { apiGetFromPage, loginViaUi, logoutViaUi, newRoleContext, openFromSidebar } from './support/browser.js';

test.describe.configure({ mode: 'serial' });

// Unique per worker start, so a CI retry (new worker) never collides with the previous attempt.
const VEHICLE_NUMBER = `TN09E2E${Date.now().toString().slice(-6)}`;
const EXPECTED_GRAND_TOTAL = '1,180.00'; // seeded service price 1000 as labour + 18% GST

const isApi = (method, path) => (r) => r.request().method() === method && r.url().split('?')[0] === `${API_URL}/api${path}`;
const isApiPrefix = (method, prefix) => (r) => r.request().method() === method && r.url().startsWith(`${API_URL}/api${prefix}`);

async function expectOk(response, label) {
  expect(response.ok(), `${label} -> HTTP ${response.status()}: ${await response.text().catch(() => '')}`).toBeTruthy();
  return response;
}

/** The garage dashboard booking card for our vehicle that offers `buttonName`. */
function bookingCard(page, buttonName) {
  return page
    .locator('div')
    .filter({ hasText: VEHICLE_NUMBER })
    .filter({ has: page.getByRole('button', { name: buttonName, exact: true }) })
    .last();
}

test.describe('cross-role booking, invoice and payment journey', () => {
  let ownerContext;
  let garageContext;
  let owner;
  let garage;
  let invoiceNumber;

  test.beforeAll(async ({ browser }) => {
    ownerContext = await newRoleContext(browser);
    garageContext = await newRoleContext(browser);
    owner = await ownerContext.newPage();
    garage = await garageContext.newPage();
  });

  test.afterAll(async () => {
    await ownerContext?.close();
    await garageContext?.close();
  });

  test('1. owner signs in and adds a vehicle', async () => {
    await loginViaUi(owner, ACCOUNTS.owner);
    await openFromSidebar(owner, 'Add Vehicle', '/add-vehicle');
    await expect(owner.getByRole('heading', { name: 'Register Vehicle' })).toBeVisible();

    await owner.getByLabel(/^Vehicle Number/).fill(VEHICLE_NUMBER);
    await owner.getByLabel('Brand', { exact: true }).fill('Honda');
    await owner.getByLabel(/^Model Name/).fill('City');
    await owner.getByLabel(/^Fuel Type/).selectOption('Petrol');
    await owner.getByLabel(/^Manufacturing Year/).fill('2021');
    await owner.getByLabel(/^Current Odometer/).fill('15000');

    const [response] = await Promise.all([
      owner.waitForResponse(isApi('POST', '/vehicles/add')),
      owner.getByRole('button', { name: /Register Complete Profiling/ }).click(),
    ]);
    await expectOk(response, 'add vehicle');
    await expect(owner.getByRole('heading', { name: 'Vehicle Added Successfully' })).toBeVisible();
  });

  test('2. owner requests a booking for the seeded garage service', async () => {
    await openFromSidebar(owner, 'Garages', '/marketplace');
    const vehicleSelect = owner.getByLabel('Vehicle', { exact: true });
    await expect(vehicleSelect.locator('option', { hasText: VEHICLE_NUMBER })).toHaveCount(1);
    await vehicleSelect.selectOption({ label: VEHICLE_NUMBER });

    const request = owner.getByRole('button', { name: `Request ${SEEDED_GARAGE.serviceTitle} at ${SEEDED_GARAGE.name}` });
    await expect(request).toBeEnabled();
    const [response] = await Promise.all([
      owner.waitForResponse(isApi('POST', '/bookings')),
      request.click(),
    ]);
    await expectOk(response, 'create booking');
    expect(response.request().postDataJSON()).toMatchObject({ serviceId: expect.any(String), vehicleId: expect.any(String) });
    await expect(owner.getByText(`Booking requested for ${SEEDED_GARAGE.serviceTitle}!`, { exact: false })).toBeVisible();
  });

  test('3. garage accepts, starts and completes the booking, generating an invoice', async () => {
    await loginViaUi(garage, ACCOUNTS.garage);
    await expect(garage.getByRole('heading', { name: 'Booking Requests' })).toBeVisible();

    const [accepted] = await Promise.all([
      garage.waitForResponse(isApiPrefix('PATCH', '/bookings/')),
      bookingCard(garage, 'Accept Booking').getByRole('button', { name: 'Accept Booking' }).click(),
    ]);
    await expectOk(accepted, 'accept booking');
    expect(accepted.request().postDataJSON()).toEqual({ status: 'ACCEPTED' });

    const [started] = await Promise.all([
      garage.waitForResponse(isApiPrefix('PATCH', '/bookings/')),
      bookingCard(garage, 'Start Job').getByRole('button', { name: 'Start Job' }).click(),
    ]);
    await expectOk(started, 'start job');
    expect(started.request().postDataJSON()).toEqual({ status: 'IN_PROGRESS' });

    await bookingCard(garage, 'Mark Complete').getByRole('button', { name: 'Mark Complete', exact: true }).click();
    await expect(garage).toHaveURL(/\/garage\/add-service\?.*completionMode=true/);
    await expect(garage.getByRole('heading', { name: 'Complete Service' })).toBeVisible();
    await expect(garage.getByText('Completion Mode', { exact: true })).toBeVisible();
    await expect(garage.getByText(VEHICLE_NUMBER).first()).toBeVisible(); // booking prefill: vehicle locked to the job

    await garage.getByLabel(/^Current Odometer/).fill('15500');
    const labourRate = garage.getByLabel('Labour item 1 rate per hour in rupees');
    await expect(labourRate).toHaveValue(String(SEEDED_GARAGE.servicePrice)); // prefilled from the booked service

    await garage.getByRole('button', { name: /Complete Service & Generate Invoice/ }).click();
    const confirm = garage.getByRole('dialog', { name: 'Confirm Invoice Generation' });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText(EXPECTED_GRAND_TOTAL);

    const [completed] = await Promise.all([
      garage.waitForResponse(isApi('POST', '/services/complete')),
      confirm.getByRole('button', { name: 'Confirm & Generate' }).click(),
    ]);
    await expectOk(completed, 'complete service');
    const body = await completed.json();
    expect(body.success).toBe(true);
    invoiceNumber = body.invoiceNumber;
    expect(invoiceNumber, 'completion response carries the invoice number').toBeTruthy();

    await expect(garage.getByRole('heading', { name: 'Service Completed Successfully' })).toBeVisible();
    await expect(garage.getByText(invoiceNumber, { exact: true }).first()).toBeVisible();
    await expect(garage.getByText(EXPECTED_GRAND_TOTAL).first()).toBeVisible();
  });

  test('4. owner pays the invoice in the Payment Center and it is CAPTURED', async () => {
    await openFromSidebar(owner, 'Payment Center', '/payments');
    await expect(owner.getByRole('heading', { name: 'Payment Center' })).toBeVisible();

    const invoiceRows = owner.getByRole('row').filter({ hasText: invoiceNumber });
    await expect(invoiceRows).toHaveCount(1);
    await expect(invoiceRows).toContainText('Pending');
    await expect(invoiceRows).toContainText(VEHICLE_NUMBER);

    const created = owner.waitForResponse(isApi('POST', '/payments/create-order'));
    const verified = owner.waitForResponse(isApi('POST', '/payments/verify'));
    await invoiceRows.getByRole('button', { name: 'Pay Now' }).click();

    const order = await (await expectOk(await created, 'create-order')).json();
    expect(order.gateway).toBe('mock');
    expect(order.amount).toBe(1180);
    const verify = await (await expectOk(await verified, 'verify')).json();
    expect(verify.success).toBe(true);

    // The app handed the backend's payment session to the (fake) Cashfree modal.
    const sdkCalls = await owner.evaluate(() => window.__e2eCashfreeCalls || []);
    expect(sdkCalls).toEqual([expect.objectContaining({ paymentSessionId: order.paymentSessionId, redirectTarget: '_modal' })]);

    await expect(owner.getByText('Payment successful! Your invoice has been settled.')).toBeVisible();
    await expect(invoiceRows.filter({ hasText: 'Paid' })).toHaveCount(1);
    await expect(invoiceRows.getByRole('button', { name: 'Pay Now' })).toHaveCount(0);

    // Server truth, fetched from the page with only the httpOnly session cookie.
    const status = await apiGetFromPage(owner, `/payments/status/${encodeURIComponent(order.cfOrderId)}`);
    expect(status.status).toBe(200);
    expect(status.body.payment).toMatchObject({ status: 'CAPTURED', invoiceNumber, amount: 1180 });

    const history = await apiGetFromPage(owner, '/payments/history');
    expect(history.status).toBe(200);
    const forInvoice = history.body.payments.filter((p) => p.invoiceNumber === invoiceNumber);
    expect(forInvoice.filter((p) => p.status === 'CAPTURED')).toHaveLength(1);
  });

  test('5. owner reloads and is still signed in (cookie session restore)', async () => {
    await owner.reload();
    await expect(owner).toHaveURL(/\/payments$/);
    await expect(owner.getByRole('heading', { name: 'Payment Center' })).toBeVisible();
    await expect(owner.getByRole('row').filter({ hasText: invoiceNumber }).filter({ hasText: 'Paid' })).toHaveCount(1);
    const storageKeys = await owner.evaluate(() => Object.keys(window.localStorage));
    expect(storageKeys).not.toContain('token');
  });

  test('6. owner signs out and protected pages redirect to login', async () => {
    await logoutViaUi(owner);
    const cookies = await ownerContext.cookies(API_URL);
    expect(cookies.find((c) => c.name === 'dp_session')).toBeUndefined();

    for (const path of ['/payments', '/user-dashboard', '/add-vehicle']) {
      await owner.goto(path);
      await expect(owner, `${path} should require a session`).toHaveURL(/\/login$/);
    }
    const session = await apiGetFromPage(owner, '/auth/session');
    expect(session.status).toBe(401);
  });
});
