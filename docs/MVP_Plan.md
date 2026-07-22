# DetailFlow — Complete Codex Implementation Prompts

---

## Honest MVP Revision (Read Before Starting)

**Cut from MVP → Phase 2:**
- Loyalty/points system
- Membership packages
- Full employee tracking (keep only "assigned to" field on work order)

**Add to MVP (critical):**
- Customer status page `/track/{token}` — eliminates "is my car ready?" calls
- Receipt PDF — shops legally need this, otherwise they won't drop WhatsApp
- SSE real-time board — makes the ops board feel alive, not a spreadsheet

**Stack:**
- .NET 10 Minimal APIs + EF Core 10 + PostgreSQL 17
- Cloudflare R2 for photo storage (S3-compatible, no transformation overhead)
- SSE via .NET 10 built-in (`Channel<T>` fan-out pattern)
- Next.js 15 (App Router) + Tailwind CSS 4 + shadcn/ui
- `@dnd-kit` for Kanban drag/drop
- `useSSE` custom hook replacing all polling

---

## CHUNK 1 — Backend: Project Scaffold & Infrastructure

```
You are initializing the backend for a multi-tenant car detailing SaaS called "DetailFlow".

Stack: ASP.NET Core 10 Minimal APIs, PostgreSQL 17, Entity Framework Core 10, Docker.

=== TASK 1: Project Creation ===

Create a new ASP.NET Core 10 Web API project named `DetailFlow.Api`.
Use Minimal APIs — not controllers.
Use WebApplication.CreateSlimBuilder() for trimmed startup.

=== TASK 2: NuGet Packages ===

Add the following:
- Microsoft.EntityFrameworkCore (v10)
- Npgsql.EntityFrameworkCore.PostgreSQL (v10)
- Microsoft.AspNetCore.Authentication.JwtBearer
- BCrypt.Net-Next
- AWSSDK.S3                         ← Cloudflare R2 (S3-compatible)
- QuestPDF                          ← receipt PDF generation
- Swashbuckle.AspNetCore            ← Swagger
- Microsoft.Extensions.Caching.Memory

=== TASK 3: Docker Compose ===

Create docker-compose.yml with:
- postgres service: image postgres:17, port 5432, named volume detailflow_pgdata
- api service: build from Dockerfile, port 5000, env_file: .env, depends_on postgres
- Use .env file for all secrets

=== TASK 4: Environment Variables ===

Create .env.example with these keys:
DB_CONNECTION_STRING
JWT_SECRET
JWT_ISSUER
JWT_AUDIENCE
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL
FRONTEND_URL

=== TASK 5: Program.cs ===

Set up Program.cs with:

1. CORS: policy named "Frontend" allowing FRONTEND_URL, any header, any method

2. JWT Bearer authentication:
   options.TokenValidationParameters = new TokenValidationParameters
   {
       ValidateIssuerSigningKey = true,
       IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
       ValidateIssuer = true,
       ValidIssuer = config["JWT_ISSUER"],
       ValidateAudience = true,
       ValidAudience = config["JWT_AUDIENCE"],
       ClockSkew = TimeSpan.Zero
   };

3. Swagger with JWT Bearer security definition

4. EF Core with Npgsql:
   builder.Services.AddDbContext<DetailFlowDbContext>(opts =>
       opts.UseNpgsql(config["DB_CONNECTION_STRING"]));

5. IMemoryCache registration

6. Global exception handler using .NET 10 IExceptionHandler interface:

   public class GlobalExceptionHandler : IExceptionHandler
   {
       public async ValueTask<bool> TryHandleAsync(
           HttpContext ctx, Exception ex, CancellationToken ct)
       {
           var (status, code) = ex switch
           {
               UnauthorizedAccessException => (401, "UNAUTHORIZED"),
               KeyNotFoundException        => (404, "NOT_FOUND"),
               ArgumentException          => (400, "BAD_REQUEST"),
               InvalidOperationException  => (422, "UNPROCESSABLE"),
               _                          => (500, "INTERNAL_ERROR")
           };
           ctx.Response.StatusCode = status;
           await ctx.Response.WriteAsJsonAsync(
               new { error = ex.Message, code, statusCode = status }, ct);
           return true;
       }
   }
   Register: builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
   Use: app.UseExceptionHandler();

7. SSE middleware: set Cache-Control: no-cache on paths ending in /stream:
   app.Use(async (ctx, next) => {
       if (ctx.Request.Path.Value?.EndsWith("/stream") == true)
           ctx.Response.Headers.Append("Cache-Control", "no-cache");
       await next();
   });

=== TASK 6: R2StorageService ===

Create Infrastructure/R2StorageService.cs:

public interface IR2StorageService
{
    Task<string> UploadAsync(Stream file, string key, string contentType);
    Task DeleteAsync(string key);
    Task<string> GetPresignedUrlAsync(string key, int expiryMinutes = 60);
}

public class R2StorageService : IR2StorageService
{
    private readonly IAmazonS3 _s3;
    private readonly string _bucket;
    private readonly string _publicBaseUrl;

    public R2StorageService(IConfiguration config)
    {
        _bucket = config["R2_BUCKET_NAME"]!;
        _publicBaseUrl = config["R2_PUBLIC_BASE_URL"]!.TrimEnd('/');

        _s3 = new AmazonS3Client(
            config["R2_ACCESS_KEY_ID"],
            config["R2_SECRET_ACCESS_KEY"],
            new AmazonS3Config
            {
                ServiceURL = $"https://{config["R2_ACCOUNT_ID"]}.r2.cloudflarestorage.com",
                ForcePathStyle = true
            });
    }

    public async Task<string> UploadAsync(Stream file, string key, string contentType)
    {
        await _s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = file,
            ContentType = contentType
        });
        return $"{_publicBaseUrl}/{key}";
    }

    public async Task DeleteAsync(string key) =>
        await _s3.DeleteObjectAsync(_bucket, key);

    public async Task<string> GetPresignedUrlAsync(string key, int expiryMinutes = 60)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _bucket,
            Key = key,
            Expires = DateTime.UtcNow.AddMinutes(expiryMinutes)
        };
        return await _s3.GetPreSignedURLAsync(request);
    }
}

Register: builder.Services.AddSingleton<IR2StorageService, R2StorageService>();

=== TASK 7: Startup Validation ===

After builder.Build(), before app.Run(), validate:
var jwtSecret = app.Configuration["JWT_SECRET"];
if (string.IsNullOrEmpty(jwtSecret) || jwtSecret.Length < 32)
    throw new InvalidOperationException("JWT_SECRET must be at least 32 characters.");

if (string.IsNullOrEmpty(app.Configuration["R2_ACCOUNT_ID"]))
    throw new InvalidOperationException("R2_ACCOUNT_ID is required.");

=== TASK 8: Dockerfile ===

Create multi-stage Dockerfile:
- Stage 1 (build): mcr.microsoft.com/dotnet/sdk:10.0, restore + publish
- Stage 2 (runtime): mcr.microsoft.com/dotnet/aspnet:10.0
- Expose port 5000
- ENTRYPOINT dotnet DetailFlow.Api.dll

Do not create any domain models yet. Infrastructure only.
```

---

## CHUNK 2 — Backend: Multi-Tenant Foundation & Auth

```
Continue DetailFlow.Api.

Create the multi-tenant foundation and authentication system.

=== TASK 1: Domain Models ===

Create Models/Tenant.cs:
public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";        // unique, used in URLs
    public string? LogoUrl { get; set; }
    public Plan Plan { get; set; } = Plan.Starter;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum Plan { Starter, Professional, MultiBranch }

Create Models/User.cs:
public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string FullName { get; set; } = "";
    public UserRole Role { get; set; } = UserRole.Staff;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum UserRole { Owner, Manager, Staff }

=== TASK 2: DbContext ===

Create Data/DetailFlowDbContext.cs:
- DbSet<Tenant> Tenants
- DbSet<User> Users
- OnModelCreating: 
  * User.Email + TenantId: unique index
  * Tenant.Slug: unique index
  * User has global query filter: e => e.TenantId == _currentTenantId
    (where _currentTenantId is injected via ITenantContext)

=== TASK 3: Tenant Context ===

Create Services/ITenantContext.cs:
public interface ITenantContext
{
    Guid TenantId { get; }
    Guid UserId { get; }
    UserRole Role { get; }
}

Create Services/TenantContext.cs:
- Implements ITenantContext
- Constructor receives IHttpContextAccessor
- Reads claims from HttpContext.User:
  * TenantId from claim "tenant_id"
  * UserId from ClaimTypes.NameIdentifier
  * Role from ClaimTypes.Role

Register both as Scoped:
builder.Services.AddScoped<ITenantContext, TenantContext>();
builder.Services.AddHttpContextAccessor();

=== TASK 4: Initial Migration ===

Create EF migration: "InitialCreate" with Tenant and User tables.

=== TASK 5: Auth Endpoints ===

Create Features/Auth/AuthEndpoints.cs with extension method MapAuthEndpoints().
Register in Program.cs: app.MapAuthEndpoints();

POST /api/auth/register-tenant:
Input DTO:
{
  tenantName: string,
  slug: string,          // lowercase, alphanumeric + hyphens only, validate with regex
  ownerEmail: string,
  ownerPassword: string, // min 8 chars
  ownerFullName: string
}

Logic:
1. Validate slug format: ^[a-z0-9-]{3,30}$
2. Check slug uniqueness — throw ArgumentException if taken
3. Check email uniqueness across tenants
4. Begin transaction:
   a. Create Tenant
   b. Create User (Owner role, BCrypt.HashPassword(password, workFactor: 12))
   c. Seed 5 default ServiceTypes for this tenant (see Chunk 3 for ServiceType model)
   d. Commit
5. Generate and return JWT token

POST /api/auth/login:
Input: { email, tenantSlug, password }
Logic:
1. Find tenant by slug
2. Find user by email + tenantId
3. Verify BCrypt.Verify(password, user.PasswordHash)
4. If invalid: throw UnauthorizedAccessException("Invalid credentials")
5. Return JWT

JWT Claims:
- sub: user.Id.ToString()
- tenant_id: tenant.Id.ToString()
- ClaimTypes.Role: user.Role.ToString()
- tenant_slug: tenant.Slug
- name: user.FullName
- Expiry: DateTime.UtcNow.AddDays(7)

=== TASK 6: Auth Helper ===

Create a base helper used by all authenticated endpoints:

public static class EndpointExtensions
{
    public static Guid GetTenantId(this HttpContext ctx) =>
        Guid.Parse(ctx.User.FindFirst("tenant_id")!.Value);

    public static Guid GetUserId(this HttpContext ctx) =>
        Guid.Parse(ctx.User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    public static UserRole GetRole(this HttpContext ctx) =>
        Enum.Parse<UserRole>(ctx.User.FindFirst(ClaimTypes.Role)!.Value);

    public static bool IsManagerOrAbove(this HttpContext ctx) =>
        ctx.GetRole() is UserRole.Manager or UserRole.Owner;
}
```

