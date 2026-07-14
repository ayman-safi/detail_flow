using System.Security.Cryptography;
using System.Text;
using DetailFlow.Api.Data;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.Dev;

public class DevSeedService(DetailFlowDbContext db)
{
    private const string Password = "Password123!";
    private const string DemoPhotoBase = "https://images.unsplash.com";
    private static readonly DateTimeOffset BaselineCreatedAt = new(2026, 1, 1, 9, 0, 0, TimeSpan.Zero);

    private static readonly SeedTenantDefinition DemoTenant = new(
        "demo",
        "Demo Detail Shop",
        TenantPlan.Pro,
        TenantBillingStatus.Active,
        true,
        TenantCurrency.USD,
        3,
        "https://placehold.co/160x160/png?text=DF");

    private static readonly SeedTenantDefinition StarterTenant = new(
        "starter",
        "Starter Wash Lab",
        TenantPlan.Free,
        TenantBillingStatus.Trial,
        true,
        TenantCurrency.SAR,
        2);

    private static readonly SeedTenantDefinition EmptyTenant = new(
        "empty",
        "Empty Bay Test Shop",
        TenantPlan.Business,
        TenantBillingStatus.Active,
        true,
        TenantCurrency.TRY,
        4);

    private static readonly SeedTenantDefinition BusinessTenant = new(
        "business",
        "Business Fleet Detail",
        TenantPlan.Business,
        TenantBillingStatus.Manual,
        true,
        TenantCurrency.EUR,
        8);

    private static readonly SeedTenantDefinition SuspendedTenant = new(
        "suspended",
        "Suspended Detail Shop",
        TenantPlan.Pro,
        TenantBillingStatus.Suspended,
        false,
        TenantCurrency.SYP,
        2);

    public async Task<object> SeedAsync()
    {
        await using var tx = await db.Database.BeginTransactionAsync();

        var tenantDefinitions = BuildTenantDefinitions();
        var tenants = await UpsertTenantsAsync(tenantDefinitions);
        var passwordHash = await GetReusablePasswordHashAsync(tenants.Values.Select(tenant => tenant.Id).ToArray());

        foreach (var slug in new[] { DemoTenant.Slug, StarterTenant.Slug, EmptyTenant.Slug, BusinessTenant.Slug, SuspendedTenant.Slug })
            await ResetFixtureTenantAsync(tenants[slug].Id);

        var demo = tenants[DemoTenant.Slug];
        var demoUsers = AddDemoUsers(demo, passwordHash);
        var demoServices = AddServices(demo.Id, demo.Slug, includeInactiveFixture: true);
        var demoManifest = AddDemoOperationalData(demo, demoUsers, demoServices);

        var starter = tenants[StarterTenant.Slug];
        AddUser(starter, "owner@starter.local", "Fiona Freeplan", "+966500001001", UserRole.Owner, passwordHash);
        AddUser(starter, "staff@starter.local", "Freddie Free Staff", "+966500001002", UserRole.Staff, passwordHash);
        var starterServices = AddServices(starter.Id, starter.Slug);
        AddFreePlanQuotaData(starter, starterServices.Single(service => service.Name == "Exterior Wash"));

        var empty = tenants[EmptyTenant.Slug];
        AddUser(empty, "owner@empty.local", "Erin Empty", "+905550001001", UserRole.Owner, passwordHash);
        AddServices(empty.Id, empty.Slug);

        var business = tenants[BusinessTenant.Slug];
        AddUser(business, "owner@business.local", "Beatrice Business", "+4915100001001", UserRole.Owner, passwordHash);
        AddUser(business, "manager@business.local", "Bora Business Manager", "+4915100001002", UserRole.Manager, passwordHash);
        AddUser(business, "staff@business.local", "Bianca Business Staff", "+4915100001003", UserRole.Staff, passwordHash);
        AddServices(business.Id, business.Slug);

        var suspended = tenants[SuspendedTenant.Slug];
        AddUser(suspended, "owner@suspended.local", "Sally Suspended", "+963990001001", UserRole.Owner, passwordHash);
        AddServices(suspended.Id, suspended.Slug);

        AddOrUpdateCatalogOwners(tenantDefinitions, tenants, passwordHash);

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        return new
        {
            password = Password,
            platformAdmin = new
            {
                email = "admin@detailflow.local",
                password = "AdminPassword123!",
                source = "development configuration"
            },
            tenants = tenantDefinitions.Select(definition => new
            {
                tenant = tenants[definition.Slug].Id,
                definition.Name,
                definition.Slug,
                definition.Plan,
                billingStatus = definition.BillingStatus,
                active = definition.IsActive
            }),
            users = new[]
            {
                new { tenantSlug = "demo", email = "owner@demo.local", role = "Owner", state = "Active" },
                new { tenantSlug = "demo", email = "manager@demo.local", role = "Manager", state = "Active" },
                new { tenantSlug = "demo", email = "staff@demo.local", role = "Staff", state = "Active" },
                new { tenantSlug = "demo", email = "jordan@demo.local", role = "Staff", state = "Active" },
                new { tenantSlug = "demo", email = "inactive@demo.local", role = "Staff", state = "Inactive" },
                new { tenantSlug = "demo", email = "pending@demo.local", role = "Staff", state = "Pending invite" },
                new { tenantSlug = "starter", email = "owner@starter.local", role = "Owner", state = "Active" },
                new { tenantSlug = "empty", email = "owner@empty.local", role = "Owner", state = "Active" },
                new { tenantSlug = "business", email = "owner@business.local", role = "Owner", state = "Active" },
                new { tenantSlug = "suspended", email = "owner@suspended.local", role = "Owner", state = "Tenant inactive" }
            },
            demo = demoManifest,
            scenarios = new
            {
                platformTenantPagination = tenantDefinitions.Count,
                customerPagination = 45,
                freePlanMonthlyBookingsUsed = 30,
                emptyTenant = EmptyTenant.Slug,
                inactiveTenant = SuspendedTenant.Slug,
                inactiveService = "Legacy Hand Wax"
            }
        };
    }

