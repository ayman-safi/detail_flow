using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using DetailFlow.Api.Data;
using DetailFlow.Api.Features.Notifications;
using DetailFlow.Api.Features.Plans;
using DetailFlow.Api.Infrastructure;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace DetailFlow.Api.Features.WorkOrders;

public class WorkOrderService(
    DetailFlowDbContext db,
    ITenantContext tenantContext,
    BoardEventService events,
    ReceiptService receipts,
    WhatsAppNotificationService whatsappNotifications,
    PlanEnforcementService planEnforcement,
    IMemoryCache cache)
{
    private const int MissingTrackingTokenDbMissThreshold = 2;
    private static readonly TimeSpan MissingTrackingTokenAttemptWindow = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan MissingTrackingTokenSuppressionWindow = TimeSpan.FromMinutes(10);
    private static readonly JsonSerializerOptions SseJson = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public async Task<object> GetBoardAsync()
    {
        var cutoff = DateTimeOffset.UtcNow.AddHours(-24);
        var orders = await WorkOrderMappings.BaseQuery(db)
            .Where(w => w.Booking == null || w.Booking.Status == BookingStatus.Confirmed || w.Stage != WorkOrderStage.Booked)
            .Where(w => w.Stage != WorkOrderStage.Delivered || w.UpdatedAt >= cutoff)
            .OrderBy(w => w.CreatedAt)
            .ToListAsync();
        var cards = orders.Select(WorkOrderMappings.ToCard).ToList();

        IEnumerable<WorkOrderCardDto> Pick(WorkOrderStage stage) => cards.Where(card => card.Stage == stage);

        return new
        {
            booked = Pick(WorkOrderStage.Booked),
            arrived = Pick(WorkOrderStage.Arrived),
            washing = Pick(WorkOrderStage.Washing),
            detailing = Pick(WorkOrderStage.Detailing),
            polishing = Pick(WorkOrderStage.Polishing),
            ready = Pick(WorkOrderStage.Ready),
            delivered = Pick(WorkOrderStage.Delivered)
        };
    }

    public async Task<WorkOrderCardDto> ChangeStageAsync(Guid id, StageChangeRequest input)
    {
        var workOrder = await WorkOrderMappings.BaseQuery(db).AsNoTracking().FirstOrDefaultAsync(w => w.Id == id)
            ?? throw new KeyNotFoundException("Work order not found.");
        var fromStage = workOrder.Stage;
        WorkOrderMappings.ValidateTransition(fromStage, input.NewStage, workOrder.PaymentStatus);

        var updatedAt = DateTimeOffset.UtcNow;
        var readyAt = input.NewStage == WorkOrderStage.Ready ? updatedAt.AddMinutes(30) : (DateTimeOffset?)null;

        await using (var tx = await db.Database.BeginTransactionAsync())
        {
            var changed = await db.WorkOrders
                .Where(w => w.Id == id && w.Stage == fromStage)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(w => w.Stage, input.NewStage)
                    .SetProperty(w => w.UpdatedAt, updatedAt)
                    .SetProperty(w => w.EstimatedReadyAt, w => readyAt != null && w.EstimatedReadyAt == null ? readyAt : w.EstimatedReadyAt));

            if (changed == 0)
            {
                var stillExists = await db.WorkOrders.AnyAsync(w => w.Id == id);
                if (!stillExists)
                    throw new KeyNotFoundException("Work order not found.");

                throw new ConflictException("Work order was changed by another user. Refresh the board and try again.");
            }

            db.WorkOrderStageHistory.Add(new WorkOrderStageHistory
            {
                WorkOrderId = workOrder.Id,
                FromStage = fromStage,
                ToStage = input.NewStage,
                ChangedByUserId = tenantContext.UserId,
                ChangedByName = tenantContext.UserName
            });

            await db.SaveChangesAsync();
            await tx.CommitAsync();
        }

        var updatedWorkOrder = await WorkOrderMappings.BaseQuery(db).AsNoTracking().FirstOrDefaultAsync(w => w.Id == id)
            ?? throw new KeyNotFoundException("Work order not found.");
        var card = WorkOrderMappings.ToCard(updatedWorkOrder);

        await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("stage_changed", new
        {
            workOrderId = updatedWorkOrder.Id,
            fromStage,
            toStage = input.NewStage,
            workOrder = card
        }));
        await events.BroadcastToTokenAsync(updatedWorkOrder.TrackingToken, new BoardEvent("stage_changed", new
        {
            workOrderId = updatedWorkOrder.Id,
            fromStage,
            toStage = input.NewStage,
            newStage = input.NewStage,
            newStageName = WorkOrderMappings.Humanize(input.NewStage),
            estimatedReadyAt = GetPublicEstimatedReadyAt(updatedWorkOrder),
            lastUpdatedAt = updatedWorkOrder.UpdatedAt
        }));

        if (fromStage != WorkOrderStage.Ready && input.NewStage == WorkOrderStage.Ready)
            await whatsappNotifications.TryAutoSendReadyAsync(updatedWorkOrder.Id);

        return card;
    }

    public async Task<WorkOrderCardDto> CreateWalkInAsync(WalkInCreateRequest input)
    {
        var phone = NormalizePhone(input.CustomerPhone);
        var plate = RequireText(input.VehiclePlate, "Vehicle plate").Trim().ToUpperInvariant();
        var customerName = RequireText(input.CustomerName, "Customer name").Trim();
        var vehicleMake = RequireText(input.VehicleMake, "Vehicle make").Trim();
        var vehicleModel = RequireText(input.VehicleModel, "Vehicle model").Trim();
        var vehicleColor = RequireText(input.VehicleColor, "Vehicle color").Trim();
        if (phone.Length < 7)
            throw new ArgumentException("Customer phone must include at least 7 digits.");

        var service = await db.ServiceTypes.FirstOrDefaultAsync(s => s.Id == input.ServiceTypeId && s.IsActive)
            ?? throw new ArgumentException("Invalid service type.");

        await using var tx = await db.Database.BeginTransactionAsync();
        await planEnforcement.AssertCanBookAsync(tenantContext.TenantId);
        
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Phone == phone);
        var notes = input.Notes;
        if (customer is null)
        {
            customer = new Customer { TenantId = tenantContext.TenantId, FullName = customerName, Phone = phone };
            db.Customers.Add(customer);
        }
        else if (!string.Equals(customer.FullName, customerName, StringComparison.OrdinalIgnoreCase))
        {
            notes = string.IsNullOrWhiteSpace(notes)
                ? $"[Walk-in under name: {customerName}]"
                : $"[Walk-in under name: {customerName}]\n{notes}";
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

        var workOrder = new WorkOrder
        {
            TenantId = tenantContext.TenantId,
            Customer = customer,
            Vehicle = vehicle,
            ServiceTypeId = service.Id,
            Stage = WorkOrderStage.Arrived,
            Notes = notes
        };
        customer.TotalVisits++;
        db.WorkOrders.Add(workOrder);
        await db.SaveChangesAsync();
        await tx.CommitAsync();

        workOrder.Customer = customer;
        workOrder.Vehicle = vehicle;
        workOrder.ServiceType = service;
        var card = WorkOrderMappings.ToCard(workOrder);
        await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("work_order_created", new
        {
            workOrder = card
        }));
        return card;
    }

    public async Task<object> GetByIdAsync(Guid id)
    {
        var workOrder = await WorkOrderMappings.BaseQuery(db)
            .Include(w => w.StageHistory)
            .FirstOrDefaultAsync(w => w.Id == id)
            ?? throw new KeyNotFoundException("Work order not found.");

        return new
        {
            card = WorkOrderMappings.ToCard(workOrder),
            photos = new
            {
                before = workOrder.Photos.Where(p => p.Type == PhotoType.Before).OrderBy(p => p.UploadedAt).Select(PhotoDto.From),
                after = workOrder.Photos.Where(p => p.Type == PhotoType.After).OrderBy(p => p.UploadedAt).Select(PhotoDto.From)
            },
            stageHistory = workOrder.StageHistory
                .OrderBy(h => h.ChangedAt)
                .Select(h => new { h.FromStage, h.ToStage, h.ChangedByName, h.ChangedAt })
        };
    }

    public async Task<WorkOrderCardDto> AssignAsync(Guid id, AssignRequest input)
    {
        EnsureManagerOrOwner();
        if (input.StaffUserId.HasValue)
        {
            _ = await db.Users.FirstOrDefaultAsync(u => u.Id == input.StaffUserId.Value && u.IsActive)
                ?? throw new ArgumentException("Staff member not found.");
        }

        var updatedAt = DateTimeOffset.UtcNow;
        var changed = await db.WorkOrders
            .Where(w => w.Id == id)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(w => w.AssignedStaffId, input.StaffUserId)
                .SetProperty(w => w.UpdatedAt, updatedAt));

        if (changed == 0)
            throw new KeyNotFoundException("Work order not found.");

        var workOrder = await WorkOrderMappings.BaseQuery(db).AsNoTracking().FirstOrDefaultAsync(w => w.Id == id)
            ?? throw new KeyNotFoundException("Work order not found.");
        var card = WorkOrderMappings.ToCard(workOrder);
        await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("work_order_updated", new
        {
            workOrder = card
        }));
        return card;
    }

    public async Task<WorkOrderCardDto> UpdatePriceAsync(Guid id, PriceRequest input)
    {
        EnsureManagerOrOwner();
        if (input.ActualPrice < 0)
            throw new ArgumentException("Price cannot be negative.");

        var updatedAt = DateTimeOffset.UtcNow;
        var changed = await db.WorkOrders
            .Where(w => w.Id == id)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(w => w.ActualPrice, input.ActualPrice)
                .SetProperty(w => w.Notes, w => input.Notes ?? w.Notes)
                .SetProperty(w => w.UpdatedAt, updatedAt));

        if (changed == 0)
            throw new KeyNotFoundException("Work order not found.");

        var workOrder = await WorkOrderMappings.BaseQuery(db).AsNoTracking().FirstOrDefaultAsync(w => w.Id == id)
            ?? throw new KeyNotFoundException("Work order not found.");
        var card = WorkOrderMappings.ToCard(workOrder);
        await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("work_order_updated", new
        {
            workOrder = card
        }));
        return card;
    }

    public async Task<WorkOrderCardDto> UpdatePaymentStatusAsync(Guid id, PaymentStatusRequest input)
    {
        EnsureManagerOrOwner();

        var updatedAt = DateTimeOffset.UtcNow;
        var changed = await db.WorkOrders
            .Where(w => w.Id == id)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(w => w.PaymentStatus, input.Status)
                .SetProperty(w => w.UpdatedAt, updatedAt));

        if (changed == 0)
            throw new KeyNotFoundException("Work order not found.");

        var workOrder = await WorkOrderMappings.BaseQuery(db).AsNoTracking().FirstOrDefaultAsync(w => w.Id == id)
            ?? throw new KeyNotFoundException("Work order not found.");
        var card = WorkOrderMappings.ToCard(workOrder);
        await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("work_order_updated", new
        {
            workOrder = card
        }));
        return card;
    }

    public async Task<object> GetTrackingAsync(string token)
    {
        token = NormalizeTrackingToken(token);
        ThrowIfMissingTrackingTokenSuppressed(token);
        var workOrder = await db.WorkOrders.IgnoreQueryFilters()
            .Include(w => w.Booking)
            .Include(w => w.Customer)
            .Include(w => w.Vehicle)
            .Include(w => w.ServiceType)
            .Include(w => w.Tenant)
            .FirstOrDefaultAsync(w => w.TrackingToken == token);

        if (workOrder is null)
        {
            RecordMissingTrackingToken(token);
            throw new KeyNotFoundException("Tracking token not found.");
        }

        ForgetMissingTrackingToken(token);

        return new
        {
            customerName = workOrder.Customer.FullName,
            vehicleMake = workOrder.Vehicle.Make,
            vehicleModel = workOrder.Vehicle.Model,
            vehicleColor = workOrder.Vehicle.Color,
            vehiclePlate = workOrder.Vehicle.PlateNumber,
            stage = workOrder.Stage,
            stageName = WorkOrderMappings.Humanize(workOrder.Stage),
            serviceName = workOrder.ServiceType.Name,
            estimatedReadyAt = GetPublicEstimatedReadyAt(workOrder),
            shopName = workOrder.Tenant.Name,
            shopLogoUrl = workOrder.Tenant.LogoUrl,
            lastUpdatedAt = workOrder.UpdatedAt
        };
    }

    private static DateTimeOffset? GetPublicEstimatedReadyAt(WorkOrder workOrder)
    {
        if (workOrder.Stage >= WorkOrderStage.Ready)
            return null;

        if (workOrder.EstimatedReadyAt.HasValue)
            return workOrder.EstimatedReadyAt;

        var durationMinutes = Math.Max(0, workOrder.ServiceType.DurationMinutes);
        var startsAt = workOrder.Booking?.ScheduledAt ?? workOrder.CreatedAt;
        return startsAt.AddMinutes(durationMinutes);
    }

    public async Task<ReceiptFileResult> GenerateReceiptAsync(Guid id, string? locale)
    {
        var workOrder = await WorkOrderMappings.BaseQuery(db)
            .Include(w => w.Tenant)
            .FirstOrDefaultAsync(w => w.Id == id)
            ?? throw new KeyNotFoundException("Work order not found.");

        var pdf = await receipts.GenerateReceiptAsync(workOrder, locale);
        var filename = $"receipt-{workOrder.Vehicle.PlateNumber}-{DateTime.UtcNow:yyyyMMdd}.pdf";
        return new ReceiptFileResult(pdf, filename);
    }

    public async Task<ReceiptFileResult> GeneratePublicReceiptAsync(string token, string? locale)
    {
        token = NormalizeTrackingToken(token);
        ThrowIfMissingTrackingTokenSuppressed(token);
        var workOrder = await db.WorkOrders
            .IgnoreQueryFilters()
            .Include(w => w.Customer)
            .Include(w => w.Vehicle)
            .Include(w => w.ServiceType)
            .Include(w => w.AssignedStaff)
            .Include(w => w.Tenant)
            .FirstOrDefaultAsync(w => w.TrackingToken == token);

        if (workOrder is null)
        {
            RecordMissingTrackingToken(token);
            throw new KeyNotFoundException("Tracking token not found.");
        }

        ForgetMissingTrackingToken(token);

        var pdf = await receipts.GenerateReceiptAsync(workOrder, locale);
        var filename = $"receipt-{workOrder.Vehicle.PlateNumber}-{DateTime.UtcNow:yyyyMMdd}.pdf";
        return new ReceiptFileResult(pdf, filename);
    }

    public Task<object> CreateManualTrackingShareAsync(Guid id, NotificationEventType? eventType, string? locale)
    {
        return whatsappNotifications.CreateManualTrackingShareAsync(id, eventType, locale);
    }

    public async Task StreamBoardAsync(HttpContext context, CancellationToken cancellationToken)
    {
        await SetupSseAsync(context);
        var channel = Channel.CreateBounded<BoardEvent>(new BoundedChannelOptions(64)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        });
        using var _ = events.SubscribeTenant(tenantContext.TenantId, new BoardSubscriber(Guid.NewGuid(), channel));
        await context.Response.WriteAsync("event: connected\ndata: {}\n\n", cancellationToken);
        await context.Response.Body.FlushAsync(cancellationToken);
        await StreamLoopAsync(context, channel, TimeSpan.FromSeconds(25), cancellationToken);
    }

    public async Task StreamTokenAsync(string token, HttpContext context, CancellationToken cancellationToken)
    {
        token = NormalizeTrackingToken(token);
        ThrowIfMissingTrackingTokenSuppressed(token);
        var exists = await db.WorkOrders.IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(w => w.TrackingToken == token, cancellationToken);
        if (!exists)
        {
            RecordMissingTrackingToken(token);
            throw new KeyNotFoundException("Tracking token not found.");
        }

        ForgetMissingTrackingToken(token);

        await SetupSseAsync(context);
        var channel = Channel.CreateBounded<BoardEvent>(new BoundedChannelOptions(32)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        });
        using var _ = events.SubscribeToken(token, new BoardSubscriber(Guid.NewGuid(), channel));
        await context.Response.WriteAsync("event: connected\ndata: {}\n\n", cancellationToken);
        await context.Response.Body.FlushAsync(cancellationToken);
        await StreamLoopAsync(context, channel, TimeSpan.FromSeconds(30), cancellationToken);
    }

    private static Task SetupSseAsync(HttpContext context)
    {
        context.Response.Headers.Append("Content-Type", "text/event-stream");
        context.Response.Headers.Append("Cache-Control", "no-cache");
        context.Response.Headers.Append("X-Accel-Buffering", "no");
        context.Response.Headers.Append("Connection", "keep-alive");
        return Task.CompletedTask;
    }

    private static async Task StreamLoopAsync(HttpContext context, Channel<BoardEvent> channel, TimeSpan interval, CancellationToken cancellationToken)
    {
        var heartbeatTask = SendHeartbeatsAsync(channel.Writer, interval, cancellationToken);
        try
        {
            await foreach (var evt in channel.Reader.ReadAllAsync(cancellationToken))
            {
                if (evt.Type == "heartbeat")
                {
                    await context.Response.WriteAsync(": heartbeat\n\n", cancellationToken);
                }
                else
                {
                    var json = JsonSerializer.Serialize(evt.Payload, SseJson);
                    await context.Response.WriteAsync($"event: {evt.Type}\ndata: {json}\n\n", cancellationToken);
                }

                await context.Response.Body.FlushAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        finally
        {
            channel.Writer.TryComplete();
            await heartbeatTask;
        }
    }

    private static async Task SendHeartbeatsAsync(ChannelWriter<BoardEvent> writer, TimeSpan interval, CancellationToken cancellationToken)
    {
        try
        {
            using var heartbeat = new PeriodicTimer(interval);
            while (await heartbeat.WaitForNextTickAsync(cancellationToken))
                writer.TryWrite(new BoardEvent("heartbeat", new { }));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
    }

    private void EnsureManagerOrOwner()
    {
        if (tenantContext.Role is not (UserRole.Manager or UserRole.Owner))
            throw new UnauthorizedAccessException("Manager or Owner role required.");
    }

    private static string NormalizeTrackingToken(string token)
    {
        var normalized = RequireText(token, "Tracking token").Trim().ToUpperInvariant();

        if (!WorkOrder.IsValidTrackingToken(normalized))
            throw new ArgumentException("Invalid tracking token.");
        return normalized;
    }

    private void ThrowIfMissingTrackingTokenSuppressed(string token)
    {
        if (cache.TryGetValue(MissingTrackingTokenSuppressionKey(token), out _))
            throw new KeyNotFoundException("Tracking token not found.");
    }

    private void RecordMissingTrackingToken(string token)
    {
        var attemptsKey = MissingTrackingTokenAttemptsKey(token);
        var attempts = cache.TryGetValue<int>(attemptsKey, out var currentAttempts) ? currentAttempts + 1 : 1;
        cache.Set(attemptsKey, attempts, MissingTrackingTokenAttemptWindow);

        if (attempts >= MissingTrackingTokenDbMissThreshold)
            cache.Set(MissingTrackingTokenSuppressionKey(token), true, MissingTrackingTokenSuppressionWindow);
    }

    private void ForgetMissingTrackingToken(string token)
    {
        cache.Remove(MissingTrackingTokenAttemptsKey(token));
        cache.Remove(MissingTrackingTokenSuppressionKey(token));
    }

    private static string MissingTrackingTokenAttemptsKey(string token) => $"tracking-token-misses:{token}";

    private static string MissingTrackingTokenSuppressionKey(string token) => $"tracking-token-suppressed:{token}";

    private static string NormalizePhone(string phone) => new(RequireText(phone, "Customer phone").Where(char.IsDigit).ToArray());

    private static string RequireText(string? value, string name) =>
        string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"{name} is required.") : value;
}

public record ReceiptFileResult(byte[] Content, string FileName);
