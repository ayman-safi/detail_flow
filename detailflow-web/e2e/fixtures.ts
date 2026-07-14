import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

export const apiBaseUrl = process.env.E2E_API_URL ?? 'http://localhost:5000/api';
export const password = 'Password123!';
let loginPartition = 10;

export const accounts = {
  owner: { email: 'owner@demo.local', tenantSlug: 'demo', password },
  manager: { email: 'manager@demo.local', tenantSlug: 'demo', password },
  staff: { email: 'staff@demo.local', tenantSlug: 'demo', password },
  inactive: { email: 'inactive@demo.local', tenantSlug: 'demo', password },
  pending: { email: 'pending@demo.local', tenantSlug: 'demo', password },
  starterOwner: { email: 'owner@starter.local', tenantSlug: 'starter', password },
  emptyOwner: { email: 'owner@empty.local', tenantSlug: 'empty', password },
  suspendedOwner: { email: 'owner@suspended.local', tenantSlug: 'suspended', password },
} as const;

export type Account = (typeof accounts)[keyof typeof accounts];

export async function resetSeed(request: APIRequestContext) {
  const response = await request.post(`${apiBaseUrl}/dev/seed`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

export async function loginThroughUi(page: Page, account: Account) {
  await page.route('**/api/auth/login', async route => {
    await route.continue({
      headers: { ...route.request().headers(), 'x-forwarded-for': nextLoginAddress() },
    });
  }, { times: 1 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByLabel('Shop ID').fill(account.tenantSlug);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByRole('heading', { name: 'Operations board' })).toBeVisible();
}

export async function loginThroughApi(context: BrowserContext, account: Account) {
  const response = await context.request.post(`${apiBaseUrl}/auth/login`, {
    data: account,
    headers: { 'x-forwarded-for': nextLoginAddress() },
  });
  expect(response.status(), await response.text()).toBe(200);
  await copyAuthCookieToBrowser(context, response.headers()['set-cookie']);
  const data = await response.json() as { user: { id: string; fullName: string; email: string; role: string; tenantId: string; tenantSlug: string } };
  await context.addInitScript(user => {
    window.localStorage.setItem('detailflow-auth', JSON.stringify({ state: { user }, version: 0 }));
  }, data.user);
  return data;
}

export async function loginPlatformAdminThroughUi(page: Page) {
  await page.route('**/api/platform/auth/login', async route => {
    await route.continue({
      headers: { ...route.request().headers(), 'x-forwarded-for': nextLoginAddress() },
    });
  }, { times: 1 });
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('admin@detailflow.local');
  await page.getByLabel('Password').fill('AdminPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Platform Admin' })).toBeVisible();
}

function nextLoginAddress() {
  loginPartition = loginPartition >= 250 ? 10 : loginPartition + 1;
  return `127.0.2.${loginPartition}`;
}

async function copyAuthCookieToBrowser(context: BrowserContext, setCookieHeader?: string) {
  expect(setCookieHeader, 'Authentication response should set a cookie.').toBeTruthy();
  const cookiePair = setCookieHeader!.split(';', 1)[0];
  const separator = cookiePair.indexOf('=');
  await context.addCookies([{
    name: cookiePair.slice(0, separator),
    value: cookiePair.slice(separator + 1),
    url: 'http://localhost:5000',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  }]);
}

export function nextOpenDate(daysFromNow = 4) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromNow);
  while (date.getDay() === 5) date.setDate(date.getDate() + 1);
  return date;
}

export function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function scheduledAt(date: Date, hour = 10, minute = 0) {
  const value = new Date(date);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

export async function activeServiceId(context: BrowserContext, tenantSlug = 'demo', name = 'Exterior Wash') {
  const response = await context.request.get(`${apiBaseUrl}/public/shops/${tenantSlug}/services`);
  expect(response.status(), await response.text()).toBe(200);
  const services = await response.json() as Array<{ id: string; name: string }>;
  return services.find(service => service.name === name)?.id ?? expect(false, `${name} service was not seeded`).toBeTruthy();
}
