import { expect, test } from '@playwright/test';
import {
  accounts,
  activeServiceId,
  apiBaseUrl,
  dateInputValue,
  loginThroughApi,
  loginThroughUi,
  nextOpenDate,
  resetSeed,
  scheduledAt,
} from './fixtures';

test.beforeEach(async ({ request }) => {
  await resetSeed(request);
});

test('walk-in form validates required fields and creates an operational card', async ({ page }) => {
  await loginThroughUi(page, accounts.owner);
  await page.getByRole('button', { name: 'Add walk-in' }).click();
  await page.getByRole('button', { name: 'Create walk-in' }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to add walk-in');

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Phone').fill('+1 555 777 0101');
  await dialog.getByLabel('Name').fill('E2E Walkin Customer');
  await dialog.getByLabel('Service').selectOption({ label: 'Exterior Wash' });
  await dialog.getByLabel('Plate').fill('E2E-WALK');
  await dialog.getByLabel('Color').fill('Blue');
  await dialog.getByLabel('Make').fill('Honda');
  await dialog.getByLabel('Model').fill('Civic');
  await dialog.getByRole('button', { name: 'Create walk-in' }).click();

  await expect(page.getByText('Walk-in added')).toBeVisible();
  await expect(page.getByText('E2E-WALK')).toBeVisible();
});

test('booking CRUD keeps its linked work order and visit counts consistent', async ({ page }) => {
  await loginThroughApi(page.context(), accounts.staff);
  const serviceId = await activeServiceId(page.context());
  const createDate = nextOpenDate(5);
  const createResponse = await page.request.post(`${apiBaseUrl}/bookings`, {
    data: {
      customerName: 'E2E Booking Customer',
      customerPhone: '+1 555 888 0101',
      vehiclePlate: 'E2E-BOOK',
      vehicleMake: 'Mazda',
      vehicleModel: '3',
      vehicleColor: 'Red',
      vehicleType: 'Sedan',
      serviceTypeId: serviceId,
      scheduledAt: scheduledAt(createDate, 11),
      notes: 'Created by Playwright',
    },
  });
  expect(createResponse.status(), await createResponse.text()).toBe(200);
  const created = await createResponse.json() as { bookingId: string; workOrderId: string };

  const updateDate = nextOpenDate(6);
  const updateResponse = await page.request.put(`${apiBaseUrl}/bookings/${created.bookingId}`, {
    data: {
      customerName: 'E2E Booking Updated',
      customerPhone: '+1 555 888 0102',
      vehiclePlate: 'E2E-UPD',
      vehicleMake: 'Mazda',
      vehicleModel: 'CX-5',
      vehicleColor: 'Gray',
      vehicleType: 'SUV',
      serviceTypeId: serviceId,
      scheduledAt: scheduledAt(updateDate, 12),
      notes: 'Updated by Playwright',
    },
  });
  expect(updateResponse.status(), await updateResponse.text()).toBe(200);
  expect((await updateResponse.json()).vehicle.plateNumber).toBe('E2E-UPD');

  const cancelResponse = await page.request.patch(`${apiBaseUrl}/bookings/${created.bookingId}/status`, {
    data: { status: 'Cancelled' },
  });
  expect(cancelResponse.status(), await cancelResponse.text()).toBe(200);
  expect((await cancelResponse.json()).status).toBe('Cancelled');

  const removedWorkOrder = await page.request.get(`${apiBaseUrl}/work-orders/${created.workOrderId}`);
  expect(removedWorkOrder.status()).toBe(404);
  const customers = await page.request.get(`${apiBaseUrl}/customers?search=E2E%20Booking%20Updated`);
  const customerBody = await customers.json();
  expect(customerBody.items[0].totalVisits).toBe(0);
});

test('unpaid ready work cannot be delivered, then produces public tracking and a PDF receipt', async ({ page }) => {
  await loginThroughApi(page.context(), accounts.owner);
  const boardResponse = await page.request.get(`${apiBaseUrl}/work-orders/board`);
  const board = await boardResponse.json();
  const ready = board.ready.find((item: { trackingToken: string }) => item.trackingToken === 'TRKREDY2');
  expect(ready).toBeTruthy();

  const blocked = await page.request.patch(`${apiBaseUrl}/work-orders/${ready.id}/stage`, { data: { newStage: 'Delivered' } });
  expect(blocked.status()).toBe(400);
  await expect(blocked.json()).resolves.toMatchObject({ code: 'BAD_REQUEST' });

  const paid = await page.request.patch(`${apiBaseUrl}/work-orders/${ready.id}/payment-status`, { data: { status: 'Paid' } });
  expect(paid.status(), await paid.text()).toBe(200);
  const delivered = await page.request.patch(`${apiBaseUrl}/work-orders/${ready.id}/stage`, { data: { newStage: 'Delivered' } });
  expect(delivered.status(), await delivered.text()).toBe(200);

  const receipt = await page.request.get(`${apiBaseUrl}/work-orders/${ready.id}/receipt?locale=en`);
  expect(receipt.status()).toBe(200);
  expect(receipt.headers()['content-type']).toContain('application/pdf');
  expect((await receipt.body()).subarray(0, 4).toString()).toBe('%PDF');

  await page.goto('/track/TRKREDY2');
  await expect(page.getByText('Your vehicle has been delivered.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Receipt PDF' })).toBeVisible();
});

test('public booking form creates a trackable booking', async ({ page }) => {
  await page.goto('/book/demo');
  await expect(page.getByRole('heading', { name: 'Demo Detail Shop' })).toBeVisible();
  await page.getByText('Exterior Wash', { exact: true }).click();
  await page.locator('#public-date').fill(dateInputValue(nextOpenDate(7)));
  const slot = page.getByRole('button', { name: /^\d{1,2}:\d{2}/ }).filter({ visible: true }).first();
  await expect(slot).toBeEnabled();
  await slot.click();
  await page.getByLabel('Name').fill('Public E2E Customer');
  await page.getByLabel('Phone number').fill('+1 555 999 0101');
  await page.getByLabel('Make').fill('Volvo');
  await page.getByLabel('Model').fill('XC60');
  await page.getByLabel('Plate').fill('PUB-E2E');
  await page.getByLabel('Color').fill('Silver');
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy tracking link' })).toBeVisible();
});
