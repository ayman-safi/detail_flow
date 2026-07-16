import { expect, type APIRequestContext } from '@playwright/test';
import { apiBaseUrl } from './environment';

export async function getTenantProfile(request: APIRequestContext) {
  const response = await request.get(`${apiBaseUrl}/tenant/profile`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

export async function getPlanStatus(request: APIRequestContext) {
  const response = await request.get(`${apiBaseUrl}/plan/status`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
