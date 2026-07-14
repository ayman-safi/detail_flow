import { expect, test } from '@playwright/test';
import {
  accounts,
  apiBaseUrl,
  loginPlatformAdminThroughUi,
  loginThroughApi,
  loginThroughUi,
  resetSeed,
} from './fixtures';

test.beforeEach(async ({ request }) => {
  await resetSeed(request);
});

test('customer search, deterministic sorting, and pagination work in the UI and API', async ({ page }) => {
  await loginThroughUi(page, accounts.owner);
  await page.getByRole('link', { name: 'Customers' }).click();
  await expect(page.getByText('Page 1 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();

  await page.getByPlaceholder('Search name or phone').fill('Boundary Search');
  await expect(page.getByText('Boundary Search Customer')).toBeVisible();
  await expect(page.getByText('Page 1 of 1')).toBeVisible();

  const response = await page.request.get(`${apiBaseUrl}/customers?limit=50`);
  const names = ((await response.json()).items as Array<{ fullName: string }>).map(item => item.fullName);
  expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
});

test('service catalog supports create, update, active filtering, and deterministic reorder', async ({ page }) => {
  await loginThroughApi(page.context(), accounts.owner);
  const initialResponse = await page.request.get(`${apiBaseUrl}/services?includeInactive=true`);
  const initial = await initialResponse.json() as Array<{ id: string; name: string; isActive: boolean }>;
  expect(initial.find(service => service.name === 'Legacy Hand Wax')?.isActive).toBe(false);

  const create = await page.request.post(`${apiBaseUrl}/services`, {
    data: { name: 'Playwright Service', description: 'Created by E2E', basePrice: 88, durationMinutes: 75 },
  });
  expect(create.status(), await create.text()).toBe(200);
  const created = await create.json();

  const update = await page.request.patch(`${apiBaseUrl}/services/${created.id}`, {
    data: { name: 'Playwright Service Updated', isActive: false, basePrice: 99 },
  });
  expect(update.status(), await update.text()).toBe(200);

  const activeOnly = await page.request.get(`${apiBaseUrl}/services`);
  expect((await activeOnly.json()).some((service: { id: string }) => service.id === created.id)).toBe(false);

  const allResponse = await page.request.get(`${apiBaseUrl}/services?includeInactive=true`);
  const all = await allResponse.json() as Array<{ id: string }>;
  const reversedIds = all.map(service => service.id).reverse();
  const reorder = await page.request.patch(`${apiBaseUrl}/services/reorder`, { data: { orderedIds: reversedIds } });
  expect(reorder.status(), await reorder.text()).toBe(200);
  const reordered = await page.request.get(`${apiBaseUrl}/services?includeInactive=true`);
  expect((await reordered.json()).map((service: { id: string }) => service.id)).toEqual(reversedIds);
});

test('analytics and notification report fixtures cover populated dashboard outcomes', async ({ page }) => {
  await loginThroughApi(page.context(), accounts.owner);
  const analytics = await page.request.get(`${apiBaseUrl}/analytics/dashboard`);
  expect(analytics.status()).toBe(200);
  const dashboard = await analytics.json();
  expect(dashboard.today.activeVehicles).toBeGreaterThanOrEqual(4);
  expect(dashboard.topServices.length).toBeGreaterThan(0);
  expect(dashboard.jobsByDay.length).toBeGreaterThan(0);
  expect(dashboard.recentActivity.length).toBeGreaterThan(0);

  const logs = await page.request.get(`${apiBaseUrl}/notifications/whatsapp/logs?limit=20`);
  expect(logs.status()).toBe(200);
  const statuses = new Set((await logs.json()).map((entry: { status: string }) => entry.status));
  expect(statuses).toEqual(new Set(['Requested', 'Accepted', 'Sent', 'Delivered', 'Read', 'Failed']));
});

test('platform admin can paginate, filter, search, and inspect multiple tenants', async ({ page }) => {
  await loginPlatformAdminThroughUi(page);
  const pageOne = await page.request.get(`${apiBaseUrl}/platform/admin/tenants?page=1&pageSize=10`);
  const first = await pageOne.json();
  expect(first.total).toBeGreaterThanOrEqual(30);
  expect(first.items).toHaveLength(10);
  const pageTwo = await page.request.get(`${apiBaseUrl}/platform/admin/tenants?page=2&pageSize=10`);
  expect((await pageTwo.json()).items).toHaveLength(10);

  const filtered = await page.request.get(`${apiBaseUrl}/platform/admin/tenants?plan=Free&active=true&pageSize=100`);
  const filteredBody = await filtered.json();
  expect(filteredBody.items.length).toBeGreaterThan(0);
  expect(filteredBody.items.every((tenant: { plan: string; isActive: boolean }) => tenant.plan === 'Free' && tenant.isActive)).toBe(true);

  await expect(page.getByText(/30 total/)).toBeVisible();
  await page.getByLabel('Search tenants').fill('suspended');
  await expect(page.getByRole('heading', { name: 'Suspended Detail Shop' })).toBeVisible();
  await expect(page.getByText('Demo Detail Shop')).toHaveCount(0);
});

test('public availability exposes full slots and invalid tracking has a safe empty state', async ({ page, request }) => {
  const servicesResponse = await request.get(`${apiBaseUrl}/public/shops/demo/services`);
  const services = await servicesResponse.json() as Array<{ id: string; name: string }>;
  const exterior = services.find(service => service.name === 'Exterior Wash');
  expect(exterior).toBeTruthy();
  const seed = await resetSeed(request);
  const availability = await request.get(`${apiBaseUrl}/public/shops/demo/availability`, {
    params: {
      date: seed.demo.availabilityFullSlot.date,
      serviceTypeId: exterior!.id,
      timezoneOffsetMinutes: 0,
    },
  });
  const slots = await availability.json() as Array<{ time: string; available: boolean }>;
  expect(slots.find(slot => slot.time === '10:00')?.available).toBe(false);

  await page.goto('/track/NOTVALID');
  await expect(page.getByRole('heading', { name: 'Booking not found.' })).toBeVisible();
});