---

## CHUNK 3 — Backend: Core Domain Models & Database Schema

```
Continue DetailFlow.Api.

Create all remaining domain models and database schema.

=== TASK 1: Create All Models ===

Models/Customer.cs:
public class Customer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string FullName { get; set; } = "";
    public string Phone { get; set; } = "";      // unique per tenant
    public int TotalVisits { get; set; } = 0;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

Models/Vehicle.cs:
public class Vehicle
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public string PlateNumber { get; set; } = "";
    public string Make { get; set; } = "";
    public string Model { get; set; } = "";
    public string Color { get; set; } = "";
    public VehicleType VehicleType { get; set; } = VehicleType.Sedan;
}

public enum VehicleType { Sedan, SUV, Truck, Van, Motorcycle, Other }

Models/ServiceType.cs:
public class ServiceType
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public int DurationMinutes { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; } = 0;
}

Models/Booking.cs:
public class Booking
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public Guid ServiceTypeId { get; set; }
    public ServiceType ServiceType { get; set; } = null!;
    public DateTimeOffset ScheduledAt { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Pending;
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum BookingStatus { Pending, Confirmed, Cancelled }

Models/WorkOrder.cs:
public class WorkOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public Guid ServiceTypeId { get; set; }
    public ServiceType ServiceType { get; set; } = null!;
    public WorkOrderStage Stage { get; set; } = WorkOrderStage.Booked;
    public Guid? AssignedStaffId { get; set; }
    public User? AssignedStaff { get; set; }
    public DateTimeOffset? EstimatedReadyAt { get; set; }
    public string TrackingToken { get; set; } = GenerateToken();
    public decimal? ActualPrice { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<WorkOrderStageHistory> StageHistory { get; set; } = [];
    public List<WorkOrderPhoto> Photos { get; set; } = [];

    private static string GenerateToken()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        return new string(Enumerable.Range(0, 8)
            .Select(_ => chars[Random.Shared.Next(chars.Length)]).ToArray());
    }
}

public enum WorkOrderStage
{
    Booked = 0,
    Arrived = 1,
    Washing = 2,
    Detailing = 3,
    Polishing = 4,
    Ready = 5,
    Delivered = 6
}

Models/WorkOrderStageHistory.cs:
public class WorkOrderStageHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkOrderId { get; set; }
    public WorkOrder WorkOrder { get; set; } = null!;
    public WorkOrderStage FromStage { get; set; }
    public WorkOrderStage ToStage { get; set; }
    public Guid ChangedByUserId { get; set; }
    public string ChangedByName { get; set; } = "";  // denormalized
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;
}

Models/WorkOrderPhoto.cs:
public class WorkOrderPhoto
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkOrderId { get; set; }
    public WorkOrder WorkOrder { get; set; } = null!;
    public string PhotoUrl { get; set; } = "";
    public string R2Key { get; set; } = "";         // stored separately for deletion
    public PhotoType Type { get; set; }
    public Guid UploadedByUserId { get; set; }
    public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum PhotoType { Before, After }

=== TASK 2: Update DbContext ===

Add all new DbSets to DetailFlowDbContext.

Apply tenant query filters:
modelBuilder.Entity<Customer>().HasQueryFilter(e => e.TenantId == _tenantId);
modelBuilder.Entity<Vehicle>().HasQueryFilter(e => e.TenantId == _tenantId);
modelBuilder.Entity<ServiceType>().HasQueryFilter(e => e.TenantId == _tenantId);
modelBuilder.Entity<Booking>().HasQueryFilter(e => e.TenantId == _tenantId);
modelBuilder.Entity<WorkOrder>().HasQueryFilter(e => e.TenantId == _tenantId);

NOTE: WorkOrderStageHistory and WorkOrderPhoto do NOT need tenant filters —
they are always accessed through their parent WorkOrder which is tenant-filtered.

Add indexes:
- Customer: unique(TenantId, Phone)
- Vehicle: unique(TenantId, PlateNumber) — one plate per tenant
- WorkOrder: unique(TrackingToken), index(TenantId, Stage), index(TenantId, CreatedAt)
- Booking: index(TenantId, ScheduledAt)

=== TASK 3: Seed Data Method ===

Create a static method SeedDefaultServices(Guid tenantId) returning List<ServiceType>:
[
  { Name="Exterior Wash",       BasePrice=15,  DurationMinutes=30  },
  { Name="Full Interior Clean", BasePrice=45,  DurationMinutes=90  },
  { Name="Full Detail",         BasePrice=120, DurationMinutes=180 },
  { Name="Paint Polish",        BasePrice=200, DurationMinutes=240 },
  { Name="Ceramic Coating",     BasePrice=500, DurationMinutes=480 }
]
Call this in the register-tenant endpoint (Chunk 2) inside the transaction.

=== TASK 4: Migration ===

Run EF migration named "AddCoreEntities".
Then run: dotnet ef database update
```

---

## CHUNK 4 — Backend: Booking System API

```
Continue DetailFlow.Api.

Implement the full Booking System API.

=== TASK 1: Service Types Endpoints ===

Create Features/Services/ServiceEndpoints.cs and MapServiceEndpoints():

GET /api/services (auth required):
- Return all active service types for tenant, ordered by SortOrder
- Response: List<{ id, name, description, basePrice, durationMinutes, sortOrder }>

POST /api/services (Manager/Owner only):
- Input: { name, description?, basePrice, durationMinutes, sortOrder? }
- Validate: basePrice > 0, durationMinutes > 0

PATCH /api/services/{id} (Manager/Owner only):
- Input: { name?, description?, basePrice?, durationMinutes?, isActive?, sortOrder? }

=== TASK 2: Booking Endpoints ===

Create Features/Bookings/BookingEndpoints.cs and MapBookingEndpoints():

GET /api/bookings?date=2025-01-15 (auth required):
- Default to today if no date
- Return all bookings for that day, ordered by ScheduledAt
- Include: id, scheduledAt, status, serviceName, durationMinutes,
           customer: { id, fullName, phone },
           vehicle: { id, plateNumber, make, model, color, vehicleType },
           workOrderId, trackingToken

GET /api/bookings/availability?date=2025-01-15&serviceTypeId=xxx (auth required):
- Generate time slots: 08:00 to 20:00, every 30 minutes
- Load confirmed bookings for that date
- Each slot: { time, available: bool, bookingCount }
- A slot is unavailable if bookingCount >= 3 (max concurrent capacity)
- Return: List<{ time: "08:00", available: bool }>

POST /api/bookings (auth required):
Input DTO:
{
  customerName: string,
  customerPhone: string,          // normalized: strip spaces/dashes
  vehiclePlate: string,           // uppercase, trim
  vehicleMake: string,
  vehicleModel: string,
  vehicleColor: string,
  vehicleType: VehicleType,
  serviceTypeId: Guid,
  scheduledAt: DateTimeOffset,    // must be future
  notes: string?
}

Logic:
1. Validate scheduledAt is in the future
2. Upsert Customer by (phone, tenantId) — update name if exists
3. Upsert Vehicle by (plateNumber, tenantId) — update make/model/color if exists
4. Validate availability — throw if slot is full
5. Create Booking (status = Confirmed if within business hours, else Pending)
6. Create WorkOrder:
   - Stage = WorkOrderStage.Booked
   - TrackingToken auto-generated (see model)
   - Increment Customer.TotalVisits
7. Commit in transaction
8. Return: { bookingId, workOrderId, trackingToken,
             trackingUrl: $"/track/{trackingToken}",
             customer, vehicle, scheduledAt, serviceName }

PATCH /api/bookings/{id}/status (auth required):
- Input: { status: "Confirmed" | "Cancelled" }
- Manager/Owner only for Cancelled
- Staff can Confirm

GET /api/bookings/{id} (auth required):
- Full details including workOrder.stage, photos count

GET /api/customers?search=xxx (auth required):
- Search by phone OR name (contains, case-insensitive)
- Returns: List<{ id, fullName, phone, totalVisits }>
- Limit 10 results (for autocomplete use)
```

---

## CHUNK 5 — Backend: Work Order API + SSE

