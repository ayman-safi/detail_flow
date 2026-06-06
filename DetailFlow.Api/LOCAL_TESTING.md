# DetailFlow API Local Testing Guide

## Prerequisites

- Visual Studio 2026 or later with .NET 10 SDK support.
- PostgreSQL running on `localhost:5432`.
- Node/npm only if you want to run the frontend.

The local API uses:

```text
Host=localhost;Port=5432;Database=detailflow;Username=detailflow;Password=detailflow
```

This connection string is already in `appsettings.Development.json`.

## Create Local Database

Run this once from PowerShell. This matches the connection string in `appsettings.Development.json`.

```powershell
$psql = "C:\Program Files\PostgreSQL\15\bin\psql.exe"
& $psql -h localhost -U postgres -d postgres -c "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'detailflow') THEN CREATE ROLE detailflow WITH LOGIN PASSWORD 'detailflow'; END IF; END `$`$;"
$dbExists = & $psql -h localhost -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='detailflow';"
if (-not $dbExists) {
  & $psql -h localhost -U postgres -d postgres -c "CREATE DATABASE detailflow OWNER detailflow;"
}
dotnet ef database update
```

Current local verification on this machine:

```text
Tenants: 1
Users: 3
ServiceTypes: 5
Applied EF migrations: 2
```

## Start the API

Open `DetailFlow.Api.sln` in Visual Studio.

1. Set `DetailFlow.Api` as the startup project.
2. Select the `http` launch profile.
3. Press F5.
4. Swagger opens at `http://localhost:5000/swagger`.

## Seed Demo Tenant, Roles, and Workflow Data

The development-only seed endpoint is available only when `ASPNETCORE_ENVIRONMENT=Development`.

In Swagger, run:

```http
POST /api/dev/seed
```

It idempotently creates tenant `demo`, the five default services, demo users, and resets/recreates operational test data for the board, bookings, customer history, tracking, analytics, assignment, photos, and availability flows.

| Role | Email | Password |
|---|---|---|
| Owner | owner@demo.local | Password123! |
| Manager | manager@demo.local | Password123! |
| Staff | staff@demo.local | Password123! |
| Staff | jordan@demo.local | Password123! |

Seeded tracking tokens:

| Scenario | Token |
|---|---|
| Booked | TRKBOOK1 |
| Arrived | TRKARRV1 |
| Washing | TRKWASH1 |
| Detailing | TRKDTL1 |
| Polishing | TRKPOL1 |
| Ready | TRKREADY |
| Delivered | TRKDELV1 |

Availability full-slot scenario:

```text
Tomorrow at 10:00 for Exterior Wash has 3 confirmed bookings, so it should be unavailable.
```

## Login Payload

Use:

```json
{
  "email": "owner@demo.local",
  "tenantSlug": "demo",
  "password": "Password123!"
}
```

Endpoint:

```http
POST /api/auth/login
```

Copy the returned JWT and click Swagger's `Authorize` button:

```text
Bearer <token>
```

## Role Permissions

- Owner: full access, tenant profile, staff, services, bookings, work orders.
- Manager: staff/service/work-order management, but managers can only create Staff users.
- Staff: bookings, board stage moves, photo uploads; cannot cancel bookings, manage staff, or edit tenant profile.

## Seeding Behavior

There are two seed paths:

- Production-safe path: `POST /api/auth/register-tenant` creates a tenant, creates the owner, and seeds the five default services for that tenant.
- Local development path: `POST /api/dev/seed` creates the `demo` tenant, Owner, Manager, Staff, and the same five default services. This endpoint is mapped only in Development.

## Suggested Test Flow

1. `POST /api/dev/seed`.
2. Login as Owner.
3. Open `/board` and confirm seeded cards exist across Booked, Arrived, Washing, Detailing, Polishing, Ready, and Delivered.
4. Open `/bookings` and confirm today's/tomorrow's seeded bookings are listed.
5. Check `/bookings/availability` for tomorrow at `10:00`; `Exterior Wash` should be full.
6. Drag a card through stages with `PATCH /api/work-orders/{id}/stage` or the board UI.
7. Open `/track/TRKREADY` without auth and confirm the public Ready state.
8. Open a work-order sheet and test assignment, price/notes, receipt PDF, and seeded photo display/delete.
9. Open `/customers` and expand a customer row to see recent work-order history.
10. Login as Manager and create a Staff user with `POST /api/staff`.
11. Login as Staff and confirm restricted endpoints return 401.

## Frontend Local Run

From `detailflow-web`:

```powershell
npm install
npm run dev
```

The frontend has `.env.local`:

```text
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Open `http://localhost:3000/login` and use the demo accounts above.

## R2 / S3 Notes

Local appsettings contain placeholder R2 values so the API can start. Photo upload and tenant logo upload need real Cloudflare R2 credentials:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`

Without real values, non-upload API flows still work.
