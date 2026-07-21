using DetailFlow.Api.Data;
using DetailFlow.Api.Features.Plans;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace DetailFlow.Api.Features.Analytics;

public class AnalyticsService(
    DetailFlowDbContext db,
    ITenantContext tenantContext,
    IMemoryCache cache,
    PlanEnforcementService planEnforcement)
{
    private const int MaximumRangeDays = 90;

    public async Task<object> GetDashboardAsync(
        DateOnly? from,
        DateOnly? to,
        int? timezoneOffsetMinutes)
    {
        await planEnforcement.AssertAnalyticsEnabledAsync(tenantContext.TenantId);

        if (timezoneOffsetMinutes is < -840 or > 840)
            throw new ArgumentException("Timezone offset must be between -840 and 840 minutes.");
        if (from.HasValue != to.HasValue)
            throw new ArgumentException("Both from and to dates are required when filtering analytics.");

        var localOffset = TimeSpan.FromMinutes(-(timezoneOffsetMinutes ?? 0));
        var localToday = DateOnly.FromDateTime(DateTimeOffset.UtcNow.ToOffset(localOffset).DateTime);
        var rangeFrom = from ?? localToday.AddDays(-6);
        var rangeTo = to ?? localToday;
        var rangeDays = rangeTo.DayNumber - rangeFrom.DayNumber + 1;
        if (rangeDays < 1)
            throw new ArgumentException("The analytics start date must be on or before the end date.");
        if (rangeDays > MaximumRangeDays)
            throw new ArgumentException($"Analytics can cover at most {MaximumRangeDays} days.");

        var rangeStart = new DateTimeOffset(rangeFrom.ToDateTime(TimeOnly.MinValue), localOffset).ToUniversalTime();
        var rangeEnd = new DateTimeOffset(rangeTo.AddDays(1).ToDateTime(TimeOnly.MinValue), localOffset).ToUniversalTime();
        var todayStart = new DateTimeOffset(localToday.ToDateTime(TimeOnly.MinValue), localOffset).ToUniversalTime();
        var tomorrowStart = todayStart.AddDays(1);

        var key = $"dashboard:{tenantContext.TenantId}:{rangeStart:O}:{rangeEnd:O}";
        if (cache.TryGetValue(key, out object? cached) && cached is not null)
            return cached;

        var bookingsToday = await db.Bookings
            .AsNoTracking()
            .CountAsync(b => b.ScheduledAt >= todayStart && b.ScheduledAt < tomorrowStart);
        var completedToday = await db.WorkOrders
            .AsNoTracking()
            .CountAsync(w => w.Stage == WorkOrderStage.Delivered && w.UpdatedAt >= todayStart && w.UpdatedAt < tomorrowStart);
        var activeVehicles = await db.WorkOrders
            .AsNoTracking()
            .CountAsync(w => w.Stage >= WorkOrderStage.Arrived && w.Stage <= WorkOrderStage.Ready);
        var walkInsToday = await db.WorkOrders
            .AsNoTracking()
            .CountAsync(w => w.BookingId == null && w.CreatedAt >= todayStart && w.CreatedAt < tomorrowStart);

        var totalBookings = await db.Bookings
            .AsNoTracking()
            .CountAsync(b => b.ScheduledAt >= rangeStart && b.ScheduledAt < rangeEnd);
        var completedJobs = await db.WorkOrders
            .AsNoTracking()
            .CountAsync(w => w.Stage == WorkOrderStage.Delivered && w.UpdatedAt >= rangeStart && w.UpdatedAt < rangeEnd);
        var totalWorkOrders = await db.WorkOrders
            .AsNoTracking()
            .CountAsync(w => w.CreatedAt >= rangeStart && w.CreatedAt < rangeEnd);
        var walkIns = await db.WorkOrders
            .AsNoTracking()
            .CountAsync(w => w.BookingId == null && w.CreatedAt >= rangeStart && w.CreatedAt < rangeEnd);
        var topServices = await db.WorkOrders
            .AsNoTracking()
            .Where(w => w.CreatedAt >= rangeStart && w.CreatedAt < rangeEnd)
            .GroupBy(w => w.ServiceType.Name)
            .Select(group => new { ServiceName = group.Key, Count = group.Count() })
            .OrderByDescending(row => row.Count)
            .Take(5)
            .ToListAsync();
        var repeatCustomers = await db.WorkOrders
            .AsNoTracking()
            .Where(w => w.CreatedAt >= rangeStart && w.CreatedAt < rangeEnd)
            .GroupBy(w => w.CustomerId)
            .CountAsync(group => group.Count() > 1);
        var completedJobUpdates = await db.WorkOrders
            .AsNoTracking()
            .Where(w => w.Stage == WorkOrderStage.Delivered && w.UpdatedAt >= rangeStart && w.UpdatedAt < rangeEnd)
            .Select(w => w.UpdatedAt)
            .ToListAsync();
        var completedByDay = completedJobUpdates
            .GroupBy(updatedAt => DateOnly.FromDateTime(updatedAt.ToOffset(localOffset).DateTime))
            .ToDictionary(group => group.Key, group => group.Count());
        var jobsByDay = Enumerable.Range(0, rangeDays)
            .Select(offset => rangeFrom.AddDays(offset))
            .Select(date => new { Date = date.ToString("yyyy-MM-dd"), Count = completedByDay.GetValueOrDefault(date) })
            .ToList();
        var recentActivity = await db.WorkOrderStageHistory
            .AsNoTracking()
            .Where(h => h.ChangedAt >= rangeStart && h.ChangedAt < rangeEnd)
            .OrderByDescending(h => h.ChangedAt)
            .Take(10)
            .Select(h => new
            {
                h.ChangedByName,
                VehiclePlate = h.WorkOrder.Vehicle == null ? "Vehicle pending" : h.WorkOrder.Vehicle.PlateNumber,
                h.FromStage,
                h.ToStage,
                h.ChangedAt
            })
            .ToListAsync();

        var dto = new
        {
            range = new
            {
                from = rangeFrom.ToString("yyyy-MM-dd"),
                to = rangeTo.ToString("yyyy-MM-dd"),
                days = rangeDays
            },
            today = new
            {
                totalBookings = bookingsToday,
                completedJobs = completedToday,
                activeVehicles,
                walkIns = walkInsToday
            },
            summary = new
            {
                totalBookings,
                completedJobs,
                activeVehicles,
                totalWorkOrders,
                walkIns
            },
            topServices = topServices.Select(x => new { serviceName = x.ServiceName, count = x.Count }),
            repeatCustomers,
            jobsByDay = jobsByDay.Select(x => new { date = x.Date, count = x.Count }),
            recentActivity = recentActivity.Select(x => new
            {
                changedByName = x.ChangedByName,
                vehiclePlate = x.VehiclePlate,
                fromStage = x.FromStage,
                toStage = x.ToStage,
                changedAt = x.ChangedAt
            })
        };
        cache.Set(key, dto, TimeSpan.FromSeconds(60));
        return dto;
    }
}
