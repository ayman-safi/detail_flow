import { expect, type APIRequestContext } from '@playwright/test';
import { apiBaseUrl } from './environment';

export async function getAnalyticsDashboard(request: APIRequestContext) {
  const response = await request.get(`${apiBaseUrl}/analytics/dashboard`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
