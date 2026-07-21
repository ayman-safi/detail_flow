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
                vehicle = b.Vehicle == null ? null : new
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
        var notes = input.Notes;
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
        else if (!string.Equals(customer.FullName, customerName, StringComparison.OrdinalIgnoreCase))
        {
            notes = string.IsNullOrWhiteSpace(notes)
                ? $"[Booked under name: {customerName}]"
                : $"[Booked under name: {customerName}]\n{notes}";
        }

        var vehicle = await db.Vehicles.FirstOrDefaultAsync(v => v.PlateNumber == plate);
        if (vehicle is null)
        {
            vehicle = new Vehicle
            {
                TenantId = tenantContext.TenantId,
                Customer = customer,
                PlateNumber = plate,
                Make = vehicleMake,
                Model = vehicleModel,
                Color = vehicleColor,
                VehicleType = input.VehicleType
            };
            db.Vehicles.Add(vehicle);
        }

        var booking = new Booking
        {
            TenantId = tenantContext.TenantId,
            Customer = customer,
            Vehicle = vehicle,
            ServiceTypeId = service.Id,
            ScheduledAt = scheduledAt,
            Status = BookingStatus.Confirmed,
            Notes = notes
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
            Notes = notes
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

    public async Task<object> UpdateAsync(Guid id, BookingUpdateRequest input)
    {
        var booking = await db.Bookings
            .Include(b => b.Customer)
            .Include(b => b.Vehicle)
            .Include(b => b.ServiceType)
            .FirstOrDefaultAsync(b => b.Id == id)
            ?? throw new KeyNotFoundException("Booking not found.");
        var workOrder = await GetLinkedWorkOrderAsync(id);

        EnsureBookingCanBeEdited(booking, workOrder);

        var service = await db.ServiceTypes.FirstOrDefaultAsync(s => s.Id == input.ServiceTypeId && s.IsActive)
            ?? throw new ArgumentException("Invalid service type.");
        var scheduledAt = await ValidateScheduleAsync(input.ScheduledAt, service, booking.Status == BookingStatus.Confirmed, booking.Id);

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var oldCustomer = booking.Customer;
        var customer = await ResolveCustomerAsync(input.CustomerName, input.CustomerPhone, oldCustomer);
        var vehicle = await ResolveVehicleAsync(input, customer, booking.Vehicle);

        if (workOrder is not null && workOrder.CustomerId != customer.Id)
        {
            DecrementVisits(oldCustomer);
            IncrementVisits(customer);
        }

        booking.Customer = customer;
        booking.CustomerId = customer.Id;
        booking.Vehicle = vehicle;
        booking.VehicleId = vehicle.Id;
        booking.ServiceType = service;
        booking.ServiceTypeId = service.Id;
        booking.ScheduledAt = scheduledAt;
        booking.Notes = input.Notes;

        if (workOrder is not null)
        {
            workOrder.Customer = customer;
            workOrder.CustomerId = customer.Id;
            workOrder.Vehicle = vehicle;
            workOrder.VehicleId = vehicle.Id;
            workOrder.ServiceType = service;
            workOrder.ServiceTypeId = service.Id;
            workOrder.Notes = input.Notes;
            workOrder.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        if (workOrder is not null)
            await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("work_order_updated", new
            {
                workOrder = WorkOrderMappings.ToCard(workOrder)
            }));

        return await GetByIdAsync(id);
    }

    public async Task<object> CompleteVehicleAsync(Guid id, BookingVehicleRequest input)
    {
        var booking = await db.Bookings
            .Include(b => b.Customer)
            .Include(b => b.Vehicle)
            .FirstOrDefaultAsync(b => b.Id == id)
            ?? throw new KeyNotFoundException("Booking not found.");
        var workOrder = await GetLinkedWorkOrderAsync(id)
            ?? throw new KeyNotFoundException("Linked work order not found.");
        EnsureBookingCanBeEdited(booking, workOrder);

        var plate = RequireText(input.VehiclePlate, "Vehicle plate").Trim().ToUpperInvariant();
        var vehicle = await db.Vehicles.FirstOrDefaultAsync(v => v.PlateNumber == plate);
        if (vehicle is null)
        {
            vehicle = new Vehicle { TenantId = tenantContext.TenantId, PlateNumber = plate };
            db.Vehicles.Add(vehicle);
        }

        vehicle.Customer = booking.Customer;
        vehicle.CustomerId = booking.CustomerId;
        vehicle.Make = RequireText(input.VehicleMake, "Vehicle make").Trim();
        vehicle.Model = RequireText(input.VehicleModel, "Vehicle model").Trim();
        vehicle.Color = RequireText(input.VehicleColor, "Vehicle color").Trim();
        vehicle.VehicleType = input.VehicleType;
        booking.Vehicle = vehicle;
        workOrder.Vehicle = vehicle;
        workOrder.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        var card = WorkOrderMappings.ToCard(workOrder);
        await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("work_order_updated", new { workOrder = card }));
        return card;
    }

    public async Task<object> UpdateStatusAsync(Guid id, BookingStatusRequest input)
    {
        var booking = await db.Bookings
            .Include(b => b.Customer)
            .Include(b => b.Vehicle)
            .Include(b => b.ServiceType)
            .FirstOrDefaultAsync(b => b.Id == id)
            ?? throw new KeyNotFoundException("Booking not found.");
        var workOrder = await GetLinkedWorkOrderAsync(id);

        if (booking.Status == input.Status)
            return ToStatusResult(booking, workOrder);

        if (booking.Status == BookingStatus.Cancelled)
            throw new ConflictException("Cancelled bookings cannot be changed.");

        if (input.Status == BookingStatus.Pending)
            throw new ConflictException("Bookings cannot be moved back to pending.");

        if (input.Status == BookingStatus.Confirmed)
            return await ConfirmAsync(booking, workOrder);

        if (input.Status == BookingStatus.Cancelled)
            return await CancelAsync(booking, workOrder);

        booking.Status = input.Status;
        await db.SaveChangesAsync();
        return ToStatusResult(booking, workOrder);
    }

    private async Task<object> ConfirmAsync(Booking booking, WorkOrder? workOrder)
    {
        var service = await db.ServiceTypes.FirstOrDefaultAsync(s => s.Id == booking.ServiceTypeId && s.IsActive)
            ?? throw new ArgumentException("Invalid service type.");
        await ValidateScheduleAsync(booking.ScheduledAt, service, true, booking.Id);

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        booking.Status = BookingStatus.Confirmed;
        if (workOrder is null)
        {
            workOrder = new WorkOrder
            {
                TenantId = tenantContext.TenantId,
                Booking = booking,
                Customer = booking.Customer,
                Vehicle = booking.Vehicle,
                ServiceTypeId = booking.ServiceTypeId,
                ServiceType = booking.ServiceType,
                Stage = WorkOrderStage.Booked,
                Notes = booking.Notes
            };
            IncrementVisits(booking.Customer);
            db.WorkOrders.Add(workOrder);
        }
        await db.SaveChangesAsync();
        await tx.CommitAsync();

        await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("work_order_created", new
        {
            workOrder = WorkOrderMappings.ToCard(workOrder)
        }));

        return ToStatusResult(booking, workOrder);
    }

    private async Task<object> CancelAsync(Booking booking, WorkOrder? workOrder)
    {
        if (booking.Status == BookingStatus.Cancelled)
            return ToStatusResult(booking, workOrder);

        Guid? removedWorkOrderId = null;
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        booking.Status = BookingStatus.Cancelled;
        if (workOrder is not null)
        {
            EnsureWorkOrderCanBeCancelled(workOrder);
            removedWorkOrderId = workOrder.Id;
            DecrementVisits(booking.Customer);
            db.WorkOrders.Remove(workOrder);
        }
        await db.SaveChangesAsync();
        await tx.CommitAsync();

        if (removedWorkOrderId.HasValue)
            await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("work_order_removed", new
            {
                workOrderId = removedWorkOrderId.Value
            }));

        return ToStatusResult(booking, null);
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
            customer = new { booking.Customer.Id, booking.Customer.FullName, booking.Customer.Phone },
            vehicle = booking.Vehicle is null ? null : new
            {
                booking.Vehicle.Id,
                booking.Vehicle.PlateNumber,
                booking.Vehicle.Make,
                booking.Vehicle.Model,
                booking.Vehicle.Color,
                booking.Vehicle.VehicleType
            },
            serviceType = new
            {
                booking.ServiceType.Id,
                booking.ServiceType.Name,
                booking.ServiceType.Description,
                booking.ServiceType.BasePrice,
                booking.ServiceType.DurationMinutes,
                booking.ServiceType.IsActive,
                booking.ServiceType.SortOrder
            },
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
            query = query.Where(c => (c.FullName != null && EF.Functions.ILike(c.FullName, term)) || EF.Functions.ILike(c.Phone, term));
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
                vehiclePlate = w.Vehicle == null ? null : w.Vehicle.PlateNumber
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

    private async Task<WorkOrder?> GetLinkedWorkOrderAsync(Guid bookingId)
    {
        return await db.WorkOrders
            .Include(w => w.Booking)
            .Include(w => w.Customer)
            .Include(w => w.Vehicle)
            .Include(w => w.ServiceType)
            .Include(w => w.AssignedStaff)
            .Include(w => w.Photos)
            .Include(w => w.StageHistory)
            .FirstOrDefaultAsync(w => w.BookingId == bookingId);
    }

    private static void EnsureBookingCanBeEdited(Booking booking, WorkOrder? workOrder)
    {
        if (booking.Status == BookingStatus.Cancelled)
            throw new ConflictException("Cancelled bookings cannot be edited.");

        if (workOrder is not null && workOrder.Stage != WorkOrderStage.Booked)
            throw new ConflictException("Bookings cannot be edited after work has started.");
    }

    private static void EnsureWorkOrderCanBeCancelled(WorkOrder workOrder)
    {
        if (workOrder.Stage != WorkOrderStage.Booked)
            throw new ConflictException("Bookings cannot be cancelled after work has started.");

        if (workOrder.Photos.Count > 0 || workOrder.StageHistory.Count > 0 || workOrder.ActualPrice.HasValue || workOrder.PaymentStatus != PaymentStatus.Pending)
            throw new ConflictException("Booking cannot be cancelled after work order activity has been recorded.");
    }

    private async Task<DateTimeOffset> ValidateScheduleAsync(
        DateTimeOffset localScheduledAt,
        ServiceType service,
        bool enforceCapacity,
        Guid? excludeBookingId)
    {
        var scheduledAt = localScheduledAt.ToUniversalTime();
        if (scheduledAt <= DateTimeOffset.UtcNow)
            throw new ArgumentException("Scheduled time must be in the future.");

        var localDay = DateOnly.FromDateTime(localScheduledAt.DateTime);
        if (await tenantSettings.IsClosedAsync(localDay))
            throw new ArgumentException("Shop is closed on this date.");

        var workingDay = await tenantSettings.GetWorkingDayAsync(localDay);
        if (workingDay is null)
            throw new ArgumentException("Shop is closed on this day.");

        EnsureWithinBusinessHours(localScheduledAt, service.DurationMinutes, workingDay.OpenTime, workingDay.CloseTime);

        if (!enforceCapacity)
            return scheduledAt;

        var settings = await tenantSettings.GetAsync();
        var businessStart = new DateTimeOffset(localDay.ToDateTime(workingDay.OpenTime), localScheduledAt.Offset).ToUniversalTime();
        var businessEnd = new DateTimeOffset(localDay.ToDateTime(workingDay.CloseTime), localScheduledAt.Offset).ToUniversalTime();
        var sameDayBookings = await db.Bookings
            .Include(b => b.ServiceType)
            .Where(b => b.Status == BookingStatus.Confirmed && b.ScheduledAt >= businessStart && b.ScheduledAt < businessEnd)
            .Where(b => excludeBookingId == null || b.Id != excludeBookingId.Value)
            .ToListAsync();
        var slotCount = CountOverlappingBookings(sameDayBookings, scheduledAt, service.DurationMinutes);
        if (slotCount >= settings.BayCapacity)
            throw new ConflictException("Selected time slot is full.");

        return scheduledAt;
    }

    private async Task<Customer> ResolveCustomerAsync(string customerNameInput, string customerPhoneInput, Customer currentCustomer)
    {
        var phone = NormalizePhone(customerPhoneInput);
        if (phone.Length < 7)
            throw new ArgumentException("Customer phone must include at least 7 digits.");

        var customerName = RequireText(customerNameInput, "Customer name").Trim();
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Phone == phone);
        if (customer is null)
        {
            currentCustomer.Phone = phone;
            currentCustomer.FullName = customerName;
            return currentCustomer;
        }

        customer.FullName = customerName;
        return customer;
    }

    private async Task<Vehicle> ResolveVehicleAsync(BookingUpdateRequest input, Customer customer, Vehicle? currentVehicle)
    {
        var plate = RequireText(input.VehiclePlate, "Vehicle plate").Trim().ToUpperInvariant();
        var vehicle = await db.Vehicles.FirstOrDefaultAsync(v => v.PlateNumber == plate);
        if (vehicle is null)
        {
            vehicle = currentVehicle ?? new Vehicle { TenantId = tenantContext.TenantId };
            vehicle.PlateNumber = plate;
            if (currentVehicle is null)
                db.Vehicles.Add(vehicle);
        }

        vehicle.Customer = customer;
        vehicle.CustomerId = customer.Id;
        vehicle.Make = RequireText(input.VehicleMake, "Vehicle make").Trim();
        vehicle.Model = RequireText(input.VehicleModel, "Vehicle model").Trim();
        vehicle.Color = RequireText(input.VehicleColor, "Vehicle color").Trim();
        vehicle.VehicleType = input.VehicleType;
        return vehicle;
    }

    private static object ToStatusResult(Booking booking, WorkOrder? workOrder) => new
    {
        booking.Id,
        booking.Status,
        workOrderId = workOrder?.Id,
        trackingToken = workOrder?.TrackingToken
    };

    private static void IncrementVisits(Customer customer)
    {
        customer.TotalVisits++;
    }

    private static void DecrementVisits(Customer customer)
    {
        customer.TotalVisits = Math.Max(0, customer.TotalVisits - 1);
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
