import { expect, type APIRequestContext } from '@playwright/test';
import { apiBaseUrl } from './environment';

export async function getServices(request: APIRequestContext, includeInactive = false) {
  const response = await request.get(`${apiBaseUrl}/services`, { params: { includeInactive } });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