    private static List<SeedTenantDefinition> BuildTenantDefinitions()
    {
        var definitions = new List<SeedTenantDefinition>
        {
            DemoTenant,
            StarterTenant,
            EmptyTenant,
            BusinessTenant,
            SuspendedTenant
        };
        var currencies = Enum.GetValues<TenantCurrency>();
        var billingStatuses = Enum.GetValues<TenantBillingStatus>();

        for (var index = 1; index <= 25; index++)
        {
            definitions.Add(new SeedTenantDefinition(
                $"sample-{index:00}",
                $"Sample Auto Care {index:00}",
                (TenantPlan)(index % 3),
                billingStatuses[index % billingStatuses.Length],
                index % 7 != 0,
                currencies[index % currencies.Length],
                2 + index % 5));
        }

        return definitions;
    }

    private async Task<Dictionary<string, Tenant>> UpsertTenantsAsync(IReadOnlyList<SeedTenantDefinition> definitions)
    {
        var slugs = definitions.Select(definition => definition.Slug).ToArray();
        var existing = await db.Tenants
            .IgnoreQueryFilters()
            .Where(tenant => slugs.Contains(tenant.Slug))
            .ToDictionaryAsync(tenant => tenant.Slug, StringComparer.OrdinalIgnoreCase);

        foreach (var definition in definitions)
        {
            if (!existing.TryGetValue(definition.Slug, out var tenant))
            {
                tenant = new Tenant
                {
                    Id = StableGuid($"tenant:{definition.Slug}"),
                    Slug = definition.Slug,
                    CreatedAt = BaselineCreatedAt.AddDays(existing.Count)
                };
                db.Tenants.Add(tenant);
                existing[definition.Slug] = tenant;
            }

            tenant.Name = definition.Name;
            tenant.Plan = definition.Plan;
            tenant.BillingStatus = definition.BillingStatus;
            tenant.BillingNotes = definition.BillingStatus is TenantBillingStatus.PastDue or TenantBillingStatus.Suspended
                ? "Deterministic seed fixture for billing-state testing."
                : null;
            tenant.IsActive = definition.IsActive;
            tenant.LogoUrl = definition.LogoUrl;
            tenant.WhatsAppMonthlyAddonMessages = definition.Plan == TenantPlan.Pro ? 25 : 0;
            tenant.SupportAccessEnabled = false;
            tenant.SupportAccessExpiresAt = null;
            tenant.Settings = BuildSettings(definition);
            db.Entry(tenant).Property(value => value.Settings).IsModified = true;
        }

        await db.SaveChangesAsync();
        return existing;
    }

    private static TenantSettings BuildSettings(SeedTenantDefinition definition) => new()
    {
        BayCapacity = definition.BayCapacity,
        Currency = definition.Currency,
        DefaultLocale = definition.Currency switch
        {
            TenantCurrency.SAR or TenantCurrency.SYP => "ar",
            TenantCurrency.TRY => "tr",
            _ => "en"
        },
        AvailableLocales = ["en", "ar", "tr"],
        WorkingDays = TenantSettings.DefaultWorkingDays(),
        ClosurePeriods = []
    };

