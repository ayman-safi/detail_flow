# Project Overview

DetailFlow is a multi-tenant SaaS application for vehicle-detailing and car-wash shops. It manages the operational flow from public or staff-created booking through customer/vehicle reuse, a seven-stage work-order board, payment, delivery, public status tracking, photos, receipts, staff administration, tenant settings, and plan enforcement.

The repository is a monorepo with three runtime layers:

1. `detailflow-web` is a Next.js application for the marketing site, tenant dashboard, public booking/tracking pages, and platform administration.
2. `DetailFlow.Api` is an ASP.NET Core controller-based JSON API. Controllers are thin; feature services contain business rules and use EF Core directly.
3. PostgreSQL is the durable store. Caddy is the deployment gateway, routing `/api/*` to the API and all other requests to Next.js.

The main business objects are `Tenant`, `User`, `Customer`, `Vehicle`, `ServiceType`, `Booking`, `WorkOrder`, `WorkOrderStageHistory`, `WorkOrderPhoto`, `TenantWhatsAppSettings`, and `NotificationLog`. Tenant roles are `Owner`, `Manager`, and `Staff`; platform administration is configuration-backed and separate from tenant accounts. Temporary support sessions provide bounded Owner-like tenant access.

Important implemented capabilities are:

- tenant registration, cookie-backed JWT login, staff invitation/password-reset links, and active-user/session enforcement;
- public shop pages, availability, internal/public booking, and booking-to-work-order synchronization;
- a drag-and-drop operations board with `Booked -> Arrived -> Washing -> Detailing -> Polishing -> Ready -> Delivered`, payment gating, assignment, pricing, notes, and stage history;
- tenant- and tracking-token-scoped server-sent events (SSE), with public tracking polling fallback;
- before/after photo storage in Cloudflare R2, localized PDF receipts, and WhatsApp template/provider integration;
- tenant profile, service catalog, hours/closures, locale/currency, receipt, staff, plan/quota, date-range analytics, and notification settings;
- platform tenant search/filter/update and time-limited support sessions;
- English, Arabic RTL, and Turkish user interfaces plus a localized marketing site.

This is not the architecture originally proposed in `MVP_Plan.md` in every detail. The current code uses ASP.NET Core controllers and Next.js 16, while that historical plan mentions Minimal APIs and Next.js 15. Executable code and current configuration are authoritative.

# Technology Stack

## Application code

- Languages: C# and TypeScript/TSX; JavaScript `.mjs` is used for generators and landing-page tooling; PowerShell and Bash are used for automation/deployment.
- Backend: .NET 10 / ASP.NET Core 10, controller-based Web API, built-in DI, JWT bearer authentication, authorization policies/roles, rate limiting, health checks, Problem Details registration, Swagger/OpenAPI, data protection, and `IHttpClientFactory`.
- Data: EF Core 10 with Npgsql and PostgreSQL 17. Production migrations live in `DetailFlow.Api/Migrations`; API tests substitute in-memory SQLite.
- Frontend: Next.js 16 App Router, React 19, strict TypeScript, and standalone production output.
- UI primitives: locally owned wrappers in `src/components/ui` built mainly on Radix UI. There is no `components.json` or shadcn CLI configuration, so treat this as a shadcn-style local component layer rather than an externally managed library.
- Styling: Tailwind CSS 4 through PostCSS, CSS custom-property design tokens in `src/app/globals.css`, and a CSS module for the marketing experience.
- Client state: TanStack React Query for server state/cache; Zustand for persisted auth metadata and the live board; local React state for page/form interaction.
- Forms and validation: React Hook Form with Zod on authentication and primary booking forms. Some complex settings and public-booking surfaces use controlled state. The API also validates DTOs with Data Annotations and enforces business rules in services.
- HTTP and feedback: Axios with a shared interceptor, `react-hot-toast`, and a React error boundary.
- Domain UI: `@dnd-kit` for the Kanban board, Recharts for analytics, date-fns for date handling, Lucide icons, and Motion on the marketing experience.
- Localization: a custom `I18nProvider`, JSON dictionaries for `en`, `ar`, and `tr`, locale routes/cookie/localStorage, `Intl`, and date-fns locales.
- Optional analytics: consent-gated PostHog on the marketing site only; it is disabled when `NEXT_PUBLIC_POSTHOG_KEY` is absent.

## Backend and infrastructure dependencies

