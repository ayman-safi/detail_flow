# DetailFlow Comprehensive Manual Regression Test Suite

## 1. Purpose and coverage basis

This checklist is a full manual regression suite for the DetailFlow multi-tenant vehicle-detailing SaaS as implemented in this repository on 2026-07-12. It is based on static inspection of the Next.js UI, ASP.NET Core API, domain models, authorization rules, plan enforcement, database query filters, deterministic development seed, integration tests, and Playwright tests.

The implemented user types are:

- **Platform Super Admin**: configuration-backed platform operator. Uses `/admin` and platform APIs. Has no normal tenant access unless a support session is started.
- **Tenant Owner**: full tenant administrator and operational user.
- **Tenant Manager**: operational user with bounded staff/configuration permissions.
- **Tenant Staff**: standard operational user. This is the implemented equivalent of a Standard User.
- **Support Session**: temporary Owner-like tenant session created by a Platform Super Admin, bounded by tenant activation, explicit support access, and expiry.
- **Anonymous Customer/Public User**: uses public shop booking, tracking, public receipts, and tracking SSE.

There is **no separate Tenant Admin, Read-Only User, custom role, custom permission set, branch administrator, or end-customer account**. Cases UNS-001 through UNS-006 verify that these capabilities are not accidentally exposed or assignable.

### Coverage notes

- Every implemented UI route and API module is covered.
- CRUD is covered where the product implements it. Hard delete is implemented only for work-order photos; other records use status/activation controls or have no deletion feature.
- Search, filtering, sorting, and pagination are covered where implemented.
- There is no application import/export feature. Receipt PDF download is the only implemented document export. This is explicitly tested rather than inventing unsupported behavior.
- Audit/history exists for work-order stage changes and notification delivery logs. There is no general audit log for settings, users, services, bookings, or platform changes.
- External R2 and WhatsApp-provider tests require disposable non-production credentials.

## 2. Role and permission reference

| Capability | Super Admin | Support Session | Owner | Manager | Staff | Public |
|---|---:|---:|---:|---:|---:|---:|
| Platform tenant administration | Yes | No | No | No | No | No |
| Tenant profile update/logo upload | No | Owner-like | Yes | No | No | No |
| Staff list/create/update | No | Owner-like | Yes | Staff targets only | No | No |
| Service list (active) | No | Yes | Yes | Yes | Yes | Public shop only |
| Service create/update/reorder/inactive list | No | Owner-like | Yes | Yes | No | No |
| Availability/localization update | No | Owner-like | Yes | Yes | No | No |
| Receipt settings read | No | Yes | Yes | Yes | Yes | No |
| Receipt settings update | No | Owner-like | Yes | Yes | No | No |
| Booking/customer/work-order operations | No | Yes | Yes | Yes | Yes | Public booking only |
| Assign staff, set price/notes/payment | No | Owner-like | Yes | Yes | No | No |
| Move work-order stage | No | Yes | Yes | Yes | Yes | No |
| Photo upload/list | No | Yes | Yes | Yes | Yes | No |
| Photo delete | No | Any tenant photo | Any tenant photo | Any tenant photo | Own uploads only | No |
| Analytics | No | Plan-dependent | Plan-dependent | Plan-dependent | Plan-dependent | No |
| WhatsApp settings update | No | Owner-like | Yes | No | No | No |
| WhatsApp settings/logs read | No | Owner-like | Yes | No | No | No |
| Public shop, tracking, public receipt | Yes | Yes | Yes | Yes | Yes | Yes |

## 3. Standard test data and environment

Run against an isolated test database. Reset with `POST /api/dev/seed` in Development or `scripts/Run-E2E.ps1`. Never use production tenant data.

| Fixture | Credential / value | Purpose |
|---|---|---|
| Platform Super Admin | `admin@detailflow.local` / `AdminPassword123!` | Platform administration |
| Demo Owner | tenant `demo`; `owner@demo.local` / `Password123!` | Full tenant access |
| Demo Manager | tenant `demo`; `manager@demo.local` / `Password123!` | Manager boundaries |
| Demo Staff | tenant `demo`; `staff@demo.local` / `Password123!` | Staff boundaries |
| Second Demo Staff | tenant `demo`; `jordan@demo.local` / `Password123!` | Assignment/photo ownership/concurrency |
| Inactive User | tenant `demo`; `inactive@demo.local` / `Password123!` | Login/session invalidation |
| Pending Invite | tenant `demo`; `pending@demo.local` | Invite acceptance |
| Free quota tenant | tenant `starter`; `owner@starter.local` / `Password123!` | Booking/staff/analytics limits |
| Empty tenant | tenant `empty`; `owner@empty.local` / `Password123!` | Empty states and isolation |
| Business tenant | tenant `business`; owner/manager/staff fixture users | Unlimited-plan workflows |
| Suspended tenant | tenant `suspended`; `owner@suspended.local` / `Password123!` | Tenant activation checks |
| Tracking tokens | `TRKBKED2`, `TRKRRVD2`, `TRKWSH22`, `TRKDTL22`, `TRKPLSH2`, `TRKREDY2`, `TRKDLVR2` | All tracking stages |

For each authorization case, verify both the UI (control hidden/disabled or redirect) and a direct API request (401/403 or the documented safe 404), because client-side hiding is not security.

## 4. Manual regression checklist

### A. Public landing, navigation, layout, localization, and resilience

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| UI-001 | ☐ Landing page renders all sections and CTAs | Public | App running | 1. Open `/`.<br>2. Inspect hero, features, workflow, Saudi-market section, pricing, FAQ, final CTA, header/footer. | All sections render without broken content; CTAs and anchors are operable; no authenticated-only data is requested. | High | Positive |
| UI-002 | ☐ Landing CTA navigation | Public | None | Activate login/register/pricing/navigation links by mouse and keyboard. | Internal links open the correct routes/sections; focus is visible; no dead links. | High | Positive |
| UI-003 | ☐ Dashboard authentication guard | Public | Logged out | Open `/board`, `/bookings`, `/customers`, `/analytics`, and `/settings` directly. | Each route redirects to `/login`; protected content does not flash or expose data. | High | Authorization/Negative |
| UI-004 | ☐ Platform route authentication guard | Public, Owner | Logged out, then logged in as Owner | Open `/admin`; repeat as tenant Owner. | Both are redirected to `/admin/login`; tenant cookie cannot authorize platform APIs. | High | Authorization/Negative |
| UI-005 | ☐ Responsive layouts | All UI roles, Public | Viewports 375x667, 768x1024, 1280x800, 1920x1080 | Visit every available route at each viewport; open sidebar, dialogs, sheets, tables, board lanes. | No clipped primary actions, inaccessible fields, unintended horizontal page overflow, or overlapping fixed controls; board uses intended horizontal lane scrolling. | High | Edge/UX |
| UI-006 | ☐ English, Arabic RTL, and Turkish switching | Tenant roles, Public | Locales available | Switch among `en`, `ar`, `tr` on landing, auth, dashboard, public booking, and tracking. | Text changes consistently; Arabic direction/layout mirrors; persisted locale survives refresh; dates/numbers/currency use selected locale. | High | Positive/Localization |
| UI-007 | ☐ Unsupported/removed locale value | Tenant roles | Ability to alter stored locale/API response in test env | Set an unknown locale or remove current locale from available list; reload. | UI falls back safely, does not crash, and does not render raw undefined keys. | Medium | Edge/Negative |
| UI-008 | ☐ Global loading, empty, and recoverable error states | All roles | Throttle network; return 404/500 once | Visit each data screen while slow; load empty tenant; inject one recoverable error and retry. | Skeletons/empty states/errors are understandable; retry or refresh recovers; stale data from another tenant is never shown. | High | Error handling |
| UI-009 | ☐ Browser back/forward and deep links | All roles | Authenticated as applicable | Navigate across modules, open a deep-linked public track/book route, use browser back/forward and refresh. | Route and session state remain coherent; refresh does not lose authorization incorrectly; dialogs do not trap navigation. | Medium | Journey/Edge |
| UI-010 | ☐ Keyboard and accessible naming smoke test | All roles, Public | None | Traverse each page with Tab/Shift+Tab/Enter/Escape; inspect form labels, buttons, dialogs, table headers, status text. | Interactive controls are reachable and named; focus stays within open modal/sheet and returns to trigger; status is not conveyed by color alone. | High | Accessibility |
| UI-011 | ☐ Error boundary behavior | All roles | Force a client component render error in test build | Open affected route, then navigate/retry. | Friendly fallback appears; sensitive stack details are absent in production mode; unaffected navigation remains usable. | Medium | Error handling |
| UI-012 | ☐ Root/API health response and production artifacts | Public | Production-like deployment | Open `/`, API root, unknown route, and inspect console/network. | App/API respond as configured; unknown routes return correct 404; no source maps/secrets/debug seed UI are exposed unintentionally. | Medium | Operational/Security |