    private async Task<string> GetReusablePasswordHashAsync(IReadOnlyCollection<Guid> tenantIds)
    {
        var hashes = await db.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(user => tenantIds.Contains(user.TenantId) && user.PasswordSetAt != null && user.PasswordHash != "")
            .Select(user => user.PasswordHash)
            .Distinct()
            .Take(10)
            .ToListAsync();

        var reusable = hashes.FirstOrDefault(hash => BCrypt.Net.BCrypt.Verify(Password, hash));
        return reusable ?? BCrypt.Net.BCrypt.HashPassword(Password, workFactor: 12);
    }

    private async Task ResetFixtureTenantAsync(Guid tenantId)
    {
        var workOrderIds = await db.WorkOrders
            .IgnoreQueryFilters()
            .Where(workOrder => workOrder.TenantId == tenantId)
            .Select(workOrder => workOrder.Id)
            .ToListAsync();

        db.NotificationLogs.RemoveRange(db.NotificationLogs.IgnoreQueryFilters().Where(log => log.TenantId == tenantId));
        db.WorkOrderPhotos.RemoveRange(db.WorkOrderPhotos.IgnoreQueryFilters().Where(photo => workOrderIds.Contains(photo.WorkOrderId)));
        db.WorkOrderStageHistory.RemoveRange(db.WorkOrderStageHistory.IgnoreQueryFilters().Where(history => workOrderIds.Contains(history.WorkOrderId)));
        db.WorkOrders.RemoveRange(db.WorkOrders.IgnoreQueryFilters().Where(workOrder => workOrder.TenantId == tenantId));
        db.Bookings.RemoveRange(db.Bookings.IgnoreQueryFilters().Where(booking => booking.TenantId == tenantId));
        db.Vehicles.RemoveRange(db.Vehicles.IgnoreQueryFilters().Where(vehicle => vehicle.TenantId == tenantId));
        db.Customers.RemoveRange(db.Customers.IgnoreQueryFilters().Where(customer => customer.TenantId == tenantId));
        db.AccountActionTokens.RemoveRange(db.AccountActionTokens.IgnoreQueryFilters().Where(token => token.TenantId == tenantId));
        db.TenantWhatsAppSettings.RemoveRange(db.TenantWhatsAppSettings.IgnoreQueryFilters().Where(settings => settings.TenantId == tenantId));
        await db.SaveChangesAsync();

        db.Users.RemoveRange(db.Users.IgnoreQueryFilters().Where(user => user.TenantId == tenantId));
        db.ServiceTypes.RemoveRange(db.ServiceTypes.IgnoreQueryFilters().Where(service => service.TenantId == tenantId));
        await db.SaveChangesAsync();
    }

    private DemoUsers AddDemoUsers(Tenant tenant, string passwordHash)
    {
        var owner = AddUser(tenant, "owner@demo.local", "Olivia Owner", "+15551001200", UserRole.Owner, passwordHash);
        var manager = AddUser(tenant, "manager@demo.local", "Manny Manager", "+15551001201", UserRole.Manager, passwordHash);
        var staff = AddUser(tenant, "staff@demo.local", "Sam Staff", "+15551001202", UserRole.Staff, passwordHash);
        var staffTwo = AddUser(tenant, "jordan@demo.local", "Jordan Detailer", "+15551001203", UserRole.Staff, passwordHash);
        AddUser(tenant, "inactive@demo.local", "Inez Inactive", "+15551001204", UserRole.Staff, passwordHash, isActive: false);
        AddUser(tenant, "pending@demo.local", "Parker Pending", "+15551001205", UserRole.Staff, "", passwordSet: false);
        return new DemoUsers(owner, manager, staff, staffTwo);
    }

    private User AddUser(
        Tenant tenant,
        string email,
        string fullName,
        string phone,
        UserRole role,
        string passwordHash,
        bool isActive = true,
        bool passwordSet = true)
    {
        var user = new User
        {
            Id = StableGuid($"user:{tenant.Slug}:{email}"),
            TenantId = tenant.Id,
            Tenant = tenant,
            Email = email,
            FullName = fullName,
            Phone = phone,
            Role = role,
            PasswordHash = passwordSet ? passwordHash : "",
            PasswordSetAt = passwordSet ? BaselineCreatedAt : null,
            IsActive = isActive,
            CreatedAt = BaselineCreatedAt
        };
        db.Users.Add(user);
        return user;
    }

