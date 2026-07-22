# DetailFlow System and Testability Report

## Outcome

The application can now be validated against a clean, dedicated PostgreSQL database with `scripts/Run-E2E.ps1`. The development seed is deterministic and repeatable, the production frontend and API build, all 52 API/integration tests pass, and all 16 Chromium Playwright scenarios pass.

Validation completed on 2026-07-11:

| Check | Result |
|---|---|
| Fresh PostgreSQL migrations | 9 migrations applied |
| .NET test suite | 52 passed, 0 failed |
| Next.js production build | Passed |
| Playwright end-to-end suite | 16 passed, 0 failed |
| ESLint | 0 errors, 19 warnings |

## Architecture and domain model

DetailFlow is a multi-tenant car-detailing SaaS. The backend is an ASP.NET Core .NET 10 API with controller endpoints, feature services, EF Core, PostgreSQL, JWT authentication in an HTTP-only cookie, tenant query filters, role checks, plan enforcement, and R2/S3-compatible object storage. The frontend is Next.js 16 with React 19, React Query, Zustand, Axios, React Hook Form/Zod, and a localized English/Arabic/Turkish UI.

The core relationship is `Tenant -> Users, Settings, Services, Customers, Vehicles, Bookings, WorkOrders, NotificationLogs`. A customer owns vehicles. A confirmed booking can create one linked work order. A work order references a customer, vehicle, service, optional booking and staff assignee; it owns stage history and photos.

Supported lifecycle values are:

- Tenant: active/inactive; Free/Pro/Business; Trial/Active/PastDue/Suspended/Manual billing.
- User: Owner/Manager/Staff; active/inactive; pending invitation represented by no password set.
- Service: active/inactive and ordered.
- Booking: Pending/Confirmed/Cancelled.
- Work order: Booked/Arrived/Washing/Detailing/Polishing/Ready/Delivered.
- Payment: Pending/Paid/Refunded.
- Notification: Requested/Accepted/Sent/Delivered/Read/Failed.

The domain does not currently implement a read-only role, custom permission combinations, entity archival, or soft deletion. Those states were therefore not invented in seed data.

## Roles and permissions

| Capability | Super Admin | Owner | Manager | Staff |
|---|---:|---:|---:|---:|
| Platform tenant search/filter/update/support session | Yes | No | No | No |
| Tenant profile update | No | Yes | No | No |
| Staff list/create/update/deactivate | No | Yes | Staff-only targets | No |
| Service create/update/reorder | No | Yes | Yes | No |
| Availability/localization settings | No | Yes | Yes | No |
| Receipt settings read | No | Yes | Yes | Yes |
| Receipt settings update | No | Yes | Yes | No |
| Booking and work-order operations | No | Yes | Yes | Yes, with restricted actions |
| Assignment | No | Yes | Yes | No |
| Tenant analytics | No | Plan permitting | Plan permitting | Plan permitting |
| Own photo deletion | No | Yes | Yes | Yes, own uploads only |

Super Admin is configuration-backed and isolated from tenant APIs. Support sessions are temporary Owner-like tenant sessions gated by explicit tenant approval and expiry.

## Business workflows reviewed

- Tenant registration creates the tenant, Owner, default settings, and default services.
- Login validates tenant/user activation and persists an HTTP-only cookie; logout and active-user middleware invalidate unusable sessions.
- Staff invitations, password setup/reset, role changes, activation and deactivation are role bounded.
- Public or internal bookings validate services and availability; confirmation links a work order; edit and cancellation preserve booking/work-order consistency.
- Walk-ins create or reuse customer/vehicle records and create a Booked work order.
- The operations board moves orders through seven stages, records history, supports assignment, pricing, notes, photos, payment, delivery, SSE refresh, public tracking, and PDF receipt generation.
- Customers support search, sorted pagination, vehicle association, and visit history.
- Settings cover tenant identity, services/order, availability, localization/currency, receipts, and WhatsApp behavior.
- Analytics summarizes daily activity, revenue, services and recent history, subject to plan limits.
- Platform administration searches, filters and updates tenants and can start bounded support access.
- Free-plan enforcement limits monthly bookings, staff count, and analytics.

## Seed data changes

The old single-tenant/random-token seed was replaced with a transactional fixture builder using SHA-256-derived stable GUIDs and fixed valid tracking tokens.