### B. Tenant authentication, registration, invitations, reset, and sessions

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| AUTH-001 | ☐ Register a new tenant | Public | Unique slug/email | Complete `/register` with valid name, slug, owner details, and password. | Tenant, Owner, default settings/services are created atomically; secure auth cookie is issued; user reaches board as Owner. | High | Positive/CRUD-Create |
| AUTH-002 | ☐ Registration required-field and format validation | Public | None | Submit empty form; test 1-char names, invalid email, password under 8, slug under 3/over 30, uppercase, spaces, underscore, Unicode, leading/trailing whitespace. | Invalid submissions are blocked with field/API feedback; no partial tenant/user/services are created. | High | Validation/Negative |
| AUTH-003 | ☐ Duplicate slug and global email | Public | Existing tenant/owner | Register using existing slug; repeat with existing email and new slug. | Each request fails safely; error is understandable; existing records unchanged; transaction leaves no orphan. | High | Negative/Integrity |
| AUTH-004 | ☐ Valid tenant login | Owner, Manager, Staff | Active user and tenant | Enter matching tenant slug, email (mixed case/trimmed), and correct password. | User-specific role and tenant are returned; HTTP-only auth cookie set; dashboard opens. | High | Positive |
| AUTH-005 | ☐ Invalid credential enumeration resistance | Public | Existing and non-existing values | Try wrong password, wrong tenant, unknown email, inactive tenant, inactive user, and pending user. | All fail with equivalent generic invalid-credentials behavior; no tenant/user existence leak; no cookie issued. | High | Security/Negative |
| AUTH-006 | ☐ Login validation and rate limiting | Public | None | Submit malformed email/missing fields; then exceed configured attempts from same partition. | Validation returns 400-style response; excess attempts return 429 with stable error; normal login works after window/reset. | High | Validation/Security |
| AUTH-007 | ☐ Session restoration with `/auth/me` | Owner, Manager, Staff | Logged in | Refresh browser and open protected page in a new tab. | Session restores correct id, name, role, tenant; no login flash or cross-tab inconsistency. | High | Positive |
| AUTH-008 | ☐ Logout and cookie invalidation | All authenticated roles | Logged in | Log out; press Back; call protected API; call logout again. | Cookie expires; protected API returns 401; protected UI redirects; repeated logout is harmless. | High | Positive/Security |
| AUTH-009 | ☐ Tampered, expired, wrong issuer/audience JWT | All authenticated roles | Test HTTP client | Modify cookie signature/claims; use expired token; wrong issuer/audience; missing tenant/user/role claim. | Request is rejected; no fallback role/tenant access; cookie does not authenticate. | High | Security/Negative |
| AUTH-010 | ☐ Active user middleware invalidates deactivated user | Staff | Staff logged in; Owner in another session | Owner deactivates Staff; Staff makes another request and refreshes. | Existing Staff session becomes unusable immediately/next request; tenant data is not returned. | High | Authorization/Journey |
| AUTH-011 | ☐ Active tenant middleware invalidates tenant sessions | Owner, Manager, Staff | Tenant users logged in; Super Admin available | Super Admin deactivates tenant; users call APIs; reactivate and log in again. | Existing sessions are rejected while inactive; public shop is hidden; reactivation permits fresh login. | High | Authorization/Journey |
| AUTH-012 | ☐ Create and accept Staff invitation | Owner, Manager, invited Staff | Active tenant under staff limit | Create Staff, copy invite link, open logged out, set valid password. | Pending account created with no usable password; link authenticates correct user once; account becomes active login-capable. | High | Positive/Journey |
| AUTH-013 | ☐ Invite token lifetime, replay, replacement, and purpose binding | Owner, invited Staff | Generate links | Generate two invite links; use first; test expired/used/random token and invite token on reset endpoint. | Older sibling token is invalidated; valid latest token works once within 7 days; expired/replayed/wrong-purpose tokens fail generically. | High | Security/Edge |
| AUTH-014 | ☐ Invite cannot target active-password or inactive account | Owner, Manager | Existing accepted and inactive users | Request invite links for both. | Requests fail without creating usable links or notifications. | High | Negative |
| AUTH-015 | ☐ Create and consume password-reset link | Owner/Manager managing Staff, Staff | Accepted active account | Generate reset link; set new 8+ char password; try old and new passwords. | New password works, old password fails, link is single-use; user is logged in after reset. | High | Positive/Journey |
| AUTH-016 | ☐ Reset token expiry, replay, replacement, and pending-user restriction | Owner, Staff | Generate links | Generate two reset links; test first, expired (>1 hour), replay, random token, and pending-invite user. | Only latest valid token works once; pending/inactive users cannot reset; failures do not reveal account details. | High | Security/Negative |
| AUTH-017 | ☐ Password boundary and hostile payloads | Public, invited Staff | Register/invite/reset forms | Test 7 and 8 chars, very long password, leading/trailing spaces, Unicode, JSON/script strings. | Minimum enforced consistently; accepted content is hashed, never reflected/logged; app remains responsive. | High | Validation/Security |
| AUTH-018 | ☐ Cookie security attributes and CORS | All authenticated roles | HTTPS-like deployment and allowed/disallowed origin | Inspect `Set-Cookie`; issue credentialed requests from configured and unconfigured origins. | Cookie is HTTP-only, environment-appropriate Secure/SameSite/path/expiry; allowed origins work; unlisted origins receive no credentialed CORS access. | High | Security |

### C. Platform Super Admin and support access

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| ADM-001 | ☐ Platform Super Admin login and session restore | Super Admin | Platform credentials configured | Log in at `/admin/login`; refresh `/admin`; call platform `/me`. | SuperAdmin identity is restored; admin dashboard loads; tenant plan-status API is not called. | High | Positive |
| ADM-002 | ☐ Platform login invalid/missing configuration | Public | Wrong credentials; separate env missing config | Try wrong credentials and rate-limit threshold; start app without admin config. | Login fails generically/429 when limited; missing config fails safely without default production credential. | High | Security/Negative |
| ADM-003 | ☐ Tenant list default sort, metrics, and pagination | Super Admin | 30+ tenants | Open admin list; compare created dates; call page/pageSize boundaries (0, negative, >100, beyond last). | Sorted newest first; owner/stats match tenant data; page clamps to >=1 and size to 1..100; empty last page handled. | High | Positive/Edge |
| ADM-004 | ☐ Tenant search | Super Admin | Seed tenants | Search exact/partial/mixed-case name and slug; whitespace; no-match term. | Matching tenants returned case-insensitively by name/slug; trimmed; empty state correct. | High | Positive/Negative |
| ADM-005 | ☐ Tenant filters and combinations | Super Admin | Diverse plans/states | Filter Free/Pro/Business, active/inactive, each billing status; combine with search. | Results satisfy every selected filter; total and selected detail stay coherent. | High | Positive |
| ADM-006 | ☐ View tenant detail | Super Admin | Select tenant | Inspect identity, plan, billing, notes, add-on, support state, stats, users, pending/inactive indicators. | Detail matches database and list summary; users sorted by role/name; no password/token/secret fields exposed. | High | Positive/Read |
| ADM-007 | ☐ Update plan and billing status | Super Admin | Selected active tenant | Change each plan and billing status; refresh; log in as tenant and inspect plan gates. | Changes persist and immediately drive quota/feature behavior; unrelated fields unchanged. | High | Positive/CRUD-Update/Journey |
| ADM-008 | ☐ Update billing notes validation | Super Admin | Selected tenant | Save whitespace, exactly 2000 chars, 2001 chars, script/HTML text. | Whitespace becomes null; 2000 persists as text; >2000 rejected; content is not executed. | Medium | Validation/Security |
| ADM-009 | ☐ Update WhatsApp add-on count | Super Admin | Pro/Business tenant | Set positive, zero, negative, very large values; inspect plan status. | Positive/zero persist; negative normalizes to zero; quotas recalculate without integer/UI corruption. | High | Edge/Validation |
| ADM-010 | ☐ Deactivate and reactivate tenant | Super Admin, tenant roles, Public | Sessions/public page open | Disable tenant; test existing/new logins and public shop; reactivate. | Disabled tenant sessions and public booking fail; stats/data remain stored; reactivation restores access without data loss. | High | Authorization/Journey |
| ADM-011 | ☐ Start support session | Super Admin, Support Session | Active tenant | Start 60-minute support session; inspect returned identity and board; call `/auth/me`. | Cookie becomes temporary Owner-like support session for selected tenant; banner/identity and expiry shown; redirect to board. | High | Positive/Journey |
| ADM-012 | ☐ Support duration boundaries | Super Admin | Active tenant | Request null, <15, 15, 480, >480 minutes. | Null defaults to 60; values clamp to 15..480; JWT expiry never exceeds support expiry or configured auth expiry. | High | Edge/Security |
| ADM-013 | ☐ Support session authorization scope | Support Session | Active support session | Perform Owner-level tenant actions; call platform APIs and access another tenant's IDs. | Owner-like actions work only in selected tenant; platform policy and other tenants remain inaccessible. | High | Authorization/Security |
| ADM-014 | ☐ Revoke/expire support access | Super Admin, Support Session | Support session active | Disable support access or set expiry past; continue calls and refresh. | Session rejected on next request; no tenant data returned; new support session required. | High | Security/Journey |
| ADM-015 | ☐ Support session inactive tenant restriction | Super Admin | Inactive tenant | Attempt to start support session directly and via UI. | UI disables control; API rejects; no support cookie/access window created. | High | Authorization/Negative |
| ADM-016 | ☐ Platform/tenant cookie context switch | Super Admin, Support Session | Admin logged in | Start support session; later log out and return to `/admin`. | Context switch is explicit and safe; tenant support cookie cannot call platform APIs; re-login required if original admin cookie was replaced. | High | Security/Edge |
| ADM-017 | ☐ Non-admin platform API denial | Owner, Manager, Staff, Public | Sessions as listed | Directly list/get/patch tenants and start support session. | Public gets 401; tenant roles get 403; no tenant platform data or change occurs. | High | Authorization/Negative |