    private void AddOrUpdateCatalogOwners(
        IReadOnlyList<SeedTenantDefinition> definitions,
        IReadOnlyDictionary<string, Tenant> tenants,
        string passwordHash)
    {
        var catalogDefinitions = definitions.Where(definition => definition.Slug.StartsWith("sample-", StringComparison.Ordinal));
        foreach (var definition in catalogDefinitions)
        {
            var tenant = tenants[definition.Slug];
            var email = $"owner{definition.Slug[^2..]}@sample.local";
            var existing = db.Users.Local.FirstOrDefault(user => user.TenantId == tenant.Id && user.Email == email)
                ?? db.Users.IgnoreQueryFilters().FirstOrDefault(user => user.TenantId == tenant.Id && user.Email == email);

            if (existing is null)
            {
                AddUser(tenant, email, $"Sample Owner {definition.Slug[^2..]}", $"+1555200{definition.Slug[^2..]}00", UserRole.Owner, passwordHash);
                continue;
            }

            existing.FullName = $"Sample Owner {definition.Slug[^2..]}";
            existing.Phone = $"+1555200{definition.Slug[^2..]}00";
            existing.Role = UserRole.Owner;
            existing.PasswordHash = passwordHash;
            existing.PasswordSetAt = BaselineCreatedAt;
            existing.IsActive = definition.IsActive;
        }
    }

    private List<ServiceType> AddServices(Guid tenantId, string tenantSlug, bool includeInactiveFixture = false)
    {
        var services = new List<ServiceType>
        {
            BuildService(tenantId, tenantSlug, "Exterior Wash", "Exterior hand wash and dry.", 15, 30, 1),
            BuildService(tenantId, tenantSlug, "Full Interior Clean", "Vacuum, wipe-down, and interior detailing.", 45, 90, 2),
            BuildService(tenantId, tenantSlug, "Full Detail", "Complete interior and exterior detail.", 120, 180, 3),
            BuildService(tenantId, tenantSlug, "Paint Polish", "Machine polish and paint enhancement.", 200, 240, 4),
            BuildService(tenantId, tenantSlug, "Ceramic Coating", "Long-duration ceramic paint protection.", 500, 480, 5)
        };

        if (includeInactiveFixture)
            services.Add(BuildService(tenantId, tenantSlug, "Legacy Hand Wax", "Inactive legacy service retained for catalog testing.", 25, 45, 99, false));

        db.ServiceTypes.AddRange(services);
        return services;
    }

    private static ServiceType BuildService(
        Guid tenantId,
        string tenantSlug,
        string name,
        string description,
        decimal basePrice,
        int durationMinutes,
        int sortOrder,
        bool isActive = true) => new()
    {
        Id = StableGuid($"service:{tenantSlug}:{name}"),
        TenantId = tenantId,
        Name = name,
        Description = description,
        BasePrice = basePrice,
        DurationMinutes = durationMinutes,
        SortOrder = sortOrder,
        IsActive = isActive
    };

    private object AddDemoOperationalData(Tenant tenant, DemoUsers users, IReadOnlyList<ServiceType> services)
    {
        var now = DateTimeOffset.UtcNow;
        var today = new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, TimeSpan.Zero);
        var tomorrow = today.AddDays(1);
        var exterior = services.Single(service => service.Name == "Exterior Wash");
        var interior = services.Single(service => service.Name == "Full Interior Clean");
        var fullDetail = services.Single(service => service.Name == "Full Detail");
        var polish = services.Single(service => service.Name == "Paint Polish");
        var coating = services.Single(service => service.Name == "Ceramic Coating");

        var alex = AddCustomer(tenant, "alex", "Alex Rivera", "+15551001001", 3, now.AddDays(-90));
        var priya = AddCustomer(tenant, "priya", "Priya Shah", "+15551001002", 2, now.AddDays(-60));
        var omar = AddCustomer(tenant, "omar", "Omar Haddad", "+15551001003", 1, now.AddDays(-45));
        var mia = AddCustomer(tenant, "mia", "Mia Chen", "+15551001004", 1, now.AddDays(-30));
        var noah = AddCustomer(tenant, "noah", "Noah Brooks", "+15551001005", 1, now.AddDays(-20));
        var sofia = AddCustomer(tenant, "sofia", "Sofia Demir", "+15551001006", 1, now.AddDays(-12));
        var liam = AddCustomer(tenant, "liam", "Liam Stone", "+15551001007", 1, now.AddDays(-8));
        var ella = AddCustomer(tenant, "ella", "Ella Carter", "+15551001008", 1, now.AddDays(-4));
        var grace = AddCustomer(tenant, "grace", "Grace Park", "+15551001009", 0, now.AddDays(-2));

