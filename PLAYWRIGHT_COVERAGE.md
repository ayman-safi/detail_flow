# Manual Regression Automation Coverage

Generated from `MANUAL_REGRESSION_TEST_SUITE.md`. Do not edit by hand.

| Manual ID | Test title | Playwright file | Automated | Status |
|---|---|---|---:|---|
| UI-001 | Landing page renders all sections and CTAs | tests/ui/ui.spec.ts | Yes | ✅ |
| UI-002 | Landing CTA navigation | tests/ui/ui.spec.ts | Yes | ✅ |
| UI-003 | Dashboard authentication guard | tests/ui/ui.spec.ts | Yes | ✅ |
| UI-004 | Platform route authentication guard | tests/ui/ui.spec.ts | Yes | ✅ |
| UI-005 | Responsive layouts | tests/ui/ui.spec.ts | Yes | ✅ |
| UI-006 | English, Arabic RTL, and Turkish switching | tests/ui/ui.spec.ts | Yes | ✅ |
| UI-007 | Unsupported/removed locale value | tests/ui/ui.spec.ts | Yes | ✅ |
| UI-008 | Global loading, empty, and recoverable error states | tests/ui/ui.spec.ts | Yes | ✅ |
| UI-009 | Browser back/forward and deep links | tests/ui/ui.spec.ts | Yes | ✅ |
| UI-010 | Keyboard and accessible naming smoke test | tests/ui/ui.spec.ts | Yes | ✅ |
| UI-011 | Error boundary behavior | tests/ui/ui.spec.ts | Conditional | ⚠️ Environment-gated |
| UI-012 | Root/API health response and production artifacts | tests/ui/ui.spec.ts | Conditional | ⚠️ Environment-gated |
| AUTH-001 | Register a new tenant | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-002 | Registration required-field and format validation | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-003 | Duplicate slug and global email | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-004 | Valid tenant login | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-005 | Invalid credential enumeration resistance | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-006 | Login validation and rate limiting | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-007 | Session restoration with /auth/me | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-008 | Logout and cookie invalidation | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-009 | Tampered, expired, wrong issuer/audience JWT | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-010 | Active user middleware invalidates deactivated user | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-011 | Active tenant middleware invalidates tenant sessions | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-012 | Create and accept Staff invitation | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-013 | Invite token lifetime, replay, replacement, and purpose binding | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-014 | Invite cannot target active-password or inactive account | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-015 | Create and consume password-reset link | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-016 | Reset token expiry, replay, replacement, and pending-user restriction | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-017 | Password boundary and hostile payloads | tests/auth/auth.spec.ts | Yes | ✅ |
| AUTH-018 | Cookie security attributes and CORS | tests/auth/auth.spec.ts | Conditional | ⚠️ Environment-gated |
| ADM-001 | Platform Super Admin login and session restore | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-002 | Platform login invalid/missing configuration | tests/admin/adm.spec.ts | Conditional | ⚠️ Environment-gated |
| ADM-003 | Tenant list default sort, metrics, and pagination | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-004 | Tenant search | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-005 | Tenant filters and combinations | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-006 | View tenant detail | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-007 | Update plan, billing, and dashboard language | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-008 | Update billing notes validation | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-009 | Update WhatsApp add-on count | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-010 | Deactivate and reactivate tenant | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-011 | Start support session | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-012 | Support duration boundaries | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-013 | Support session authorization scope | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-014 | Revoke/expire support access | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-015 | Support session inactive tenant restriction | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-016 | Platform/tenant cookie context switch | tests/admin/adm.spec.ts | Yes | ✅ |
| ADM-017 | Non-admin platform API denial | tests/admin/adm.spec.ts | Conditional | ⚠️ Environment-gated |
| RBAC-001 | Cross-tenant ID isolation across all resources | tests/security/rbac.spec.ts | Yes | ✅ |
| RBAC-002 | Cross-tenant list/query isolation | tests/security/rbac.spec.ts | Yes | ✅ |
| RBAC-003 | Super Admin excluded from tenant APIs | tests/security/rbac.spec.ts | Yes | ✅ |
| RBAC-004 | Staff UI and direct-API permission boundaries | tests/security/rbac.spec.ts | Yes | ✅ |
| RBAC-005 | Manager boundaries against Owner accounts | tests/security/rbac.spec.ts | Yes | ✅ |
| RBAC-006 | Owner self-protection and role changes | tests/security/rbac.spec.ts | Yes | ✅ |
| RBAC-007 | Direct enum injection for unsupported roles | tests/security/rbac.spec.ts | Yes | ✅ |
| RBAC-008 | Stale permission after role change | tests/security/rbac.spec.ts | Yes | ✅ |
| PLAN-001 | Plan status values by Free/Pro/Business | tests/plans/plan.spec.ts | Yes | ✅ |
| PLAN-002 | Free monthly booking limit | tests/plans/plan.spec.ts | Yes | ✅ |
| PLAN-003 | Booking quota monthly boundary and concurrency | tests/plans/plan.spec.ts | Yes | ✅ |
| PLAN-004 | Staff-account plan limit | tests/plans/plan.spec.ts | Yes | ✅ |
| PLAN-005 | Photo-per-work-order plan limit | tests/plans/plan.spec.ts | Yes | ✅ |
| PLAN-006 | Analytics plan gate | tests/plans/plan.spec.ts | Yes | ✅ |
| PLAN-007 | WhatsApp plan and provider-send gate | tests/plans/plan.spec.ts | Yes | ✅ |
| PLAN-008 | WhatsApp included plus add-on quota | tests/plans/plan.spec.ts | Yes | ✅ |
| PLAN-009 | Downgrade below current usage | tests/plans/plan.spec.ts | Yes | ✅ |
| SVC-001 | List active services and sort order | tests/services/svc.spec.ts | Yes | ✅ |
| SVC-002 | Include inactive authorization | tests/services/svc.spec.ts | Yes | ✅ |
| SVC-003 | Create service | tests/services/svc.spec.ts | Yes | ✅ |
| SVC-004 | Service create validation | tests/services/svc.spec.ts | Yes | ✅ |
| SVC-005 | Partial service update | tests/services/svc.spec.ts | Yes | ✅ |
| SVC-006 | Activate/deactivate service | tests/services/svc.spec.ts | Yes | ✅ |
| SVC-007 | Reorder services | tests/services/svc.spec.ts | Yes | ✅ |
| SVC-008 | Reorder invalid payload | tests/services/svc.spec.ts | Yes | ✅ |
| SVC-009 | Staff service mutation denial | tests/services/svc.spec.ts | Yes | ✅ |
| SVC-010 | Service image management | tests/services/svc.spec.ts | Yes | ✅ |
| BKG-001 | Daily booking list and calendar | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-002 | Empty booking date | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-003 | Availability slot generation | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-004 | Closed day and closure period | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-005 | Business-hour boundaries | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-006 | Capacity overlap with varied service durations | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-007 | Create internal booking | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-008 | Internal booking required fields and enums | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-009 | Phone and plate normalization | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-010 | Existing customer name mismatch behavior | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-011 | Existing public customer/vehicle update behavior | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-012 | Create public booking journey | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-013 | Public invalid/inactive shop isolation | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-014 | Public booking abuse validation/rate limit | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-015 | Get and edit Booked booking | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-016 | Edit booking validation and slot conflict | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-017 | Edit non-Booked or cancelled booking | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-018 | Confirm pending booking | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-019 | Cancel pending/confirmed Booked booking | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-020 | Cancel booking after work has started | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-021 | Invalid booking status transitions | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-022 | Booking race for last slot | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-023 | Booking UI failure recovery | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-024 | Three-step phone-only public booking | tests/bookings/bkg.spec.ts | Yes | ✅ |
| BKG-025 | Masked vehicle lookup and staff completion | tests/bookings/bkg.spec.ts | Yes | ✅ |
| CUS-001 | Customer list default sorting and metrics | tests/customers/cus.spec.ts | Yes | ✅ |
| CUS-002 | Search by name and phone | tests/customers/cus.spec.ts | Yes | ✅ |
| CUS-003 | Customer pagination boundaries | tests/customers/cus.spec.ts | Yes | ✅ |
| CUS-004 | Customer detail drawer and recent history | tests/customers/cus.spec.ts | Yes | ✅ |
| CUS-005 | Customer data updates across booking/work-order flows | tests/customers/cus.spec.ts | Yes | ✅ |
| CUS-006 | Customer create/update/delete/import/export absence | tests/customers/cus.spec.ts | Yes | ✅ |
| WO-001 | Board stage grouping, ordering, summary, and retention | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-002 | Show/hide Delivered and compact lane navigation | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-003 | Create walk-in | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-004 | Walk-in validation and normalization | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-005 | Open work-order details | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-006 | Valid forward stage progression | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-007 | Skip forward stages | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-008 | Move back one stage | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-009 | Move back more than one stage | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-010 | Delivered is terminal | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-011 | Payment-gated delivery | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-012 | Concurrent stage update conflict | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-013 | Assign/unassign active staff | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-014 | Assignment denial and invalid target | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-015 | Set actual price and notes | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-016 | Price/notes validation and unsaved changes | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-017 | Staff price/notes restriction | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-018 | Payment status updates | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-019 | Payment status authorization and enum validation | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-020 | Work-order not-found and malformed IDs | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-021 | Stage history immutability and ordering | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-022 | Board card identity under reused customer/vehicle | tests/workorders/wo.spec.ts | Yes | ✅ |
| WO-023 | Work-order deletion absence | tests/workorders/wo.spec.ts | Yes | ✅ |
| TRK-001 | Tracking page for every stage | tests/notifications/trk.spec.ts | Yes | ✅ |
| TRK-002 | Estimated-ready visibility | tests/notifications/trk.spec.ts | Yes | ✅ |
| TRK-003 | Tracking token validation | tests/notifications/trk.spec.ts | Yes | ✅ |
| TRK-004 | Repeated unknown-token suppression/rate limit | tests/notifications/trk.spec.ts | Yes | ✅ |
| TRK-005 | Public tracking SSE update | tests/notifications/trk.spec.ts | Yes | ✅ |
| TRK-006 | Authenticated board SSE synchronization | tests/notifications/trk.spec.ts | Yes | ✅ |
| TRK-007 | SSE tenant/token isolation | tests/notifications/trk.spec.ts | Yes | ✅ |
| TRK-008 | SSE authorization, disconnect, and resource cleanup | tests/notifications/trk.spec.ts | Yes | ✅ |
| PHO-001 | Upload Before and After photos | tests/workorders/pho.spec.ts | Conditional | ⚠️ Environment-gated |
| PHO-002 | Photo type validation | tests/workorders/pho.spec.ts | Conditional | ⚠️ Environment-gated |
| PHO-003 | File signature and MIME spoofing | tests/workorders/pho.spec.ts | Yes | ✅ |
| PHO-004 | Photo size/empty boundaries | tests/workorders/pho.spec.ts | Yes | ✅ |
| PHO-005 | Logo versus work-photo size boundary | tests/workorders/pho.spec.ts | Yes | ✅ |
| PHO-006 | List and order photos | tests/workorders/pho.spec.ts | Conditional | ⚠️ Environment-gated |
| PHO-007 | Delete own Staff photo | tests/workorders/pho.spec.ts | Conditional | ⚠️ Environment-gated |
| PHO-008 | Staff cannot delete another user's photo | tests/workorders/pho.spec.ts | Conditional | ⚠️ Environment-gated |
| PHO-009 | Manager/Owner delete any tenant photo | tests/workorders/pho.spec.ts | Conditional | ⚠️ Environment-gated |
| PHO-010 | Cross-tenant photo and parent-ID mismatch | tests/workorders/pho.spec.ts | Conditional | ⚠️ Environment-gated |
| PHO-011 | Storage upload/delete failure handling | tests/workorders/pho.spec.ts | Conditional | ⚠️ Environment-gated |
| RCP-001 | Authenticated receipt PDF download | tests/workorders/rcp.spec.ts | Yes | ✅ |
| RCP-002 | Public receipt by tracking token | tests/workorders/rcp.spec.ts | Yes | ✅ |
| RCP-003 | Actual versus base price | tests/workorders/rcp.spec.ts | Yes | ✅ |
| RCP-004 | Receipt locales and RTL | tests/workorders/rcp.spec.ts | Yes | ✅ |
| RCP-005 | Currency coverage | tests/workorders/rcp.spec.ts | Yes | ✅ |
| RCP-006 | Logo loading trust and failure | tests/workorders/rcp.spec.ts | Yes | ✅ |
| RCP-007 | Receipt authorization and tenant isolation | tests/workorders/rcp.spec.ts | Yes | ✅ |
| RCP-008 | Repeated/large receipt generation | tests/workorders/rcp.spec.ts | Conditional | ⚠️ Environment-gated |
| SET-001 | Read tenant profile and plan status | tests/settings/set.spec.ts | Yes | ✅ |
| SET-002 | Owner updates tenant name | tests/settings/set.spec.ts | Yes | ✅ |
| SET-003 | Profile update authorization/validation | tests/settings/set.spec.ts | Yes | ✅ |
| SET-004 | Owner logo upload | tests/settings/set.spec.ts | Yes | ✅ |
| SET-005 | Logo upload authorization and validation | tests/settings/set.spec.ts | Yes | ✅ |
| SET-006 | Availability settings read/update | tests/settings/set.spec.ts | Yes | ✅ |
| SET-007 | Availability settings Staff denial | tests/settings/set.spec.ts | Yes | ✅ |
| SET-008 | Availability validation edge cases | tests/settings/set.spec.ts | Yes | ✅ |
| SET-009 | Public and dashboard localization settings update | tests/settings/set.spec.ts | Yes | ✅ |
| SET-010 | Dashboard localization validation and Staff denial | tests/settings/set.spec.ts | Yes | ✅ |
| SET-011 | Receipt settings read by all tenant roles | tests/settings/set.spec.ts | Yes | ✅ |
| SET-012 | Receipt currency update authorization | tests/settings/set.spec.ts | Yes | ✅ |
| SET-013 | Unsupported receipt currency | tests/settings/set.spec.ts | Yes | ✅ |
| STF-001 | List staff and operational metrics | tests/settings/stf.spec.ts | Yes | ✅ |
| STF-002 | Owner creates Staff, Manager, and Owner | tests/settings/stf.spec.ts | Yes | ✅ |
| STF-003 | Manager creates Staff only | tests/settings/stf.spec.ts | Yes | ✅ |
| STF-004 | Staff creation validation | tests/settings/stf.spec.ts | Yes | ✅ |
| STF-005 | Update another user's profile fields | tests/settings/stf.spec.ts | Yes | ✅ |
| STF-006 | Owner changes another user's role | tests/settings/stf.spec.ts | Yes | ✅ |
| STF-007 | Activate/deactivate staff | tests/settings/stf.spec.ts | Yes | ✅ |
| STF-008 | Owner account protections from Manager | tests/settings/stf.spec.ts | Yes | ✅ |
| STF-009 | Self-deactivation and self-role change | tests/settings/stf.spec.ts | Yes | ✅ |
| STF-010 | Invalid/nonexistent/cross-tenant staff ID | tests/settings/stf.spec.ts | Yes | ✅ |
| STF-011 | Completed-jobs-today metric boundary | tests/settings/stf.spec.ts | Yes | ✅ |
| STF-012 | Notification delivery result when generating account link | tests/settings/stf.spec.ts | Yes | ✅ |
| WA-001 | Read WhatsApp settings and logs | tests/notifications/wa.spec.ts | Yes | ✅ |
| WA-002 | Owner updates WhatsApp settings | tests/notifications/wa.spec.ts | Yes | ✅ |
| WA-003 | Non-Owner update denial | tests/notifications/wa.spec.ts | Yes | ✅ |
| WA-004 | Enable-provider required fields | tests/notifications/wa.spec.ts | Yes | ✅ |
| WA-005 | Auto-Ready template validation | tests/notifications/wa.spec.ts | Yes | ✅ |
| WA-006 | Manual WhatsApp share preparation | tests/notifications/wa.spec.ts | Yes | ✅ |
| WA-007 | Manual share event inference/validation | tests/notifications/wa.spec.ts | Yes | ✅ |
| WA-008 | Invalid customer phone for sharing | tests/notifications/wa.spec.ts | Yes | ✅ |
| WA-009 | Automatic Ready notification exactly once per transition | tests/notifications/wa.spec.ts | Yes | ✅ |
| WA-010 | Provider success and failure mapping | tests/notifications/wa.spec.ts | Conditional | ⚠️ Environment-gated |
| WA-011 | Notification logs limit boundaries | tests/notifications/wa.spec.ts | Yes | ✅ |
| WA-012 | Webhook verification handshake | tests/notifications/wa.spec.ts | Conditional | ⚠️ Environment-gated |
| WA-013 | Webhook signature validation | tests/notifications/wa.spec.ts | Conditional | ⚠️ Environment-gated |
| WA-014 | Webhook status progression and idempotency | tests/notifications/wa.spec.ts | Conditional | ⚠️ Environment-gated |
| WA-015 | Webhook rate limiting and oversized payload | tests/notifications/wa.spec.ts | Conditional | ⚠️ Environment-gated |
| AN-001 | Dashboard metric accuracy | tests/analytics/an.spec.ts | Yes | ✅ |
| AN-002 | Jobs-by-day and top services | tests/analytics/an.spec.ts | Yes | ✅ |
| AN-003 | Recent activity audit feed | tests/analytics/an.spec.ts | Yes | ✅ |
| AN-004 | Analytics cache correctness | tests/analytics/an.spec.ts | Yes | ✅ |
| AN-005 | Empty and partial analytics | tests/analytics/an.spec.ts | Yes | ✅ |
| AN-006 | Analytics export absence | tests/analytics/an.spec.ts | Yes | ✅ |
| SEC-001 | Unauthenticated protected-endpoint sweep | tests/security/sec.spec.ts | Yes | ✅ |
| SEC-002 | Method and content-type enforcement | tests/security/sec.spec.ts | Yes | ✅ |
| SEC-003 | Object-level authorization sweep | tests/security/sec.spec.ts | Yes | ✅ |
| SEC-004 | Stored/reflected XSS payloads | tests/security/sec.spec.ts | Yes | ✅ |
| SEC-005 | SQL/query injection payloads | tests/security/sec.spec.ts | Yes | ✅ |
| SEC-006 | CSRF resistance for cookie-auth mutations | tests/security/sec.spec.ts | Conditional | ⚠️ Environment-gated |
| SEC-007 | Secrets and PII exposure | tests/security/sec.spec.ts | Yes | ✅ |
| SEC-008 | Global exception mapping | tests/security/sec.spec.ts | Yes | ✅ |
| SEC-009 | Rate-limit policy sweep | tests/security/sec.spec.ts | Yes | ✅ |
| SEC-010 | CORS configured-origin parsing | tests/security/sec.spec.ts | Conditional | ⚠️ Environment-gated |
| SEC-011 | Forwarded headers and HTTPS behavior | tests/security/sec.spec.ts | Conditional | ⚠️ Environment-gated |
| SEC-012 | Startup configuration validation | tests/security/sec.spec.ts | Conditional | ⚠️ Environment-gated |
| SEC-013 | Dev seed production isolation | tests/security/sec.spec.ts | Conditional | ⚠️ Environment-gated |
| SEC-014 | Database/storage/provider outage behavior | tests/security/sec.spec.ts | Conditional | ⚠️ Environment-gated |
| SEC-015 | Duplicate submission/idempotency smoke | tests/security/sec.spec.ts | Yes | ✅ |
| UNS-001 | Read-Only role is not assignable | tests/security/uns.spec.ts | Yes | ✅ |
| UNS-002 | Tenant Admin and Standard User aliases are not assignable | tests/security/uns.spec.ts | Yes | ✅ |
| UNS-003 | Custom permissions and branch roles absent | tests/security/uns.spec.ts | Yes | ✅ |
| UNS-004 | Import absent | tests/security/uns.spec.ts | Yes | ✅ |
| UNS-005 | Export scope limited to receipts | tests/security/uns.spec.ts | Yes | ✅ |
| UNS-006 | General audit log, archive, and soft delete absent | tests/security/uns.spec.ts | Yes | ✅ |