### D. Tenant isolation and role-based access controls

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| RBAC-001 | ☐ Cross-tenant ID isolation across all resources | Owner, Manager, Staff | Valid IDs from `demo` and `business` | While logged into one tenant, call booking, work-order, photo, staff, service and settings operations using other tenant IDs. | Reads/updates/deletes fail as safe 404/authorization response; no existence leak or mutation across tenants. | High | Security/Authorization |
| RBAC-002 | ☐ Cross-tenant list/query isolation | All tenant roles | Data in multiple tenants | Compare board, bookings, customers, services, staff, analytics, notification logs and plan status. | Every list/stat contains only current tenant data; cached responses do not bleed between tenants. | High | Security |
| RBAC-003 | ☐ Super Admin excluded from tenant APIs | Super Admin | Admin session | Call representative tenant endpoints without support session. | Requests fail because admin lacks tenant claims/normal tenant authorization; no implicit tenant selected. | High | Authorization/Negative |
| RBAC-004 | ☐ Staff UI and direct-API permission boundaries | Staff | Logged in | Inspect settings/work-order controls; directly call staff management, inactive service list, service mutations, availability/localization/receipt update, profile/logo update, assign/price/payment. | Restricted UI absent/disabled; APIs reject; permitted operational/read actions still work. | High | Authorization |
| RBAC-005 | ☐ Manager boundaries against Owner accounts | Manager | Owner and Staff targets exist | Try create Manager/Owner; edit/deactivate/reset/invite Owner or Manager; create/manage Staff. | Manager can only create/manage Staff; all Owner/non-Staff targets rejected; Staff actions work. | High | Authorization |
| RBAC-006 | ☐ Owner self-protection and role changes | Owner | At least two Owner-capable users | Try deactivate self/change own role; edit another user role/status. | Self-deactivation and self-role change rejected; permitted changes to other tenant users persist. | High | Authorization/Integrity |
| RBAC-007 | ☐ Direct enum injection for unsupported roles | Owner, Super Admin | API client | Submit `ReadOnly`, `TenantAdmin`, `StandardUser`, `SuperAdmin`, numeric out-of-range, and malformed role values to staff create/update. | Model binding rejects unknown values; no user is created/changed; SuperAdmin cannot be created as tenant user. | High | Validation/Security |
| RBAC-008 | ☐ Stale permission after role change | Owner, Manager/Staff target | Target logged in | Owner changes target Manager→Staff or Staff→Manager; target continues using existing session. | Active-user/session processing reflects intended claim behavior; at minimum privileged API cannot remain usable indefinitely; fresh login gets new role. Record a defect if stale JWT grants old privilege until expiry. | High | Security/Edge |

### E. Plans, quotas, and upgrade behavior

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| PLAN-001 | ☐ Plan status values by Free/Pro/Business | Tenant roles, Support Session | Seed tenants | Open settings/header usage and call `/plan/status` in each plan. | Plan, used/limit/remaining/warning, staff, photo, WhatsApp, analytics and multi-location fields match configured quotas. | High | Positive |
| PLAN-002 | ☐ Free monthly booking limit | All tenant roles, Public | Free tenant at 30 current-month bookings | Try internal booking, public booking, and walk-in. | Each is rejected with 402 `plan_limit_exceeded` and upgrade metadata; no partial customer/vehicle/booking/work-order/visit increment. | High | Negative/Integrity |
| PLAN-003 | ☐ Booking quota monthly boundary and concurrency | Owner, Public | Free tenant at 29; two clients | Create final allowed booking concurrently; retry after UTC month boundary. | At most one reaches 30; serializable handling prevents quota overflow; new month resets usage by creation timestamp. | High | Edge/Concurrency |
| PLAN-004 | ☐ Staff-account plan limit | Owner, Manager | Free at 2 users; Pro at 10 | Try create above limit, including when existing user inactive/pending. | All user rows count; over-limit creation returns 402 with no partial token/user; Business is unlimited. | High | Negative |
| PLAN-005 | ☐ Photo-per-work-order plan limit | All tenant roles | Work orders with Free 3 / Pro 10 photos | Upload through limit, then one more; delete one and retry. | Allowed counts succeed; over-limit gets 402 before storage write; deletion frees capacity. | High | Boundary |
| PLAN-006 | ☐ Analytics plan gate | Owner, Manager, Staff | Free and paid tenants | Open analytics UI and call API directly. | Free shows upgrade panel and API 402; Pro/Business return tenant metrics for all tenant roles. | High | Authorization/Plan |
| PLAN-007 | ☐ WhatsApp plan and provider-send gate | Owner and operational roles | Free and Pro tenants | Open notification settings; create a manual `wa.me` share; enable provider delivery/send an automatic message. | Manual message preparation remains available to operational users on any plan; Owner-only provider settings and automatic provider delivery are upgrade-gated to paid plans and quotas; no provider secret leaks. | High | Plan/Authorization |
| PLAN-008 | ☐ WhatsApp included plus add-on quota | Owner, Super Admin | Pro at 500 sends; add-on configurable | Reach 500, add quota, send, exhaust combined quota. | Usage counts non-failed automatic sends for current month; remaining clamps at 0; add-on expands limit; overage is blocked without provider call. | High | Boundary/Journey |
| PLAN-009 | ☐ Downgrade below current usage | Super Admin, Owner | Business tenant exceeding Free limits | Downgrade to Free; inspect existing data and attempt new gated actions. | Existing data remains readable; new bookings/staff/photos/analytics/WhatsApp obey Free restrictions; no destructive truncation. | High | Edge/Journey |

### F. Service catalog

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| SVC-001 | ☐ List active services and sort order | All tenant roles | Active/inactive services | Open booking/walk-in/service views and call default list. | Only active services returned, ascending `sortOrder`; fields and currency display correctly. | High | Positive/Read |
| SVC-002 | ☐ Include inactive authorization | Owner, Manager, Staff | Inactive service exists | Request `includeInactive=true` via UI/API as each role. | Owner/Manager see active and inactive; Staff is rejected; public never sees inactive. | High | Authorization |
| SVC-003 | ☐ Create service | Owner, Manager | Settings open | Create with valid name, description, price, duration, order. | Service persists in tenant, appears in correct order and booking choices if active. | High | Positive/CRUD-Create |
| SVC-004 | ☐ Service create validation | Owner, Manager | None | Test blank name; null/0/negative/>999999 price; null/0/>1440 duration; order <0/>10000; long/hostile text. | Invalid values rejected without record; accepted text is rendered safely. | High | Validation/Negative |
| SVC-005 | ☐ Partial service update | Owner, Manager | Existing service | Change each field independently; omit others; refresh. | Only supplied fields change; decimal precision and descriptions persist; tenant isolation maintained. | High | Positive/CRUD-Update |
| SVC-006 | ☐ Activate/deactivate service | Owner, Manager | Service used by historical records | Toggle inactive then active. | Inactive disappears from new booking/public/walk-in choices but remains in historical booking/work-order detail; reactivation restores choice. | High | Journey/Integrity |
| SVC-007 | ☐ Reorder services | Owner, Manager | 3+ services | Drag/reorder; refresh UI and public page. | Requested IDs receive sequential order 1..n; order persists everywhere. | High | Positive/Sorting |
| SVC-008 | ☐ Reorder invalid payload | Owner, Manager | Known and foreign IDs | Submit empty, duplicates, missing/nonexistent/cross-tenant IDs. | Validation fails atomically; original orders unchanged; no cross-tenant existence leak. | High | Validation/Security |
| SVC-009 | ☐ Staff service mutation denial | Staff | Logged in | Directly create/update/reorder/deactivate service. | Every mutation rejected and catalog unchanged. | High | Authorization/Negative |

