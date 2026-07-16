import { expect, type BrowserContext, type Page } from '@playwright/test';
import { accounts, apiBaseUrl } from './environment';

export type TenantAccount = (typeof accounts)[keyof typeof accounts];
let loginPartition = 20;

function nextAddress() {
  loginPartition = loginPartition >= 240 ? 20 : loginPartition + 1;
  return `127.0.3.${loginPartition}`;
}

export async function loginThroughUi(page: Page, account: TenantAccount = accounts.owner) {
  await page.route('**/api/auth/login', async route => {
    await route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': nextAddress() } });
  }, { times: 1 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByLabel('Shop ID').fill(account.tenantSlug);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByRole('heading', { name: 'Operations board' })).toBeVisible();
}

export async function loginThroughApi(context: BrowserContext, account: TenantAccount = accounts.owner) {
  const response = await context.request.post(`${apiBaseUrl}/auth/login`, {
    data: account,
    headers: { 'x-forwarded-for': nextAddress() },
  });
  expect(response.status(), await response.text()).toBe(200);
  const header = response.headers()['set-cookie'];
  expect(header).toBeTruthy();
  const pair = header.split(';', 1)[0];
  const separator = pair.indexOf('=');
  await context.addCookies([{
    name: pair.slice(0, separator), value: pair.slice(separator + 1),
    url: 'http://localhost:5000', httpOnly: true, secure: false, sameSite: 'Lax',
  }]);
  const body = await response.json();
  await context.addInitScript(user => {
    window.localStorage.setItem('detailflow-auth', JSON.stringify({ state: { user }, version: 0 }));
  }, body.user);
  return body;
}

export async function loginPlatformAdmin(page: Page) {
  await page.route('**/api/platform/auth/login', async route => {
    await route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': nextAddress() } });
  }, { times: 1 });
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('admin@detailflow.local');
  await page.getByLabel('Password').fill('AdminPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Platform Admin' })).toBeVisible();
}