```
Continue DetailFlow.Api.

Implement the Work Order / Operations Board API with Server-Sent Events.

=== TASK 1: BoardEventService (Singleton) ===

Create Infrastructure/BoardEventService.cs:

public record BoardEvent(string Type, object Payload);
public record BoardSubscriber(Guid Id, Channel<BoardEvent> Channel);

public class BoardEventService
{
    private readonly ConcurrentDictionary<Guid, ConcurrentBag<BoardSubscriber>> _tenantSubs = new();
    private readonly ConcurrentDictionary<string, ConcurrentBag<BoardSubscriber>> _tokenSubs = new();

    public IDisposable SubscribeTenant(Guid tenantId, BoardSubscriber sub)
    {
        var bag = _tenantSubs.GetOrAdd(tenantId, _ => new ConcurrentBag<BoardSubscriber>());
        bag.Add(sub);
        return Disposable.Create(() => RemoveSub(_tenantSubs, tenantId, sub.Id));
    }

    public IDisposable SubscribeToken(string token, BoardSubscriber sub)
    {
        var bag = _tokenSubs.GetOrAdd(token, _ => new ConcurrentBag<BoardSubscriber>());
        bag.Add(sub);
        return Disposable.Create(() => RemoveTokenSub(token, sub.Id));
    }

    public async Task BroadcastToTenantAsync(Guid tenantId, BoardEvent evt)
    {
        if (!_tenantSubs.TryGetValue(tenantId, out var subs)) return;
        foreach (var sub in subs)
            await sub.Channel.Writer.WriteAsync(evt);
    }

    public async Task BroadcastToTokenAsync(string token, BoardEvent evt)
    {
        if (!_tokenSubs.TryGetValue(token, out var subs)) return;
        foreach (var sub in subs)
            await sub.Channel.Writer.WriteAsync(evt);
    }

    private void RemoveSub(ConcurrentDictionary<Guid, ConcurrentBag<BoardSubscriber>> dict,
        Guid key, Guid subId)
    {
        if (!dict.TryGetValue(key, out var bag)) return;
        var updated = new ConcurrentBag<BoardSubscriber>(bag.Where(s => s.Id != subId));
        dict.TryUpdate(key, updated, bag);
    }

    private void RemoveTokenSub(string token, Guid subId)
    {
        if (!_tokenSubs.TryGetValue(token, out var bag)) return;
        var updated = new ConcurrentBag<BoardSubscriber>(bag.Where(s => s.Id != subId));
        _tokenSubs.TryUpdate(token, updated, bag);
    }
}

Helper for disposable:
public class Disposable(Action onDispose) : IDisposable
{
    public static Disposable Create(Action a) => new(a);
    public void Dispose() => onDispose();
}

Register as Singleton in Program.cs.

=== TASK 2: Token-Based SSE Auth Filter ===

Since EventSource (browser) cannot send Authorization headers,
create a custom endpoint filter that also accepts token via query param:

Create Infrastructure/SseAuthFilter.cs:
public class SseTokenAuthFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var httpCtx = ctx.HttpContext;
        // Already authenticated via header: pass through
        if (httpCtx.User.Identity?.IsAuthenticated == true)
            return await next(ctx);

        // Try query param: ?token=xxx
        var token = httpCtx.Request.Query["token"].ToString();
        if (string.IsNullOrEmpty(token))
            return Results.Unauthorized();

        // Validate JWT manually
        var jwtHandler = httpCtx.RequestServices.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>();
        var options = jwtHandler.Get(JwtBearerDefaults.AuthenticationScheme);
        try
        {
            var principal = options.TokenHandlers.First()
                .ValidateTokenAsync(token, options.TokenValidationParameters).Result;
            httpCtx.User = principal.ClaimsIdentity != null
                ? new ClaimsPrincipal(principal.ClaimsIdentity) : httpCtx.User;
            return await next(ctx);
        }
        catch
        {
            return Results.Unauthorized();
        }
    }
}

=== TASK 3: Work Order Endpoints ===

Create Features/WorkOrders/WorkOrderEndpoints.cs and MapWorkOrderEndpoints():

GET /api/work-orders/board (auth required):
- Return all work orders where Stage != Delivered, grouped by stage
- Response shape:
  {
    booked: WorkOrderCard[],
    arrived: WorkOrderCard[],
    washing: WorkOrderCard[],
    detailing: WorkOrderCard[],
    polishing: WorkOrderCard[],
    ready: WorkOrderCard[],
    delivered: WorkOrderCard[]   // last 24h only
  }

WorkOrderCard DTO:
{
  id, stage, trackingToken,
  customer: { id, fullName, phone },
  vehicle: { plateNumber, make, model, color, vehicleType },
  serviceName, serviceBasePrice,
  assignedStaff: { id, fullName }?,
  estimatedReadyAt?,
  actualPrice?,
  notes?,
  photoCount,
  createdAt, updatedAt
}

PATCH /api/work-orders/{id}/stage (auth required):
Input: { newStage: WorkOrderStage }

Transition validation rules:
- Can move forward any number of stages
- Can move back maximum 1 stage (for corrections only)
- Cannot move from Delivered to anything
- Throw ArgumentException if invalid

Logic:
1. Load work order (with tenant filter)
2. Validate transition
3. Create WorkOrderStageHistory entry
4. Update wo.Stage, wo.UpdatedAt
5. If newStage == Ready && wo.EstimatedReadyAt == null: set EstimatedReadyAt = now + 30min
6. Save changes
7. Build WorkOrderCard DTO
8. Broadcast to tenant: await events.BroadcastToTenantAsync(tenantId, new BoardEvent("stage_changed", new {
       workOrderId = wo.Id, fromStage, toStage = newStage, workOrder = dto }));
9. Broadcast to tracking token: await events.BroadcastToTokenAsync(wo.TrackingToken, same event);
10. Return updated WorkOrderCard

POST /api/work-orders (auth required — walk-in, no booking):
Input: same as POST /api/bookings but without scheduledAt
Creates WorkOrder with Stage = Arrived immediately.
Broadcast "work_order_created" event to tenant.

GET /api/work-orders/{id} (auth required):
Full details including:
- All WorkOrderCard fields
- photos: { before: PhotoDto[], after: PhotoDto[] }
- stageHistory: [{ fromStage, toStage, changedByName, changedAt }]

PATCH /api/work-orders/{id}/assign (Manager/Owner only):
Input: { staffUserId: Guid? }   // null = unassign
Broadcast "work_order_updated" to tenant.

PATCH /api/work-orders/{id}/price (auth required):
Input: { actualPrice: decimal, notes?: string }

=== TASK 4: Public Tracking Endpoint ===

GET /api/work-orders/track/{token} (NO AUTH — public):
- Use IgnoreQueryFilters() since we query by token not by tenant
- Return TrackingInfoDto:
  {
    customerName, vehicleMake, vehicleModel, vehicleColor, vehiclePlate,
    stage, stageName (human-readable), serviceName,
    estimatedReadyAt?,
    shopName, shopLogoUrl?,
    lastUpdatedAt
  }
- If token not found: 404

=== TASK 5: SSE Streaming Endpoints ===

GET /api/work-orders/board/stream (auth via header OR ?token= query param):
Apply SseTokenAuthFilter.

app.MapGet("/api/work-orders/board/stream", async (
    HttpContext ctx, BoardEventService events, CancellationToken ct) =>
{
    var tenantId = ctx.GetTenantId();

    ctx.Response.Headers.Append("Content-Type", "text/event-stream");
    ctx.Response.Headers.Append("Cache-Control", "no-cache");
    ctx.Response.Headers.Append("X-Accel-Buffering", "no");
    ctx.Response.Headers.Append("Connection", "keep-alive");

    var channel = Channel.CreateUnbounded<BoardEvent>();
    var sub = new BoardSubscriber(Guid.NewGuid(), channel);
    using var _ = events.SubscribeTenant(tenantId, sub);

    // Initial heartbeat
    await ctx.Response.WriteAsync("event: connected\ndata: {}\n\n", ct);
    await ctx.Response.Body.FlushAsync(ct);

    // Heartbeat every 25s to prevent proxy timeouts
    using var heartbeat = new PeriodicTimer(TimeSpan.FromSeconds(25));
    var heartbeatTask = Task.Run(async () =>
    {
        while (await heartbeat.WaitForNextTickAsync(ct))
        {
            await channel.Writer.WriteAsync(new BoardEvent("heartbeat", new {}), ct);
        }
    }, ct);

    await foreach (var evt in channel.Reader.ReadAllAsync(ct))
    {
        if (evt.Type == "heartbeat")
        {
            await ctx.Response.WriteAsync(": heartbeat\n\n", ct);
        }
        else
        {
            var json = JsonSerializer.Serialize(evt.Payload);
            await ctx.Response.WriteAsync($"event: {evt.Type}\ndata: {json}\n\n", ct);
        }
        await ctx.Response.Body.FlushAsync(ct);
    }
}).AddEndpointFilter<SseTokenAuthFilter>();

GET /api/work-orders/track/{token}/stream (NO AUTH — public):
Same pattern but:
- Subscribe via events.SubscribeToken(token, sub)
- Only receives stage_changed events for that specific work order
- Heartbeat every 30s
- No auth filter needed
```

---

## CHUNK 6 — Backend: Photo Upload & Receipt PDF

```
Continue DetailFlow.Api.

Implement photo uploads via Cloudflare R2 and receipt PDF generation.

=== TASK 1: Photo Endpoints ===

Create Features/Photos/PhotoEndpoints.cs and MapPhotoEndpoints():

POST /api/work-orders/{id}/photos (auth required):
- Accept multipart/form-data with fields: file (IFormFile), type ("Before" | "After")
- Validate:
  * file != null
  * file.Length <= 10 * 1024 * 1024 (10MB)
  * file.ContentType in ["image/jpeg", "image/png", "image/webp"]
  * type is valid PhotoType enum value
- Generate R2 key:
    var ext = Path.GetExtension(file.FileName).ToLower();
    var key = $"photos/{tenantId}/{workOrderId}/{type.ToLower()}/{Guid.NewGuid()}{ext}";
- Upload: var photoUrl = await r2.UploadAsync(file.OpenReadStream(), key, file.ContentType);
- Save WorkOrderPhoto { WorkOrderId, PhotoUrl, R2Key = key, Type, UploadedByUserId }
- Broadcast "work_order_updated" to tenant with updated photo count
- Return: { id, photoUrl, type, uploadedAt }

DELETE /api/work-orders/{id}/photos/{photoId} (auth required):
- Load photo, verify it belongs to this work order (and tenant via work order filter)
- Permission check: Staff can only delete photos they uploaded; Manager/Owner any
  if (ctx.GetRole() == UserRole.Staff && photo.UploadedByUserId != ctx.GetUserId())
      throw new UnauthorizedAccessException("You can only delete your own photos.");
- Delete from R2: await r2.DeleteAsync(photo.R2Key);
- Delete DB record
- Return 204 No Content

GET /api/work-orders/{id}/photos (auth required):
- Returns: { before: [{ id, photoUrl, uploadedAt }], after: [...] }
- Ordered by UploadedAt ascending within each group

=== TASK 2: Receipt PDF Endpoint ===

GET /api/work-orders/{id}/receipt (auth required):
- Load work order with Customer, Vehicle, ServiceType, AssignedStaff, Tenant

Create Services/ReceiptService.cs using QuestPDF:

public byte[] GenerateReceipt(WorkOrder wo)
{
    return Document.Create(container =>
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A5);
            page.Margin(30, Unit.Point);
            page.DefaultTextStyle(t => t.FontFamily("Arial").FontSize(10));

            page.Content().Column(col =>
            {
                // Header: Logo + Shop Name
                col.Item().Row(row =>
                {
                    if (!string.IsNullOrEmpty(wo.Tenant.LogoUrl))
                        row.ConstantItem(60).Image(FetchLogoBytes(wo.Tenant.LogoUrl));
                    row.RelativeItem().AlignRight().Column(c =>
                    {
                        c.Item().Text(wo.Tenant.Name).Bold().FontSize(16);
                        c.Item().Text("Vehicle Detailing Receipt").FontColor("#666666");
                    });
                });

                col.Item().PaddingVertical(8).LineHorizontal(1).LineColor("#e2e8f0");

                // Receipt meta
                col.Item().Row(row =>
                {
                    row.RelativeItem().Text($"Receipt #WO-{wo.Id.ToString()[..8].ToUpper()}").Bold();
                    row.RelativeItem().AlignRight().Text(wo.UpdatedAt.ToString("dd MMM yyyy, HH:mm"));
                });

                col.Item().PaddingTop(12).Row(row =>
                {
                    // Customer info
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("Customer").Bold().FontColor("#666666").FontSize(9);
                        c.Item().Text(wo.Customer.FullName).Bold();
                        c.Item().Text(wo.Customer.Phone);
                    });
                    // Vehicle info
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("Vehicle").Bold().FontColor("#666666").FontSize(9);
                        c.Item().Text($"{wo.Vehicle.Make} {wo.Vehicle.Model}").Bold();
                        c.Item().Text(wo.Vehicle.PlateNumber).FontFamily("Courier New");
                        c.Item().Text(wo.Vehicle.Color).FontColor("#666666");
                    });
                });

                col.Item().PaddingTop(16).Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        c.RelativeColumn(3);
                        c.RelativeColumn(1);
                        c.RelativeColumn(1);
                    });

                    // Header row
                    table.Header(h =>
                    {
                        h.Cell().Background("#f1f5f9").Padding(6).Text("Service").Bold();
                        h.Cell().Background("#f1f5f9").Padding(6).AlignCenter().Text("Duration").Bold();
                        h.Cell().Background("#f1f5f9").Padding(6).AlignRight().Text("Price").Bold();
                    });

                    // Service row
                    table.Cell().Padding(6).Text(wo.ServiceType.Name);
                    table.Cell().Padding(6).AlignCenter().Text($"{wo.ServiceType.DurationMinutes} min");
                    table.Cell().Padding(6).AlignRight()
                        .Text($"${(wo.ActualPrice ?? wo.ServiceType.BasePrice):F2}").Bold();
                });

                if (!string.IsNullOrEmpty(wo.AssignedStaff?.FullName))
                    col.Item().PaddingTop(8)
                        .Text($"Serviced by: {wo.AssignedStaff.FullName}").FontColor("#666666");

                col.Item().PaddingTop(16).LineHorizontal(1).LineColor("#e2e8f0");

                col.Item().PaddingTop(8).AlignCenter()
                    .Text($"Thank you for choosing {wo.Tenant.Name} ✦")
                    .FontColor("#64748b").FontSize(9).Italic();
            });
        });
    }).GeneratePdf();
}

Back in endpoint:
- var pdfBytes = receiptService.GenerateReceipt(wo);
- var filename = $"receipt-{wo.Vehicle.PlateNumber}-{DateTime.UtcNow:yyyyMMdd}.pdf";
- return Results.File(pdfBytes, "application/pdf", filename);

Register ReceiptService as Scoped in Program.cs.
```