### G. Availability, internal booking, public booking, and booking lifecycle

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| BKG-001 | ☐ Daily booking list and calendar | Owner, Manager, Staff, Support Session | Bookings across dates/statuses | Select dates and compare list; pass timezone offsets. | Only bookings in selected local day returned, ordered by scheduled time; status, customer, vehicle, service, work-order link/token correct. | High | Positive/Read/Sorting |
| BKG-002 | ☐ Empty booking date | Tenant roles | Date with no bookings | Select date. | Clear empty state; count is zero; create form remains available. | Medium | Edge |
| BKG-003 | ☐ Availability slot generation | Tenant roles, Public | Active service; known hours/capacity | Query an open date at multiple timezone offsets. | 30-minute start slots fit full service duration inside local opening hours; booking count/available flag reflect overlapping confirmed bookings and bay capacity. | High | Positive/Time zone |
| BKG-004 | ☐ Closed day and closure period | Tenant roles, Public | Configure weekly closed day and date-range closure | Query availability and attempt booking on each. | Availability is empty; create is rejected with correct closed-day/date reason; no records created. | High | Negative/Validation |
| BKG-005 | ☐ Business-hour boundaries | Tenant roles, Public | Open 08:00–20:00; 60-minute service | Book 08:00, 19:00, before 08:00, after 19:00, and crossing midnight. | Exact-fitting starts succeed; outside/cross-day times fail; displayed slots match API acceptance. | High | Boundary |
| BKG-006 | ☐ Capacity overlap with varied service durations | Tenant roles, Public | Capacity and 30/60/90-minute services | Create overlapping confirmed bookings at capacity; try same/partially overlapping slot and non-overlap. | Overlap count uses duration; full overlaps return unavailable/409; non-overlap succeeds. | High | Edge/Concurrency |
| BKG-007 | ☐ Create internal booking | Owner, Manager, Staff | Future available slot and active service | Complete form with valid customer, phone, vehicle, service, notes. | Confirmed booking and linked Booked work order created atomically; visit increments; board/customers/plan usage refresh; tracking URL returned. | High | Positive/CRUD-Create/Journey |
| BKG-008 | ☐ Internal booking required fields and enums | Tenant roles | None | Omit/shorten each required field; invalid GUID/service, invalid vehicle type, past/now/default date. | Client/API reject; no partial entities or quota increment. | High | Validation/Negative |
| BKG-009 | ☐ Phone and plate normalization | Tenant roles, Public | Existing customer/vehicle | Rebook using phone punctuation/spaces and plate lowercase/spacing variants. | Phone is digits-only and plate uppercased/trimmed; matching canonical record reused where equivalent; unintended duplicate avoided. | High | Edge/Data integrity |
| BKG-010 | ☐ Existing customer name mismatch behavior | Tenant roles | Existing phone under another name | Internal booking with same phone/different name; inspect notes/customer. | Existing internal customer name remains; entered name is preserved in booking notes marker; visit increments once. | Medium | Edge |
| BKG-011 | ☐ Existing public customer/vehicle update behavior | Public | Existing phone/plate | Publicly book with changed name, make/model/color/type. | Existing tenant customer name and vehicle details update as implemented; no cross-tenant match; new booking/work order links correctly. | High | Positive/Integrity |
| BKG-012 | ☐ Create public booking journey | Public | Active shop, available future slot | Open `/book/{slug}`, load shop/services/availability, submit valid details. | Shop branding/currency and only active services show; confirmed booking/work order created; success exposes tracking route without tenant authentication. | High | Positive/Journey |
| BKG-013 | ☐ Public invalid/inactive shop isolation | Public | Unknown and inactive slugs | Open shop and call services/availability/create. | Returns safe not-found; tenant configuration/data is not exposed; no booking created. | High | Security/Negative |
| BKG-014 | ☐ Public booking abuse validation/rate limit | Public | None | Submit malformed/oversized/hostile fields, invalid service from another tenant, repeated requests above limit. | Validation/tenant binding rejects bad requests; 429 at threshold; no script execution or cross-tenant booking. | High | Security/Negative |
| BKG-015 | ☐ Get and edit Booked booking | Tenant roles | Confirmed booking with linked stage Booked | Open edit; change customer, vehicle, service, schedule, notes; save. | Booking and linked work order update consistently; visits move correctly if customer changes; board receives updated card. | High | Positive/CRUD-Read-Update |
| BKG-016 | ☐ Edit booking validation and slot conflict | Tenant roles | Editable booking | Set past/closed/outside-hours/full slot/inactive service and invalid fields. | Save rejected; original booking/work order/customer/visit counts remain unchanged. | High | Validation/Negative |
| BKG-017 | ☐ Edit non-Booked or cancelled booking | Tenant roles | Linked work order Arrived+; cancelled booking | Attempt edit via UI/API. | Rejected with conflict; operational work order/history remains unchanged. | High | Integrity/Negative |
| BKG-018 | ☐ Confirm pending booking | Tenant roles | Seed pending booking without work order | Change status to Confirmed. | Schedule/capacity/plan validated; linked Booked work order created once; customer visit increments; board event emitted. | High | Positive/Journey |
| BKG-019 | ☐ Cancel pending/confirmed Booked booking | Tenant roles | Pending and confirmed Booked examples | Cancel with confirmation dialog; refresh board/customers. | Booking becomes Cancelled; linked Booked work order removed; visit decrements without going below zero; board removal event emitted. | High | Positive/CRUD-Status |
| BKG-020 | ☐ Cancel booking after work has started | Tenant roles | Linked work order Arrived+ | Attempt cancellation. | Rejected; booking/work order/visit/history unchanged. | High | Integrity/Negative |
| BKG-021 | ☐ Invalid booking status transitions | Tenant roles | Confirmed/cancelled bookings | Move Confirmed→Pending; change Cancelled; repeat same status; send invalid enum. | Back-to-pending and any cancelled change rejected; idempotent same status is safe; invalid enum rejected; no duplicate work order. | High | Validation/Edge |
| BKG-022 | ☐ Booking race for last slot | Tenant roles, Public | One capacity remains | Submit two simultaneous requests from different clients. | Serializable transaction allows one and rejects other with conflict; capacity/quota/customer visits remain correct. | High | Concurrency |
| BKG-023 | ☐ Booking UI failure recovery | Tenant roles, Public | Inject timeout/500 after submit | Submit and retry carefully; refresh lists. | UI shows actionable error and prevents accidental double-submit; if server committed, refresh reveals single booking, not duplicate. | High | Error handling |

### H. Customers and visit history

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| CUS-001 | ☐ Customer list default sorting and metrics | Owner, Manager, Staff | 45 seed customers | Open Customers; compare names, total, visits-on-page, repeat-on-page. | Names sorted ascending; total is tenant-wide; page metrics use displayed page; values match work-order visits. | High | Positive/Sorting |
| CUS-002 | ☐ Search by name and phone | Tenant roles | Seed data | Search exact/partial/mixed-case name and partial phone; whitespace; no-match; rapidly change input. | 400ms debounce; case-insensitive name/phone match; page resets to 1; stale responses do not overwrite latest; empty state correct. | High | Positive/Edge |
| CUS-003 | ☐ Customer pagination boundaries | Tenant roles | >40 customers | Navigate pages; direct API page 0/negative/beyond and limit 0/1/50/>50. | UI pages of 20; API clamps page >=1 and limit 1..50; stable sorted non-duplicated items; controls disable correctly. | High | Boundary/Pagination |
| CUS-004 | ☐ Customer detail drawer and recent history | Tenant roles | Customer with >5 orders and customer with none | Open drawer; inspect phone link, visits, last visit, history. | Up to 5 most recent orders descending show service, plate, stage, timestamp; empty state for none; tel link correct. | High | Positive/Audit |
| CUS-005 | ☐ Customer data updates across booking/work-order flows | Tenant roles, Public | Existing customer | Create/cancel/edit booking and walk-in; revisit customer. | Visit totals and last/recent work update consistently; never negative; cancellation removes corresponding active order history as implemented. | High | Cross-feature |
| CUS-006 | ☐ Customer create/update/delete/import/export absence | Owner | Customers screen | Inspect UI/API surface for standalone CRUD/import/export; attempt guessed endpoints. | No unsupported controls; unknown endpoints 404; customers are created/updated only through booking/walk-in flows and cannot be deleted/exported accidentally. | Medium | Unsupported/Security |

