using System.Data;
using DetailFlow.Api.Data;
using DetailFlow.Api.Features.Plans;
using DetailFlow.Api.Features.WorkOrders;
using DetailFlow.Api.Infrastructure;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.Bookings;

public class PublicBookingService(
    DetailFlowDbContext db,
    BoardEventService events,
    PlanEnforcementService planEnforcement,
    TenantSettingsService tenantSettings)
{
    public async Task<object> GetShopAsync(string tenantSlug)
    {
        var tenant = await GetTenantAsync(tenantSlug, asNoTracking: true);
        return new
        {
            tenant.Name,
            tenant.Slug,
            tenant.LogoUrl,
            Currency = TenantCurrencies.Normalize(tenant.Settings.Currency)
        };
    }

    public async Task<IReadOnlyList<object>> ListServicesAsync(string tenantSlug)
    {
        var tenant = await GetTenantAsync(tenantSlug, asNoTracking: true);
        return await db.ServiceTypes
            .IgnoreQueryFilters()
            .Where(s => s.TenantId == tenant.Id && s.IsActive)
            .OrderBy(s => s.SortOrder)
            .Select(s => (object)new
            {
                s.Id,
                s.Name,
                s.Description,
                s.BasePrice,
                s.DurationMinutes,
                s.SortOrder,
                s.IsActive,
                s.ImageUrl
            })
            .ToListAsync();
    }

    public async Task<object> LookupVehiclesAsync(string tenantSlug, string customerPhone)
    {
        var tenant = await GetTenantAsync(tenantSlug, asNoTracking: true);
        var phone = NormalizePhone(customerPhone);
        if (phone.Length < 7)
            throw new ArgumentException("Customer phone must include at least 7 digits.");

        var customerId = await db.Customers
            .IgnoreQueryFilters()
            .Where(c => c.TenantId == tenant.Id && c.Phone == phone)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefaultAsync();

        if (!customerId.HasValue)
            return new { vehicles = Array.Empty<object>() };

        var vehicles = await db.Vehicles
            .IgnoreQueryFilters()
            .Where(v => v.TenantId == tenant.Id && v.CustomerId == customerId.Value)
            .OrderBy(v => v.Make)
            .ThenBy(v => v.Model)
            .Select(v => new
            {
                v.Id,
                maskedPlate = MaskPlate(v.PlateNumber),
                v.Make,
                v.Model,
                v.Color,
                v.VehicleType
            })
            .ToListAsync();

        return new { vehicles };
    }

    public async Task<IReadOnlyList<object>> GetMonthAvailabilityAsync(
        string tenantSlug,
        DateTime month,
        Guid serviceTypeId,
        int? timezoneOffsetMinutes)
    {
        var tenant = await GetTenantAsync(tenantSlug, asNoTracking: true);
        var service = await GetActiveServiceAsync(tenant.Id, serviceTypeId);
        var settings = await tenantSettings.GetAsync(tenant.Id);
        var localOffset = TimeSpan.FromMinutes(-(timezoneOffsetMinutes ?? 0));
        var firstDay = new DateOnly(month.Year, month.Month, 1);
        var nextMonth = firstDay.AddMonths(1);
        var utcStart = new DateTimeOffset(firstDay.ToDateTime(TimeOnly.MinValue), localOffset).ToUniversalTime();
        var utcEnd = new DateTimeOffset(nextMonth.ToDateTime(TimeOnly.MinValue), localOffset).ToUniversalTime();
        var confirmed = await db.Bookings
            .IgnoreQueryFilters()
            .Include(b => b.ServiceType)
            .Where(b => b.TenantId == tenant.Id && b.Status == BookingStatus.Confirmed && b.ScheduledAt >= utcStart && b.ScheduledAt < utcEnd)
            .ToListAsync();
        var today = DateOnly.FromDateTime(DateTimeOffset.UtcNow.ToOffset(localOffset).DateTime);

        var result = new List<object>();
        for (var day = firstDay; day < nextMonth; day = day.AddDays(1))
        {
            var status = "closed";
            if (day < today)
            {
                status = "past";
            }
            else if (!TenantSettingsService.IsClosed(settings, day))
            {
                var workingDay = TenantSettingsService.GetWorkingDay(settings, day);
                if (workingDay is not null)
                {
                    var localStart = new DateTimeOffset(day.ToDateTime(workingDay.OpenTime), localOffset);
                    var localEnd = new DateTimeOffset(day.ToDateTime(workingDay.CloseTime), localOffset);
                    var hasSlot = Enumerable.Range(0, Math.Max(0, (int)Math.Floor((localEnd - localStart).TotalMinutes / 30) + 1))
                        .Select(i => localStart.AddMinutes(i * 30))
                        .Where(slot => slot.AddMinutes(service.DurationMinutes) <= localEnd)
                        .Where(slot => slot > DateTimeOffset.UtcNow.ToOffset(localOffset))
                        .Any(localSlot => BookingService.CountOverlappingBookings(confirmed, localSlot.ToUniversalTime(), service.DurationMinutes) < settings.BayCapacity);
                    status = hasSlot ? "available" : "full";
                }
            }

            result.Add(new { date = day.ToString("yyyy-MM-dd"), status });
        }

        return result;
    }

    public async Task<IReadOnlyList<object>> GetAvailabilityAsync(
        string tenantSlug,
        DateTime date,
        Guid serviceTypeId,
        int? timezoneOffsetMinutes)
    {
        var tenant = await GetTenantAsync(tenantSlug, asNoTracking: true);
        var service = await GetActiveServiceAsync(tenant.Id, serviceTypeId);
        var localOffset = TimeSpan.FromMinutes(-(timezoneOffsetMinutes ?? 0));
        var day = DateOnly.FromDateTime(date);
        var settings = await tenantSettings.GetAsync(tenant.Id);
        if (TenantSettingsService.IsClosed(settings, day))
            return [];
        var workingDay = TenantSettingsService.GetWorkingDay(settings, day);
        if (workingDay is null)
            return [];

        var localStart = new DateTimeOffset(day.ToDateTime(workingDay.OpenTime), localOffset);
        var localEnd = new DateTimeOffset(day.ToDateTime(workingDay.CloseTime), localOffset);
        var start = localStart.ToUniversalTime();
        var end = localEnd.ToUniversalTime();
        var confirmed = await db.Bookings
            .IgnoreQueryFilters()
            .Include(b => b.ServiceType)
            .Where(b => b.TenantId == tenant.Id && b.Status == BookingStatus.Confirmed && b.ScheduledAt >= start && b.ScheduledAt < end)
            .ToListAsync();

        var slotCount = Math.Max(0, (int)Math.Floor((localEnd - localStart).TotalMinutes / 30) + 1);
        return Enumerable.Range(0, slotCount)
            .Select(i => localStart.AddMinutes(i * 30))
            .Where(slot => slot.AddMinutes(service.DurationMinutes) <= localEnd)
            .Select(localSlot =>
            {
                var slot = localSlot.ToUniversalTime();
                var count = BookingService.CountOverlappingBookings(confirmed, slot, service.DurationMinutes);
                return (object)new
                {
                    time = localSlot.ToString("HH:mm"),
                    available = count < settings.BayCapacity,
                    bookingCount = count
                };
            })
            .ToList();
    }

    public async Task<object> CreateAsync(string tenantSlug, PublicBookingCreateRequest input)
    {
        var tenant = await GetTenantAsync(tenantSlug, asNoTracking: true);
        var localScheduledAt = input.ScheduledAt;
        var scheduledAt = localScheduledAt.ToUniversalTime();
        if (scheduledAt <= DateTimeOffset.UtcNow)
            throw new ArgumentException("Scheduled time must be in the future.");

        var phone = NormalizePhone(input.CustomerPhone);
        if (phone.Length < 7)
            throw new ArgumentException("Customer phone must include at least 7 digits.");

        if (input.ExistingVehicleId.HasValue && input.Vehicle is not null)
            throw new ArgumentException("Choose an existing vehicle or add a new vehicle, not both.");
        var service = await GetActiveServiceAsync(tenant.Id, input.ServiceTypeId);

        var localDay = DateOnly.FromDateTime(localScheduledAt.DateTime);
        var settings = await tenantSettings.GetAsync(tenant.Id);
        if (TenantSettingsService.IsClosed(settings, localDay))
            throw new ArgumentException("Shop is closed on this date.");
        var workingDay = TenantSettingsService.GetWorkingDay(settings, localDay);
        if (workingDay is null)
            throw new ArgumentException("Shop is closed on this day.");

        EnsureWithinBusinessHours(localScheduledAt, service.DurationMinutes, workingDay.OpenTime, workingDay.CloseTime);

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await planEnforcement.AssertCanBookAsync(tenant.Id);
        var businessStart = new DateTimeOffset(localDay.ToDateTime(workingDay.OpenTime), localScheduledAt.Offset).ToUniversalTime();
        var businessEnd = new DateTimeOffset(localDay.ToDateTime(workingDay.CloseTime), localScheduledAt.Offset).ToUniversalTime();
        var sameDayBookings = await db.Bookings
            .IgnoreQueryFilters()
            .Include(b => b.ServiceType)
            .Where(b => b.TenantId == tenant.Id && b.Status == BookingStatus.Confirmed && b.ScheduledAt >= businessStart && b.ScheduledAt < businessEnd)
            .ToListAsync();
        var slotCount = BookingService.CountOverlappingBookings(sameDayBookings, scheduledAt, service.DurationMinutes);
        if (slotCount >= settings.BayCapacity)
            throw new ConflictException("Selected time slot is full.");

        var customer = await db.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == tenant.Id && c.Phone == phone);
        if (customer is null)
        {
            customer = new Customer
            {
                TenantId = tenant.Id,
                Phone = phone
            };
            db.Customers.Add(customer);
        }

        Vehicle? vehicle = null;
        if (input.ExistingVehicleId.HasValue)
        {
            vehicle = await db.Vehicles
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(v => v.TenantId == tenant.Id && v.Id == input.ExistingVehicleId && v.CustomerId == customer.Id)
                ?? throw new ArgumentException("Selected vehicle is not available for this phone number.");
        }
        else if (input.Vehicle is not null)
        {
            var plate = RequireText(input.Vehicle.PlateNumber, "Vehicle plate").Trim().ToUpperInvariant();
            vehicle = await db.Vehicles
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(v => v.TenantId == tenant.Id && v.PlateNumber == plate);
            if (vehicle is null)
            {
                vehicle = new Vehicle { TenantId = tenant.Id, Customer = customer, PlateNumber = plate };
                db.Vehicles.Add(vehicle);
            }
            else if (vehicle.CustomerId != customer.Id)
            {
                throw new ConflictException("This vehicle is already registered to another phone number.");
            }
            vehicle.Customer = customer;
            vehicle.Make = RequireText(input.Vehicle.Make, "Vehicle make").Trim();
            vehicle.Model = RequireText(input.Vehicle.Model, "Vehicle model").Trim();
            vehicle.Color = RequireText(input.Vehicle.Color, "Vehicle color").Trim();
            vehicle.VehicleType = input.Vehicle.VehicleType;
        }

        var booking = new Booking
        {
            TenantId = tenant.Id,
            Customer = customer,
            Vehicle = vehicle,
            ServiceTypeId = service.Id,
            ScheduledAt = scheduledAt,
            Status = BookingStatus.Confirmed,
            Notes = input.Notes
        };
        db.Bookings.Add(booking);

        var workOrder = new WorkOrder
        {
            TenantId = tenant.Id,
            Booking = booking,
            Customer = customer,
            Vehicle = vehicle,
            ServiceTypeId = service.Id,
            ServiceType = service,
            Stage = WorkOrderStage.Booked,
            Notes = input.Notes
        };
        customer.TotalVisits++;
        db.WorkOrders.Add(workOrder);
        await db.SaveChangesAsync();
        await tx.CommitAsync();

        await events.BroadcastToTenantAsync(tenant.Id, new BoardEvent("work_order_created", new
        {
            workOrder = WorkOrderMappings.ToCard(workOrder)
        }));

        return new
        {
            bookingId = booking.Id,
            workOrderId = workOrder.Id,
            workOrder.TrackingToken,
            trackingUrl = $"/track/{workOrder.TrackingToken}",
            customer = new { customer.Id, customer.FullName, customer.Phone },
            vehicle = vehicle is null ? null : new
            {
                vehicle.Id,
                vehicle.PlateNumber,
                vehicle.Make,
                vehicle.Model,
                vehicle.Color,
                vehicle.VehicleType
            },
            booking.ScheduledAt,
            serviceName = service.Name
        };
    }

    private async Task<Tenant> GetTenantAsync(string tenantSlug, bool asNoTracking)
    {
        var slug = RequireText(tenantSlug, "Shop").Trim().ToLowerInvariant();
        var query = db.Tenants.Where(t => t.Slug == slug && t.IsActive);
        if (asNoTracking)
            query = query.AsNoTracking();

        return await query.FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Shop not found.");
    }

    private async Task<ServiceType> GetActiveServiceAsync(Guid tenantId, Guid serviceTypeId)
    {
        return await db.ServiceTypes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == serviceTypeId && s.IsActive)
            ?? throw new ArgumentException("Invalid service type.");
    }

    private static void EnsureWithinBusinessHours(
        DateTimeOffset localScheduledAt,
        int durationMinutes,
        TimeOnly opensAt,
        TimeOnly closesAt)
    {
        var localStart = TimeOnly.FromDateTime(localScheduledAt.DateTime);
        var localEnd = TimeOnly.FromDateTime(localScheduledAt.AddMinutes(durationMinutes).DateTime);
        var sameDay = DateOnly.FromDateTime(localScheduledAt.DateTime) ==
            DateOnly.FromDateTime(localScheduledAt.AddMinutes(durationMinutes).DateTime);

        if (!sameDay || localStart < opensAt || localEnd > closesAt)
            throw new ArgumentException("Selected time must fit inside business hours.");
    }

    private static string NormalizePhone(string phone) => new(RequireText(phone, "Customer phone").Where(char.IsDigit).ToArray());

    private static string MaskPlate(string plate)
    {
        var normalized = plate.Trim();
        var suffix = normalized.Length <= 2 ? normalized : normalized[^2..];
        return $"••••{suffix}";
    }

    private static string RequireText(string? value, string name) =>
        string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"{name} is required.") : value;
}