- `AWSSDK.S3`: Cloudflare R2-compatible object uploads, deletes, and presigned URLs.
- `BCrypt.Net-Next`: tenant and platform password hashing/verification with work factor 12.
- `QuestPDF`: localized receipt PDFs; Amiri regular/bold fonts are embedded for Arabic text.
- `Microsoft.AspNetCore.Authentication.JwtBearer` and `System.IdentityModel.Tokens.Jwt`: signed sessions accepted from the `detailflow_auth` HTTP-only cookie or bearer header.
- ASP.NET Core Data Protection: encrypts per-tenant WhatsApp access tokens; production persists keys in a named Docker volume.
- PostgreSQL 17, Caddy 2, Docker/Compose, GHCR, GitHub Actions, and a Linux VPS form the deployed platform.
- Restic uploads encrypted PostgreSQL dumps to a dedicated R2 repository; systemd schedules nightly backups.

## Tooling

- Package managers: NuGet/dotnet for C# and npm with committed `package-lock.json` for the web app.
- SDK/runtime pins: `global.json` requests .NET SDK `10.0.301` with latest-patch roll-forward; CI and Docker use Node.js 24.
- Testing: xUnit v3, `Microsoft.AspNetCore.Mvc.Testing`, SQLite, coverlet collector, and Playwright 1.61 (Chromium configuration).
- Linting: ESLint 9 with Next.js core-web-vitals and TypeScript rules. Several React compiler rules are warnings, not errors.
- Formatting: no Prettier, `.editorconfig`, dotnet-format configuration, Stylelint, or dedicated formatter is present. Preserve nearby formatting and `.gitattributes` line endings.
- CI/CD: `.github/workflows/ci.yml` and `.github/workflows/deploy-vps.yml`.
- Not present: Kubernetes, Terraform/Pulumi, a message broker, a frontend unit-test runner, Storybook, commitlint, Husky, or an enforced coverage threshold.

# Project Structure

- `DetailFlow.Api/`: ASP.NET Core host.
  - `Program.cs`: configuration validation, CORS, auth, JSON, Swagger, EF Core, health checks, data protection, middleware order, Development seeding, and endpoint mapping.
  - `Features/<Capability>/`: vertical feature slices. Most contain a controller/`*Endpoints.cs`, a feature service, and request/response records.
  - `Models/`: EF Core entities and domain enums.
  - `Data/`: `DetailFlowDbContext`, design-time factory, and default service seeding.
  - `Infrastructure/`: auth cookie, active-user middleware, exception mapping, DI/rate-limit registration, R2 adapter, image validation, SSE fan-out, and HTTP-context helpers.
  - `Services/`: cross-feature tenant settings/context and receipt generation.
  - `Migrations/`: generated EF Core migrations and model snapshot.
  - `Resources/Fonts/`: embedded receipt fonts.
- `DetailFlow.Api.Tests/`: xUnit integration/service tests and the shared `WebApplicationFactory`/HTTP helpers.
- `detailflow-web/`: Next.js/npm application. Its nested `AGENTS.md` also applies and requires reading the installed Next.js documentation before changing framework APIs.
  - `src/app/`: App Router route groups for landing, auth, dashboard, public booking/tracking, and platform admin; root providers, proxy, metadata, sitemap, robots, and health endpoint.
  - `src/components/ui/`: reusable Radix/native primitives.
  - `src/components/{board,bookings,customers,photos,analytics,plans,layout,shared,auth}/`: feature and composition components.
  - `src/hooks/`: React Query and SSE/currency/localization hooks.
  - `src/store/`: Zustand auth and board stores.
  - `src/lib/`: Axios client, environment resolution, React Query client, plan-limit events, cache synchronization, analytics, and utilities.
  - `src/i18n/`: provider, locale metadata/domain keys, and translation dictionaries.
  - `src/types/index.ts`: hand-maintained frontend copies of API contracts and enum string unions.
  - `src/styles/`: stage colors/order and the compatibility CSS import; global design tokens are in `src/app/globals.css`.
  - `tests/`: configured Playwright suite; the per-prefix spec files and `tests/generated/manual-cases.ts` are generated.
  - `fixtures/`, `helpers/`, `page-objects/`, `reporters/`: deterministic seed, login/API helpers, manual-case dispatcher, page objects, and evidence capture.
  - `e2e/`: four older hand-written Playwright specs. They are outside `playwright.config.ts`'s `testDir` and are not part of `npm run test:e2e` unless explicitly targeted/configured.
  - `e2e-manual/`: suite generator and production web launcher.
  - `scripts/`: landing QA and hero-film generation.
  - `public/`: marketing and framework assets.
