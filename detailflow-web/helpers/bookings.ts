import { expect, type APIRequestContext } from '@playwright/test';
import { apiBaseUrl } from './environment';

export async function getBookings(request: APIRequestContext, date?: string) {
  const response = await request.get(`${apiBaseUrl}/bookings`, { params: date ? { date } : undefined });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

export async function getAvailability(request: APIRequestContext, date: string, serviceTypeId: string) {
  const response = await request.get(`${apiBaseUrl}/bookings/availability`, { params: { date, serviceTypeId } });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