---

## CHUNK 7 — Backend: Staff & Analytics API

```
Continue DetailFlow.Api.

Implement staff management and analytics endpoints.

=== TASK 1: Staff Endpoints ===

Create Features/Staff/StaffEndpoints.cs and MapStaffEndpoints():

GET /api/staff (Manager/Owner only):
- Return all users in tenant
- Include: id, fullName, email, role, isActive
- Also include: completedJobsToday (COUNT of WorkOrders where AssignedStaffId = user.Id
  AND Stage = Delivered AND UpdatedAt >= today 00:00 UTC)
- Return as List<StaffMemberDto>

POST /api/staff (Manager/Owner only):
Input: { fullName, email, password, role }
Rules:
- Owner can assign any role
- Manager can only create Staff role
  if (ctx.GetRole() == UserRole.Manager && input.Role != UserRole.Staff)
      throw new UnauthorizedAccessException("Managers can only create Staff members.");
- Hash password with BCrypt
- Throw ArgumentException if email already used in this tenant

PATCH /api/staff/{id} (Manager/Owner only):
Input: { fullName?, role?, isActive? }
Rules:
- Cannot demote/change an Owner's role unless the requester is also Owner
- Cannot deactivate yourself

=== TASK 2: Analytics Endpoint ===

GET /api/analytics/dashboard (auth required — all roles):

Use IMemoryCache with key "dashboard:{tenantId}", expiry 60 seconds.

Build response using raw SQL via EF Core for performance:

var today = DateTimeOffset.UtcNow.Date;

var totalBookings = await db.Bookings
    .Where(b => b.ScheduledAt.Date == today)
    .CountAsync();

var completedJobs = await db.WorkOrders
    .Where(w => w.Stage == WorkOrderStage.Delivered && w.UpdatedAt.Date == today)
    .CountAsync();

var activeVehicles = await db.WorkOrders
    .Where(w => w.Stage >= WorkOrderStage.Arrived && w.Stage <= WorkOrderStage.Ready)
    .CountAsync();

var walkIns = await db.WorkOrders
    .Where(w => w.BookingId == null && w.CreatedAt.Date == today)
    .CountAsync();

// Top services: last 30 days
var thirtyDaysAgo = DateTimeOffset.UtcNow.AddDays(-30);
var topServices = await db.WorkOrders
    .Where(w => w.CreatedAt >= thirtyDaysAgo)
    .GroupBy(w => w.ServiceType.Name)
    .Select(g => new { ServiceName = g.Key, Count = g.Count() })
    .OrderByDescending(x => x.Count)
    .Take(5)
    .ToListAsync();

// Repeat customers: last 30 days
var repeatCustomers = await db.Customers
    .Where(c => c.TotalVisits > 1)
    .CountAsync();

// Jobs last 7 days (for chart)
var sevenDaysAgo = DateTimeOffset.UtcNow.AddDays(-7);
var jobsByDay = await db.WorkOrders
    .Where(w => w.Stage == WorkOrderStage.Delivered && w.UpdatedAt >= sevenDaysAgo)
    .GroupBy(w => w.UpdatedAt.Date)
    .Select(g => new { Date = g.Key, Count = g.Count() })
    .OrderBy(x => x.Date)
    .ToListAsync();

// Recent activity: last 10 stage changes
var recentActivity = await db.Set<WorkOrderStageHistory>()
    .Include(h => h.WorkOrder).ThenInclude(w => w.Vehicle)
    .OrderByDescending(h => h.ChangedAt)
    .Take(10)
    .Select(h => new {
        h.ChangedByName,
        VehiclePlate = h.WorkOrder.Vehicle.PlateNumber,
        h.FromStage,
        h.ToStage,
        h.ChangedAt
    })
    .ToListAsync();

Cache and return the assembled DashboardDto.

=== TASK 3: Tenant Profile Endpoint ===

PATCH /api/tenant/profile (Owner only):
Input: { name?, logoUrl? }
- Update Tenant.Name and/or Tenant.LogoUrl
- Note: logoUrl should already be uploaded to R2 via the photo endpoint
  (reuse the same upload mechanism, just a different key prefix: logos/{tenantId}/logo)

GET /api/tenant/profile (auth required):
- Return: { id, name, slug, logoUrl, plan }
```

---

## CHUNK 8 — UX & Theme Guide

```
Create the complete design system for DetailFlow frontend.

This chunk produces TWO files:
1. src/styles/globals.css  — all CSS custom properties + base styles
2. src/styles/theme.ts     — typed TypeScript theme object

=== BRAND DIRECTION ===

Product: Operations SaaS for premium car detailing shops
Users: Shop staff, managers, owners — on tablets + desktop daily
Tone: Industrial precision meets modern clarity.
      Dark, purposeful, fast. Workshop meets software.
      NOT corporate SaaS blue. NOT consumer app.

Primary font: "Syne" (bold labels, stage names, numbers)
Body font: "DM Sans" (all UI text)
Mono font: "JetBrains Mono" (plate numbers, tokens, IDs only)

=== FILE 1: src/styles/globals.css ===

@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

/* Tailwind v4 theme block */
@theme {
  /* Typography */
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Type scale */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;

  /* Spacing (4px base) */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;

  /* Border radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;
}

/* === DARK THEME (default — operations board) === */
:root {
  --color-bg:               #0f1117;
  --color-surface:          #1a1d27;
  --color-surface-elevated: #22263a;
  --color-surface-hover:    #2a2f45;
  --color-border:           #2e3347;
  --color-border-subtle:    #252840;

  --color-primary:          #3b82f6;
  --color-primary-hover:    #2563eb;
  --color-primary-muted:    rgba(59, 130, 246, 0.12);

  --color-accent:           #f59e0b;
  --color-accent-hover:     #d97706;
  --color-accent-muted:     rgba(245, 158, 11, 0.12);

  --color-success:          #22c55e;
  --color-success-muted:    rgba(34, 197, 94, 0.12);
  --color-destructive:      #ef4444;
  --color-destructive-muted:rgba(239, 68, 68, 0.12);
  --color-warning:          #f59e0b;

  --color-text:             #f1f5f9;
  --color-text-secondary:   #94a3b8;
  --color-text-muted:       #64748b;
  --color-text-disabled:    #3d4766;

  /* Stage colors */
  --stage-booked:           #6366f1;
  --stage-arrived:          #8b5cf6;
  --stage-washing:          #3b82f6;
  --stage-detailing:        #06b6d4;
  --stage-polishing:        #f59e0b;
  --stage-ready:            #22c55e;
  --stage-delivered:        #475569;
}

/* === LIGHT THEME (analytics, booking, public pages) === */
[data-theme="light"] {
  --color-bg:               #f8fafc;
  --color-surface:          #ffffff;
  --color-surface-elevated: #f1f5f9;
  --color-surface-hover:    #e8edf5;
  --color-border:           #e2e8f0;
  --color-border-subtle:    #f1f5f9;

  --color-primary:          #2563eb;
  --color-primary-hover:    #1d4ed8;
  --color-primary-muted:    rgba(37, 99, 235, 0.08);

  --color-accent:           #d97706;
  --color-accent-hover:     #b45309;
  --color-accent-muted:     rgba(217, 119, 6, 0.08);

  --color-success:          #16a34a;
  --color-success-muted:    rgba(22, 163, 74, 0.08);
  --color-destructive:      #dc2626;
  --color-destructive-muted:rgba(220, 38, 38, 0.08);

  --color-text:             #0f172a;
  --color-text-secondary:   #475569;
  --color-text-muted:       #94a3b8;
  --color-text-disabled:    #cbd5e1;
}

/* === BASE STYLES === */
*, *::before, *::after { box-sizing: border-box; }

html {
  font-family: var(--font-body);
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar — dark theme only */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--color-surface); }
::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }

/* Shimmer skeleton */
@keyframes shimmer {
  from { background-position: -200% 0; }
  to   { background-position:  200% 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface) 25%,
    var(--color-surface-elevated) 50%,
    var(--color-surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

/* Plate number style (used on vehicle cards) */
.plate {
  font-family: var(--font-mono);
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Stage badge base */
.stage-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

=== FILE 2: src/styles/theme.ts ===

export const stageColors: Record<string, string> = {
  Booked:    '#6366f1',
  Arrived:   '#8b5cf6',
  Washing:   '#3b82f6',
  Detailing: '#06b6d4',
  Polishing: '#f59e0b',
  Ready:     '#22c55e',
  Delivered: '#475569',
};

export const stageLabels: Record<string, string> = {
  Booked:    'Booked',
  Arrived:   'Arrived',
  Washing:   'Washing',
  Detailing: 'Detailing',
  Polishing: 'Polishing',
  Ready:     'Ready',
  Delivered: 'Delivered',
};

export const stageOrder = [
  'Booked', 'Arrived', 'Washing', 'Detailing', 'Polishing', 'Ready', 'Delivered'
] as const;

export type Stage = typeof stageOrder[number];
```