- `deploy/`: production Compose topology, Caddy routing, migration/deploy/backup/restore scripts, and systemd backup units.
- `scripts/Run-E2E.ps1`: destructive-but-guarded fresh test-database validation followed by API and Playwright checks.
- `.github/workflows/`: CI and VPS delivery.
- Root documentation: deployment/Visual Studio/testing guides, the manual regression source, generated Playwright coverage, a static system-testing report, and the historical MVP plan.
- `artifacts/`, `evidence/`, `output/`, `reports/`, `TestResults/`, `.e2e/`, `.playwright-cli/`, `.next/`, `bin/`, `obj/`, and `node_modules/` are local/generated outputs and are ignored.

# Coding Standards

## C# conventions actually in use

- Use file-scoped namespaces, PascalCase public types/members, camelCase parameters/locals, and `Async` suffixes for asynchronous methods.
- Nullable reference types and implicit usings are enabled. Entities initialize collections with `[]`, strings with safe defaults, and required navigation properties with `null!`.
- Primary constructors are common for controllers and services. Constructor injection is the default; service registration is centralized in `AddDetailFlowApplicationServices`.
- Keep controllers thin: apply route/auth/rate-limit/model-binding attributes, call one service method, and translate the result to an `IActionResult`.
- Keep persistence and business rules together in feature services. There is intentionally no repository abstraction over `DetailFlowDbContext`.
- Request/response shapes are usually records near their controller or mapping file. EF entities are not returned wholesale when a dedicated card/detail/projection shape exists.
- Use EF Core async APIs for database work. Multi-entity booking operations use transactions, often `Serializable`; work-order mutations sometimes use `ExecuteUpdateAsync` to make guarded updates atomic.
- Read-only/reporting queries commonly use `AsNoTracking`. `IgnoreQueryFilters` is reserved for platform, public lookup, authentication, plan accounting, or test/seed work and must be paired with an explicit tenant/public identity predicate.
- Fine-grained Owner/Manager/Staff decisions are often enforced in services through `ITenantContext`, even when the controller only has `[Authorize]`. Do not infer permission solely from controller attributes.
- Use centralized exception mapping. Services throw `ArgumentException`, `KeyNotFoundException`, `ConflictException`, `UnauthorizedAccessException`, `AuthenticationFailedException`, `InvalidOperationException`, or `PlanLimitException`; `GlobalExceptionHandler` maps them to the repository's established status/body shapes.
- Logging is deliberately sparse and structured: unexpected 500s, provider failures, receipt-logo failures, and suspicious webhook events. Use `ILogger<T>` placeholders rather than string concatenation, and do not log tokens, secrets, or customer payloads.
- Cancellation tokens are used on SSE loops, image header reads, and several platform calls, but are not consistently threaded through every feature. Match the surrounding feature instead of claiming a repository-wide rule.

## TypeScript/React conventions actually in use

- TypeScript is `strict`, `noEmit`, bundler-resolved, and uses `@/*` for `src/*`. `allowJs` is enabled for the repository's JS tooling.
- Components and hooks use PascalCase and `useX`; utilities and stores use camelCase. Component files are generally PascalCase, while utility/store files are camelCase.
- Interactive pages/components start with `'use client'`. Server-capable layout code is retained where request headers/cookies and metadata are needed.
- Shared components are named exports; App Router pages/layouts are default exports. Imports usually target the owning file directly rather than a barrel.
- API contracts live in `src/types/index.ts` as string unions/interfaces that mirror C# enum serialization. Update both sides when an API payload or enum changes.
- Use React Query for remote data and stable array query keys such as `['board']`, `['bookings', date]`, and `['plan-status']`. Mutations invalidate or synchronize all affected caches.
- Use Zustand only for cross-page client state that is live or persisted. The persisted auth user is UI metadata; the HTTP-only cookie is the actual credential.
- The board performs optimistic local moves and reverts on failure; SSE events then reconcile board and work-order caches.
- Parse untyped SSE payloads with local type guards before mutating state.
- User-visible request failures normally go through `getApiErrorMessage` and translated toasts. A global Axios interceptor handles plan-limit dialogs and authenticated 401 redirects; anonymous auth failures are deliberately excluded.
- Use `cn()` (`clsx` plus `tailwind-merge`) for conditional class composition and CSS logical properties/RTL branches where direction matters.
- Semicolons and mostly single-quoted imports/strings are the dominant style. There is no formatter to normalize deviations automatically.

