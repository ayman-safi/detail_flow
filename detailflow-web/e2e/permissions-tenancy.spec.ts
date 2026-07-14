import { expect, test } from '@playwright/test';
import { accounts, activeServiceId, apiBaseUrl, loginThroughApi, resetSeed } from './fixtures';

test.beforeEach(async ({ request }) => {
  await resetSeed(request);
});

test('staff can operate bookings but cannot manage protected configuration', async ({ page }) => {
  await loginThroughApi(page.context(), accounts.staff);
  const staffList = await page.request.get(`${apiBaseUrl}/staff`);
  expect(staffList.status()).toBe(403);

  const serviceCreate = await page.request.post(`${apiBaseUrl}/services`, {
    data: { name: 'Forbidden Service', basePrice: 10, durationMinutes: 30 },
  });
  expect(serviceCreate.status()).toBe(403);

  const tenantUpdate = await page.request.patch(`${apiBaseUrl}/tenant/profile`, { data: { name: 'Forbidden Rename' } });
  expect(tenantUpdate.status()).toBe(403);

  const services = await page.request.get(`${apiBaseUrl}/services`);
  expect(services.status()).toBe(200);
  const serviceId = await activeServiceId(page.context());
  const walkIn = await page.request.post(`${apiBaseUrl}/work-orders`, {
    data: {
      customerName: 'Staff Operated Customer',
      customerPhone: '+1 555 400 0001',
      vehiclePlate: 'STAFF-E2E',
      vehicleMake: 'Ford',
      vehicleModel: 'Focus',
      vehicleColor: 'White',
      vehicleType: 'Sedan',
      serviceTypeId: serviceId,
      notes: 'Allowed staff operation',
    },
  });
  expect(walkIn.status(), await walkIn.text()).toBe(200);
});

test('manager has bounded staff and tenant permissions', async ({ page }) => {
  await loginThroughApi(page.context(), accounts.manager);
  const forbiddenManager = await page.request.post(`${apiBaseUrl}/staff`, {
    data: { fullName: 'Nested Manager', email: 'nested.manager@demo.local', phone: '+15554100001', role: 'Manager' },
  });
  expect(forbiddenManager.status()).toBe(403);

  const allowedStaff = await page.request.post(`${apiBaseUrl}/staff`, {
    data: { fullName: 'Managed Staff', email: 'managed.staff@demo.local', phone: '+15554100002', role: 'Staff' },
  });
  expect(allowedStaff.status(), await allowedStaff.text()).toBe(200);
  expect((await allowedStaff.json()).user.role).toBe('Staff');

  const tenantUpdate = await page.request.patch(`${apiBaseUrl}/tenant/profile`, { data: { name: 'Manager Rename' } });
  expect(tenantUpdate.status()).toBe(403);

  const serviceCreate = await page.request.post(`${apiBaseUrl}/services`, {
    data: { name: 'Manager Service', basePrice: 75, durationMinutes: 60 },
  });
  expect(serviceCreate.status(), await serviceCreate.text()).toBe(200);
});

test('tenant query filters isolate authenticated data', async ({ page, browser }) => {
  await loginThroughApi(page.context(), accounts.owner);
  const demoBoard = await page.request.get(`${apiBaseUrl}/work-orders/board`);
  const demoBoardBody = await demoBoard.json();
  const demoWorkOrderId = demoBoardBody.ready[0].id as string;

  const emptyContext = await browser.newContext();
  try {
    await loginThroughApi(emptyContext, accounts.emptyOwner);
    const emptyBoard = await emptyContext.request.get(`${apiBaseUrl}/work-orders/board`);
    expect(emptyBoard.status()).toBe(200);
    const emptyBoardBody = await emptyBoard.json();
    expect(Object.values(emptyBoardBody).flat()).toHaveLength(0);

    const crossTenantRead = await emptyContext.request.get(`${apiBaseUrl}/work-orders/${demoWorkOrderId}`);
    expect(crossTenantRead.status()).toBe(404);
    const emptyCustomers = await emptyContext.request.get(`${apiBaseUrl}/customers`);
    expect((await emptyCustomers.json()).total).toBe(0);
  } finally {
    await emptyContext.close();
  }
});

test('free plan boundary blocks bookings, staff growth, and analytics', async ({ page }) => {
  await loginThroughApi(page.context(), accounts.starterOwner);
  const plan = await page.request.get(`${apiBaseUrl}/plan/status`);
  expect(plan.status()).toBe(200);
  await expect(plan.json()).resolves.toMatchObject({
    plan: 'Free',
    bookingsUsed: 30,
    bookingsRemaining: 0,
    staffUsed: 2,
    analyticsEnabled: false,
  });

  const analytics = await page.request.get(`${apiBaseUrl}/analytics/dashboard`);
  expect(analytics.status()).toBe(402);
  const staff = await page.request.post(`${apiBaseUrl}/staff`, {
    data: { fullName: 'Third Free User', email: 'third@starter.local', phone: '+966511111111', role: 'Staff' },
  });
  expect(staff.status()).toBe(402);

  const serviceId = await activeServiceId(page.context(), 'starter');
  const walkIn = await page.request.post(`${apiBaseUrl}/work-orders`, {
    data: {
      customerName: 'Quota Boundary',
      customerPhone: '+966522222222',
      vehiclePlate: 'LIMIT-30',
      vehicleMake: 'Toyota',
      vehicleModel: 'Yaris',
      vehicleColor: 'White',
      vehicleType: 'Sedan',
      serviceTypeId: serviceId,
    },
  });
  expect(walkIn.status()).toBe(402);
});
