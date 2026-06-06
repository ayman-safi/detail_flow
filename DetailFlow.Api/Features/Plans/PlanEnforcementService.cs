using DetailFlow.Api.Data;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.Plans;

public class PlanEnforcementService(DetailFlowDbContext db)
{
    public async Task<PlanQuota> GetQuotaAsync(Guid tenantId, CancellationToken ct = default)
    {
        var (_, quota) = await GetTenantQuotaAsync(tenantId, ct);
        return quota;
    }

    public async Task<PlanStatusDto> GetStatusAsync(Guid tenantId, CancellationToken ct = default)
    {
        var (tenant, quota) = await GetTenantQuotaAsync(tenantId, ct);
        var monthStart = GetCurrentMonthStart();
        var bookingsUsed = await db.Bookings
            .IgnoreQueryFilters()
            .Where(b => b.TenantId == tenantId && b.CreatedAt >= monthStart)
            .CountAsync(ct);
        var staffUsed = await db.Users
            .IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId)
            .CountAsync(ct);

        return new PlanStatusDto(
            tenant.Plan,
            bookingsUsed,
            quota.MonthlyBookings,
            quota.MonthlyBookings == int.MaxValue ? null : Math.Max(quota.MonthlyBookings - bookingsUsed, 0),
            quota.MonthlyBookings == int.MaxValue ? null : Math.Max(quota.MonthlyBookings - 5, 0),
            staffUsed,
            quota.StaffAccounts,
            quota.PhotosPerWorkOrder,
            quota.WhatsAppEnabled,
            quota.AnalyticsEnabled,
            quota.MultiLocation);
    }

    public async Task AssertCanBookAsync(Guid tenantId, CancellationToken ct = default)
    {
        var quota = await GetQuotaAsync(tenantId, ct);
        if (quota.MonthlyBookings == int.MaxValue)
            return;

        var count = await db.Bookings
            .IgnoreQueryFilters()
            .Where(b => b.TenantId == tenantId && b.CreatedAt >= GetCurrentMonthStart())
            .CountAsync(ct);

        if (count >= quota.MonthlyBookings)
            throw new PlanLimitException("Monthly booking limit reached. Upgrade to Pro to continue.");
    }

    public async Task AssertCanAddStaffAsync(Guid tenantId, CancellationToken ct = default)
    {
        var quota = await GetQuotaAsync(tenantId, ct);
        if (quota.StaffAccounts == int.MaxValue)
            return;

        var count = await db.Users
            .IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId)
            .CountAsync(ct);

        if (count >= quota.StaffAccounts)
            throw new PlanLimitException("Staff account limit reached. Upgrade to Pro.");
    }

    public async Task AssertCanUploadPhotoAsync(Guid tenantId, Guid workOrderId, CancellationToken ct = default)
    {
        var quota = await GetQuotaAsync(tenantId, ct);
        if (quota.PhotosPerWorkOrder == int.MaxValue)
            return;

        var count = await db.WorkOrderPhotos
            .IgnoreQueryFilters()
            .Where(p => p.WorkOrderId == workOrderId && p.WorkOrder.TenantId == tenantId)
            .CountAsync(ct);

        if (count >= quota.PhotosPerWorkOrder)
            throw new PlanLimitException("Photo limit reached for this work order. Upgrade to Pro.");
    }

    public async Task AssertWhatsAppEnabledAsync(Guid tenantId, CancellationToken ct = default)
    {
        var quota = await GetQuotaAsync(tenantId, ct);
        if (!quota.WhatsAppEnabled)
            throw new PlanLimitException("WhatsApp notifications require Pro plan.");
    }

    public async Task AssertAnalyticsEnabledAsync(Guid tenantId, CancellationToken ct = default)
    {
        var quota = await GetQuotaAsync(tenantId, ct);
        if (!quota.AnalyticsEnabled)
            throw new PlanLimitException("Analytics require Pro plan.");
    }

    private async Task<(Tenant Tenant, PlanQuota Quota)> GetTenantQuotaAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await db.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId && t.IsActive, ct)
            ?? throw new KeyNotFoundException("Tenant not found.");

        if (!PlanLimits.Quotas.TryGetValue(tenant.Plan, out var quota))
            throw new InvalidOperationException($"Plan '{tenant.Plan}' is not configured.");

        return (tenant, quota);
    }

    private static DateTimeOffset GetCurrentMonthStart()
    {
        var now = DateTimeOffset.UtcNow;
        return new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
    }
}

public sealed record PlanStatusDto(
    TenantPlan Plan,
    int BookingsUsed,
    int BookingsLimit,
    int? BookingsRemaining,
    int? BookingWarningThreshold,
    int StaffUsed,
    int StaffLimit,
    int PhotosPerWorkOrder,
    bool WhatsAppEnabled,
    bool AnalyticsEnabled,
    bool MultiLocation);

public class PlanLimitException(string message) : Exception(message);