# Existing Design Patterns

- Vertical feature slices on the API (`Features/Bookings`, `Features/WorkOrders`, and so on).
- Thin controller plus scoped service layer, with direct EF Core access.
- Request-scoped tenant context plus EF Core global query filters for tenant isolation.
- Explicit DTO/projection and mapping helpers, especially `WorkOrderMappings`.
- Strategy-like plan quotas keyed by `TenantPlan` in `PlanLimits`, enforced by `PlanEnforcementService`.
- Adapter abstraction for object storage (`IR2StorageService`/`R2StorageService`), replaced by a fake in tests.
- Singleton in-memory observer/fan-out via `BoardEventService`, `ConcurrentDictionary`, and `Channel<BoardEvent>` for SSE.
- Shared frontend primitive layer and composed shells (`DashboardShell`, Radix dialog/sheet wrappers, providers).
- Custom hooks encapsulating query/SSE/localization/plan behavior; React Query owns server-state caching.
- Page Object plus fixtures/helpers/evidence reporter in Playwright.

Patterns not present should not be introduced in documentation as if they already exist: there is no repository/unit-of-work layer, CQRS, MediatR/mediator, general event bus, domain aggregate framework, or production factory pattern. `DetailFlowApiFactory` is specifically the test host factory.

# UI Development

- Reuse `src/components/ui` before creating new primitives. These wrappers encode focus, disabled, sizing, theme, Radix behavior, and RTL-aware close controls.
- The dashboard design system is defined by Tailwind utilities plus CSS variables for fonts, spacing, radii, surfaces, text, borders, semantic colors, and work-order stages. Dark is the default; public/auth/tracking surfaces opt into `[data-theme="light"]`.
- Stage names/order/colors are business-significant and appear in C# enums, `src/types`, `src/styles/theme.ts`, and i18n domain keys. Change them as a coordinated contract change.
- Responsive design is mobile-first. Existing patterns include stacked-to-grid `sm`/`md`/`lg` layouts, an `xl` desktop sidebar with a mobile `Sheet`, large touch targets, responsive tables/cards, and a horizontally scrolling/snap-aligned board with compact quick-move controls.
- RTL is a first-class path: the root `html` gets `lang`/`dir`, forms inherit RTL text alignment, directional icons/layouts branch on `isRtl`, and some board/tracking internals deliberately use `dir="ltr"` for stage order while translating content layout.
- Accessibility practices in current code include real labels, `aria-invalid`/`aria-describedby`, dialog titles, named icon buttons, combobox/listbox semantics, keyboard-activatable cards, visible `focus-visible` outlines, reduced-motion CSS, and Radix focus management.
- Accessibility is not automatically audited. Playwright is Chromium-only and no axe/Lighthouse CI is configured, so preserve these practices and manually verify keyboard, focus, responsive, and RTL behavior for UI changes.
- Primary auth/booking forms use React Hook Form + translated Zod schemas. Settings and public-booking flows also contain controlled forms and service-side validation; do not force one form style across unrelated existing screens without a refactor request.
- Marketing UI is a separate image-led experience in `_components/LandingExperience.tsx` and `landing.module.css`, with localized copy in `_content/marketingContent.ts`, a consent dialog, and optional PostHog events.

# Testing

## API tests

- Framework: xUnit v3 with `Microsoft.AspNetCore.Mvc.Testing`.
- Location: `DetailFlow.Api.Tests/*Tests.cs`, generally grouped by feature/API surface.
- `DetailFlowApiFactory` runs the real ASP.NET Core pipeline in `Testing`, swaps PostgreSQL for one open in-memory SQLite connection, persists test data-protection keys in a temp directory, and replaces R2 and outbound HTTP with deterministic fakes.
- `TestApi` centralizes tenant registration, tokens/cookies, common payloads, status diagnostics, and public-booking helpers.
- Tests combine HTTP assertions with direct EF verification; isolated service tests cover `BoardEventService` and development seeding.
- Current validation on 2026-07-20: `dotnet test ... --no-restore` passed 56/56. xUnit analyzer cancellation-token warnings are present and do not fail the build.
- `coverage.runsettings` produces Cobertura through coverlet and excludes migrations and Development seed files. No minimum percentage is configured.