### I. Operations board, work orders, payment, and stage history

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| WO-001 | ☐ Board stage grouping, ordering, summary, and retention | All tenant roles, Support Session | Orders in every stage including old Delivered | Open board and compare data. | Cards grouped in seven stages and ordered oldest-created first; active/ready/completed summaries correct; Delivered older than 24h omitted. | High | Positive/Read/Sorting |
| WO-002 | ☐ Show/hide Delivered and compact lane navigation | All tenant roles | Delivered orders exist | Toggle Delivered; use stage pills/arrows on tablet/phone; test RTL. | Delivered lane toggles; lane counts/progress/arrows correct; scrolling snaps; RTL order/navigation is coherent. | Medium | UX/Responsive |
| WO-003 | ☐ Create walk-in | Owner, Manager, Staff | Active service and quota | Submit valid new customer/vehicle. | Arrived work order (no booking) created; customer/vehicle created or reused; visit increments; board and SSE update. | High | Positive/CRUD-Create |
| WO-004 | ☐ Walk-in validation and normalization | Tenant roles | None | Omit/shorten fields; <7 phone digits; inactive/foreign service; invalid vehicle enum; lowercase plate; hostile notes. | Invalid requests rejected without partial data; valid phone/plate normalized; text rendered safely. | High | Validation/Negative |
| WO-005 | ☐ Open work-order details | Tenant roles | Work order with photos/history | Open card/sheet from board and booking. | Customer, vehicle, service, base/actual price, assignment, payment, stage, notes, tracking, photo count, grouped photos and chronological history match data. | High | Positive/Read |
| WO-006 | ☐ Valid forward stage progression | All tenant roles | Paid as needed | Move Booked→Arrived→Washing→Detailing→Polishing→Ready→Delivered via drag/select/action. | Each transition persists; card moves optimistically then confirms; stage history records actor/from/to/time; tracking/SSE updates; Ready estimate/notification behavior fires. | High | Positive/Journey |
| WO-007 | ☐ Skip forward stages | All tenant roles | Work order before Ready | Move Booked directly to Detailing/Ready and other forward jumps. | Forward skip is accepted by current rule; stage/history/tracking reflect selected target exactly. | Medium | Edge |
| WO-008 | ☐ Move back one stage | All tenant roles | Stage Arrived–Ready | Move to immediately previous stage. | Accepted and audited; card/tracking update consistently. | High | Positive/Edge |
| WO-009 | ☐ Move back more than one stage | All tenant roles | Stage Detailing+ | Attempt target two or more stages back. | API rejects; optimistic UI reverts; no history/event created. | High | Validation/Negative |
| WO-010 | ☐ Delivered is terminal | All tenant roles | Delivered order | Attempt any stage move. | Rejected; Delivered card/history/payment unchanged. | High | Integrity/Negative |
| WO-011 | ☐ Payment-gated delivery | All tenant roles | Ready order Pending/Refunded | Attempt Delivered by drag/direct API/action; then mark Paid and retry. | Unpaid/refunded delivery rejected and UI reverts/disabled; after Manager/Owner sets Paid, delivery succeeds. | High | Business rule/Journey |
| WO-012 | ☐ Concurrent stage update conflict | Two tenant users | Same initial card in two sessions | Move same order to different stages simultaneously. | One conditional update wins; other gets 409 conflict and refresh/revert; exactly one history row per successful update. | High | Concurrency |
| WO-013 | ☐ Assign/unassign active staff | Owner, Manager, Support Session | Active users | Assign each active tenant user, change assignee, unassign, refresh. | Assignment persists and broadcasts; only current tenant active user accepted; card/detail agree. | High | Positive/CRUD-Update |
| WO-014 | ☐ Assignment denial and invalid target | Staff, Owner/Manager | Staff session; inactive/foreign/nonexistent user | Staff attempts assign; authorized user submits invalid targets. | Staff rejected; invalid/inactive/foreign target rejected; existing assignment unchanged. | High | Authorization/Negative |
| WO-015 | ☐ Set actual price and notes | Owner, Manager, Support Session | Work order open | Save 0, decimal, max 999999, notes-only, and both; refresh/receipt. | Values persist and broadcast; 0 is allowed; receipt uses actual price when present; omitted notes preserve current notes. | High | Positive/Boundary |
| WO-016 | ☐ Price/notes validation and unsaved changes | Owner, Manager | Work order open | Enter negative/>max/non-numeric; edit then close/navigate; choose cancel, discard, save-and-leave. | Invalid values blocked/rejected; unsaved dialog behaves per choice; failed save retains editor safely; no silent data loss. | High | Validation/UX |
| WO-017 | ☐ Staff price/notes restriction | Staff | Work order open | Inspect disabled fields/controls; call price API directly. | Staff can read but cannot change price/notes; API rejects; original values remain. | High | Authorization |
| WO-018 | ☐ Payment status updates | Owner, Manager, Support Session | Work order open | Set Pending→Paid→Refunded→Paid; refresh and observe delivery action. | Each enum persists and broadcasts; delivery enablement follows Paid only. | High | Positive/CRUD-Update |
| WO-019 | ☐ Payment status authorization and enum validation | Staff, Owner/Manager | Work order exists | Staff calls API; authorized user submits unknown/numeric out-of-range/missing status. | Requests rejected; no payment/stage change. | High | Authorization/Validation |
| WO-020 | ☐ Work-order not-found and malformed IDs | Tenant roles | None | Open/call random GUID, malformed GUID, deleted/cancelled linked work-order ID. | Correct 404/route failure and friendly UI error; no other tenant/order data leaked. | Medium | Negative/Error |
| WO-021 | ☐ Stage history immutability and ordering | Tenant roles | Multiple transitions by different users | Inspect History tab and database/API after refresh. | Entries chronological, correct actors/stages/timestamps; no edit/delete UI/API; failed/idempotent operations add no row. | High | Audit |
| WO-022 | ☐ Board card identity under reused customer/vehicle | Tenant roles | Multiple work orders for same customer/plate | Create bookings/walk-ins and move one card. | Only targeted work order changes; card counts and customer history remain distinct; no accidental plate-based mutation. | High | Integrity/Edge |
| WO-023 | ☐ Work-order deletion absence | Owner, Manager | Existing work order | Inspect UI/API; attempt guessed DELETE endpoint. | No hard-delete feature; unknown DELETE returns 404/405; cancellation is only allowed through eligible linked booking. | Medium | Unsupported/Security |

### J. Public tracking, real-time streams, and customer journey

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| TRK-001 | ☐ Tracking page for every stage | Public | Seven stable tokens | Open each `/track/{token}` on desktop/mobile and in all locales. | Shop/customer/vehicle/service/stage/last update display; stage progress and Ready/Delivered presentation are correct; no private phone, notes, price, staff, photos, or history exposed. | High | Positive/Security |
| TRK-002 | ☐ Estimated-ready visibility | Public, tenant roles | Work orders before/at/after Ready with estimate | Track each. | Future estimate shown only before Ready as implemented; Ready/Delivered suppress estimate; tenant detail may retain internal estimate safely. | Medium | Edge |
| TRK-003 | ☐ Tracking token validation | Public | None | Try lowercase valid token, whitespace, 6 chars, 65 chars, ambiguous/invalid characters, path traversal, random valid-shaped token. | Valid token normalizes uppercase/trim; invalid shape is 400; unknown valid shape is safe 404; no injection/path traversal. | High | Validation/Security |
| TRK-004 | ☐ Repeated unknown-token suppression/rate limit | Public | Same client/token | Request same unknown token repeatedly past miss/suppression and route-rate limits. | Database abuse is suppressed and/or 429 returned; response remains generic; valid tokens continue according to partition policy. | High | Security/Abuse |
| TRK-005 | ☐ Public tracking SSE update | Public, tenant user | Tracking page open; tenant changes stage | Observe connection and stage changes through Delivered. | Public page updates without reload with only public-safe event fields; reconnects after transient disconnect; no tenant board events from other tokens. | High | Positive/Realtime |
| TRK-006 | ☐ Authenticated board SSE synchronization | Two tenant users | Board open in two tabs/users | Create walk-in/booking; move, assign, price, pay, upload/delete photo, cancel booking. | Other client updates corresponding card/removal promptly without duplicates; detail query invalidates; connection status reflects connected/lost. | High | Cross-feature/Realtime |
| TRK-007 | ☐ SSE tenant/token isolation | Users from two tenants; two public tokens | Multiple streams open | Trigger events in each tenant/order and inspect network payloads. | Auth stream receives only its tenant; public stream receives only its token; heartbeats contain no sensitive data. | High | Security |
| TRK-008 | ☐ SSE authorization, disconnect, and resource cleanup | Public, tenant roles | HTTP client | Open board stream logged out; open invalid token stream; disconnect/reconnect many clients. | Board stream returns 401; invalid token fails; server cleans subscriptions; no runaway CPU/memory; cache-control prevents proxy buffering. | High | Security/Reliability |

### K. Photos and object storage

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| PHO-001 | ☐ Upload Before and After photos | Owner, Manager, Staff, Support Session | Real/disposable R2 or storage substitute | Upload valid JPEG, PNG, WEBP to each type. | File signature is accepted; tenant/order/type-specific key created; photo metadata persists; grouped grid/count/SSE update. | High | Positive/CRUD-Create |
| PHO-002 | ☐ Photo type validation | Tenant roles | Work order exists | Submit `Before`, `before`, `After`, empty, unknown, script string. | Case-insensitive valid types accepted; invalid types rejected before storage; no orphan object/row. | High | Validation |
| PHO-003 | ☐ File signature and MIME spoofing | Tenant roles | Prepared test files | Upload real supported images with wrong extension/MIME; upload executable/PDF/text renamed `.jpg`; polyglot if available. | Detection uses magic bytes; only actual JPEG/PNG/WEBP accepted; spoofed files rejected and never served/stored. | High | Security |
| PHO-004 | ☐ Photo size/empty boundaries | Tenant roles | Generated files | Upload 0 bytes, just under/exactly/just over 10MB, truncated headers. | Empty/oversize/truncated invalid files rejected; valid <=10MB accepted; clear error and no orphan. | High | Boundary |
| PHO-005 | ☐ Logo versus work-photo size boundary | Owner | Prepared 5MB files | Upload logo at/over 5MB and work photo at same sizes. | Logo limit is 5MB; work photo limit is 10MB; limits reported accurately. | Medium | Boundary |
| PHO-006 | ☐ List and order photos | Tenant roles | Multiple Before/After uploads | Refresh details/list API. | Grouped by type and ordered ascending upload time; IDs/URLs unique; no duplicate rows. | Medium | Positive/Read |
| PHO-007 | ☐ Delete own Staff photo | Staff | Staff uploaded photo | Delete it; refresh board/detail/storage. | DB row and object removed; count/grid/SSE update; repeated delete returns safe not-found. | High | Positive/CRUD-Delete |
| PHO-008 | ☐ Staff cannot delete another user's photo | Two Staff users | Photo uploaded by other Staff | Hide/control check and direct DELETE. | Rejected; photo row/object remains. | High | Authorization/Negative |
| PHO-009 | ☐ Manager/Owner delete any tenant photo | Owner, Manager | Photo by another user | Delete and refresh. | Authorized deletion succeeds only within tenant; object and row removed. | High | Authorization/Positive |
| PHO-010 | ☐ Cross-tenant photo and parent-ID mismatch | Owner/Manager | IDs from two tenants/orders | List/delete/upload using foreign work-order/photo IDs or photo ID paired with wrong parent. | Safe not-found/rejection; no object or metadata leak/mutation. | High | Security |
| PHO-011 | ☐ Storage upload/delete failure handling | Tenant roles | Configure storage to fail/timeout | Upload; then fail delete. | User sees error; DB/object consistency is preserved or recoverable; no false success; board count not corrupted. | High | Error handling |

