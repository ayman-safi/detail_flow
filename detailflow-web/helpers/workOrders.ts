import { expect, type APIRequestContext } from '@playwright/test';
import { apiBaseUrl } from './environment';

export async function getBoard(request: APIRequestContext) {
  const response = await request.get(`${apiBaseUrl}/work-orders/board`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

export async function updateStage(request: APIRequestContext, id: string, newStage: string) {
  const response = await request.patch(`${apiBaseUrl}/work-orders/${id}/stage`, { data: { newStage } });
  return { response, body: await response.json() };
}