## Browser tests

- Framework: Playwright for TypeScript, configured in `detailflow-web/playwright.config.ts` with `testDir: './tests'`.
- The source of test inventory is `MANUAL_REGRESSION_TEST_SUITE.md`. `npm run test:e2e:generate` writes `tests/generated/manual-cases.ts`, the 19 prefix spec files under `tests/`, and root `PLAYWRIGHT_COVERAGE.md`. Do not hand-edit generated outputs.
- The generated inventory currently contains 219 manual IDs; some are marked `Environment-gated` and only perform the reachable local baseline without provider/proxy/fault-injection infrastructure.
- `fixtures/evidence-test.ts` resets the deterministic Development seed before every test and captures screenshots; the reporter copies videos and traces to ignored `evidence/` paths.
- The configured suite is serial (`workers: 1`, `fullyParallel: false`) because seed reset is global. CI retries twice; local runs do not retry.
- Playwright starts the API and a production Next.js server. It expects a dedicated PostgreSQL database and uses `E2E_DB_CONNECTION_STRING`, `E2E_API_URL`, and `E2E_WEB_URL` overrides.
- The checked-in GitHub CI workflow does not currently execute Playwright or publish browser evidence; `PLAYWRIGHT_AUTOMATION.md` describes what a future E2E CI job should provision and retain.
- Never point Playwright or `Run-E2E.ps1` at production. The runner refuses to reset a database whose name does not contain `e2e` or `test`.
- Trace, screenshot, and video are configured `on`, not just on failure. Reports go to ignored `reports/` and `evidence/` directories.
- No Vitest/Jest/React Testing Library suite exists. UI confidence currently comes from TypeScript/build, ESLint, landing QA, and Playwright.

# Development Workflow

Prerequisites are .NET 10 SDK, `dotnet-ef`, Node.js/npm, PostgreSQL, and Playwright Chromium for browser tests.

From the repository root:

```powershell
dotnet restore .\DetailFlow.sln --configfile .\NuGet.Config
dotnet build .\DetailFlow.sln --no-restore
dotnet test .\DetailFlow.sln --no-build --no-restore
```

Start a local database, migrate, and run the API:

```powershell
docker compose up -d postgres
$env:DB_CONNECTION_STRING = "Host=127.0.0.1;Port=5432;Database=detailflow;Username=detailflow;Password=detailflow"
dotnet ef database update --project .\DetailFlow.Api\DetailFlow.Api.csproj --startup-project .\DetailFlow.Api\DetailFlow.Api.csproj
dotnet run --project .\DetailFlow.Api\DetailFlow.Api.csproj
```

Run the web app from `detailflow-web`:

```powershell
npm ci
npm run dev
npm run lint
npm run build
npm run start
```

On Windows hosts that block the unsigned PowerShell npm/npx shims, use `cmd /c npm ...` or `npx.cmd`, as already noted in `PLAYWRIGHT_AUTOMATION.md`.

Test and QA commands:

```powershell
# Root: guarded clean DB migration + solution build/tests + web build + full Playwright
.\scripts\Run-E2E.ps1
.\scripts\Run-E2E.ps1 -SkipInstall

# detailflow-web
npm run test:e2e:generate
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:report
npm run qa:landing
```

`qa:landing` expects a running site at `LANDING_QA_URL` or `http://127.0.0.1:3000`. It checks English desktop, Arabic RTL, mobile layout, interactions, and writes ignored screenshots to `output/`.

Coverage can be collected with:

```powershell
dotnet test .\DetailFlow.sln --settings .\coverage.runsettings --collect:"XPlat Code Coverage"
```

Local container topology can be built with `docker compose up --build`; Caddy is the public entry point and maps host port 80 to its internal port 8080. Production Compose should at least parse with the same command CI uses:

```powershell
docker compose --env-file .env.example -f deploy/compose.yml config --quiet
```

# Repository Conventions

