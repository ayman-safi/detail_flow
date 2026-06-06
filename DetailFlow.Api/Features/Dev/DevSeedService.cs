using DetailFlow.Api.Data;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.Dev;

public class DevSeedService(DetailFlowDbContext db)
{
    private const string Password = "Password123!";
    private const string DemoPhotoBase = "https://images.unsplash.com";

    public async Task<object> SeedAsync()
    {
        await using var tx = await db.Database.BeginTransactionAsync();

        var tenant = await db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Slug == "demo");
        if (tenant is null)
        {
            tenant = new Tenant
            {
                Name = "Demo Detail Shop",
                Slug = "demo",
                Plan = TenantPlan.Pro,
                LogoUrl = "https://placehold.co/160x160/png?text=DF"
            };
            db.Tenants.Add(tenant);
            await db.SaveChangesAsync();
        }
        else
        {
            tenant.Name = "Demo Detail Shop";
            tenant.Plan = TenantPlan.Pro;
            tenant.IsActive = true;
            tenant.LogoUrl ??= "https://placehold.co/160x160/png?text=DF";
        }

        var owner = await UpsertUserAsync(tenant.Id, "owner@demo.local", "Olivia Owner", UserRole.Owner);
        var manager = await UpsertUserAsync(tenant.Id, "manager@demo.local", "Manny Manager", UserRole.Manager);
        var staff = await UpsertUserAsync(tenant.Id, "staff@demo.local", "Sam Staff", UserRole.Staff);
        var staffTwo = await UpsertUserAsync(tenant.Id, "jordan@demo.local", "Jordan Detailer", UserRole.Staff);

        var services = await EnsureServicesAsync(tenant.Id);
        await ResetOperationalDataAsync(tenant.Id);

