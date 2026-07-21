namespace DetailFlow.Api.Models;

public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string? LogoUrl { get; set; }
    public TenantPlan Plan { get; set; } = TenantPlan.Free;
    public TenantBillingStatus BillingStatus { get; set; } = TenantBillingStatus.Trial;
    public string? BillingNotes { get; set; }
    public int WhatsAppMonthlyAddonMessages { get; set; }
    public string DashboardLocale { get; set; } = DashboardLanguages.Default;
    public TenantSettings Settings { get; set; } = new();
    public bool IsActive { get; set; } = true;
    public bool SupportAccessEnabled { get; set; }
    public DateTimeOffset? SupportAccessExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum TenantPlan
{
    Free,
    Pro,
    Business
}

public enum TenantBillingStatus
{
    Trial,
    Active,
    PastDue,
    Suspended,
    Manual
}