- The protected/trunk branch visible in the repository is `main`. Existing feature/fix branches predominantly use `codex/<short-kebab-description>`, but there is no checked-in branch-policy file; do not claim this is universally enforced.
- Commit history is mixed (`feat: ...`, imperative titles, and generic messages). No reliable commit-message convention or commitlint configuration can be inferred.
- Pull requests are expected to pass GitHub Actions CI: solution restore/test, production npm audit at high severity, ESLint, Next.js production build, and production Compose validation. There is no PR template, CODEOWNERS file, or checked-in review checklist.
- Deployment runs only after successful CI on `main` or manual dispatch. It builds immutable API/web images, pushes both SHA and `latest` tags to GHCR, copies versioned deploy files to the VPS, backs up, runs the EF bundle, deploys, and verifies `/healthz` plus `/api/health/ready`.
- Application rollback restores the previous image tag, not the database schema. Migrations must remain backward-compatible with the previous application image where practical.
- Root Markdown files are operational/product/testing documentation. Keep commands and counts synchronized when changing workflows or generated test coverage.
- `.env.example`, `DetailFlow.Api/.env.example`, `detailflow-web/.env.example`, and `backup.env.example` document configuration shape only. Never commit populated `.env`, `backup.env`, credentials, JWTs, provider tokens, or production data.
- `.gitattributes` expects LF for source/docs/shell files and CRLF for `.sln`.

# Important Dependencies

- EF Core/Npgsql is the persistence and tenant-filter foundation; changes to entity relationships, filters, indexes, or JSON settings require a migration and integration tests.
- React Query is the authoritative frontend server-state cache. New mutations must invalidate or update every affected query key, including plan usage and board/detail projections.
- Zustand is used only where React Query is insufficient: persisted auth display state and live/optimistic board state.
- Axios is the authenticated API boundary. Creating ad hoc Axios clients bypasses the plan-limit and 401 behaviors; public tracking intentionally uses `fetch`/`EventSource`.
- `@dnd-kit` drives both board movement and service reordering. Its ref/listener patterns currently trigger warning-level React compiler lint rules.
- Radix UI provides dialog, sheet, menu, select, tabs, switch, avatar, label, and separator behavior behind local wrappers.
- Zod + React Hook Form provides client validation for principal forms, but the server remains authoritative.
- QuestPDF plus embedded Amiri fonts implements the only document export in the product: work-order receipts.
- AWSSDK.S3 is configured against the R2 endpoint with path-style requests. Uploads accept only JPEG, PNG, and WEBP after magic-byte validation; do not trust filename/content-type alone.
- In-memory cache holds tenant- and date-range-keyed analytics for 60 seconds. In-memory channels distribute SSE events inside one API process.

# Things Future AI Agents Must Know