---

## CHUNK 9 — Frontend: Next.js 15 Project Scaffold

```
Initialize the DetailFlow Next.js 15 frontend project.

=== TASK 1: Project Setup ===

Create Next.js 15 project:
npx create-next-app@latest detailflow-web \
  --typescript --tailwind --app --src-dir \
  --import-alias "@/*"

Tailwind CSS 4 (comes with Next.js 15 — CSS-first, no tailwind.config.ts needed).
All custom tokens defined in globals.css via @theme {} (see Chunk 8).

=== TASK 2: shadcn/ui ===

npx shadcn@latest init
Choose: dark theme, CSS variables, src/components/ui path.

Install components used in this project:
npx shadcn@latest add button input label select sheet dialog
npx shadcn@latest add dropdown-menu avatar badge separator
npx shadcn@latest add toast tabs skeleton card

=== TASK 3: Additional Packages ===

npm install \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  zustand \
  @tanstack/react-query \
  axios \
  react-hot-toast \
  date-fns \
  react-hook-form zod @hookform/resolvers/zod \
  lucide-react \
  recharts

=== TASK 4: Project Structure ===

src/
  app/
    (auth)/
      login/page.tsx
      register/page.tsx
      layout.tsx
    (dashboard)/
      layout.tsx
      board/page.tsx
      bookings/page.tsx
      customers/page.tsx
      analytics/page.tsx
      settings/page.tsx
    track/
      [token]/page.tsx           ← public, no auth
    layout.tsx                   ← root layout with fonts + providers
    globals.css                  ← design system (from Chunk 8)
  components/
    ui/                          ← shadcn auto-generated
    layout/
      Sidebar.tsx
      Header.tsx
      DashboardShell.tsx
    board/
      KanbanBoard.tsx
      StageColumn.tsx
      VehicleCard.tsx
      VehicleCardSkeleton.tsx
      WorkOrderSheet.tsx         ← detail slide-out panel
      AddWalkInModal.tsx
    bookings/
      BookingForm.tsx
      BookingCalendar.tsx
      BookingRow.tsx
    customers/
      CustomerSearchInput.tsx
    photos/
      PhotoUploader.tsx
      PhotoGrid.tsx
    analytics/
      StatCard.tsx
      JobsChart.tsx
      TopServicesChart.tsx
      ActivityFeed.tsx
    shared/
      StageBadge.tsx
      SSEStatusDot.tsx
      EmptyState.tsx
      ErrorBoundary.tsx
  hooks/
    useSSE.ts
    useBoard.ts
    useBookings.ts
  lib/
    api.ts
    queryClient.ts
  store/
    authStore.ts
    boardStore.ts
  styles/
    theme.ts
  types/
    index.ts

=== TASK 5: TypeScript Types ===

Create src/types/index.ts with all types:

export type Stage = 'Booked'|'Arrived'|'Washing'|'Detailing'|'Polishing'|'Ready'|'Delivered';

export interface Customer {
  id: string; fullName: string; phone: string; totalVisits: number; createdAt: string;
}

export interface Vehicle {
  id: string; plateNumber: string; make: string; model: string;
  color: string; vehicleType: string;
}

export interface ServiceType {
  id: string; name: string; description?: string;
  basePrice: number; durationMinutes: number; isActive: boolean; sortOrder: number;
}

export interface WorkOrderCard {
  id: string; stage: Stage; trackingToken: string;
  customer: Pick<Customer, 'id'|'fullName'|'phone'>;
  vehicle: Pick<Vehicle, 'plateNumber'|'make'|'model'|'color'|'vehicleType'>;
  serviceName: string; serviceBasePrice: number;
  assignedStaff?: { id: string; fullName: string };
  estimatedReadyAt?: string; actualPrice?: number;
  notes?: string; photoCount: number;
  createdAt: string; updatedAt: string;
}

export interface BoardData {
  booked: WorkOrderCard[]; arrived: WorkOrderCard[];
  washing: WorkOrderCard[]; detailing: WorkOrderCard[];
  polishing: WorkOrderCard[]; ready: WorkOrderCard[];
  delivered: WorkOrderCard[];
}

export interface Booking {
  id: string; scheduledAt: string; status: 'Pending'|'Confirmed'|'Cancelled';
  serviceName: string; durationMinutes: number;
  customer: Pick<Customer, 'id'|'fullName'|'phone'>;
  vehicle: Pick<Vehicle, 'id'|'plateNumber'|'make'|'model'>;
  workOrderId?: string; trackingToken?: string;
}

export interface TrackingInfo {
  customerName: string; vehicleMake: string; vehicleModel: string;
  vehicleColor: string; vehiclePlate: string;
  stage: Stage; stageName: string; serviceName: string;
  estimatedReadyAt?: string; shopName: string; shopLogoUrl?: string;
  lastUpdatedAt: string;
}

export interface StaffMember {
  id: string; fullName: string; email: string;
  role: 'Owner'|'Manager'|'Staff'; isActive: boolean;
  completedJobsToday: number;
}

export interface DashboardData {
  today: { totalBookings: number; completedJobs: number; activeVehicles: number; walkIns: number };
  topServices: { serviceName: string; count: number }[];
  repeatCustomers: number;
  jobsByDay: { date: string; count: number }[];
  recentActivity: { changedByName: string; vehiclePlate: string;
    fromStage: Stage; toStage: Stage; changedAt: string }[];
}

export interface AuthUser {
  id: string; fullName: string; email: string;
  role: 'Owner'|'Manager'|'Staff'; tenantId: string; tenantSlug: string;
}

=== TASK 6: API Client ===

Create src/lib/api.ts:

import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  error => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

=== TASK 7: Zustand Stores ===

Create src/store/authStore.ts:
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'detailflow-auth' }
  )
);

Create src/store/boardStore.ts:
import { create } from 'zustand';
import type { BoardData, WorkOrderCard, Stage } from '@/types';

interface BoardStore {
  board: BoardData | null;
  setBoard: (data: BoardData) => void;
  moveCard: (id: string, from: Stage, to: Stage, updated: WorkOrderCard) => void;
  revertMove: (id: string, from: Stage, to: Stage, original: WorkOrderCard) => void;
  addCard: (card: WorkOrderCard) => void;
  updateCard: (card: WorkOrderCard) => void;
}

const stageKey = (s: Stage): keyof BoardData => s.toLowerCase() as keyof BoardData;

export const useBoardStore = create<BoardStore>((set) => ({
  board: null,
  setBoard: (data) => set({ board: data }),
  moveCard: (id, from, to, updated) => set(state => {
    if (!state.board) return state;
    const board = { ...state.board };
    board[stageKey(from)] = board[stageKey(from)].filter(c => c.id !== id) as WorkOrderCard[];
    board[stageKey(to)] = [...board[stageKey(to)], updated] as WorkOrderCard[];
    return { board };
  }),
  revertMove: (id, from, to, original) => set(state => {
    if (!state.board) return state;
    const board = { ...state.board };
    board[stageKey(to)] = board[stageKey(to)].filter(c => c.id !== id) as WorkOrderCard[];
    board[stageKey(from)] = [...board[stageKey(from)], original] as WorkOrderCard[];
    return { board };
  }),
  addCard: (card) => set(state => {
    if (!state.board) return state;
    const board = { ...state.board };
    const key = stageKey(card.stage);
    board[key] = [...board[key], card] as WorkOrderCard[];
    return { board };
  }),
  updateCard: (card) => set(state => {
    if (!state.board) return state;
    const board = { ...state.board };
    const key = stageKey(card.stage);
    board[key] = board[key].map(c => c.id === card.id ? card : c) as WorkOrderCard[];
    return { board };
  }),
}));

=== TASK 8: SSE Hook ===

Create src/hooks/useSSE.ts:

import { useEffect, useState } from 'react';

type SSEStatus = 'connecting' | 'connected' | 'error' | 'closed';

interface UseSSEOptions {
  onEvent: (type: string, data: unknown) => void;
  onConnected?: () => void;
  onError?: () => void;
  enabled?: boolean;
  eventTypes?: string[];
}

const DEFAULT_EVENTS = ['stage_changed', 'work_order_created', 'work_order_updated'];

export function useSSE(url: string | null, options: UseSSEOptions) {
  const [status, setStatus] = useState<SSEStatus>('connecting');

  useEffect(() => {
    if (!url || options.enabled === false) return;

    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource(url);

      es.addEventListener('connected', () => {
        setStatus('connected');
        options.onConnected?.();
      });

      const eventTypes = options.eventTypes ?? DEFAULT_EVENTS;
      eventTypes.forEach(type => {
        es.addEventListener(type, (e: MessageEvent) => {
          try { options.onEvent(type, JSON.parse(e.data)); }
          catch { /* malformed event — ignore */ }
        });
      });

      es.onerror = () => {
        setStatus('error');
        options.onError?.();
        es.close();
        // Reconnect after 5 seconds
        retryTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      clearTimeout(retryTimeout);
      es?.close();
      setStatus('closed');
    };
  }, [url, options.enabled]);

  return { status };
}

=== TASK 9: QueryClient ===

Create src/lib/queryClient.ts:
import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

=== TASK 10: Root Layout ===

Create src/app/layout.tsx:
- Import Google Fonts preconnect in <head>
- Wrap children in QueryClientProvider + Toaster (react-hot-toast)
- Apply font-body class to <body>
- Default dark theme (data-theme not set = dark)

Do not build any page UI yet — infrastructure only.
```

---

## CHUNK 10 — Frontend: Auth Pages & Dashboard Shell

