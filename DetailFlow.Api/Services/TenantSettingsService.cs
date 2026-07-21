using DetailFlow.Api.Data;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Services;

public class TenantSettingsService(
    DetailFlowDbContext db,
    ITenantContext tenantContext)
{
    public Task<TenantSettings> GetAsync() => GetAsync(tenantContext.TenantId);

    public async Task<TenantSettings> GetAsync(Guid tenantId)
    {
        var tenant = await db.Tenants
            .FirstOrDefaultAsync(t => t.Id == tenantId)
            ?? throw new KeyNotFoundException("Tenant not found.");

        var settings = tenant.Settings ?? new TenantSettings();
        settings.Currency = TenantCurrencies.Normalize(settings.Currency);
        return settings;
    }

    public async Task SaveAsync(TenantSettings settings)
    {
        var tenant = await db.Tenants
            .FirstOrDefaultAsync(t => t.Id == tenantContext.TenantId)
            ?? throw new KeyNotFoundException("Tenant not found.");

        if (!TenantCurrencies.IsSupported(settings.Currency))
            throw new ArgumentException("Unsupported receipt currency.");

        tenant.Settings = settings;
        db.Entry(tenant).Property(t => t.Settings).IsModified = true;
        await db.SaveChangesAsync();
    }

    public async Task<string> GetDashboardLanguageAsync()
    {
        var language = await db.Tenants
            .Where(t => t.Id == tenantContext.TenantId)
            .Select(t => t.DashboardLocale)
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Tenant not found.");

        return DashboardLanguages.Normalize(language);
    }

    public async Task<string> SaveDashboardLanguageAsync(string? language)
    {
        var tenant = await db.Tenants
            .FirstOrDefaultAsync(t => t.Id == tenantContext.TenantId)
            ?? throw new KeyNotFoundException("Tenant not found.");

        tenant.DashboardLocale = DashboardLanguages.Validate(language);
        await db.SaveChangesAsync();
        return tenant.DashboardLocale;
    }

    public async Task<WorkingDay?> GetWorkingDayAsync(DateOnly date)
    {
        var settings = await GetAsync();
        return GetWorkingDay(settings, date);
    }

    public async Task<bool> IsClosedAsync(DateOnly date)
    {
        var settings = await GetAsync();
        return IsClosed(settings, date);
    }

    public static WorkingDay? GetWorkingDay(TenantSettings settings, DateOnly date) =>
        settings.WorkingDays.FirstOrDefault(d => d.Day == date.DayOfWeek && d.IsOpen);

    public static bool IsClosed(TenantSettings settings, DateOnly date) =>
        settings.ClosurePeriods.Any(c => date >= c.From && date <= c.To);
}
