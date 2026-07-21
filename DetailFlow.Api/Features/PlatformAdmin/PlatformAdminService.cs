using DetailFlow.Api.Data;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.PlatformAdmin;

public class PlatformAdminService(
    DetailFlowDbContext db,
    PlatformAdminAuthService auth)
{
    public async Task<PlatformTenantListDto> ListTenantsAsync(
        string? search,
        TenantPlan? plan,
        bool? active,
        TenantBillingStatus? billingStatus,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(t =>
                t.Name.ToLower().Contains(term) ||
                t.Slug.ToLower().Contains(term));
        }

        if (plan.HasValue)
            query = query.Where(t => t.Plan == plan.Value);
        if (active.HasValue)
            query = query.Where(t => t.IsActive == active.Value);
        if (billingStatus.HasValue)
            query = query.Where(t => t.BillingStatus == billingStatus.Value);

        var total = await query.CountAsync(ct);
        var tenants = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.Name,
                t.Slug,
                t.Plan,
                t.BillingStatus,
                t.IsActive,
                t.SupportAccessEnabled,
                t.SupportAccessExpiresAt,
                t.CreatedAt
            })
            .ToListAsync(ct);

        var tenantIds = tenants.Select(t => t.Id).ToList();
        var owners = await db.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => tenantIds.Contains(u.TenantId) && u.Role == UserRole.Owner)
            .OrderBy(u => u.CreatedAt)
            .Select(u => new
            {
                u.TenantId,
                Owner = new PlatformOwnerDto(u.Id, u.FullName, u.Email, u.IsActive)
            })
            .ToListAsync(ct);
        var ownerLookup = owners
            .GroupBy(x => x.TenantId)
            .ToDictionary(g => g.Key, g => g.First().Owner);

        var statsLookup = await BuildStatsLookupAsync(tenantIds, ct);

        var items = tenants.Select(t =>
        {
            statsLookup.TryGetValue(t.Id, out var stats);
            ownerLookup.TryGetValue(t.Id, out var owner);
            return new PlatformTenantSummaryDto(
                t.Id,
                t.Name,
                t.Slug,
                t.Plan,
                t.BillingStatus,
                t.IsActive,
                t.SupportAccessEnabled,
                t.SupportAccessExpiresAt,
                t.CreatedAt,
                owner,
                stats ?? PlatformTenantStats.Empty);
        }).ToList();

        return new PlatformTenantListDto(items, page, pageSize, total);
    }

    public async Task<PlatformTenantDetailDto> GetTenantAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await db.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct)
            ?? throw new KeyNotFoundException("Tenant not found.");

        var users = await db.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.TenantId == tenantId)
            .OrderBy(u => u.Role)
            .ThenBy(u => u.FullName)
            .Select(u => new PlatformTenantUserDto(
                u.Id,
                u.FullName,
                u.Email,
                u.Role,
                u.IsActive,
                u.PasswordSetAt == null,
                u.CreatedAt))
            .ToListAsync(ct);

        var stats = await BuildStatsLookupAsync([tenantId], ct);
        stats.TryGetValue(tenantId, out var tenantStats);

        return new PlatformTenantDetailDto(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            tenant.LogoUrl,
            tenant.Plan,
            tenant.BillingStatus,
            tenant.BillingNotes,
            tenant.WhatsAppMonthlyAddonMessages,
            DashboardLanguages.Normalize(tenant.DashboardLocale),
            tenant.IsActive,
            tenant.SupportAccessEnabled,
            tenant.SupportAccessExpiresAt,
            tenant.CreatedAt,
            tenantStats ?? PlatformTenantStats.Empty,
            users);
    }

    public async Task<PlatformTenantDetailDto> UpdateTenantAsync(
        Guid tenantId,
        PlatformTenantUpdateRequest input,
        CancellationToken ct)
    {
        var tenant = await db.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct)
            ?? throw new KeyNotFoundException("Tenant not found.");

        if (input.Plan.HasValue)
            tenant.Plan = input.Plan.Value;
        if (input.BillingStatus.HasValue)
            tenant.BillingStatus = input.BillingStatus.Value;
        if (input.IsActive.HasValue)
            tenant.IsActive = input.IsActive.Value;
        if (input.BillingNotes is not null)
            tenant.BillingNotes = NormalizeOptionalText(input.BillingNotes, 2_000);
        if (input.WhatsAppMonthlyAddonMessages.HasValue)
            tenant.WhatsAppMonthlyAddonMessages = Math.Max(input.WhatsAppMonthlyAddonMessages.Value, 0);
        if (input.DashboardLocale is not null)
            tenant.DashboardLocale = DashboardLanguages.Validate(input.DashboardLocale);
        if (input.SupportAccessEnabled.HasValue)
            tenant.SupportAccessEnabled = input.SupportAccessEnabled.Value;
        if (input.SupportAccessExpiresAt.HasValue)
            tenant.SupportAccessExpiresAt = input.SupportAccessExpiresAt.Value;

        if (!tenant.SupportAccessEnabled)
            tenant.SupportAccessExpiresAt = null;
        else if (tenant.SupportAccessExpiresAt is null || tenant.SupportAccessExpiresAt <= DateTimeOffset.UtcNow)
            tenant.SupportAccessExpiresAt = DateTimeOffset.UtcNow.AddHours(1);

        await db.SaveChangesAsync(ct);
        return await GetTenantAsync(tenantId, ct);
    }

    public async Task<object> StartSupportSessionAsync(
        Guid tenantId,
        PlatformSupportSessionRequest input,
        CancellationToken ct)
    {
        var tenant = await db.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct)
            ?? throw new KeyNotFoundException("Tenant not found.");

        if (!tenant.IsActive)
            throw new InvalidOperationException("Support session cannot be started for an inactive tenant.");

        var minutes = Math.Clamp(input.DurationMinutes ?? 60, 15, 480);
        tenant.SupportAccessEnabled = true;
        tenant.SupportAccessExpiresAt = DateTimeOffset.UtcNow.AddMinutes(minutes);
        await db.SaveChangesAsync(ct);

        return auth.IssueSupportSession(tenant, tenant.SupportAccessExpiresAt.Value);
    }

    private async Task<Dictionary<Guid, PlatformTenantStats>> BuildStatsLookupAsync(
        IReadOnlyCollection<Guid> tenantIds,
        CancellationToken ct)
    {
        if (tenantIds.Count == 0)
            return [];

        var monthStart = GetCurrentMonthStart();
        var userCounts = await db.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => tenantIds.Contains(u.TenantId))
            .GroupBy(u => u.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count(), Active = g.Count(u => u.IsActive) })
            .ToDictionaryAsync(x => x.TenantId, x => x, ct);

        var bookingCounts = await db.Bookings
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(b => tenantIds.Contains(b.TenantId))
            .GroupBy(b => b.TenantId)
            .Select(g => new
            {
                TenantId = g.Key,
                Total = g.Count(),
                CurrentMonth = g.Count(b => b.CreatedAt >= monthStart)
            })
            .ToDictionaryAsync(x => x.TenantId, x => x, ct);

        var workOrderCounts = await db.WorkOrders
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(w => tenantIds.Contains(w.TenantId))
            .GroupBy(w => w.TenantId)
            .Select(g => new
            {
                TenantId = g.Key,
                Total = g.Count(),
                Active = g.Count(w => w.Stage != WorkOrderStage.Delivered)
            })
            .ToDictionaryAsync(x => x.TenantId, x => x, ct);

        return tenantIds.ToDictionary(
            tenantId => tenantId,
            tenantId =>
            {
                userCounts.TryGetValue(tenantId, out var users);
                bookingCounts.TryGetValue(tenantId, out var bookings);
                workOrderCounts.TryGetValue(tenantId, out var workOrders);

                return new PlatformTenantStats(
                    users?.Count ?? 0,
                    users?.Active ?? 0,
                    bookings?.Total ?? 0,
                    bookings?.CurrentMonth ?? 0,
                    workOrders?.Total ?? 0,
                    workOrders?.Active ?? 0);
            });
    }

    private static string? NormalizeOptionalText(string value, int maxLength)
    {
        var trimmed = value.Trim();
        if (trimmed.Length == 0)
            return null;
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"Value must be {maxLength} characters or fewer.");
        return trimmed;
    }

    private static DateTimeOffset GetCurrentMonthStart()
    {
        var now = DateTimeOffset.UtcNow;
        return new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
    }
}

