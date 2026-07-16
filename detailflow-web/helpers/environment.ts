export const webBaseUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
export const apiBaseUrl = process.env.E2E_API_URL ?? 'http://localhost:5000/api';

export const accounts = {
  owner: { email: 'owner@demo.local', tenantSlug: 'demo', password: 'Password123!' },
  manager: { email: 'manager@demo.local', tenantSlug: 'demo', password: 'Password123!' },
  staff: { email: 'staff@demo.local', tenantSlug: 'demo', password: 'Password123!' },
  starterOwner: { email: 'owner@starter.local', tenantSlug: 'starter', password: 'Password123!' },
  emptyOwner: { email: 'owner@empty.local', tenantSlug: 'empty', password: 'Password123!' },
} as const;