- 30 tenants across all plans, billing states, currencies, active states, and enough rows for platform pagination.
- Five named fixture tenants: populated demo, quota-bound Free, empty Business, populated Business, and suspended Pro.
- Super Admin plus Owner, Manager and Staff accounts; active, inactive and pending-invite users.
- 45 demo customers with vehicles for deterministic search, sort and three-page pagination.
- Active and inactive services with stable order.
- Every supported booking, work-order, payment and notification status.
- Realistic linked bookings, orders, stage history, assignments, photos, receipts, notifications and analytics history.
- A deliberately full public availability slot and a Free tenant at exactly 30 monthly bookings/two staff.
- Repeat calls reset fixture-tenant operational data and reproduce stable identifiers, relationships and manifest values.

`DevSeedServiceTests` verifies repeatability, cleanup of injected data, counts, stable identities and complete enum coverage.

## Playwright coverage added

Sixteen scenarios now cover:

- Valid, invalid, inactive and pending authentication; sign-out and navigation.
- Owner navigation and empty-state rendering.
- Customer pagination, search and deterministic sorting.
- Service create, update, active filtering and reorder persistence.
- Populated analytics and all notification report outcomes.
- Platform tenant pagination, filtering, search and detail inspection.
- Public availability and invalid tracking empty state.
- Walk-in form validation and creation.
- Booking create/read/update/cancel consistency.
- Unpaid-delivery rejection, payment, delivery, public tracking and PDF receipt.
- Public booking creation and tracking.
- Staff and Manager permission boundaries.
- Cross-tenant query-filter isolation and 404 behavior.
- Free-plan booking, staff and analytics limits.

The Playwright configuration runs one worker for deterministic seed resets, starts both production services, uses the dedicated database connection, and retains trace, screenshot and video artifacts on failure.

## Bugs and test issues fixed

- Fixed the global Axios 401 interceptor so expected anonymous login/invite/reset failures remain on their form instead of forcing a redirect and erasing validation feedback.
- Fixed a Super Admin session race: the globally mounted plan dialog called tenant-only `/plan/status`, whose rejection cleared the admin auth cookie. Plan status now runs only for tenant sessions.
- Added missing Turkish locale labels required by the language selector.
- Made seeded tracking tokens truly stable and valid.
- Removed the inconsistent seed relationship where a Pending booking already had a work order.
- Corrected E2E assumptions for the service-reorder response and unpaid-delivery HTTP status.
- Tightened ambiguous Playwright locators to role-based unique targets.
- Aligned browser/API hosts and isolated login-rate-limit partitions in test traffic.
- Pinned Playwright to the intended IPv4 PostgreSQL instance; an unrelated stale IPv6 database had caused schema errors.

## Remaining known issues

- ESLint reports 19 React Compiler warnings around effect-driven state, refs and React Hook Form compatibility. They do not fail builds or tests, but should be reduced.
- NuGet reports high-severity advisories for `Microsoft.OpenApi 2.4.1` and test dependency `SQLitePCLRaw.lib.e_sqlite3 2.1.11`; dependency upgrades need compatibility review.
- `npm audit` reports five dependency vulnerabilities; update and regression-test the affected dependency chain.
- `next start` works for the suite but warns because the project uses standalone output. The runner can later copy static assets and launch `.next/standalone/server.js` directly.
- Browser coverage is Chromium only. Firefox, WebKit, responsive/mobile layouts, RTL visual behavior and accessibility audits are not yet automated.
- Real R2 uploads and live WhatsApp delivery require external credentials and are not browser-tested locally.
- There is no read-only/custom-permission/archive/soft-delete behavior to cover until those product capabilities exist.

## Recommended future cases

- Concurrent booking of the last available slot and optimistic board update conflicts.
- Invite/reset token expiry, replay and cross-tenant misuse in the browser.
- Support-session expiry/revocation and restoration of the platform session.
- SSE reconnect/backoff and multi-user board synchronization.
- Photo/logo upload size, type, deletion ownership and storage failures against a disposable object-store emulator.
- Time-zone and daylight-saving boundaries, overnight availability, currency formatting, Arabic RTL and Turkish localization snapshots.
- Large exports/reports and broader database-volume performance checks.
- Firefox/WebKit projects, mobile viewports, keyboard-only navigation and automated accessibility checks.
