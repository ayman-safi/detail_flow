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
        var whatsAppUsage = await GetWhatsAppUsageAsync(tenant, quota, ct);

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
            whatsAppUsage.ProviderSendEnabled,
            whatsAppUsage.Included,
            whatsAppUsage.Addon,
            whatsAppUsage.Used,
            whatsAppUsage.Limit,
            whatsAppUsage.Remaining,
            quota.AnalyticsEnabled,
            quota.MultiLocation);
    }

    public async Task<WhatsAppQuotaStatusDto> GetWhatsAppQuotaStatusAsync(Guid tenantId, CancellationToken ct = default)
    {
        var (tenant, quota) = await GetTenantQuotaAsync(tenantId, ct);
        return await GetWhatsAppUsageAsync(tenant, quota, ct);
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

    public async Task AssertCanSendWhatsAppProviderMessageAsync(Guid tenantId, CancellationToken ct = default)
    {
        var status = await GetWhatsAppQuotaStatusAsync(tenantId, ct);
        if (!status.ProviderSendEnabled)
            throw new PlanLimitException("WhatsApp notifications require Pro plan.");
        if (status.Remaining <= 0)
            throw new PlanLimitException("WhatsApp message quota reached. Add more messages or upgrade your plan.");
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

    private async Task<WhatsAppQuotaStatusDto> GetWhatsAppUsageAsync(Tenant tenant, PlanQuota quota, CancellationToken ct)
    {
        var used = await db.NotificationLogs
            .IgnoreQueryFilters()
            .Where(log =>
                log.TenantId == tenant.Id &&
                log.Channel == NotificationChannel.WhatsApp &&
                log.DispatchType == NotificationDispatchType.Automatic &&
                log.Status != NotificationStatus.Failed &&
                log.CreatedAt >= GetCurrentMonthStart())
            .CountAsync(ct);

        var included = quota.WhatsAppMonthlyMessages;
        var addon = Math.Max(tenant.WhatsAppMonthlyAddonMessages, 0);
        var limit = included == int.MaxValue || addon == int.MaxValue
            ? int.MaxValue
            : Math.Max(0, included + addon);
        var providerSendEnabled = quota.WhatsAppEnabled;
        var remaining = providerSendEnabled
            ? (limit == int.MaxValue ? int.MaxValue : Math.Max(limit - used, 0))
            : 0;

        return new WhatsAppQuotaStatusDto(
            providerSendEnabled,
            included,
            addon,
            used,
            providerSendEnabled ? limit : 0,
            remaining);
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
    bool WhatsAppProviderSendEnabled,
    int WhatsAppMessagesIncluded,
    int WhatsAppMessagesAddon,
    int WhatsAppMessagesUsed,
    int WhatsAppMessagesLimit,
    int WhatsAppMessagesRemaining,
    bool AnalyticsEnabled,
    bool MultiLocation);

public sealed record WhatsAppQuotaStatusDto(
    bool ProviderSendEnabled,
    int Included,
    int Addon,
    int Used,
    int Limit,
    int Remaining);

public class PlanLimitException(string message) : Exception(message);