        var alexCar = AddVehicle(tenant, alex, "alex", "DF-1001", "BMW", "M4", "Black", VehicleType.Sedan);
        var priyaCar = AddVehicle(tenant, priya, "priya", "DF-2002", "Mercedes", "GLE", "White", VehicleType.SUV);
        var omarCar = AddVehicle(tenant, omar, "omar", "DF-3003", "Porsche", "911", "Silver", VehicleType.Sedan);
        var miaCar = AddVehicle(tenant, mia, "mia", "DF-4004", "Tesla", "Model Y", "Blue", VehicleType.SUV);
        var noahCar = AddVehicle(tenant, noah, "noah", "DF-5005", "Ford", "Ranger", "Red", VehicleType.Truck);
        var sofiaCar = AddVehicle(tenant, sofia, "sofia", "DF-6006", "Audi", "A6", "Gray", VehicleType.Sedan);
        var liamCar = AddVehicle(tenant, liam, "liam", "DF-7007", "Range Rover", "Sport", "Green", VehicleType.SUV);
        var ellaCar = AddVehicle(tenant, ella, "ella", "DF-8008", "Mini", "Cooper", "Yellow", VehicleType.Sedan);
        var graceCar = AddVehicle(tenant, grace, "grace", "DF-9009", "Lexus", "RX", "Pearl", VehicleType.SUV);

        var booked = AddBookedScenario(tenant, "booked", alex, alexCar, exterior, tomorrow.AddHours(9), "TRKBKED2");
        var arrived = AddWorkOrderScenario(tenant, "arrived", priya, priyaCar, interior, WorkOrderStage.Arrived, users.Manager, null, now.AddMinutes(-25), "TRKRRVD2");
        var washing = AddWorkOrderScenario(tenant, "washing", omar, omarCar, fullDetail, WorkOrderStage.Washing, users.Staff, null, now.AddHours(-1), "TRKWSH22", paymentStatus: PaymentStatus.Refunded);
        var detailing = AddWorkOrderScenario(tenant, "detailing", mia, miaCar, coating, WorkOrderStage.Detailing, users.StaffTwo, null, now.AddHours(-2), "TRKDTL22");
        var polishing = AddWorkOrderScenario(tenant, "polishing", noah, noahCar, polish, WorkOrderStage.Polishing, users.Staff, null, now.AddHours(-3), "TRKPLSH2");
        var ready = AddWorkOrderScenario(tenant, "ready", sofia, sofiaCar, fullDetail, WorkOrderStage.Ready, users.StaffTwo, now.AddMinutes(20), now.AddHours(-4), "TRKREDY2");
        var delivered = AddWorkOrderScenario(tenant, "delivered", liam, liamCar, coating, WorkOrderStage.Delivered, users.Staff, null, now.AddHours(-5), "TRKDLVR2", 540, PaymentStatus.Paid);

        AddBookedScenario(tenant, "today-booked", ella, ellaCar, interior, today.AddHours(16), "TRKTDYB2");
        AddPendingBookingScenario(tenant, "pending", grace, graceCar, polish, tomorrow.AddHours(21));
        AddCancelledBookingScenario(tenant, "cancelled", grace, graceCar, exterior, tomorrow.AddDays(1).AddHours(11));
        AddFullSlotAvailabilityScenario(tenant, tomorrow.AddHours(10), exterior);
        AddHistoricalDeliveredJobs(tenant, alex, alexCar, fullDetail, users.Staff, today);
        AddPaginationCustomers(tenant, now);
        AddNotificationFixtures(tenant, ready, users.Owner, now);