### L. Receipts and document export

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| RCP-001 | ☐ Authenticated receipt PDF download | Owner, Manager, Staff, Support Session | Work order exists | Download from detail; inspect filename, MIME, pages/text. | HTTP 200 `application/pdf`; opens as valid A5 PDF; tenant/customer/vehicle/service/date/price/payment and branding accurate. | High | Positive/Export |
| RCP-002 | ☐ Public receipt by tracking token | Public | Valid token | Download `/track/{token}/receipt`; repeat invalid token. | Valid receipt downloads without auth; invalid shape/token safely fails; receipt contains intended customer-facing data only. | High | Positive/Security |
| RCP-003 | ☐ Actual versus base price | Tenant roles, Public | Orders with null, 0 and positive actual price | Download each. | Price selection matches implemented rule; 0 is not silently replaced if explicitly valid; currency formatting consistent. | High | Business rule |
| RCP-004 | ☐ Receipt locales and RTL | Tenant roles, Public | `en`, `ar`, `tr`, unknown locale | Download each and visually inspect/render. | Localized labels/date/currency; Arabic direction/font readable; unknown locale safely falls back; no clipped/overlapping glyphs. | High | Localization/Visual |
| RCP-005 | ☐ Currency coverage | Owner/Manager | Set SAR, USD, TRY, EUR, SYP | Generate receipts and UI previews. | Correct supported symbol/label and amount formatting appear consistently in settings, work order, public shop, and PDF. | High | Positive |
| RCP-006 | ☐ Logo loading trust and failure | Owner | Valid R2 logo, unavailable logo, untrusted URL attempt | Generate PDFs. | Trusted supported logo renders; unavailable/invalid image does not break PDF; arbitrary/localhost/untrusted host cannot be used for server-side fetch. | High | Security/Error |
| RCP-007 | ☐ Receipt authorization and tenant isolation | Super Admin, tenant roles | Foreign work-order ID | Direct authenticated download as wrong tenant/Super Admin. | Rejected without data; only public token route bypasses tenant auth. | High | Authorization |
| RCP-008 | ☐ Repeated/large receipt generation | Tenant roles, Public | Work order with long names/notes/branding | Download repeatedly and concurrently. | PDFs remain valid and layout stable; rate limit applies; service remains responsive; notes/private fields only appear if intentionally included. | Medium | Performance/Edge |

### M. Tenant profile, availability, localization, and receipt settings

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| SET-001 | ☐ Read tenant profile and plan status | Owner, Manager, Staff, Support Session | Logged in | Open settings/header and call endpoints. | Correct tenant name/slug/logo/plan and quota status shown; no other tenant data. | High | Positive/Read |
| SET-002 | ☐ Owner updates tenant name | Owner, Support Session | Profile open | Set trimmed valid name; refresh landing/public booking/receipt/dashboard. | Name persists and propagates; slug remains immutable. | High | Positive/CRUD-Update/Journey |
| SET-003 | ☐ Profile update authorization/validation | Manager, Staff, Owner | Sessions as listed | Manager/Staff try patch; Owner submits blank/hostile/very long name and arbitrary logo URL. | Non-Owner rejected; blank rejected; text rendered safely; logo URL accepted only from configured R2 base/path or null. | High | Authorization/Security |
| SET-004 | ☐ Owner logo upload | Owner, Support Session | Valid image | Upload logo and refresh public shop/tracking/receipt. | Valid URL stored; all branding surfaces update; upload progress/success shown. | High | Positive/Journey |
| SET-005 | ☐ Logo upload authorization and validation | Manager, Staff, Owner | Prepared invalid files | Non-Owner uploads; Owner tests types/spoof/empty/>5MB/storage failure. | Unauthorized/invalid uploads rejected; old logo remains on failure; no orphan or arbitrary URL. | High | Authorization/Validation |
| SET-006 | ☐ Availability settings read/update | Owner, Manager | Settings open | Change bay capacity, open days/times, closures; save/reload and query availability. | Values persist; availability/public booking immediately reflect them; currency remains unchanged by availability PUT. | High | Positive/Cross-feature |
| SET-007 | ☐ Availability settings Staff denial | Staff | Logged in | Open settings tab/direct GET and PUT. | UI restricted and controller returns 403 for both; no settings exposed/changed through that route. | High | Authorization |
| SET-008 | ☐ Availability validation edge cases | Owner, Manager | API client | Test capacity 0/negative/huge, open>=close, duplicate/missing weekdays, closure from>to, overlapping closures, leap day, long reason. | Product either rejects with clear validation or behaves deterministically; invalid persisted settings that create broken availability are defects. | High | Validation/Edge |
| SET-009 | ☐ Localization settings update | Owner, Manager | Settings open | Set default locale and available locale combinations; save/reload/public routes. | Supported configuration persists and default is used as designed; UI permits intentional locale switching. | High | Positive |
| SET-010 | ☐ Localization validation and Staff denial | Staff, Owner/Manager | API client | Staff GET/PATCH; authorized submit empty list, duplicates, unsupported code, default absent from list. | Staff rejected; invalid configuration should be rejected or normalized. Record defect if raw invalid locale state persists/crashes UI. | High | Authorization/Validation |
| SET-011 | ☐ Receipt settings read by all tenant roles | Owner, Manager, Staff, Support Session | Logged in | Open Receipts tab/call GET. | Current normalized currency plus exactly SAR/USD/TRY/EUR/SYP options returned. | Medium | Positive/Read |
| SET-012 | ☐ Receipt currency update authorization | Owner, Manager, Staff | Settings open | Owner/Manager set every currency; Staff attempts PUT. | Owner/Manager succeed; Staff rejected and sees restricted UI; availability settings unaffected. | High | Authorization/Positive |
| SET-013 | ☐ Unsupported receipt currency | Owner, Manager | API client | Submit unknown string, numeric out-of-range, null, malformed JSON. | 400/rejection; prior currency retained; no fallback mutation. | High | Validation/Negative |

### N. Staff management

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| STF-001 | ☐ List staff and operational metrics | Owner, Manager | Users in all states | Open Staff settings. | Tenant users show name/email/phone/role/active/invite-pending and completed jobs today; no password hashes/tokens; Staff cannot list. | High | Positive/Read/Authorization |
| STF-002 | ☐ Owner creates Staff, Manager, and Owner | Owner | Under plan limit | Create each role with valid unique details. | Pending user created with requested role and invite link/expiry; list/plan usage update; no initial password exposed. | High | Positive/CRUD-Create |
| STF-003 | ☐ Manager creates Staff only | Manager | Under plan limit | Create Staff, then Manager and Owner via UI/API. | Staff succeeds; elevated roles absent in UI and rejected by API. | High | Authorization |
| STF-004 | ☐ Staff creation validation | Owner, Manager | None | Blank/1-char name, malformed/duplicate/mixed-case email, <7 phone, blank phone, unsupported role, hostile/long values. | Invalid rejected; email normalized lower-case; duplicate within tenant rejected; no partial user/token/notification. | High | Validation/Negative |
| STF-005 | ☐ Update another user's profile fields | Owner, Manager | Manageable target | Change full name/phone; refresh assignments/history/list. | Values trim and persist; blank supplied values rejected; Manager only affects Staff target. | High | Positive/CRUD-Update |
| STF-006 | ☐ Owner changes another user's role | Owner | Non-self target | Cycle Staff↔Manager↔Owner and test resulting access after fresh login. | Role persists; new session receives correct controls/API access; self-role change blocked. | High | Authorization/Journey |
| STF-007 | ☐ Activate/deactivate staff | Owner, Manager | Staff target logged in | Deactivate/reactivate Staff; test session, assignment choices, invite/reset. | Deactivated account cannot log in/use session/be assigned/receive links; historical assignment remains readable; reactivation restores eligible behavior. | High | Positive/Journey |
| STF-008 | ☐ Owner account protections from Manager | Manager | Owner target | Attempt profile/role/status/invite/reset operations. | All rejected; Owner unchanged. | High | Authorization/Negative |
| STF-009 | ☐ Self-deactivation and self-role change | Owner, Manager | Logged in | Direct PATCH own ID with `isActive=false` or role. | Rejected; session and account remain usable. | High | Integrity |
| STF-010 | ☐ Invalid/nonexistent/cross-tenant staff ID | Owner, Manager | Foreign and random IDs | Update/invite/reset each. | Safe not-found/authorization; no cross-tenant identity leak or notification. | High | Security |
| STF-011 | ☐ Completed-jobs-today metric boundary | Owner, Manager | Delivered orders around UTC day boundary | Assign/deliver orders before/after boundary; refresh. | Metric counts assigned Delivered work orders updated during current UTC day per implementation; other stages excluded. | Medium | Edge/Analytics |
| STF-012 | ☐ Notification delivery result when generating account link | Owner, Manager | WhatsApp configured/unconfigured | Generate invite/reset links in each state. | Link creation succeeds according to account rules; response reports delivery outcome accurately; provider failure does not expose access token or corrupt token lifecycle. | High | Integration/Error |

