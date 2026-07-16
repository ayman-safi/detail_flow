import { expect, type APIRequestContext } from '@playwright/test';
import { apiBaseUrl } from './environment';

export async function searchCustomers(request: APIRequestContext, search = '', page = 1, limit = 20) {
  const response = await request.get(`${apiBaseUrl}/customers`, { params: { search, page, limit } });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
