import { expect, type APIRequestContext } from '@playwright/test';
import { apiBaseUrl } from '../helpers/environment';

export async function resetSeed(request: APIRequestContext) {
  const response = await request.post(`${apiBaseUrl}/dev/seed`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