### O. WhatsApp settings, manual sharing, notifications, and webhook

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| WA-001 | ☐ Read WhatsApp settings and logs | Owner, Support Session, Manager, Staff | Paid/free tenants with logs | Open Notifications tab and call GETs as each role. | Owner/Support can read paid-plan settings/logs; Manager/Staff receive restricted UI and 403 from direct GETs; response masks token (only stored-state indication), sorts logs newest first, and remains tenant-scoped. | High | Positive/Read/Authorization |
| WA-002 | ☐ Owner updates WhatsApp settings | Owner, Support Session | Paid tenant | Configure enable flag, business phone ID, token, template names/languages, auto-Ready; save/reload. | Settings persist; token stored protected/not returned; template fields map to correct event; updated timestamp changes. | High | Positive/CRUD-Update |
| WA-003 | ☐ Non-Owner update denial | Manager, Staff | Logged in | Inspect UI; direct PATCH settings. | Restricted UI; API rejects; settings/token unchanged. | High | Authorization |
| WA-004 | ☐ Enable-provider required fields | Owner | Paid tenant | Enable with missing phone/token; test stored token with blank replacement; clear token while enabled. | Provider enable requires phone and usable current/new token; invalid combination rejected; blank does not unintentionally erase stored token. | High | Validation |
| WA-005 | ☐ Auto-Ready template validation | Owner | Paid tenant | Enable auto-Ready with no Ready template; then valid template/language. | Missing template rejected; valid configuration saves and triggers only on entry to Ready. | High | Validation/Positive |
| WA-006 | ☐ Manual WhatsApp share preparation | Owner, Manager, Staff, Support Session | Work order with valid phone | Prepare TrackingLink and ReadyForPickup in EN/AR; preview, copy, open WhatsApp. | Returned normalized phone, message text, tracking/receipt URLs and `wa.me` URL are correct; manual action logged; clipboard/open action uses same text. | High | Positive/Journey |
| WA-007 | ☐ Manual share event inference/validation | Tenant roles | Orders in pre-Ready and Ready stages | Omit event type; submit supported and unsupported account-action event types. | Tracking inferred before Ready and Ready event at Ready as implemented; only TrackingLink/ReadyForPickup accepted. | High | Edge/Validation |
| WA-008 | ☐ Invalid customer phone for sharing | Tenant roles | Work order phone <7 digits in controlled data | Prepare share. | Rejected; no malformed WhatsApp URL/provider call; failed attempt behavior/log is accurate. | Medium | Negative |
| WA-009 | ☐ Automatic Ready notification exactly once per transition | Tenant roles, Owner configured | Auto-Ready enabled | Move non-Ready→Ready; retry/reconnect; move back one then Ready again. | A successful transition triggers intended provider attempt and log; failed/concurrent stage requests do not duplicate; a genuine later Ready re-entry follows defined behavior. | High | Cross-feature/Edge |
| WA-010 | ☐ Provider success and failure mapping | Owner | Disposable WhatsApp test setup/mock | Simulate accepted message, timeout, 4xx/5xx/provider error. | Logs contain correct Requested/Accepted/Failed, provider ID/error fields and timestamps; user action remains clear; secrets absent from errors/logs. | High | Integration/Error |
| WA-011 | ☐ Notification logs limit boundaries | Owner, Support Session | >200 logs on paid tenant | Request null, 0, 1, 25, 200, large/negative limits. | Default is 50 and values clamp to 1..200; newest entries shown; UI remains responsive and does not leak other tenants. | Medium | Boundary/Pagination |
| WA-012 | ☐ Webhook verification handshake | External provider/Public | Verify token configured | GET with correct mode/token/challenge; wrong/missing combinations. | Correct request echoes challenge as plain text; invalid requests return auth failure, never reveal verify token. | High | Security/Integration |
| WA-013 | ☐ Webhook signature validation | External provider/Public | App secret configured | POST valid signed payload; missing, malformed, wrong signature; altered body. | Only exact HMAC signature accepted; failures rejected; constant-time comparison behavior; no log update on invalid request. | High | Security |
| WA-014 | ☐ Webhook status progression and idempotency | External provider | Existing provider message ID | Send Sent, Delivered, Read, Failed updates, duplicates, out-of-order, unknown ID/status, malformed JSON. | Matching tenant log updates safely; duplicates idempotent; status/error/timestamps mapped; unknown/malformed payload does not corrupt data. | High | Integration/Edge |
| WA-015 | ☐ Webhook rate limiting and oversized payload | External/Public | Test client | Exceed webhook limit and submit very large JSON. | 429/size protection as configured; service stays available; no memory/log flooding or sensitive error detail. | High | Security/Performance |

### P. Analytics and reporting

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| AN-001 | ☐ Dashboard metric accuracy | Owner, Manager, Staff, Support Session | Paid populated tenant | Compare bookings today, completed today, active vehicles, walk-ins, repeat customers to source records. | Counts use documented UTC/time/stage rules and current tenant only. | High | Positive |
| AN-002 | ☐ Jobs-by-day and top services | Paid tenant roles | 7/30-day historical data | Inspect charts and source records, including ties/empty days. | Delivered updates in last 7 days group by UTC date; top 5 services by last-30-day work orders descending; empty data renders safely. | High | Positive/Sorting |
| AN-003 | ☐ Recent activity audit feed | Paid tenant roles | >10 stage changes | Inspect feed and manually refresh. | Latest 10 history entries descending with actor, plate, from/to/time; refresh retrieves current data. | High | Audit |
| AN-004 | ☐ Analytics cache correctness | Two tenants; one tenant with changes | Paid plans | Load dashboard, mutate activity, reload within/after 60s; switch tenant sessions. | Cache is tenant-keyed; no cross-tenant data; values update after expiry/manual conditions as designed; UI indicates refresh behavior. | High | Security/Edge |
| AN-005 | ☐ Empty and partial analytics | Paid empty tenant | No data | Open dashboard. | Zero cards and empty charts/feed render without error/NaN. | Medium | Edge |
| AN-006 | ☐ Analytics export absence | Tenant roles | Analytics open | Inspect for CSV/PDF/export and try guessed export endpoint. | No unsupported export presented; unknown endpoint fails; receipt PDF remains only implemented export. | Low | Unsupported |

### Q. Security, API errors, rate limits, and operational safeguards

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| SEC-001 | ☐ Unauthenticated protected-endpoint sweep | Public | Logged out | Call every protected endpoint/method. | All return 401 before business data/action; no endpoint accidentally anonymous except documented public/auth/webhook/dev routes. | High | Security |
| SEC-002 | ☐ Method and content-type enforcement | All roles, Public | API client | Use wrong HTTP verbs; wrong/missing JSON/multipart content type; malformed JSON. | 400/405/415-style responses; no mutation; errors do not expose internals. | High | Negative |
| SEC-003 | ☐ Object-level authorization sweep | Tenant roles | Foreign IDs for every entity | Repeat get/update/delete/action requests. | Query filters and explicit tenant predicates block IDOR across all entity types and nested photo routes. | High | Security |
| SEC-004 | ☐ Stored/reflected XSS payloads | Roles with text entry, Public | Test tenant | Enter HTML/script/event-handler/URL payloads in names, notes, services, billing notes, closure reason, customer/vehicle fields. | Content is encoded as text in UI/PDF/log previews; no script execution or unsafe link. | High | Security |
| SEC-005 | ☐ SQL/query injection payloads | All search/auth/public inputs | API client | Submit quotes, wildcards, SQL-like and Unicode payloads in search, slug, email, token, phone. | Parameterized queries handle safely; no auth bypass, error detail, data leak, or destructive effect. | High | Security |
| SEC-006 | ☐ CSRF resistance for cookie-auth mutations | All authenticated roles | Malicious origin page/test client | Attempt credentialed cross-site POST/PATCH/PUT/DELETE with simple and preflight requests. | Disallowed origin cannot read or successfully exploit state-changing APIs; if request can mutate despite CORS, record critical CSRF defect. | High | Security |
| SEC-007 | ☐ Secrets and PII exposure | Super Admin, tenant roles, Public | Browser/devtools/log access | Inspect API responses, HTML, JS bundle, errors, PDFs, notification logs, cookies. | No password hash, JWT value in JS storage, access-token ciphertext/plaintext, app secret, DB/R2 credentials, or unintended PII exposed. | High | Security |
| SEC-008 | ☐ Global exception mapping | All roles | Trigger validation, auth, not-found, conflict, plan, duplicate DB and unexpected errors | Inspect status/body in Development and Production. | Stable codes/status: 400, 401, 404, 409, 402, and 500; production 500 hides exception detail; no partial transaction. | High | Error handling |
| SEC-009 | ☐ Rate-limit policy sweep | All roles, Public | Test client with resettable partitions | Exceed auth, reads, mutations, uploads, public booking/read/track/receipt, SSE and webhook policies. | 429 body has `RATE_LIMITED`; limits partition appropriately by user/IP/shop/token; one tenant/token cannot cheaply deny all others. | High | Security/Abuse |
| SEC-010 | ☐ CORS configured-origin parsing | Public/authenticated | Multiple allowed origins separated by comma/semicolon | Test each allowed origin and near-match/subdomain/HTTP-vs-HTTPS origin. | Exact configured origins allowed with credentials; near matches rejected; wildcard-with-credentials absent. | High | Security |
| SEC-011 | ☐ Forwarded headers and HTTPS behavior | All | Reverse proxy staging | Send trusted/untrusted forwarded proto/for headers; inspect generated links/cookies and logs. | Deployment creates correct HTTPS URLs/cookies and client partitioning; untrusted spoofing does not bypass security/rate limits. | High | Operational/Security |
| SEC-012 | ☐ Startup configuration validation | Operator | Separate test deployment | Omit/shorten JWT secret; omit issuer/audience/R2 keys; invalid R2 public URL. | App fails fast with precise non-secret configuration error; does not start insecurely. | High | Operational/Negative |
| SEC-013 | ☐ Dev seed production isolation | Public | Production environment | Call `POST /api/dev/seed`; inspect Swagger. | Seed returns 404 and cannot reset/create fixtures; Swagger/UI only exposed according to environment policy. | High | Security |
| SEC-014 | ☐ Database/storage/provider outage behavior | All roles | Fault-injection environment | Stop DB, R2, WhatsApp, or interrupt network during representative actions. | Timeouts/errors are bounded and user-friendly; app recovers; transactions prevent partial relational state; provider/storage failures do not leak secrets. | High | Reliability |
| SEC-015 | ☐ Duplicate submission/idempotency smoke | All mutation-capable roles, Public | Slow network | Double-click submit/retry create booking, walk-in, staff, service, photo, manual share. | UI prevents avoidable duplicates; database constraints/transactions limit corruption. Any duplicate business records are documented defects. | High | Edge/Concurrency |

