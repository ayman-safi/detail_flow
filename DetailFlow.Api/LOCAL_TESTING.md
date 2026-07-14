# DetailFlow Local and End-to-End Testing

## Prerequisites

- .NET 10 SDK and `dotnet-ef`.
- Node.js/npm.
- PostgreSQL reachable on `127.0.0.1:5432`.
- A dedicated `detailflow_e2e` database owned by the configured PostgreSQL login.

The repeatable runner refuses to reset a database unless its name contains `e2e` or `test`.

## One-command fresh database validation

From the repository root:

```powershell
.\scripts\Run-E2E.ps1
```

The database only needs to be provisioned once. For example, from an administrative PostgreSQL shell:

```sql
CREATE DATABASE detailflow_e2e OWNER detailflow;
```

The script restores dependencies, rolls the dedicated database back to migration zero, applies every EF migration, builds both applications, runs the .NET tests, and runs the complete Playwright suite. To use another safe test database:

```powershell
.\scripts\Run-E2E.ps1 -ConnectionString "Host=127.0.0.1;Port=5432;Database=my_test_db;Username=detailflow;Password=detailflow"
```

After dependencies and Chromium are already installed, use `-SkipInstall`.

## Manual development run

Apply migrations and start the API:

```powershell
$env:DB_CONNECTION_STRING = "Host=127.0.0.1;Port=5432;Database=detailflow;Username=detailflow;Password=detailflow"
dotnet ef database update --project .\DetailFlow.Api\DetailFlow.Api.csproj --startup-project .\DetailFlow.Api\DetailFlow.Api.csproj
dotnet run --project .\DetailFlow.Api\DetailFlow.Api.csproj
```

In another shell:

```powershell
Set-Location .\detailflow-web
npm install
npm run dev
```

Open `http://localhost:3000/login`. The API is at `http://localhost:5000/api`.

## Deterministic development seed

The seed endpoint exists only in the Development environment:

```http
POST /api/dev/seed
```

It is safe to call repeatedly. The five fixture tenants are reset transactionally, stable identifiers and tracking tokens are reused, and extra operational records in those tenants are removed. Twenty-five catalog tenants are also upserted for platform pagination and filtering, for 30 tenants total.

All tenant users use `Password123!`.

| Tenant | Account | Role/state | Purpose |
|---|---|---|---|
| `demo` | `owner@demo.local` | Owner, active | Full operational access |
| `demo` | `manager@demo.local` | Manager, active | Bounded configuration/staff access |
| `demo` | `staff@demo.local` | Staff, active | Operational access |
| `demo` | `jordan@demo.local` | Staff, active | Assignment and history fixtures |
| `demo` | `inactive@demo.local` | Staff, inactive | Login rejection |
| `demo` | `pending@demo.local` | Staff, pending invite | Invite lifecycle |
| `starter` | `owner@starter.local` | Owner, active | Free-plan limits reached |
| `empty` | `owner@empty.local` | Owner, active | Empty states and isolation |
| `business` | `owner@business.local` | Owner, active | Business-plan fixture |
| `business` | `manager@business.local` | Manager, active | Multi-role fixture |
| `business` | `staff@business.local` | Staff, active | Multi-role fixture |
| `suspended` | `owner@suspended.local` | Owner, tenant inactive | Suspended-tenant rejection |

The configuration-backed Super Admin is `admin@detailflow.local` / `AdminPassword123!`.

Stable public tracking tokens:

| Stage | Token |
|---|---|
| Booked | `TRKBKED2` |
| Arrived | `TRKRRVD2` |
| Washing | `TRKWSH22` |
| Detailing | `TRKDTL22` |
| Polishing | `TRKPLSH2` |
| Ready | `TRKREDY2` |
| Delivered | `TRKDLVR2` |

The seed also provides 45 demo customers, active/inactive services, all booking/work-order/payment/notification statuses, historical analytics data, a full availability slot returned in the seed response, notification log outcomes, an empty tenant, an inactive tenant, and 30 current-month bookings at the Free-plan boundary. Invalid records are exercised through validation requests rather than persisted in the database.

## Individual checks

```powershell
dotnet test .\DetailFlow.sln
Set-Location .\detailflow-web
npm run build
npm run lint
npm run test:e2e
```

Playwright starts the API and production frontend automatically. Set `E2E_DB_CONNECTION_STRING`, `E2E_API_URL`, or `E2E_WEB_URL` to override its defaults.

## External integrations

Photo and tenant-logo uploads need real R2/S3 credentials. The E2E suite validates the remaining browser workflows; API integration tests use isolated storage substitutes for upload behavior.
