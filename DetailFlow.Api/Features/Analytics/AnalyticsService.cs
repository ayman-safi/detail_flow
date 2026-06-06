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
    public async Task<object> GetDashboardAsync()
    {
        await planEnforcement.AssertAnalyticsEnabledAsync(tenantContext.TenantId);

        var key = $"dashboard:{tenantContext.TenantId}";
        if (cache.TryGetValue(key, out object? cached) && cached is not null)
            return cached;

        var now = DateTimeOffset.UtcNow;
        var today = new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, TimeSpan.Zero);
        var tomorrow = today.AddDays(1);
        var totalBookings = await db.Bookings
            .AsNoTracking()
            .CountAsync(b => b.ScheduledAt >= today && b.ScheduledAt < tomorrow);
        var completedJobs = await db.WorkOrders
            .AsNoTracking()
            .CountAsync(w => w.Stage == WorkOrderStage.Delivered && w.UpdatedAt >= today);
        var activeVehicles = await db.WorkOrders
            .AsNoTracking()
            .CountAsync(w => w.Stage >= WorkOrderStage.Arrived && w.Stage <= WorkOrderStage.Ready);
        var walkIns = await db.WorkOrders
            .AsNoTracking()
            .CountAsync(w => w.BookingId == null && w.CreatedAt >= today);
        var thirtyDaysAgo = now.AddDays(-30);
        var topServices = await db.WorkOrders
            .AsNoTracking()
            .Where(w => w.CreatedAt >= thirtyDaysAgo)
            .GroupBy(w => w.ServiceType.Name)
            .Select(group => new { ServiceName = group.Key, Count = group.Count() })
            .OrderByDescending(row => row.Count)
            .Take(5)
            .ToListAsync();
        var repeatCustomers = await db.Customers
            .AsNoTracking()
            .CountAsync(c => c.TotalVisits > 1);
        var sevenDaysAgo = now.AddDays(-7);
        var completedJobUpdates = await db.WorkOrders
            .AsNoTracking()
            .Where(w => w.Stage == WorkOrderStage.Delivered && w.UpdatedAt >= sevenDaysAgo)
            .Select(w => w.UpdatedAt)
            .ToListAsync();
        var jobsByDay = completedJobUpdates
            .GroupBy(updatedAt => updatedAt.UtcDateTime.Date)
            .OrderBy(group => group.Key)
            .Select(group => new { Date = group.Key, Count = group.Count() })
            .ToList();
        var recentActivity = await db.WorkOrderStageHistory
            .AsNoTracking()
            .OrderByDescending(h => h.ChangedAt)
            .Take(10)
            .Select(h => new
            {
                h.ChangedByName,
                VehiclePlate = h.WorkOrder.Vehicle.PlateNumber,
                h.FromStage,
                h.ToStage,
                h.ChangedAt
            })
            .ToListAsync();

        var dto = new
        {
            today = new
            {
                totalBookings,
                completedJobs,
                activeVehicles,
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
