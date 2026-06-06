using DetailFlow.Api.Models;

namespace DetailFlow.Api.Data;

public static class DefaultServiceSeeder
{
    public static List<ServiceType> SeedDefaultServices(Guid tenantId) =>
    [
        new() { TenantId = tenantId, Name = "Exterior Wash", BasePrice = 15, DurationMinutes = 30, SortOrder = 1 },
        new() { TenantId = tenantId, Name = "Full Interior Clean", BasePrice = 45, DurationMinutes = 90, SortOrder = 2 },
        new() { TenantId = tenantId, Name = "Full Detail", BasePrice = 120, DurationMinutes = 180, SortOrder = 3 },
        new() { TenantId = tenantId, Name = "Paint Polish", BasePrice = 200, DurationMinutes = 240, SortOrder = 4 },
        new() { TenantId = tenantId, Name = "Ceramic Coating", BasePrice = 500, DurationMinutes = 480, SortOrder = 5 }
    ];
}
