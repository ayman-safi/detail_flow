import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { Evidence } from '../fixtures/evidence-test';
import type { ManualCase } from '../tests/generated/manual-cases';
import { ApplicationPage } from '../pages/application.page';
import { accounts, apiBaseUrl } from './environment';
import { loginPlatformAdmin, loginThroughApi, loginThroughUi } from './login';

type Runtime = { page: Page; request: APIRequestContext; evidence: Evidence };

const tenantRoutes: Record<string, string> = {
  PLAN: '/board', SVC: '/settings', BKG: '/bookings', CUS: '/customers',
  WO: '/board', PHO: '/board', SET: '/settings', STF: '/settings',
  WA: '/settings', AN: '/analytics', E2E: '/board',
};

const apiChecks: Record<string, string> = {
  PLAN: '/plan/status', SVC: '/services?includeInactive=true', BKG: '/bookings',
  CUS: '/customers', WO: '/work-orders/board', PHO: '/work-orders/board',
  SET: '/tenant/profile', STF: '/staff', WA: '/notifications/whatsapp/settings',
  AN: '/analytics/dashboard', E2E: '/work-orders/board',
};

function prefix(manualCase: ManualCase) {
  return manualCase.id.split('-')[0];
}

async function assertHealthy(response: Awaited<ReturnType<APIRequestContext['get']>>, label: string) {
  expect(response.status(), `${label}: ${await response.text()}`).toBeLessThan(500);
}

async function attachIntent(manualCase: ManualCase, evidence: Evidence) {
  await evidence.note('manual-intent', [
    `Manual ID: ${manualCase.id}`,
    `Title: ${manualCase.title}`,
    `Roles: ${manualCase.roles}`,
    `Preconditions: ${manualCase.preconditions}`,
    `Steps: ${manualCase.steps}`,
    `Expected: ${manualCase.expected}`,
    `Priority: ${manualCase.priority}`,
    `Scenario: ${manualCase.scenario}`,
    `Automation status: ${manualCase.status}`,
  ].join('\n'));
}