```
Continue DetailFlow frontend.

Build authentication pages and the main dashboard layout.

=== TASK 1: Login Page ===

src/app/(auth)/login/page.tsx:

Layout: full-viewport dark background with subtle dot grid pattern:
background-image: radial-gradient(circle, #2e3347 1px, transparent 1px);
background-size: 24px 24px;

Centered card (max-width 400px):
- Top: Logo mark (a simple ◆ diamond SVG in primary blue) + "Detail" + "Flow" wordmark
  "Detail" in white, "Flow" in var(--color-primary), font-family Syne, font-size 28px
- Subtitle: "Sign in to your workspace"
- Form using react-hook-form + zod:
  Fields: Email, Password, Shop ID (tenantSlug)
  Validation: email format, password required, slug required
- Submit button: full-width, primary, "Sign In", shows spinner on loading
- Error display: red text below form
- Link: "New shop? Create an account →"

On submit: POST /api/auth/login
On success: useAuthStore.setAuth(token, user), router.push('/board')

=== TASK 2: Register Page ===

src/app/(auth)/register/page.tsx:

Two-column layout (hidden on mobile — left column only):
Left column (white background): registration form
Right column (dark bg, primary gradient): feature highlights
  - "Join 500+ detailing shops"
  - Three feature bullets with icons

Form fields (react-hook-form + zod):
1. Shop Name (auto-generates slug on change)
2. Shop ID / Slug:
   - Auto-populated from shop name: .toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
   - Editable, shows preview: "Your URL: detailflow.app/[slug]"
   - Validate: ^[a-z0-9-]{3,30}$
3. Your Full Name
4. Email
5. Password (min 8 chars, show/hide toggle)

On submit: POST /api/auth/register-tenant
On success: setAuth + router.push('/board')

=== TASK 3: Sidebar ===

src/components/layout/Sidebar.tsx:

Props: none — reads from usePathname() and useAuthStore

Width: 220px expanded, 64px collapsed (toggle button)
Background: var(--color-surface)
Right border: 1px solid var(--color-border)

Top: Logo (collapsed = diamond icon only, expanded = full wordmark)

Nav items (use next/link):
const navItems = [
  { href: '/board',     icon: LayoutDashboard, label: 'Operations' },
  { href: '/bookings',  icon: CalendarDays,    label: 'Bookings'   },
  { href: '/customers', icon: Users,           label: 'Customers'  },
  { href: '/analytics', icon: BarChart2,       label: 'Analytics'  },
  { href: '/settings',  icon: Settings,        label: 'Settings'   },
]

Active item styling:
- Background: var(--color-surface-elevated)
- Left border: 3px solid var(--color-primary)
- Text: var(--color-text)
Inactive: text var(--color-text-muted), no background

Hover: background var(--color-surface-hover), text var(--color-text)
Transition: background 150ms ease, color 150ms ease

Bottom section:
- User avatar (initials, colored by role — Owner=primary, Manager=accent, Staff=muted)
- Full name + role chip
- Logout button (icon only, ghost)

Collapse toggle: ChevronLeft/ChevronRight icon, bottom of sidebar.
Store collapsed state in localStorage: 'sidebar-collapsed'.

=== TASK 4: Header ===

src/components/layout/Header.tsx:

Height: 56px
Background: var(--color-surface)
Border-bottom: 1px solid var(--color-border)

Left: Dynamic page title (object mapping pathname → title)
const titles: Record<string, string> = {
  '/board':     'Operations Board',
  '/bookings':  'Bookings',
  '/customers': 'Customers',
  '/analytics': 'Analytics',
  '/settings':  'Settings',
}

Right:
- SSEStatusDot component (see board chunk)
- Today's date: format(new Date(), 'EEE, dd MMM') — DM Sans, text-sm, muted
- "New Booking" button (primary, small, Plus icon)
  → opens BookingForm in a Sheet from the right

=== TASK 5: Dashboard Layout ===

src/app/(dashboard)/layout.tsx:

'use client'
- Check auth on mount: if (!token) redirect('/login')
- Render: <DashboardShell><Sidebar /><main>{children}</main></DashboardShell>

src/components/layout/DashboardShell.tsx:
- Flex row, full viewport height
- Sidebar on left (fixed height, no scroll)
- Main area: flex-1, overflow-y-auto, background var(--color-bg)
- When sidebar is collapsed: main area gets full width minus 64px

=== TASK 6: Auth Layout ===

src/app/(auth)/layout.tsx:
- If already authenticated: redirect('/board')
- Otherwise render children directly (no sidebar)
```

---

## CHUNK 11 — Frontend: Operations Board (Core Feature)

```
Continue DetailFlow frontend.

Build the Operations Board — the most important screen in the product.

=== TASK 1: StageBadge Component ===

src/components/shared/StageBadge.tsx:
- Props: stage (Stage), size?: 'sm'|'md'
- Renders colored badge using stageColors and stageLabels from theme.ts
- Uses .stage-badge CSS class from globals.css
- Background: {stageColor}20 (20% opacity), border: 1px solid {stageColor}40, color: {stageColor}

=== TASK 2: SSEStatusDot Component ===

src/components/shared/SSEStatusDot.tsx:
- Props: status: 'connecting'|'connected'|'error'|'closed'
- Renders a 8px dot:
  connected:   green, with subtle pulse animation
  connecting:  amber, pulsing faster
  error:       red, no pulse
  closed:      muted gray
- Tooltip (title attribute): "Live updates active" / "Reconnecting..." / "Disconnected"
- Position in Header right section

=== TASK 3: VehicleCard ===

src/components/board/VehicleCard.tsx:
Props: { workOrder: WorkOrderCard; onOpenDetail: (id: string) => void; dragHandleProps?: any }

Card structure (width: 100%, min-height: 120px):
Background: var(--color-surface-elevated)
Border: 1px solid var(--color-border)
Border-radius: var(--radius-md)
Left border: 4px solid {stageColor}
Transition: transform 150ms ease, box-shadow 150ms ease
Hover: translateY(-1px), box-shadow 0 4px 20px rgba(0,0,0,0.3)
Cursor: grab (when dragging: grabbing)
Padding: 12px 14px

Row 1 (plate + drag handle):
- Plate number: font-mono, text-base, font-medium, color var(--color-text)
- Color dot: 10px circle, background = CSS color closest to vehicle.color string
- GripVertical icon (16px, muted, drag handle): only visible on hover

Row 2 (make/model + service):
- "{make} {model}": text-sm, text-secondary
- Service badge: rounded-full, background var(--color-primary-muted),
  color var(--color-primary), text-xs, font-medium, padding 2px 8px

Row 3 (customer):
- User icon (12px, muted) + customer fullName (text-sm)
- Phone (text-xs, muted) — show on hover only (opacity transition)

Row 4 (bottom meta):
- Left: Staff chip
  If assigned: avatar (initials, 20px circle) + name (text-xs)
  If not: "Unassigned" in muted text-xs italic
- Right side:
  * If estimatedReadyAt: Clock icon + time formatted as "2:30 PM"
    Color: amber if within 30 minutes, green if ready, white otherwise
  * Photo badge: if photoCount > 0: Camera icon + count (text-xs, muted)

onClick (not on drag handle): call onOpenDetail(workOrder.id)

=== TASK 4: VehicleCardSkeleton ===

src/components/board/VehicleCardSkeleton.tsx:
Same card dimensions but all content replaced with .skeleton divs.
Show 2-3 per column during loading state.

=== TASK 5: StageColumn ===

src/components/board/StageColumn.tsx:
Props: { stage: Stage; workOrders: WorkOrderCard[]; isOver: boolean; onOpenDetail: (id:string)=>void }

Width: 280px (fixed), flex-shrink: 0
Height: calc(100vh - 120px) — full board height
Display: flex, flex-direction: column

Header (48px, fixed):
- Color dot (10px, stage color)
- Stage name: font-display, text-sm, font-semibold, uppercase, letter-spacing 0.05em
- Count badge: background stage color with 20% opacity, color stage color,
  rounded-full, text-xs, font-bold, min-width 22px, text-center

isOver state: border 1px dashed {stageColor}, background {stageColor}08

Cards area: flex-1, overflow-y-auto, padding 8px, gap 8px
Custom scrollbar matching dark theme.

Empty state (when no cards):
- Dashed border box, centered, stage icon (large, muted)
- Text: "No vehicles" in muted

=== TASK 6: KanbanBoard ===

src/components/board/KanbanBoard.tsx:

Uses @dnd-kit/core DndContext + @dnd-kit/sortable SortableContext

Stage order constant:
const STAGES: Stage[] = ['Booked','Arrived','Washing','Detailing','Polishing','Ready'];
// 'Delivered' shown only when toggle is on

State: activeId (for drag overlay), overStage

DndContext sensors: PointerSensor with activationConstraint { distance: 8 }
— prevents accidental drags on click

onDragStart: set activeId
onDragOver: track which column is being dragged over → set overStage
onDragEnd:
1. If dropped in same column: return
2. Build WorkOrderCard update with new stage
3. Store original card reference for potential revert
4. Call boardStore.moveCard(id, fromStage, toStage, optimisticCard)
5. Call api.patch(`/work-orders/${id}/stage`, { newStage: toStage })
6. On success: toast.success(`Moved to ${toStage}`)
7. On error: boardStore.revertMove(id, fromStage, toStage, originalCard) + toast.error(...)

DragOverlay: renders a VehicleCard with reduced opacity + scale(1.02) + shadow
(the "ghost" card following the cursor)

Board layout: horizontal flex, gap 12px, overflow-x-auto, padding 16px
Use CSS scroll-snap-type: x mandatory on container for tablet UX.

"Show Delivered" toggle button: top-right of board, ghost style.

=== TASK 7: WorkOrderSheet ===

src/components/board/WorkOrderSheet.tsx:
Props: { workOrderId: string | null; onClose: () => void }

shadcn Sheet (side: "right", width: 480px)
Open when workOrderId != null.

Data: useQuery to GET /api/work-orders/{id} when open.

Three-tab layout (shadcn Tabs):

Tab 1 — Details:
- Customer: name, phone (click to call link)
- Vehicle: plate (mono), make/model, color, type
- Service: name, base price
- Actual price input (inline edit, show pencil icon on hover)
- Notes textarea
- Assign staff: dropdown of staff members
- Stage: StageBadge + manual stage changer dropdown (Manager/Owner only)
- Receipt download button: links to GET /api/work-orders/{id}/receipt
- "Mark as Delivered" button (green, full-width, only shows when stage=Ready)
  → calls PATCH /stage with Delivered

Tab 2 — Photos:
PhotoUploader component:
- Two zones: "Before" and "After"
- Each zone: grid of existing photos (2-col), click to view full size
- Upload area: drag-to-upload or click, shows progress
- Delete button on each photo (trash icon, hover only)
- Calls POST /api/work-orders/{id}/photos (multipart)

Tab 3 — History:
Timeline of stage changes:
- Vertical line connecting events
- Each entry: stage badge + "by {name}" + relative time (date-fns formatDistanceToNow)

=== TASK 8: AddWalkInModal ===

src/components/board/AddWalkInModal.tsx:
shadcn Dialog, same fields as booking form but no date/time.
Stage starts at Arrived.
Calls POST /api/work-orders.
On success: boardStore.addCard(newCard) + toast.

=== TASK 9: Board Page ===

src/app/(dashboard)/board/page.tsx:

'use client'

Initial data load (ONE time on mount, no polling):
const { data: initialBoard, isLoading } = useQuery({
  queryKey: ['board'],
  queryFn: () => api.get<BoardData>('/work-orders/board').then(r => r.data),
  refetchOnWindowFocus: false,
  // No refetchInterval — SSE handles all updates
});

useEffect:
if (initialBoard) boardStore.setBoard(initialBoard);

SSE setup:
const token = useAuthStore(s => s.token);
const sseUrl = token
  ? `${process.env.NEXT_PUBLIC_API_URL}/work-orders/board/stream?token=${token}`
  : null;

const { status: sseStatus } = useSSE(sseUrl, {
  onEvent: (type, data: any) => {
    if (type === 'stage_changed')     boardStore.moveCard(data.workOrderId, data.fromStage, data.toStage, data.workOrder);
    if (type === 'work_order_created') boardStore.addCard(data.workOrder);
    if (type === 'work_order_updated') boardStore.updateCard(data.workOrder);
  },
  onConnected: () => toast.success('Live updates active', { duration: 2000, icon: '●' }),
  onError: () => toast.error('Live connection lost — retrying...'),
});

Stats bar (derive from boardStore.board directly — updates free via SSE):
const board = useBoardStore(s => s.board);
const activeCount = board ? ['arrived','washing','detailing','polishing']
  .flatMap(s => board[s as keyof BoardData]).length : 0;
const readyCount = board?.ready.length ?? 0;
const todayCompleted = board?.delivered.length ?? 0;

Stats bar UI: three pill cards in header area showing these numbers.
Updates in real-time as SSE events move cards.

Detail sheet state: selectedWorkOrderId (string|null)
FAB button (bottom-right, fixed): Plus icon + "Walk-in", opens AddWalkInModal

Loading state: show VehicleCardSkeleton (2-3 per column) while isLoading.
SSEStatusDot passed to Header via context or prop.
```