### R. End-to-end cross-feature journeys

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| E2E-001 | ☐ New tenant onboarding to first completed paid job | Public→Owner | Unique tenant details | Register → review defaults → configure hours/currency/logo/service → create booking → advance stages → upload photos → price/pay → deliver → download/track receipt. | One coherent tenant-scoped journey; every surface updates; public tracking/receipt accurate; history complete; no manual DB correction. | High | Positive/Journey |
| E2E-002 | ☐ Public customer booking to pickup | Public, Staff, Manager | Active paid tenant | Public books → Staff sees SSE → Staff processes/photos → Manager prices/marks paid → Ready notification/share → customer tracks → Staff delivers. | Booking, work order, customer visits, notifications, tracking, payment and receipt remain consistent end to end. | High | Positive/Journey |
| E2E-003 | ☐ Walk-in operational journey | Staff, Manager, Public | Active service | Staff creates walk-in → Manager assigns/prices → Staff progresses/photos → Manager pays → Staff delivers → customer uses token. | No booking exists; all other operational/customer flows work; quota and visit counts increment once. | High | Positive/Journey |
| E2E-004 | ☐ Booking edit then cancellation | Staff | Future confirmed Booked booking | Create → edit customer/vehicle/service/time → inspect board/customer → cancel → inspect all surfaces. | Linked data updates then is removed/adjusted consistently; no orphan work order, stale board card, or wrong visit count. | High | Positive/Journey |
| E2E-005 | ☐ Multi-user live board conflict | Owner, Manager, two Staff | Four browser contexts | Simultaneously assign, move, edit, upload and observe; force same-stage conflict and disconnect/reconnect. | Authorized actions synchronize; conflict loser recovers; no duplicate/lost history; reconnect converges to server state. | High | Concurrency/Journey |
| E2E-006 | ☐ Free-plan upgrade journey | Free Owner, Super Admin | Quotas reached | Trigger booking/staff/analytics/WhatsApp limits → Super Admin upgrades to Pro/adds messages → retry actions. | Upgrade prompts/errors explain block; existing input is recoverable; upgraded plan immediately enables correct features and quotas. | High | Cross-role/Journey |
| E2E-007 | ☐ Tenant suspension and recovery | Super Admin, Owner, Staff, Public | Active sessions and public tracking/booking open | Suspend tenant → exercise sessions/public routes/tracking → reactivate → fresh login and data verification. | Tenant-private and public shop booking are blocked while inactive as designed; historical data survives; public tracking behavior is verified/documented; recovery is clean. | High | Cross-role/Journey |
| E2E-008 | ☐ Support troubleshooting journey | Super Admin, Support Session, Owner | Tenant enables/access window | Admin inspects tenant → starts bounded support → reproduces issue/reads data → makes authorized fix → ends/expires session → Owner verifies. | Actions limited to selected tenant and window; identity clearly support; access ends reliably; resulting tenant changes persist. | High | Cross-role/Security |
| E2E-009 | ☐ Localization and currency journey | Owner, Public | Paid tenant | Owner sets available/default locales and each currency → public books in Arabic/Turkish → operations process → download localized receipt. | Direction, dates, amounts, templates, tracking and PDF remain consistent across languages/currency. | High | Localization/Journey |
| E2E-010 | ☐ Failure recovery during critical workflow | Owner, Staff, Public | Fault-injection environment | Interrupt API/network during booking, stage update, photo upload, payment, receipt and notification; reconnect/retry. | Server remains source of truth; UI converges after refresh/SSE; no double booking, false payment/delivery, orphan metadata, or misleading success. | High | Reliability/Journey |

### S. Explicit unsupported-capability checks

| ID | Test case title | Role(s) | Preconditions | Test steps | Expected result | Priority | Scenario |
|---|---|---|---|---|---|---|---|
| UNS-001 | ☐ Read-Only role is not assignable | Owner, Super Admin | API client | Search role selectors; submit `ReadOnly` on staff create/update; inspect platform controls. | No selector/API enum accepts it; request rejected; no misleading read-only access claim. | High | Unsupported/Authorization |
| UNS-002 | ☐ Tenant Admin and Standard User aliases are not assignable | Owner | API client | Submit `TenantAdmin` and `StandardUser`; compare to implemented Owner/Manager/Staff. | Unknown aliases rejected; Staff remains documented standard operational role; no hidden role mapping. | High | Unsupported/Validation |
| UNS-003 | ☐ Custom permissions and branch roles absent | Owner, Super Admin | Settings/admin open | Inspect UI/API for custom permission sets, branch/location assignment, MultiLocation feature. | No unsupported controls/endpoints; `multiLocation` remains false for all current plans; guessed routes fail safely. | Medium | Unsupported |
| UNS-004 | ☐ Import absent | All roles | App open | Inspect customers/bookings/services/staff/platform for CSV/XLSX import; try guessed import endpoints/content types. | No import action; unknown endpoints 404/405; uploaded files are accepted only by photo/logo routes with image validation. | Medium | Unsupported/Security |
| UNS-005 | ☐ Export scope limited to receipts | All roles | App open | Inspect list/analytics/admin screens for CSV/XLSX/PDF export; test guessed endpoints. | No bulk export exists; only work-order receipt PDF endpoints operate; unauthorized guessed endpoints expose no data. | Medium | Unsupported/Security |
| UNS-006 | ☐ General audit log, archive, and soft delete absent | Owner, Super Admin | App open | Inspect entity actions/APIs; attempt guessed archive/audit/delete routes. | Only stage history and notification logs exist; no unsupported archive/soft-delete/general-audit behavior or accidental destructive endpoint. | Medium | Unsupported |

## 5. Completion and defect recording checklist

Before signing off a full run:

- [ ] Every High-priority case has passed on the release candidate.
- [ ] All roles were tested in separate clean browser contexts, not by editing client state.
- [ ] Direct API authorization checks accompanied every permission-sensitive UI check.
- [ ] Tenant-isolation cases used real IDs from at least two tenants.
- [ ] Free, Pro, and Business plan gates and boundary counts were exercised.
- [ ] English, Arabic RTL, and Turkish were checked at desktop and mobile widths.
- [ ] External R2/WhatsApp cases were either executed against disposable integrations or explicitly marked blocked with evidence.
- [ ] Chromium, Firefox, and WebKit coverage status is recorded; browser-specific failures are linked.
- [ ] Each defect records case ID, role, tenant/plan, environment/build, data IDs, exact steps, expected/actual result, network status/body, screenshots/video, and reproducibility.
- [ ] Data was reset after destructive/concurrency/quota tests and no test artifacts remain in shared environments.

## 6. Traceability summary

| Product module | Primary case ranges |
|---|---|
| Landing/navigation/responsive/localization | UI-001–UI-012 |
| Tenant auth/invite/reset/session | AUTH-001–AUTH-018 |
| Platform admin/support | ADM-001–ADM-017 |
| RBAC/tenant isolation | RBAC-001–RBAC-008, SEC-001–SEC-003 |
| Plans/quotas | PLAN-001–PLAN-009 |
| Services | SVC-001–SVC-009 |
| Availability/bookings/public booking | BKG-001–BKG-023 |
| Customers | CUS-001–CUS-006 |
| Board/work orders/payment/history | WO-001–WO-023 |
| Tracking/SSE | TRK-001–TRK-008 |
| Photos/storage | PHO-001–PHO-011 |
| Receipt PDF/export | RCP-001–RCP-008 |
| Tenant/settings/localization | SET-001–SET-013 |
| Staff | STF-001–STF-012 |
| WhatsApp/webhook/logs | WA-001–WA-015 |
| Analytics | AN-001–AN-006 |
| Security/reliability/operations | SEC-001–SEC-015 |
| Cross-feature journeys | E2E-001–E2E-010 |
| Unsupported capabilities | UNS-001–UNS-006 |