        var now = DateTimeOffset.UtcNow;
        var today = new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, TimeSpan.Zero);
        var tomorrow = today.AddDays(1);

        var exterior = services.Single(s => s.Name == "Exterior Wash");
        var interior = services.Single(s => s.Name == "Full Interior Clean");
        var fullDetail = services.Single(s => s.Name == "Full Detail");
        var polish = services.Single(s => s.Name == "Paint Polish");
        var coating = services.Single(s => s.Name == "Ceramic Coating");

        var alex = AddCustomer(tenant.Id, "Alex Rivera", "+15551001001", 3);
        var priya = AddCustomer(tenant.Id, "Priya Shah", "+15551001002", 2);
        var omar = AddCustomer(tenant.Id, "Omar Haddad", "+15551001003", 1);
        var mia = AddCustomer(tenant.Id, "Mia Chen", "+15551001004", 1);
        var noah = AddCustomer(tenant.Id, "Noah Brooks", "+15551001005", 1);
        var sofia = AddCustomer(tenant.Id, "Sofia Demir", "+15551001006", 1);
        var liam = AddCustomer(tenant.Id, "Liam Stone", "+15551001007", 1);
        var ella = AddCustomer(tenant.Id, "Ella Carter", "+15551001008", 1);
        var grace = AddCustomer(tenant.Id, "Grace Park", "+15551001009", 1);

        var alexCar = AddVehicle(tenant.Id, alex, "DF-1001", "BMW", "M4", "Black", VehicleType.Sedan);
        var priyaCar = AddVehicle(tenant.Id, priya, "DF-2002", "Mercedes", "GLE", "White", VehicleType.SUV);
        var omarCar = AddVehicle(tenant.Id, omar, "DF-3003", "Porsche", "911", "Silver", VehicleType.Sedan);
        var miaCar = AddVehicle(tenant.Id, mia, "DF-4004", "Tesla", "Model Y", "Blue", VehicleType.SUV);
        var noahCar = AddVehicle(tenant.Id, noah, "DF-5005", "Ford", "Ranger", "Red", VehicleType.Truck);
        var sofiaCar = AddVehicle(tenant.Id, sofia, "DF-6006", "Audi", "A6", "Gray", VehicleType.Sedan);
        var liamCar = AddVehicle(tenant.Id, liam, "DF-7007", "Range Rover", "Sport", "Green", VehicleType.SUV);
        var ellaCar = AddVehicle(tenant.Id, ella, "DF-8008", "Mini", "Cooper", "Yellow", VehicleType.Sedan);
        var graceCar = AddVehicle(tenant.Id, grace, "DF-9009", "Lexus", "RX", "Pearl", VehicleType.SUV);

        var booked = AddBookedScenario(tenant.Id, alex, alexCar, exterior, tomorrow.AddHours(9));
        var arrived = AddWorkOrderScenario(tenant.Id, priya, priyaCar, interior, WorkOrderStage.Arrived, manager, null, now.AddMinutes(-25));
        var washing = AddWorkOrderScenario(tenant.Id, omar, omarCar, fullDetail, WorkOrderStage.Washing, staff, null, now.AddHours(-1));
        var detailing = AddWorkOrderScenario(tenant.Id, mia, miaCar, coating, WorkOrderStage.Detailing, staffTwo, null, now.AddHours(-2));
        var polishing = AddWorkOrderScenario(tenant.Id, noah, noahCar, polish, WorkOrderStage.Polishing, staff, null, now.AddHours(-3));
        var ready = AddWorkOrderScenario(tenant.Id, sofia, sofiaCar, fullDetail, WorkOrderStage.Ready, staffTwo, now.AddMinutes(20), now.AddHours(-4));
        var delivered = AddWorkOrderScenario(tenant.Id, liam, liamCar, coating, WorkOrderStage.Delivered, staff, null, now.AddHours(-5), 540);

        AddBookedScenario(tenant.Id, ella, ellaCar, interior, today.AddHours(16));
        AddPendingBookingScenario(tenant.Id, grace, graceCar, polish, tomorrow.AddHours(21));

        AddFullSlotAvailabilityScenario(tenant.Id, tomorrow.AddHours(10), exterior);
        AddHistoricalDeliveredJobs(tenant.Id, alex, alexCar, fullDetail, staff, today);

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        return new
        {
            tenant = new { tenant.Id, tenant.Name, tenant.Slug },
            password = Password,
            users = new[]
            {
                new { email = "owner@demo.local", role = UserRole.Owner, name = owner.FullName },
                new { email = "manager@demo.local", role = UserRole.Manager, name = manager.FullName },
                new { email = "staff@demo.local", role = UserRole.Staff, name = staff.FullName },
                new { email = "jordan@demo.local", role = UserRole.Staff, name = staffTwo.FullName }
            },
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
            counts = new
            {
                customers = await db.Customers.IgnoreQueryFilters().CountAsync(c => c.TenantId == tenant.Id),
                vehicles = await db.Vehicles.IgnoreQueryFilters().CountAsync(v => v.TenantId == tenant.Id),
                bookings = await db.Bookings.IgnoreQueryFilters().CountAsync(b => b.TenantId == tenant.Id),
                workOrders = await db.WorkOrders.IgnoreQueryFilters().CountAsync(w => w.TenantId == tenant.Id)
            }
        };
    }

    private async Task<List<ServiceType>> EnsureServicesAsync(Guid tenantId)
    {
        var existing = await db.ServiceTypes.IgnoreQueryFilters().Where(s => s.TenantId == tenantId).ToListAsync();
        if (existing.Count == 0)
        {
            existing = DefaultServiceSeeder.SeedDefaultServices(tenantId);
            db.ServiceTypes.AddRange(existing);
            await db.SaveChangesAsync();
        }

        foreach (var service in existing)
            service.IsActive = true;

        return existing;
    }

    private async Task ResetOperationalDataAsync(Guid tenantId)
    {
        var workOrderIds = await db.WorkOrders.IgnoreQueryFilters()
            .Where(w => w.TenantId == tenantId)
            .Select(w => w.Id)
            .ToListAsync();

        db.NotificationLogs.RemoveRange(db.NotificationLogs.IgnoreQueryFilters().Where(log => log.TenantId == tenantId));
        db.WorkOrderPhotos.RemoveRange(db.WorkOrderPhotos.Where(p => workOrderIds.Contains(p.WorkOrderId)));
        db.WorkOrderStageHistory.RemoveRange(db.WorkOrderStageHistory.Where(h => workOrderIds.Contains(h.WorkOrderId)));
        db.WorkOrders.RemoveRange(db.WorkOrders.IgnoreQueryFilters().Where(w => w.TenantId == tenantId));
        db.Bookings.RemoveRange(db.Bookings.IgnoreQueryFilters().Where(b => b.TenantId == tenantId));
        db.Vehicles.RemoveRange(db.Vehicles.IgnoreQueryFilters().Where(v => v.TenantId == tenantId));
        db.Customers.RemoveRange(db.Customers.IgnoreQueryFilters().Where(c => c.TenantId == tenantId));
        await db.SaveChangesAsync();
    }

    private async Task<User> UpsertUserAsync(Guid tenantId, string email, string fullName, UserRole role)
    {
        var user = await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Email == email);
        if (user is null)
        {
            user = new User
            {
                TenantId = tenantId,
                Email = email,
                FullName = fullName,
                Role = role,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Password, workFactor: 12),
                PasswordSetAt = DateTimeOffset.UtcNow,
                IsActive = true
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return user;
        }

        user.FullName = fullName;
        user.Role = role;
        user.PasswordSetAt ??= DateTimeOffset.UtcNow;
        user.IsActive = true;
        return user;
    }

    private Customer AddCustomer(Guid tenantId, string name, string phone, int totalVisits)
    {
        var customer = new Customer { TenantId = tenantId, FullName = name, Phone = phone, TotalVisits = totalVisits };
        db.Customers.Add(customer);
        return customer;
    }

    private Vehicle AddVehicle(Guid tenantId, Customer customer, string plate, string make, string model, string color, VehicleType type)
    {
        var vehicle = new Vehicle
        {
            TenantId = tenantId,
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

    private WorkOrder AddBookedScenario(Guid tenantId, Customer customer, Vehicle vehicle, ServiceType service, DateTimeOffset scheduledAt)
    {
        var booking = new Booking
        {
            TenantId = tenantId,
            Customer = customer,
            Vehicle = vehicle,
            ServiceType = service,
            ScheduledAt = scheduledAt,
            Status = BookingStatus.Confirmed,
            Notes = "Seeded booking for board and booking-list testing."
        };
        db.Bookings.Add(booking);

        var workOrder = new WorkOrder
        {
            TenantId = tenantId,
            Booking = booking,
            Customer = customer,
            Vehicle = vehicle,
            ServiceType = service,
            Stage = WorkOrderStage.Booked,
            Notes = booking.Notes,
            CreatedAt = scheduledAt.AddHours(-2),
            UpdatedAt = scheduledAt.AddHours(-2)
        };
        db.WorkOrders.Add(workOrder);
        return workOrder;
    }

    private WorkOrder AddPendingBookingScenario(Guid tenantId, Customer customer, Vehicle vehicle, ServiceType service, DateTimeOffset scheduledAt)
    {
        var booking = new Booking
        {
            TenantId = tenantId,
            Customer = customer,
            Vehicle = vehicle,
            ServiceType = service,
            ScheduledAt = scheduledAt,
            Status = BookingStatus.Pending,
            Notes = "After-hours request waiting for confirmation."
        };
        db.Bookings.Add(booking);
        var workOrder = new WorkOrder
        {
            TenantId = tenantId,
            Booking = booking,
            Customer = customer,
            Vehicle = vehicle,
            ServiceType = service,
            Stage = WorkOrderStage.Booked,
            Notes = booking.Notes,
            CreatedAt = scheduledAt.AddHours(-4),
            UpdatedAt = scheduledAt.AddHours(-4)
        };
        db.WorkOrders.Add(workOrder);
        return workOrder;
    }

    private WorkOrder AddWorkOrderScenario(
        Guid tenantId,
        Customer customer,
        Vehicle vehicle,
        ServiceType service,
        WorkOrderStage stage,
        User? assignedStaff,
        DateTimeOffset? estimatedReadyAt,
        DateTimeOffset createdAt,
        decimal? actualPrice = null)
    {
        var workOrder = new WorkOrder
        {
            TenantId = tenantId,
            Customer = customer,
            Vehicle = vehicle,
            ServiceType = service,
            Stage = stage,
            AssignedStaff = assignedStaff,
            EstimatedReadyAt = estimatedReadyAt,
            ActualPrice = actualPrice,
            Notes = $"Seeded {stage} scenario.",
            CreatedAt = createdAt,
            UpdatedAt = stage == WorkOrderStage.Delivered ? createdAt.AddHours(4) : DateTimeOffset.UtcNow.AddMinutes(-10)
        };

        if (stage >= WorkOrderStage.Washing)
        {
            workOrder.Photos.Add(new WorkOrderPhoto
            {
                PhotoUrl = $"{DemoPhotoBase}/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
                R2Key = $"demo/{workOrder.TrackingToken}/before.jpg",
                Type = PhotoType.Before,
                UploadedByUserId = assignedStaff?.Id ?? Guid.Empty,
                UploadedAt = createdAt.AddMinutes(15)
            });
        }

        if (stage >= WorkOrderStage.Ready)
        {
            workOrder.Photos.Add(new WorkOrderPhoto
            {
                PhotoUrl = $"{DemoPhotoBase}/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80",
                R2Key = $"demo/{workOrder.TrackingToken}/after.jpg",
                Type = PhotoType.After,
                UploadedByUserId = assignedStaff?.Id ?? Guid.Empty,
                UploadedAt = createdAt.AddHours(2)
            });
        }

        AddStageHistory(workOrder, assignedStaff, stage, createdAt);
        db.WorkOrders.Add(workOrder);
        return workOrder;
    }

    private static void AddStageHistory(WorkOrder workOrder, User? user, WorkOrderStage currentStage, DateTimeOffset start)
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
                FromStage = from,
                ToStage = to,
                ChangedByUserId = user?.Id ?? Guid.Empty,
                ChangedByName = user?.FullName ?? "Seed Bot",
                ChangedAt = changedAt
            });
            from = to;
            changedAt = changedAt.AddMinutes(35);
        }
    }

    private void AddFullSlotAvailabilityScenario(Guid tenantId, DateTimeOffset slot, ServiceType service)
    {
        for (var i = 1; i <= 3; i++)
        {
            var customer = AddCustomer(tenantId, $"Full Slot Customer {i}", $"+1555100110{i}", 1);
            var vehicle = AddVehicle(tenantId, customer, $"FULL-{i}", "Toyota", "Camry", "White", VehicleType.Sedan);
            AddBookedScenario(tenantId, customer, vehicle, service, slot);
        }
    }

    private void AddHistoricalDeliveredJobs(Guid tenantId, Customer customer, Vehicle vehicle, ServiceType service, User staff, DateTimeOffset today)
    {
        for (var i = 1; i <= 6; i++)
        {
            AddWorkOrderScenario(
                tenantId,
                customer,
                vehicle,
                service,
                WorkOrderStage.Delivered,
                staff,
                null,
                today.AddDays(-i).AddHours(10),
                service.BasePrice + i * 5);
        }
    }
}
