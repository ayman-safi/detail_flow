import { expect, test } from '@playwright/test';
import { accounts, apiBaseUrl, loginThroughUi, resetSeed } from './fixtures';

test.beforeEach(async ({ request }) => {
  await resetSeed(request);
});

test('login validation and inactive account states are enforced', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('owner@demo.local');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByLabel('Shop ID').fill('demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('Invalid credentials');

  for (const account of [accounts.inactive, accounts.pending, accounts.suspendedOwner]) {
    const response = await request.post(`${apiBaseUrl}/auth/login`, { data: account });
    expect(response.status()).toBe(401);
  }
});

test('owner can navigate the seeded operational application and sign out', async ({ page }) => {
  await loginThroughUi(page, accounts.owner);
  await expect(page.getByText('DF-1001')).toBeVisible();
  await expect(page.getByText('DF-6006')).toBeVisible();
  await expect(page.getByText('Ready', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Bookings' }).click();
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.getByRole('heading', { name: 'New booking' }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Customers' }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(page.getByRole('heading', { name: 'Customers' }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByText('Jobs this week')).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('empty tenant renders empty states without leaking demo data', async ({ page }) => {
  await loginThroughUi(page, accounts.emptyOwner);
  await expect(page.getByText('DF-1001')).toHaveCount(0);
  await expect(page.getByText('No vehicles in this stage').first()).toBeVisible();

  await page.getByRole('link', { name: 'Customers' }).click();
  await expect(page.getByText('No customers found')).toBeVisible();

  await page.getByRole('link', { name: 'Bookings' }).click();
  await expect(page.getByText('No bookings for this day.')).toBeVisible();

  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page.getByText('Bookings today').locator('..').getByText('0')).toBeVisible();
});