---

## CHUNK 12 — Frontend: Booking Management

```
Continue DetailFlow frontend.

Build the Booking Management page.

=== TASK 1: BookingRow ===

src/components/bookings/BookingRow.tsx:
Props: { booking: Booking; onStatusChange: (id:string, status:string) => void }

Row layout (horizontal, 64px height):
- Time chip: "09:30 AM", background var(--color-surface-elevated), mono font, rounded-md
- Customer: fullName (bold, text-sm) + phone (text-xs, muted) in a column
- Vehicle: plateNumber (mono, text-sm) + "make model" (text-xs, muted) in a column
- Service badge: rounded-full, accent color
- Status chip: color-coded
  Pending:   amber background, amber text
  Confirmed: green background, green text
  Cancelled: muted background, muted text
- Actions (DropdownMenu from shadcn):
  "Confirm" (only if Pending)
  "Cancel" (only if not Cancelled)
  "View Work Order" (link to open WorkOrderSheet)

Cancelled rows: opacity 0.5

=== TASK 2: CustomerSearchInput ===

src/components/customers/CustomerSearchInput.tsx:
Props: { onSelect: (customer: Pick<Customer,'id'|'fullName'|'phone'>) => void; value?: string }

Combobox-style input:
- On input change (debounced 400ms): GET /api/customers?search={value}
- Dropdown of results showing: fullName + phone + visits badge
- On select: call onSelect, fill input with phone number
- If no results: show "New customer — will be created"
- Loading: show spinner in input right side

=== TASK 3: BookingForm ===

src/components/bookings/BookingForm.tsx:

react-hook-form + zod schema:
const schema = z.object({
  customerPhone: z.string().min(7, 'Valid phone required'),
  customerName: z.string().min(2, 'Name required'),
  serviceTypeId: z.string().uuid('Select a service'),
  scheduledDate: z.string().min(1, 'Date required'),
  scheduledTime: z.string().min(1, 'Select a time slot'),
  vehiclePlate: z.string().min(2).transform(s => s.toUpperCase().trim()),
  vehicleMake: z.string().min(1),
  vehicleModel: z.string().min(1),
  vehicleColor: z.string().min(1),
  vehicleType: z.enum(['Sedan','SUV','Truck','Van','Motorcycle','Other']),
  notes: z.string().optional(),
});

Field order and UX:
1. Phone field: uses CustomerSearchInput
   On customer select: auto-fill customerName
   On manual type: clear auto-fill

2. Customer Name (auto-filled or manual)

3. Service dropdown (fetch from GET /api/services)
   Show: name + duration + price

4. Date picker: <input type="date"> styled with design tokens,
   min = today's date

5. Time slot grid (loads after date + service selected):
   GET /api/bookings/availability?date=&serviceTypeId=
   Render as 4-column grid of time buttons
   Available: primary outlined button
   Unavailable: disabled, gray
   Selected: primary filled
   Loading: skeleton grid

6. Vehicle fields in 2-col grid:
   Plate (full width), Make + Model (2-col), Color + Type (2-col)

7. Notes textarea (optional, collapsed by default — "Add notes +" link to expand)

Submit button: "Confirm Booking" (full width, primary, loading state)

On success: show success state with tracking info:
- Green checkmark animation
- "Booking confirmed!"
- Tracking URL: detailflow.app/track/{token}
- "Copy link" button + "Share on WhatsApp" link:
  https://wa.me/{phone}?text=Track your car: {trackingUrl}
- "New Booking" button to reset form

=== TASK 4: Bookings Page ===

src/app/(dashboard)/bookings/page.tsx:
'use client'

Layout: 60/40 two-panel on desktop, stacked on mobile.

Left panel:
State: selectedDate (Date, default = today)

Week strip:
- Show 7 days: 3 before today, today, 3 after
- Each day: day abbreviation (Mon) + date number
- Active: primary background, white text
- Has bookings indicator: small dot below date
- Arrows to scroll week backward/forward

Bookings list:
useQuery(['bookings', selectedDate], () =>
  api.get(`/bookings?date=${format(selectedDate, 'yyyy-MM-dd')}`).then(r => r.data))
No SSE needed here — not real-time critical. React Query staleTime 60s.

List header: "{count} bookings on {formattedDate}"
Render BookingRow for each booking.
Empty state: CalendarOff icon + "No bookings for this day."

Right panel:
Card with "New Booking" heading.
Render BookingForm.
```

---

## CHUNK 13 — Frontend: Customer Status Page (Public)

```
Continue DetailFlow frontend.

Build the public customer vehicle tracking page with real-time SSE.

=== TASK 1: Page Structure ===

src/app/track/[token]/page.tsx
'use client'

This page uses light theme: apply data-theme="light" to the page wrapper.
Mobile-first: max-width 480px, centered, full-height.
No navigation, no sidebar, completely standalone.

=== TASK 2: Initial Data Load ===

const params = useParams();
const token = params.token as string;
const [info, setInfo] = useState<TrackingInfo | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(false);
const [liveStatus, setLiveStatus] = useState<'live'|'polling'|'loading'>('loading');
const [justBecameReady, setJustBecameReady] = useState(false);

useEffect(() => {
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/work-orders/track/${token}`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => { setInfo(data); setLoading(false); })
    .catch(() => { setError(true); setLoading(false); });
}, [token]);

=== TASK 3: SSE Real-Time Updates ===

const sseUrl = token
  ? `${process.env.NEXT_PUBLIC_API_URL}/work-orders/track/${token}/stream`
  : null;

