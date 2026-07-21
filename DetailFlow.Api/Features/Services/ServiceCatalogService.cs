using DetailFlow.Api.Data;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.Services;

public class ServiceCatalogService(DetailFlowDbContext db, ITenantContext tenantContext)
{
    public async Task<IReadOnlyList<object>> ListAsync(bool includeInactive = false)
    {
        if (includeInactive)
            EnsureManagerOrOwner();

        var query = db.ServiceTypes.AsQueryable();
        if (!includeInactive)
            query = query.Where(s => s.IsActive);

        return await query
            .OrderBy(s => s.SortOrder)
            .Select(s => (object)new
            {
                s.Id,
                s.Name,
                s.Description,
                s.BasePrice,
                s.DurationMinutes,
                s.SortOrder,
                s.IsActive
            })
            .ToListAsync();
    }

    public async Task<ServiceType> CreateAsync(ServiceRequest input)
    {
        EnsureManagerOrOwner();
        if (input.BasePrice is null or <= 0 || input.DurationMinutes is null or <= 0)
            throw new ArgumentException("Price and duration must be greater than zero.");
        var name = RequireText(input.Name, "Name").Trim();

        var service = new ServiceType
        {
            TenantId = tenantContext.TenantId,
            Name = name,
            Description = input.Description,
            BasePrice = input.BasePrice.Value,
            DurationMinutes = input.DurationMinutes.Value,
            IsActive = input.IsActive ?? true,
            SortOrder = input.SortOrder ?? 0
        };

        db.ServiceTypes.Add(service);
        await db.SaveChangesAsync();
        return service;
    }

    public async Task<ServiceType> UpdateAsync(Guid id, ServiceRequest input)
    {
        EnsureManagerOrOwner();
        var service = await db.ServiceTypes.FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new KeyNotFoundException("Service not found.");

        if (input.Name is not null)
            service.Name = RequireText(input.Name, "Name").Trim();

        if (input.Description is not null)
            service.Description = input.Description;

        if (input.BasePrice.HasValue)
        {
            if (input.BasePrice <= 0)
                throw new ArgumentException("Base price must be greater than zero.");

            service.BasePrice = input.BasePrice.Value;
        }

        if (input.DurationMinutes.HasValue)
        {
            if (input.DurationMinutes <= 0)
                throw new ArgumentException("Duration must be greater than zero.");

            service.DurationMinutes = input.DurationMinutes.Value;
        }

        if (input.IsActive.HasValue)
            service.IsActive = input.IsActive.Value;

        if (input.SortOrder.HasValue)
            service.SortOrder = input.SortOrder.Value;

        await db.SaveChangesAsync();
        return service;
    }

    public async Task<IReadOnlyList<object>> ReorderAsync(ServiceReorderRequest input)
    {
        EnsureManagerOrOwner();
        if (input.OrderedIds.Count != input.OrderedIds.Distinct().Count())
            throw new ArgumentException("Service order contains duplicate IDs.");

        await using var tx = await db.Database.BeginTransactionAsync();
        var services = await db.ServiceTypes
            .Where(s => input.OrderedIds.Contains(s.Id))
            .ToListAsync();

        if (services.Count != input.OrderedIds.Count)
            throw new ArgumentException("Service order contains an invalid service ID.");

        var sortOrderById = input.OrderedIds
            .Select((id, index) => new { id, sortOrder = index + 1 })
            .ToDictionary(item => item.id, item => item.sortOrder);
        foreach (var service in services)
            service.SortOrder = sortOrderById[service.Id];

        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return await ListAsync();
    }

    private void EnsureManagerOrOwner()
    {
        if (tenantContext.Role is not (UserRole.Manager or UserRole.Owner))
            throw new UnauthorizedAccessException("Manager or Owner role required.");
    }

    private static string RequireText(string? value, string name) =>
        string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"{name} is required.") : value;
}
