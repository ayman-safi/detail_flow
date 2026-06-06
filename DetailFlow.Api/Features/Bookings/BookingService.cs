using System.Data;
using DetailFlow.Api.Data;
using DetailFlow.Api.Infrastructure;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using DetailFlow.Api.Features.Plans;
using DetailFlow.Api.Features.WorkOrders;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.Bookings;

public class BookingService(
    DetailFlowDbContext db,
    ITenantContext tenantContext,
    TenantSettingsService tenantSettings,
    BoardEventService events,
    PlanEnforcementService planEnforcement)
{
    public async Task<IReadOnlyList<object>> ListAsync(DateTime? date, int? timezoneOffsetMinutes)
    {
        var localOffset = TimeSpan.FromMinutes(-(timezoneOffsetMinutes ?? 0));
        var day = DateOnly.FromDateTime(date ?? DateTime.UtcNow);
        var start = new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), localOffset).ToUniversalTime();
        var end = start.AddDays(1);

        return await db.Bookings
            .Include(b => b.Customer)
            .Include(b => b.Vehicle)
            .Include(b => b.ServiceType)
            .Where(b => b.ScheduledAt >= start && b.ScheduledAt < end)
            .OrderBy(b => b.ScheduledAt)
            .Select(b => (object)new
            {
                b.Id,
                b.ScheduledAt,
                b.Status,
                serviceName = b.ServiceType.Name,
                b.ServiceType.DurationMinutes,
                customer = new { b.Customer.Id, b.Customer.FullName, b.Customer.Phone },
                vehicle = new
                {
                    b.Vehicle.Id,
                    b.Vehicle.PlateNumber,
                    b.Vehicle.Make,
                    b.Vehicle.Model,
                    b.Vehicle.Color,
                    b.Vehicle.VehicleType
                },
                workOrderId = db.WorkOrders.Where(w => w.BookingId == b.Id).Select(w => (Guid?)w.Id).FirstOrDefault(),
                trackingToken = db.WorkOrders.Where(w => w.BookingId == b.Id).Select(w => w.TrackingToken).FirstOrDefault()
            })
            .ToListAsync();
    }

    public async Task<IReadOnlyList<object>> GetAvailabilityAsync(DateTime date, Guid serviceTypeId, int? timezoneOffsetMinutes)
    {
        var service = await db.ServiceTypes.FirstOrDefaultAsync(s => s.Id == serviceTypeId && s.IsActive)
            ?? throw new ArgumentException("Invalid service type.");

        var localOffset = TimeSpan.FromMinutes(-(timezoneOffsetMinutes ?? 0));
        var day = DateOnly.FromDateTime(date);
        if (await tenantSettings.IsClosedAsync(day))
            return [];
        var workingDay = await tenantSettings.GetWorkingDayAsync(day);
        if (workingDay is null)
            return [];
        var settings = await tenantSettings.GetAsync();
        var localStart = new DateTimeOffset(day.ToDateTime(workingDay.OpenTime), localOffset);
        var localEnd = new DateTimeOffset(day.ToDateTime(workingDay.CloseTime), localOffset);
        var start = localStart.ToUniversalTime();
        var end = localEnd.ToUniversalTime();
        var confirmed = await db.Bookings
            .Include(b => b.ServiceType)
            .Where(b => b.Status == BookingStatus.Confirmed && b.ScheduledAt >= start && b.ScheduledAt < end)
            .ToListAsync();

        var slotCount = Math.Max(0, (int)Math.Floor((localEnd - localStart).TotalMinutes / 30) + 1);
        return Enumerable.Range(0, slotCount)
            .Select(i => localStart.AddMinutes(i * 30))
            .Where(slot => slot.AddMinutes(service.DurationMinutes) <= localEnd)
            .Select(i =>
            {
                var slot = i.ToUniversalTime();
                var count = CountOverlappingBookings(confirmed, slot, service.DurationMinutes);
                return (object)new
                {
                    time = i.ToString("HH:mm"),
                    available = count < settings.BayCapacity,
                    bookingCount = count
                };
            })
            .ToList();
    }

    public async Task<object> CreateAsync(BookingCreateRequest input)
    {
        var localScheduledAt = input.ScheduledAt;
        var scheduledAt = localScheduledAt.ToUniversalTime();
        if (scheduledAt <= DateTimeOffset.UtcNow)
            throw new ArgumentException("Scheduled time must be in the future.");

        var phone = NormalizePhone(input.CustomerPhone);
        if (phone.Length < 7)
            throw new ArgumentException("Customer phone must include at least 7 digits.");
        var plate = RequireText(input.VehiclePlate, "Vehicle plate").Trim().ToUpperInvariant();
        var customerName = RequireText(input.CustomerName, "Customer name").Trim();
        var vehicleMake = RequireText(input.VehicleMake, "Vehicle make").Trim();
        var vehicleModel = RequireText(input.VehicleModel, "Vehicle model").Trim();
        var vehicleColor = RequireText(input.VehicleColor, "Vehicle color").Trim();
        var service = await db.ServiceTypes.FirstOrDefaultAsync(s => s.Id == input.ServiceTypeId && s.IsActive)
            ?? throw new ArgumentException("Invalid service type.");

        var localDay = DateOnly.FromDateTime(localScheduledAt.DateTime);
        if (await tenantSettings.IsClosedAsync(localDay))
            throw new ArgumentException("Shop is closed on this date.");
        var workingDay = await tenantSettings.GetWorkingDayAsync(localDay);
        if (workingDay is null)
            throw new ArgumentException("Shop is closed on this day.");
        var settings = await tenantSettings.GetAsync();

        EnsureWithinBusinessHours(localScheduledAt, service.DurationMinutes, workingDay.OpenTime, workingDay.CloseTime);

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await planEnforcement.AssertCanBookAsync(tenantContext.TenantId);
        var businessStart = new DateTimeOffset(localDay.ToDateTime(workingDay.OpenTime), localScheduledAt.Offset).ToUniversalTime();
        var businessEnd = new DateTimeOffset(localDay.ToDateTime(workingDay.CloseTime), localScheduledAt.Offset).ToUniversalTime();
        var sameDayBookings = await db.Bookings
            .Include(b => b.ServiceType)
            .Where(b => b.Status == BookingStatus.Confirmed && b.ScheduledAt >= businessStart && b.ScheduledAt < businessEnd)
            .ToListAsync();
        var slotCount = CountOverlappingBookings(sameDayBookings, scheduledAt, service.DurationMinutes);
        if (slotCount >= settings.BayCapacity)
            throw new ConflictException("Selected time slot is full.");

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Phone == phone);
        if (customer is null)
        {
            customer = new Customer
            {
                TenantId = tenantContext.TenantId,
                FullName = customerName,
                Phone = phone
            };
            db.Customers.Add(customer);
        }
        else
        {
            customer.FullName = customerName;
        }

        var vehicle = await db.Vehicles.FirstOrDefaultAsync(v => v.PlateNumber == plate);
        if (vehicle is null)
        {
            vehicle = new Vehicle
            {
                TenantId = tenantContext.TenantId,
                Customer = customer,
                PlateNumber = plate
            };
            db.Vehicles.Add(vehicle);
        }

        vehicle.Make = vehicleMake;
        vehicle.Model = vehicleModel;
        vehicle.Color = vehicleColor;
        vehicle.VehicleType = input.VehicleType;

        var booking = new Booking
        {
            TenantId = tenantContext.TenantId,
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
            TenantId = tenantContext.TenantId,
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

        await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("work_order_created", new
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
            vehicle = new
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

    public async Task<object> UpdateStatusAsync(Guid id, BookingStatusRequest input)
    {
        if (tenantContext.Role is not (UserRole.Manager or UserRole.Owner))
            throw new UnauthorizedAccessException("Manager or Owner role required to update booking status.");

        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id)
            ?? throw new KeyNotFoundException("Booking not found.");
        booking.Status = input.Status;
        var workOrder = await WorkOrderMappings.BaseQuery(db)
            .FirstOrDefaultAsync(w => w.BookingId == id);
        await db.SaveChangesAsync();

        if (workOrder is not null)
        {
            var shouldHideFromBoard = workOrder.Stage == WorkOrderStage.Booked && input.Status != BookingStatus.Confirmed;
            await events.BroadcastToTenantAsync(tenantContext.TenantId, shouldHideFromBoard
                ? new BoardEvent("work_order_removed", new { workOrderId = workOrder.Id })
                : new BoardEvent("work_order_updated", new { workOrder = WorkOrderMappings.ToCard(workOrder) }));
        }

        return new { booking.Id, booking.Status };
    }

    public async Task<object> GetByIdAsync(Guid id)
    {
        var booking = await db.Bookings
            .Include(b => b.Customer)
            .Include(b => b.Vehicle)
            .Include(b => b.ServiceType)
            .FirstOrDefaultAsync(b => b.Id == id)
            ?? throw new KeyNotFoundException("Booking not found.");
        var workOrder = await db.WorkOrders.Include(w => w.Photos).FirstOrDefaultAsync(w => w.BookingId == id);

        return new
        {
            booking.Id,
            booking.ScheduledAt,
            booking.Status,
            booking.Notes,
            booking.Customer,
            booking.Vehicle,
            booking.ServiceType,
            workOrder = workOrder is null ? null : new
            {
                workOrder.Id,
                workOrder.Stage,
                photosCount = workOrder.Photos.Count
            }
        };
    }

    public async Task<object> ListCustomersAsync(string? search, int? page, int? limit)
    {
        var pageValue = Math.Max(page ?? 1, 1);
        var limitValue = Math.Clamp(limit ?? 20, 1, 50);
        var query = db.Customers.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(c => EF.Functions.ILike(c.FullName, term) || EF.Functions.ILike(c.Phone, term));
        }

        var total = await query.CountAsync();
        var customers = await query
            .OrderBy(c => c.FullName)
            .Skip((pageValue - 1) * limitValue)
            .Take(limitValue)
            .ToListAsync();
        var customerIds = customers.Select(c => c.Id).ToList();
        var recentWorkOrdersByCustomer = await db.WorkOrders
            .Where(w => customerIds.Contains(w.CustomerId))
            .OrderByDescending(w => w.CreatedAt)
            .Select(w => new
            {
                w.CustomerId,
                w.Id,
                w.Stage,
                w.CreatedAt,
                serviceName = w.ServiceType.Name,
                vehiclePlate = w.Vehicle.PlateNumber
            })
            .ToListAsync();

        var items = customers.Select(c =>
        {
            var recentWorkOrders = recentWorkOrdersByCustomer
                .Where(w => w.CustomerId == c.Id)
                .Take(5)
                .Select(w => new
                {
                    w.Id,
                    w.Stage,
                    w.CreatedAt,
                    w.serviceName,
                    w.vehiclePlate
                })
                .ToList();

            return new
            {
                c.Id,
                c.FullName,
                c.Phone,
                c.TotalVisits,
                c.CreatedAt,
                lastVisitAt = recentWorkOrders.Select(w => (DateTimeOffset?)w.CreatedAt).FirstOrDefault(),
                recentWorkOrders
            };
        }).ToList();

        return new { items, total, page = pageValue, limit = limitValue };
    }

    public static int CountOverlappingBookings(IEnumerable<Booking> bookings, DateTimeOffset slotStart, int durationMinutes)
    {
        var slotEnd = slotStart.AddMinutes(durationMinutes);
        return bookings.Count(booking =>
        {
            var bookingEnd = booking.ScheduledAt.AddMinutes(booking.ServiceType.DurationMinutes);
            return booking.ScheduledAt < slotEnd && bookingEnd > slotStart;
        });
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

    private static string RequireText(string? value, string name) =>
        string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"{name} is required.") : value;
}