useSSE(sseUrl, {
  onEvent: (type, data: any) => {
    if (type === 'stage_changed') {
      const prevStage = info?.stage;
      setInfo(prev => prev ? { ...prev, stage: data.newStage, stageName: data.newStageName,
        lastUpdatedAt: new Date().toISOString() } : prev);
      if (data.newStage === 'Ready' && prevStage !== 'Ready') {
        setJustBecameReady(true);
        setTimeout(() => setJustBecameReady(false), 6000);
      }
    }
  },
  onConnected: () => setLiveStatus('live'),
  onError: () => {
    setLiveStatus('polling');
    // Fallback polling
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/work-orders/track/${token}`);
        const d = await r.json();
        setInfo(d);
      } catch {}
    }, 60_000);
    return () => clearInterval(interval);
  },
});

=== TASK 4: Page Layout ===

Full page structure:

1. HEADER BAR (56px):
   - Shop logo (if available) or diamond icon
   - Shop name (Syne font, text-lg)
   - Background white, shadow-sm

2. VEHICLE CARD (below header, 16px margin):
   Background white, border, rounded-xl, padding 20px
   - Color indicator dot (16px circle, background = color)
   - Vehicle: "{make} {model}" (Syne, text-xl, bold)
   - Plate: mono font, text-sm, background #f1f5f9, rounded, padding 4px 8px
   - Service name: text-sm, muted

3. STAGE PROGRESS TRACKER (main visual, padding 24px):

   Vertical stepper showing all stages except Delivered:
   ['Booked','Arrived','Washing','Detailing','Polishing','Ready']

   For each stage:
   - Left: 32px circle indicator
     Completed (past): green circle, white checkmark icon
     Current: colored circle with stage color, pulsing animation ring
     Upcoming: white circle, light gray border
   - Right: stage name (font-display, text-sm)
   - Connecting line between stages: green for completed segments, gray for upcoming

   Current stage circle animation:
   @keyframes stagePulse {
     0%, 100% { box-shadow: 0 0 0 0 {stageColor}40; }
     50%       { box-shadow: 0 0 0 8px transparent; }
   }
   animation: stagePulse 2s infinite;

4. READY STATE BANNER (only when stage === 'Ready'):
   Animated slide-down (translateY(-20px) → translateY(0)):
   Background: linear-gradient(135deg, #16a34a, #22c55e)
   Text: "✓ Your vehicle is ready for pickup!" (white, Syne, bold)
   Sub-text: "Please proceed to the shop at your earliest convenience."
   
   justBecameReady (SSE trigger): run CSS confetti animation:
   @keyframes confettiFall {
     0%   { transform: translateY(-100%) rotate(0deg); opacity: 1; }
     100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
   }
   Render 8 small colored squares absolutely positioned, staggered delays.

5. ETA SECTION (below tracker, if estimatedReadyAt):
   Clock icon + "Estimated ready by:"
   Time in large format: format(parseISO(estimatedReadyAt), 'h:mm a')
   If past ETA: show "— your vehicle should be ready soon"

6. LIVE STATUS & LAST UPDATED (below ETA):
   If live: "● Live updates active" (green dot + text-xs muted)
   If polling: "↻ Checking for updates every minute" (text-xs muted)
   "Last updated: {formatDistanceToNow(parseISO(info.lastUpdatedAt))} ago"
   Auto-updates every 30s via setInterval(() => forceRender(), 30_000)

7. FOOTER:
   Thin divider + "Powered by DetailFlow" (text-xs, muted, centered)

=== TASK 5: Loading & Error States ===

Loading: full-page skeleton matching the layout above.
Error (invalid token): centered illustration (car icon, large), "Booking not found.",
"The tracking link may have expired or is invalid."
```

---

## CHUNK 14 — Frontend: Analytics & Settings

```
Continue DetailFlow frontend.

Build the Analytics dashboard and Settings pages.

=== TASK 1: Analytics Components ===

src/components/analytics/StatCard.tsx:
Props: { title, value, subtitle?, icon, color?: string, loading?: boolean }
Card: var(--color-surface), border, rounded-xl, padding 20px
Icon: 40px circle, background {color}20, icon {color}
Value: Syne font, text-3xl, bold — large and prominent
Title: text-sm, muted, uppercase, letter-spacing 0.05em
Subtitle: text-xs, muted (optional delta or context)
Loading: skeleton version

src/components/analytics/JobsChart.tsx:
Props: { data: { date: string; count: number }[] }
recharts BarChart (responsive):
- X axis: dates formatted as "Mon 3", "Tue 4"
- Y axis: integer ticks
- Bar fill: var(--color-primary)
- Bar radius: [4,4,0,0]
- Tooltip: dark background, white text, "{count} jobs"
- Height: 200px

src/components/analytics/TopServicesChart.tsx:
Props: { data: { serviceName: string; count: number }[] }
recharts horizontal BarChart:
- Y axis: service names
- Bar fill: var(--color-accent)
- Height: 180px

src/components/analytics/ActivityFeed.tsx:
Props: { activity: DashboardData['recentActivity'] }
Vertical timeline list:
Each item: stage badge (from) + arrow icon + stage badge (to) + "by {name}" + relative time
Max 10 items, overflow hidden.
Empty state: "No recent activity"

=== TASK 2: Analytics Page ===

src/app/(dashboard)/analytics/page.tsx:
'use client'

useQuery(['dashboard'], () => api.get<DashboardData>('/analytics/dashboard').then(r => r.data),
  { refetchInterval: 60_000 }) // Refresh every minute — no SSE needed for analytics

Layout:
1. Stats row (4 StatCards):
   - Bookings Today (CalendarDays icon, primary color)
   - Active Vehicles (Car icon, accent color)
   - Completed Today (CheckCircle icon, success color)
   - Repeat Customers (Users icon, indigo #6366f1)

2. Charts row (2 columns, 60/40):
   Left: "Jobs This Week" JobsChart
   Right: "Top Services" TopServicesChart
   Both in surface cards with title headers

3. Activity feed card (full width):
   Title: "Recent Activity" + refresh button (RefreshCw icon, ghost, small)
   ActivityFeed component

All sections: skeleton loading state while data loads.

=== TASK 3: Settings Page ===

src/app/(dashboard)/settings/page.tsx:
'use client'

Tabs (shadcn Tabs, horizontal):

TAB 1 — Shop Profile:
Form (react-hook-form):
- Shop name input
- Logo upload:
  * Show current logo (if set) in 80px rounded square
  * Upload button → file input → POST /api/work-orders is NOT the right endpoint here
    Instead: POST to a dedicated /api/tenant/logo endpoint that accepts a single file
    and returns the new logoUrl (same R2 upload logic, key: logos/{tenantId}/logo.{ext})
  * Show upload progress
- Save button → PATCH /api/tenant/profile { name, logoUrl }

TAB 2 — Services:
Fetch: GET /api/services

Table columns: Name | Duration | Price | Status | Actions
Each row: inline edit mode (click pencil icon):
  - Name and price become input fields
  - Save (check icon) or Cancel (x icon)
  - Calls PATCH /api/services/{id}

"Active" toggle: shadcn Switch component, calls PATCH immediately on change.

"Add Service" button (bottom of table):
Appends a new empty row in edit mode.
Save calls POST /api/services.

Drag-to-reorder: use @dnd-kit on table rows, updates sortOrder on drag end.

TAB 3 — Staff (Manager/Owner only):

Table: Full Name | Email | Role | Status | Actions
Role shown as colored chip.
"Invite Staff" button → Dialog:
  Fields: Full Name, Email, Password (temporary), Role (dropdown)
  Calls POST /api/staff

Each row: action menu:
  "Edit Role" (opens inline role dropdown)
  "Deactivate" / "Activate" (PATCH isActive)
  Disabled for own row (can't deactivate yourself)
  Disabled for Owner row (if requester is Manager)
```

---

## CHUNK 15 — Final: Polish, Error States & Deployment

```
Continue DetailFlow. Final polish and deployment setup.

=== TASK 1: EmptyState Component ===

src/components/shared/EmptyState.tsx:
Props: { icon: LucideIcon; title: string; description?: string; action?: { label: string; onClick: () => void } }

Centered layout, padding 48px:
- Icon: 64px circle (var(--color-surface-elevated)), icon inside (40px, muted color)
- Title: Syne font, text-xl, font-semibold
- Description: text-sm, muted, max-width 300px, centered
- Action button: primary, if provided

Use on: board columns (empty), bookings list (no bookings), customer list, activity feed.

=== TASK 2: ErrorBoundary ===

src/components/shared/ErrorBoundary.tsx:
Class component implementing React error boundary.
Fallback UI: EmptyState with AlertTriangle icon + "Something went wrong" + "Retry" button
Retry: reset error boundary state + call queryClient.clear()

Wrap: main content areas in dashboard layout, NOT the sidebar.

=== TASK 3: Customers Page ===

src/app/(dashboard)/customers/page.tsx:
(This page was not specified in earlier chunks — add it now)

Simple searchable table:
- Search input (debounced): calls GET /api/customers?search=
- Columns: Name | Phone | Total Visits | Last Visit | Actions
- "Last Visit" derived from a new backend endpoint:
  GET /api/customers (add to Chunk 4 backend):
  Returns customers with lastVisitAt from latest WorkOrder.CreatedAt
- "View History" action: expand row to show last 5 work orders with stage + date
- Pagination: simple prev/next, 20 per page

=== TASK 4: Missing Backend Endpoint ===

Add to Chunk 4 (BookingEndpoints):

GET /api/customers (auth required):
- Query params: search? (string), page? (int, default 1), limit? (int, default 20)
- Search by fullName ILIKE or phone ILIKE
- Join to get lastVisitAt: latest WorkOrder.CreatedAt for that customer
- Returns paginated: { items: CustomerDto[], total, page, limit }

CustomerDto includes: id, fullName, phone, totalVisits, lastVisitAt?

=== TASK 5: Responsive Adjustments ===

Operations Board (tablet optimization):
- Container: overflow-x-auto, scroll-snap-type: x mandatory
- Each StageColumn: scroll-snap-align: start
- Show 2-3 columns at once on tablet (768px-1024px)
- Board stats bar: stacks to 2x2 grid on mobile

Sidebar:
- auto-collapse to icon-only when screen width < 1280px (xl breakpoint)
- On mobile (<768px): sidebar becomes a Sheet (drawer from left), triggered by hamburger icon in Header

Booking form:
- Single column on mobile
- Two column vehicle fields collapse to single column on <640px

=== TASK 6: Environment Variable Validation (Frontend) ===

Create src/lib/env.ts:
const required = ['NEXT_PUBLIC_API_URL'] as const;
required.forEach(key => {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
});
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL!,
};

Import env.ts in api.ts instead of using process.env directly.

=== TASK 7: Docker Frontend ===

Create detailflow-web/Dockerfile (multi-stage):

Stage 1 — deps:
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

Stage 2 — builder:
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

Stage 3 — runner:
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

=== TASK 8: Nginx Reverse Proxy ===

Create nginx/nginx.conf:

events { worker_connections 1024; }
http {
  upstream api  { server api:5000; }
  upstream web  { server web:3000; }

  server {
    listen 80;

    # CRITICAL for SSE: disable proxy buffering on /stream routes
    location ~* /stream$ {
      proxy_pass http://api;
      proxy_http_version 1.1;
      proxy_set_header Connection '';
      proxy_buffering off;
      proxy_cache off;
      proxy_read_timeout 3600s;
      chunked_transfer_encoding on;
    }

    location /api/ {
      proxy_pass http://api;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
      proxy_pass http://web;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }
}

Update docker-compose.yml to add:
  web:
    build: ./detailflow-web
    environment:
      - NEXT_PUBLIC_API_URL=http://nginx/api
    depends_on: [api]

  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes: ["./nginx/nginx.conf:/etc/nginx/nginx.conf:ro"]
    depends_on: [api, web]

=== TASK 9: Deploy Script ===

Create deploy.sh:
#!/bin/bash
set -e
echo "Pulling latest..."
git pull origin main

echo "Building and starting services..."
docker-compose down
docker-compose build --no-cache
docker-compose up -d

echo "Running DB migrations..."
docker-compose exec api dotnet ef database update

echo "Done. Services:"
docker-compose ps

chmod +x deploy.sh

=== TASK 10: Final Verification Checklist ===

Manually verify these flows end-to-end before considering MVP complete:

1. Register new tenant → receive JWT → redirect to board
2. Create a booking → see work order appear in "Booked" column via SSE
3. Drag card from Booked → Arrived → Washing (SSE broadcasts to all open tabs)
4. Upload a before photo via WorkOrderSheet
5. Move card to Ready → customer tracking page shows Ready + green banner
6. Download receipt PDF
7. Open /track/{token} on mobile — verify mobile layout
8. Open two browser tabs as different staff → drag in one → see instant update in other
```

---

## Execution Order Summary

| Chunk | What It Builds | Depends On |
|---|---|---|
| 1 | .NET 10 scaffold, R2, Docker | nothing |
| 2 | Auth, multi-tenant, JWT | 1 |
| 3 | All domain models + migrations | 2 |
| 4 | Booking + availability API | 3 |
| 5 | Work order API + SSE fan-out | 3, 4 |
| 6 | R2 photo upload + PDF receipt | 5 |
| 7 | Staff management + analytics | 5, 6 |
| 8 | Design tokens + theme guide | nothing |
| 9 | Next.js 15 scaffold, stores, SSE hook | 8 |
| 10 | Login, register, dashboard shell | 9 |
| 11 | Operations board + drag/drop + SSE | 9, 10 |
| 12 | Booking management page | 9, 10 |
| 13 | Public tracking page + SSE | 9 |
| 14 | Analytics + settings | 9, 10 |
| 15 | Polish, deployment, nginx SSE config | all |

Backend (1–7) can run fully parallel to design (8) before frontend starts.