public sealed record PlatformTenantListDto(
    IReadOnlyList<PlatformTenantSummaryDto> Items,
    int Page,
    int PageSize,
    int Total);

public sealed record PlatformTenantSummaryDto(
    Guid Id,
    string Name,
    string Slug,
    TenantPlan Plan,
    TenantBillingStatus BillingStatus,
    bool IsActive,
    bool SupportAccessEnabled,
    DateTimeOffset? SupportAccessExpiresAt,
    DateTimeOffset CreatedAt,
    PlatformOwnerDto? Owner,
    PlatformTenantStats Stats);

public sealed record PlatformTenantDetailDto(
    Guid Id,
    string Name,
    string Slug,
    string? LogoUrl,
    TenantPlan Plan,
    TenantBillingStatus BillingStatus,
    string? BillingNotes,
    int WhatsAppMonthlyAddonMessages,
    string DashboardLocale,
    bool IsActive,
    bool SupportAccessEnabled,
    DateTimeOffset? SupportAccessExpiresAt,
    DateTimeOffset CreatedAt,
    PlatformTenantStats Stats,
    IReadOnlyList<PlatformTenantUserDto> Users);

public sealed record PlatformOwnerDto(Guid Id, string FullName, string Email, bool IsActive);

public sealed record PlatformTenantUserDto(
    Guid Id,
    string FullName,
    string Email,
    UserRole Role,
    bool IsActive,
    bool IsInvitePending,
    DateTimeOffset CreatedAt);

public sealed record PlatformTenantStats(
    int StaffAccounts,
    int ActiveStaffAccounts,
    int TotalBookings,
    int CurrentMonthBookings,
    int TotalWorkOrders,
    int ActiveWorkOrders)
{
    public static PlatformTenantStats Empty { get; } = new(0, 0, 0, 0, 0, 0);
}

public sealed record PlatformTenantUpdateRequest(
    TenantPlan? Plan,
    TenantBillingStatus? BillingStatus,
    bool? IsActive,
    string? BillingNotes,
    int? WhatsAppMonthlyAddonMessages,
    string? DashboardLocale,
    bool? SupportAccessEnabled,
    DateTimeOffset? SupportAccessExpiresAt);

public sealed record PlatformSupportSessionRequest(int? DurationMinutes);