        return new
        {
            trackingTokens = new
            {
                booked = booked.TrackingToken,
                arrived = arrived.TrackingToken,
                washing = washing.TrackingToken,
                detailing = detailing.TrackingToken,
                polishing = polishing.TrackingToken,
                ready = ready.TrackingToken,
                delivered = delivered.TrackingToken
            },
            availabilityFullSlot = new { date = tomorrow.ToString("yyyy-MM-dd"), time = "10:00", service = exterior.Name },
            statuses = new
            {
                bookings = Enum.GetNames<BookingStatus>(),
                workOrders = Enum.GetNames<WorkOrderStage>(),
                payments = Enum.GetNames<PaymentStatus>(),
                notifications = Enum.GetNames<NotificationStatus>()
            }
        };
    }

    private void AddFreePlanQuotaData(Tenant tenant, ServiceType service)
    {
        var now = DateTimeOffset.UtcNow;
        var monthStart = new DateTimeOffset(now.Year, now.Month, 1, 8, 0, 0, TimeSpan.Zero);
        for (var index = 1; index <= 30; index++)
        {
            var customer = AddCustomer(tenant, $"quota-{index:00}", $"Quota Customer {index:00}", $"+9665100{index:0000}", 0, monthStart.AddMinutes(index));
            var vehicle = AddVehicle(tenant, customer, $"quota-{index:00}", $"FREE-{index:00}", "Toyota", "Yaris", "White", VehicleType.Sedan);
            db.Bookings.Add(new Booking
            {
                Id = StableGuid($"booking:{tenant.Slug}:quota-{index:00}"),
                TenantId = tenant.Id,
                Customer = customer,
                Vehicle = vehicle,
                ServiceType = service,
                ScheduledAt = now.AddDays(index + 1),
                Status = BookingStatus.Cancelled,
                Notes = "Cancelled fixture still counts toward the current monthly plan quota.",
                CreatedAt = monthStart.AddMinutes(index)
            });
        }
    }

    private Customer AddCustomer(Tenant tenant, string key, string name, string phone, int totalVisits, DateTimeOffset createdAt)
    {
        var customer = new Customer
        {
            Id = StableGuid($"customer:{tenant.Slug}:{key}"),
            TenantId = tenant.Id,
            FullName = name,
            Phone = phone,
            TotalVisits = totalVisits,
            CreatedAt = createdAt
        };
        db.Customers.Add(customer);
        return customer;
    }

    private Vehicle AddVehicle(
        Tenant tenant,
        Customer customer,
        string key,
        string plate,
        string make,
        string model,
        string color,
        VehicleType type)
    {
        var vehicle = new Vehicle
        {
            Id = StableGuid($"vehicle:{tenant.Slug}:{key}"),
            TenantId = tenant.Id,
            Customer = customer,
            PlateNumber = plate,
            Make = make,
            Model = model,
            Color = color,
            VehicleType = type
        };
        db.Vehicles.Add(vehicle);
        return vehicle;
    }

    private WorkOrder AddBookedScenario(
        Tenant tenant,
        string key,
        Customer customer,
        Vehicle vehicle,
        ServiceType service,
        DateTimeOffset scheduledAt,
        string trackingToken)
    {
        var booking = new Booking
        {
            Id = StableGuid($"booking:{tenant.Slug}:{key}"),
            TenantId = tenant.Id,
            Customer = customer,
            Vehicle = vehicle,
            ServiceType = service,
            ScheduledAt = scheduledAt,
            Status = BookingStatus.Confirmed,
            Notes = "Seeded confirmed booking for board and booking-list testing.",
            CreatedAt = scheduledAt.AddHours(-2)
        };
        db.Bookings.Add(booking);

        var workOrder = new WorkOrder
        {
            Id = StableGuid($"work-order:{tenant.Slug}:{key}"),
            TenantId = tenant.Id,
            Booking = booking,
            Customer = customer,
            Vehicle = vehicle,
            ServiceType = service,
            Stage = WorkOrderStage.Booked,
            Notes = booking.Notes,
            CreatedAt = scheduledAt.AddHours(-2),
            UpdatedAt = scheduledAt.AddHours(-2)
        };
        workOrder.SetTrackingTokenForSeed(trackingToken);
        db.WorkOrders.Add(workOrder);
        return workOrder;
    }

    private void AddPendingBookingScenario(
        Tenant tenant,
        string key,
        Customer customer,
        Vehicle vehicle,
        ServiceType service,
        DateTimeOffset scheduledAt)
    {
        db.Bookings.Add(new Booking
        {
            Id = StableGuid($"booking:{tenant.Slug}:{key}"),
            TenantId = tenant.Id,
            Customer = customer,
            Vehicle = vehicle,
            ServiceType = service,
            ScheduledAt = scheduledAt,
            Status = BookingStatus.Pending,
            Notes = "After-hours request waiting for confirmation.",
            CreatedAt = scheduledAt.AddHours(-4)
        });
    }

    private void AddCancelledBookingScenario(
        Tenant tenant,
        string key,
        Customer customer,
        Vehicle vehicle,
        ServiceType service,
        DateTimeOffset scheduledAt)
    {
        db.Bookings.Add(new Booking
        {
            Id = StableGuid($"booking:{tenant.Slug}:{key}"),
            TenantId = tenant.Id,
            Customer = customer,
            Vehicle = vehicle,
            ServiceType = service,
            ScheduledAt = scheduledAt,
            Status = BookingStatus.Cancelled,
            Notes = "Cancelled fixture with no linked work order.",
            CreatedAt = scheduledAt.AddDays(-2)
        });
    }

    private WorkOrder AddWorkOrderScenario(
        Tenant tenant,
        string key,
        Customer customer,
        Vehicle vehicle,
        ServiceType service,
        WorkOrderStage stage,
        User? assignedStaff,
        DateTimeOffset? estimatedReadyAt,
        DateTimeOffset createdAt,
        string trackingToken,
        decimal? actualPrice = null,
        PaymentStatus paymentStatus = PaymentStatus.Pending)
    {
        var workOrder = new WorkOrder
        {
            Id = StableGuid($"work-order:{tenant.Slug}:{key}"),
            TenantId = tenant.Id,
            Customer = customer,
            Vehicle = vehicle,
            ServiceType = service,
            Stage = stage,
            AssignedStaff = assignedStaff,
            EstimatedReadyAt = estimatedReadyAt,
            ActualPrice = actualPrice,
            PaymentStatus = paymentStatus,
            Notes = $"Seeded {stage} scenario.",
            CreatedAt = createdAt,
            UpdatedAt = stage == WorkOrderStage.Delivered ? createdAt.AddHours(4) : DateTimeOffset.UtcNow.AddMinutes(-10)
        };
        workOrder.SetTrackingTokenForSeed(trackingToken);

        if (stage >= WorkOrderStage.Washing)
        {
            workOrder.Photos.Add(new WorkOrderPhoto
            {
                Id = StableGuid($"photo:{tenant.Slug}:{key}:before"),
                PhotoUrl = $"{DemoPhotoBase}/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
                R2Key = $"{tenant.Slug}/{trackingToken}/before.jpg",
                Type = PhotoType.Before,
                UploadedByUserId = assignedStaff?.Id ?? StableGuid("user:seed-bot"),
                UploadedAt = createdAt.AddMinutes(15)
            });
        }

        if (stage >= WorkOrderStage.Ready)
        {
            workOrder.Photos.Add(new WorkOrderPhoto
            {
                Id = StableGuid($"photo:{tenant.Slug}:{key}:after"),
                PhotoUrl = $"{DemoPhotoBase}/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80",
                R2Key = $"{tenant.Slug}/{trackingToken}/after.jpg",
                Type = PhotoType.After,
                UploadedByUserId = assignedStaff?.Id ?? StableGuid("user:seed-bot"),
                UploadedAt = createdAt.AddHours(2)
            });
        }

        AddStageHistory(tenant.Slug, key, workOrder, assignedStaff, stage, createdAt);
        db.WorkOrders.Add(workOrder);
        return workOrder;
    }

    private static void AddStageHistory(
        string tenantSlug,
        string workOrderKey,
        WorkOrder workOrder,
        User? user,
        WorkOrderStage currentStage,
        DateTimeOffset start)
    {
        if (currentStage == WorkOrderStage.Booked)
            return;

        var stages = Enum.GetValues<WorkOrderStage>()
            .Where(stage => stage > WorkOrderStage.Booked && stage <= currentStage)
            .ToList();
        var from = WorkOrderStage.Booked;
        var changedAt = start.AddMinutes(20);

        foreach (var to in stages)
        {
            workOrder.StageHistory.Add(new WorkOrderStageHistory
            {
                Id = StableGuid($"history:{tenantSlug}:{workOrderKey}:{to}"),
                FromStage = from,
                ToStage = to,
                ChangedByUserId = user?.Id ?? StableGuid("user:seed-bot"),
                ChangedByName = user?.FullName ?? "Seed Bot",
                ChangedAt = changedAt
            });
            from = to;
            changedAt = changedAt.AddMinutes(35);
        }
    }

    private void AddFullSlotAvailabilityScenario(Tenant tenant, DateTimeOffset slot, ServiceType service)
    {
        for (var index = 1; index <= tenant.Settings.BayCapacity; index++)
        {
            var customer = AddCustomer(tenant, $"full-slot-{index}", $"Full Slot Customer {index}", $"+1555100110{index}", 1, slot.AddDays(-7));
            var vehicle = AddVehicle(tenant, customer, $"full-slot-{index}", $"FULL-{index}", "Toyota", "Camry", "White", VehicleType.Sedan);
            AddBookedScenario(tenant, $"full-slot-{index}", customer, vehicle, service, slot, $"FULLSLT{index + 1}");
        }
    }

    private void AddHistoricalDeliveredJobs(
        Tenant tenant,
        Customer customer,
        Vehicle vehicle,
        ServiceType service,
        User staff,
        DateTimeOffset today)
    {
        for (var index = 1; index <= 6; index++)
        {
            AddWorkOrderScenario(
                tenant,
                $"history-{index}",
                customer,
                vehicle,
                service,
                WorkOrderStage.Delivered,
                staff,
                null,
                today.AddDays(-index).AddHours(10),
                $"HSTJB{index + 21}",
                service.BasePrice + index * 5,
                index == 6 ? PaymentStatus.Refunded : PaymentStatus.Paid);
        }
    }

    private void AddPaginationCustomers(Tenant tenant, DateTimeOffset now)
    {
        var makes = new[] { "Toyota", "Honda", "Ford", "Hyundai", "Kia", "Nissan" };
        var types = Enum.GetValues<VehicleType>();
        for (var index = 1; index <= 33; index++)
        {
            var customer = AddCustomer(
                tenant,
                $"pagination-{index:00}",
                index == 33 ? "Boundary Search Customer" : $"Pagination Customer {index:00}",
                $"+1555300{index:0000}",
                index % 5,
                now.AddDays(-index));
            AddVehicle(
                tenant,
                customer,
                $"pagination-{index:00}",
                $"PAGE-{index:000}",
                makes[index % makes.Length],
                $"Model {index:00}",
                index % 2 == 0 ? "Black" : "White",
                types[index % types.Length]);
        }
    }

    private void AddNotificationFixtures(Tenant tenant, WorkOrder workOrder, User owner, DateTimeOffset now)
    {
        db.TenantWhatsAppSettings.Add(new TenantWhatsAppSettings
        {
            Id = StableGuid($"whatsapp-settings:{tenant.Slug}"),
            TenantId = tenant.Id,
            Tenant = tenant,
            IsEnabled = false,
            ReadyTemplateName = "detailflow_ready",
            TrackingTemplateName = "detailflow_tracking",
            StaffInviteTemplateName = "detailflow_staff_invite",
            PasswordResetTemplateName = "detailflow_password_reset",
            TemplateLanguageCode = "en_US",
            AutoSendReady = false,
            UpdatedAt = now.AddHours(-1)
        });

        var statuses = Enum.GetValues<NotificationStatus>();
        for (var index = 0; index < statuses.Length; index++)
        {
            var status = statuses[index];
            db.NotificationLogs.Add(new NotificationLog
            {
                Id = StableGuid($"notification:{tenant.Slug}:{status}"),
                TenantId = tenant.Id,
                Tenant = tenant,
                WorkOrder = workOrder,
                Channel = NotificationChannel.WhatsApp,
                EventType = index % 2 == 0 ? NotificationEventType.ReadyForPickup : NotificationEventType.TrackingLink,
                DispatchType = index % 2 == 0 ? NotificationDispatchType.Automatic : NotificationDispatchType.Manual,
                RecipientPhone = workOrder.Customer.Phone,
                ProviderMessageId = status == NotificationStatus.Failed ? null : $"wamid.seed.{index}",
                Status = status,
                ErrorCode = status == NotificationStatus.Failed ? "SEED_PROVIDER_FAILURE" : null,
                ErrorMessage = status == NotificationStatus.Failed ? "Deterministic provider failure fixture." : null,
                RequestedByUserId = owner.Id,
                RequestedByName = owner.FullName,
                CreatedAt = now.AddMinutes(-30 + index),
                UpdatedAt = now.AddMinutes(-25 + index)
            });
        }
    }

    private static Guid StableGuid(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"detailflow-dev-seed:{value}"));
        return new Guid(bytes.AsSpan(0, 16));
    }

    private sealed record SeedTenantDefinition(
        string Slug,
        string Name,
        TenantPlan Plan,
        TenantBillingStatus BillingStatus,
        bool IsActive,
        TenantCurrency Currency,
        int BayCapacity,
        string? LogoUrl = null);

    private sealed record DemoUsers(User Owner, User Manager, User Staff, User StaffTwo);
}