- Tenant isolation is the most critical invariant. `DetailFlowDbContext` captures `ITenantContext.TenantId` and applies global filters to tenant-owned entities. Any `IgnoreQueryFilters()` call must be reviewed as a potential cross-tenant leak and constrained explicitly.
- `Tenant` itself has no global filter. Platform and public flows intentionally query without tenant context; tenant-facing services must not accidentally do so.
- Frontend auth persistence is not authentication. The signed JWT is in the HTTP-only `detailflow_auth` cookie. `withCredentials`, exact CORS origins, cookie security, forwarded headers, and Caddy's same-origin `/api` routing are coupled.
- Platform-admin and tenant/support sessions share the cookie mechanism but are deliberately isolated by claims and `ActiveUserMiddleware`. Do not call tenant-only APIs from platform pages; `usePlanStatus` already disables itself for platform admins for this reason.
- Server startup fails fast unless DB, JWT, and R2 settings are present and the R2 public URL is valid. Development configuration contains placeholders that start the app but do not make real upload flows work.
- Data-protection keys must persist across container restarts or encrypted WhatsApp access tokens become unreadable. Do not remove the production key volume/path casually.
- Work-order transitions are business rules, not presentation choices: delivered orders cannot move, delivery requires `Paid`, and moving backward is limited to one stage. Successful changes record history and broadcast tenant/token SSE events.
- Booking capacity and consistency are concurrency-sensitive. Internal/public create and update paths use serializable transactions; preserve that protection when changing availability or booking-to-work-order logic.
- `BoardEventService` and analytics cache are process-local. Current production Compose runs one API instance. Horizontal scaling would require a distributed event/cache design; do not assume cross-instance SSE delivery today.
- Public tracking has SSE plus polling fallback. Caddy disables proxy buffering through `flush_interval -1`, and the API emits SSE/no-cache headers; changing proxy or stream behavior can silently break live updates.
- Date/time logic mixes UTC persistence/report boundaries with browser-supplied timezone offsets for booking-day availability. Test DST and locale boundaries when touching scheduling.
- Analytics accepts inclusive shop-local date ranges up to 90 days and uses the browser timezone offset for UTC query boundaries. Bookings, completions, service mix, repeat customers, trend data, and activity follow the selected range; active vehicles remains a live snapshot.
- `src/types/index.ts` is not generated. C# payload/enum changes can compile while the web contract becomes stale; update and build both applications.
- Translation keys must remain complete across `en.json`, `ar.json`, and `tr.json`. Verify Arabic RTL as well as English; fallback-to-English can hide missing keys.
- `MVP_Plan.md` is historical input, not a source of current framework or feature truth. `SYSTEM_TESTING_REPORT.md` and dated counts are snapshots, not automatically live.
- `DevSeedService` is intentionally deterministic and destructive for its fixture tenants. The Playwright suite depends on its stable IDs/tokens/accounts and one-worker reset behavior. Do not randomize it or expose the seed outside Development.
- Edit `MANUAL_REGRESSION_TEST_SUITE.md` and `e2e-manual/generate-suite.mjs`, then regenerate. Do not edit generated Playwright spec files, `tests/generated/manual-cases.ts`, or `PLAYWRIGHT_COVERAGE.md` directly.
- EF migration designer files and `DetailFlowDbContextModelSnapshot.cs` are generated. Change models/configuration and create a migration with `dotnet ef migrations add`; do not hand-maintain the snapshot except during an intentional migration repair.
- `DetailFlow.Api/Resources/Fonts`, receipt layout, storage key conventions, auth/data-protection code, tenant query filters, deployment scripts, and backup/restore safeguards deserve focused review and should not be modified casually.
- The restore script blocks production overwrite without an explicit flag and creates a fresh backup first. The E2E runner blocks database names lacking `e2e`/`test`. Preserve these destructive-operation guards.
- Current known warning baseline is 19 ESLint warnings (React compiler/effect/ref compatibility) plus xUnit cancellation-token analyzer warnings. Warnings are not an invitation to add more; avoid broad cleanup mixed into unrelated changes.
- No soft delete, general audit log, custom permissions, read-only role, multi-location behavior, bulk import/export, or customer account exists. Do not imply or partially wire these unsupported capabilities without an explicit feature request.

# Definition of Done

Scale validation to the change, but a completed change in this repository normally means:

- behavior is implemented in the existing feature/service/component architecture without bypassing tenant, role, plan, transition, or validation rules;
- API contract changes update C# DTOs, frontend types/callers, translations, and relevant manual/API/browser tests;
- persistence changes include a reviewed EF migration and model snapshot, and remain safe for the deployment's backup/migrate/application-rollback sequence;
- affected xUnit tests pass; `dotnet build` and `dotnet test` pass for backend changes;
- `npm run lint` and `npm run build` pass for frontend changes, without adding warning regressions;
- relevant Playwright/manual cases are updated and regenerated for user-visible cross-feature changes; environment-gated gaps are stated rather than simulated as full coverage;
- responsive, keyboard/focus, light/dark surface, localization, and Arabic RTL behavior are checked when UI is affected;
- query keys/caches, optimistic board state, SSE events, plan usage, and public tracking remain synchronized where applicable;
- no duplicate business logic or new parallel abstraction is introduced when an existing service, hook, primitive, mapper, or utility already owns the concern;
- configuration examples and operational documentation are updated when environment variables, commands, health checks, deployment, backup, or restore behavior changes;
- generated files, secrets, test evidence, build outputs, and local environment files are not committed accidentally;
- `git diff` is reviewed so unrelated user changes, including untracked local files, are preserved.

# Maintenance

Treat this file as a living repository map. While doing future work, update `AGENTS.md` in the same change whenever repository evidence reveals or introduces a new architectural boundary, business invariant, shared abstraction, workflow, dependency, generated-file rule, validation command, deployment behavior, or recurring pitfall.

Keep updates evidence-based: point to current code/configuration, remove obsolete statements, and explicitly say when a convention cannot be determined. Do not convert preferences or one-off implementation choices into project-wide rules. If a change only affects the Next.js subtree, also reconcile the nested `detailflow-web/AGENTS.md` when its Next.js-specific instruction needs to evolve.
