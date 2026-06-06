using DetailFlow.Api.Models;

namespace DetailFlow.Api.Features.Plans;

public static class PlanLimits
{
    public static readonly Dictionary<TenantPlan, PlanQuota> Quotas = new()
    {
        [TenantPlan.Free] = new PlanQuota
        {
            MonthlyBookings = 30,
            StaffAccounts = 2,
            PhotosPerWorkOrder = 3,
            AnalyticsEnabled = false,
            WhatsAppEnabled = false,
            MultiLocation = false
        },
        [TenantPlan.Pro] = new PlanQuota
        {
            MonthlyBookings = int.MaxValue,
            StaffAccounts = 10,
            PhotosPerWorkOrder = 10,
            AnalyticsEnabled = true,
            WhatsAppEnabled = true,
            MultiLocation = false
        },
        [TenantPlan.Business] = new PlanQuota
        {
            MonthlyBookings = int.MaxValue,
            StaffAccounts = int.MaxValue,
            PhotosPerWorkOrder = 10,
            AnalyticsEnabled = true,
            WhatsAppEnabled = true,
            MultiLocation = false
        }
    };
}

public class PlanQuota
{
    public int MonthlyBookings { get; init; }
    public int StaffAccounts { get; init; }
    public int PhotosPerWorkOrder { get; init; }
    public bool AnalyticsEnabled { get; init; }
    public bool WhatsAppEnabled { get; init; }
    public bool MultiLocation { get; init; }
}