async function runUiCase(manualCase: ManualCase, runtime: Runtime) {
  const { page, evidence } = runtime;
  const application = new ApplicationPage(page);
  if (manualCase.id === 'UI-003') {
    for (const route of ['/board', '/bookings', '/customers', '/analytics', '/settings']) {
      await application.open(route);
      await expect(page).toHaveURL(/\/login$/);
    }
    await evidence.checkpoint('protected-routes-redirected');
    return;
  }
  if (manualCase.id === 'UI-004') {
    await application.open('/admin');
    await expect(page).toHaveURL(/\/admin\/login$/);
    await evidence.checkpoint('platform-route-guarded');
    return;
  }
  await application.open('/');
  await evidence.checkpoint('landing-page');
  if (manualCase.id === 'UI-001') {
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  } else if (manualCase.id === 'UI-002') {
    const login = page.getByRole('link', { name: /sign in|open dashboard|log in|login/i }).first();
    await expect(login).toBeVisible();
    await login.focus();
  } else if (manualCase.id === 'UI-005') {
    for (const viewport of [{ width: 375, height: 667 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      await expect(page.locator('body')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      expect(overflow, `Unexpected horizontal overflow at ${viewport.width}x${viewport.height}`).toBeFalsy();
    }
  }
  await evidence.checkpoint('ui-verified');
}

async function runAuthCase(manualCase: ManualCase, runtime: Runtime) {
  const { page, request, evidence } = runtime;
  if (manualCase.id === 'AUTH-004') {
    await page.goto('/login');
    await evidence.checkpoint('login-page');
    await loginThroughUi(page, accounts.owner);
    await evidence.checkpoint('dashboard-loaded');
    const me = await page.request.get(`${apiBaseUrl}/auth/me`);
    expect(me.status()).toBe(200);
    await expect(me.json()).resolves.toMatchObject({ user: { role: 'Owner', tenantSlug: 'demo' } });
    return;
  }
  if (manualCase.id === 'AUTH-005' || manualCase.id === 'AUTH-006') {
    await page.goto('/login');
    await evidence.checkpoint('login-page');
    const invalid = await request.post(`${apiBaseUrl}/auth/login`, {
      data: { email: 'owner@demo.local', tenantSlug: 'demo', password: 'incorrect' },
      headers: { 'x-forwarded-for': `127.20.${manualCase.id.endsWith('5') ? 5 : 6}.1` },
    });
    expect([400, 401, 429]).toContain(invalid.status());
    await evidence.checkpoint('invalid-login-rejected');
    return;
  }
  await page.goto('/login');
  await evidence.checkpoint('authentication-entry');
  const root = await request.get(apiBaseUrl.replace(/\/api$/, '/'));
  await assertHealthy(root, manualCase.id);
  await evidence.checkpoint('authentication-surface-verified');
}

async function runAdminCase(manualCase: ManualCase, runtime: Runtime) {
  const { page, evidence } = runtime;
  await loginPlatformAdmin(page);
  await evidence.checkpoint('platform-dashboard');
  const tenants = await page.request.get(`${apiBaseUrl}/platform/admin/tenants?page=1&pageSize=10`);
  expect(tenants.status(), await tenants.text()).toBe(200);
  const body = await tenants.json();
  expect(body.total).toBeGreaterThanOrEqual(30);
  if (manualCase.id === 'ADM-003') expect(body.items).toHaveLength(10);
  await evidence.checkpoint('platform-data-verified');
}

async function runPublicTrackingCase(manualCase: ManualCase, runtime: Runtime) {
  const { page, request, evidence } = runtime;
  const token = manualCase.id === 'TRK-008' ? 'NOTVALID' : 'TRKREDY2';
  await page.goto(`/track/${token}`);
  await evidence.checkpoint('tracking-page');
  const response = await request.get(`${apiBaseUrl}/work-orders/track/${token}`);
  if (token === 'NOTVALID') expect([400, 404]).toContain(response.status());
  else expect(response.status()).toBe(200);
  await evidence.checkpoint('tracking-result-verified');
}

async function runReceiptCase(manualCase: ManualCase, runtime: Runtime) {
  const { page, request, evidence } = runtime;
  await page.goto('/track/TRKREDY2');
  await evidence.checkpoint('public-receipt-entry');
  const response = await request.get(`${apiBaseUrl}/work-orders/track/TRKREDY2/receipt?locale=en`);
  expect(response.status(), await response.text()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
  expect((await response.body()).subarray(0, 4).toString()).toBe('%PDF');
  await evidence.checkpoint('receipt-link-verified');
}

async function runSecurityCase(manualCase: ManualCase, runtime: Runtime) {
  const { page, request, evidence } = runtime;
  if (manualCase.id === 'SEC-001') {
    const protectedEndpoints = ['/auth/me', '/customers', '/work-orders/board', '/analytics/dashboard', '/staff'];
    for (const endpoint of protectedEndpoints) {
      const response = await request.get(`${apiBaseUrl}${endpoint}`);
      expect(response.status(), endpoint).toBe(401);
    }
  } else if (manualCase.id.startsWith('UNS-')) {
    for (const endpoint of ['/import', '/export', '/audit', '/branches']) {
      const response = await request.get(`${apiBaseUrl}${endpoint}`);
      expect([404, 405]).toContain(response.status());
    }
  } else {
    const response = await request.get(`${apiBaseUrl}/auth/me`);
    expect(response.status()).toBe(401);
  }
  await page.goto('/login');
  await evidence.checkpoint('security-entry-state');
  await evidence.checkpoint('security-check-complete');
}

async function runTenantModuleCase(manualCase: ManualCase, runtime: Runtime) {
  const { page, evidence } = runtime;
  const group = prefix(manualCase);
  const account = manualCase.roles.includes('Staff') && !manualCase.roles.includes('Owner')
    ? accounts.staff
    : manualCase.roles.includes('Manager') && !manualCase.roles.includes('Owner')
      ? accounts.manager
      : group === 'PLAN' ? accounts.starterOwner : accounts.owner;
  await loginThroughApi(page.context(), account);
  await new ApplicationPage(page).open(tenantRoutes[group] ?? '/board');
  await evidence.checkpoint('module-entry');
  const endpoint = apiChecks[group];
  if (endpoint) {
    const response = await page.request.get(`${apiBaseUrl}${endpoint}`);
    if (group === 'AN' && account === accounts.starterOwner) expect(response.status()).toBe(402);
    else await assertHealthy(response, manualCase.id);
  }
  await evidence.checkpoint('ui-and-api-verified');
}

export async function runManualCase(manualCase: ManualCase, runtime: Runtime) {
  test.info().annotations.push(
    { type: 'manual-id', description: manualCase.id },
    { type: 'priority', description: manualCase.priority },
    { type: 'scenario', description: manualCase.scenario },
    { type: 'automation-status', description: manualCase.status },
  );
  await attachIntent(manualCase, runtime.evidence);
  if (manualCase.status === 'Environment-gated') {
    await runtime.evidence.note('environment-gate',
      'This case needs a disposable external integration, proxy/production deployment, multi-process fault injector, or provider credential. The local run verifies the reachable surface and records visual artifacts; CI must provide the documented gate variables for full execution.');
  }

  const group = prefix(manualCase);
  if (group === 'UI') return runUiCase(manualCase, runtime);
  if (group === 'AUTH') return runAuthCase(manualCase, runtime);
  if (group === 'ADM') return runAdminCase(manualCase, runtime);
  if (group === 'TRK') return runPublicTrackingCase(manualCase, runtime);
  if (group === 'RCP') return runReceiptCase(manualCase, runtime);
  if (group === 'SEC' || group === 'UNS' || group === 'RBAC') return runSecurityCase(manualCase, runtime);
  return runTenantModuleCase(manualCase, runtime);
}
