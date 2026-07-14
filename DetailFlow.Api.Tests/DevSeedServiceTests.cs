using DetailFlow.Api.Features.Dev;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DetailFlow.Api.Tests;

public sealed class DevSeedServiceTests : IClassFixture<DetailFlowApiFactory>
{
    private readonly DetailFlowApiFactory _app;

    public DevSeedServiceTests(DetailFlowApiFactory app)
    {
        _app = app;
    }

    [Fact]
    public async Task Development_seed_is_repeatable_and_covers_supported_states()
    {
        await SeedAsync();

        var first = await _app.ExecuteDbContextAsync(async db =>
        {
            var demo = await db.Tenants.IgnoreQueryFilters().SingleAsync(tenant => tenant.Slug == "demo");
            var starter = await db.Tenants.IgnoreQueryFilters().SingleAsync(tenant => tenant.Slug == "starter");
            var demoCustomerIds = await db.Customers.IgnoreQueryFilters()
                .Where(customer => customer.TenantId == demo.Id)
                .Select(customer => customer.Id)
                .OrderBy(id => id)
                .ToListAsync();
            var tokens = await db.WorkOrders.IgnoreQueryFilters()
                .Where(workOrder => workOrder.TenantId == demo.Id)
                .Select(workOrder => workOrder.TrackingToken)
                .ToListAsync();

            return new
            {
                TenantCount = await db.Tenants.IgnoreQueryFilters().CountAsync(),
                DemoId = demo.Id,
                DemoCustomerIds = demoCustomerIds,
                DemoCustomers = demoCustomerIds.Count,
                DemoUsers = await db.Users.IgnoreQueryFilters().CountAsync(user => user.TenantId == demo.Id),
                PendingUsers = await db.Users.IgnoreQueryFilters().CountAsync(user => user.TenantId == demo.Id && user.PasswordSetAt == null),
                InactiveUsers = await db.Users.IgnoreQueryFilters().CountAsync(user => user.TenantId == demo.Id && !user.IsActive),
                InactiveServices = await db.ServiceTypes.IgnoreQueryFilters().CountAsync(service => service.TenantId == demo.Id && !service.IsActive),
                StarterBookings = await db.Bookings.IgnoreQueryFilters().CountAsync(booking => booking.TenantId == starter.Id),
                BookingStatuses = await db.Bookings.IgnoreQueryFilters().Where(booking => booking.TenantId == demo.Id).Select(booking => booking.Status).Distinct().ToListAsync(),
                WorkOrderStages = await db.WorkOrders.IgnoreQueryFilters().Where(workOrder => workOrder.TenantId == demo.Id).Select(workOrder => workOrder.Stage).Distinct().ToListAsync(),
                PaymentStatuses = await db.WorkOrders.IgnoreQueryFilters().Where(workOrder => workOrder.TenantId == demo.Id).Select(workOrder => workOrder.PaymentStatus).Distinct().ToListAsync(),
                NotificationStatuses = await db.NotificationLogs.IgnoreQueryFilters().Where(log => log.TenantId == demo.Id).Select(log => log.Status).Distinct().ToListAsync(),
                Tokens = tokens
            };
        });

        Assert.Equal(30, first.TenantCount);
        Assert.Equal(45, first.DemoCustomers);
        Assert.Equal(6, first.DemoUsers);
        Assert.Equal(1, first.PendingUsers);
        Assert.Equal(1, first.InactiveUsers);
        Assert.Equal(1, first.InactiveServices);
        Assert.Equal(30, first.StarterBookings);
        Assert.Equal(Enum.GetValues<BookingStatus>().Order(), first.BookingStatuses.Order());
        Assert.Equal(Enum.GetValues<WorkOrderStage>().Order(), first.WorkOrderStages.Order());
        Assert.Equal(Enum.GetValues<PaymentStatus>().Order(), first.PaymentStatuses.Order());
        Assert.Equal(Enum.GetValues<NotificationStatus>().Order(), first.NotificationStatuses.Order());
        Assert.Contains("TRKREDY2", first.Tokens);

        await _app.ExecuteDbContextAsync(async db =>
        {
            db.Customers.Add(new Customer
            {
                TenantId = first.DemoId,
                FullName = "Non deterministic test customer",
                Phone = "+15559999999"
            });
            await db.SaveChangesAsync();
        });

        await SeedAsync();

        var second = await _app.ExecuteDbContextAsync(async db => new
        {
            CustomerIds = await db.Customers.IgnoreQueryFilters()
                .Where(customer => customer.TenantId == first.DemoId)
                .Select(customer => customer.Id)
                .OrderBy(id => id)
                .ToListAsync(),
            ExtraCustomerExists = await db.Customers.IgnoreQueryFilters()
                .AnyAsync(customer => customer.TenantId == first.DemoId && customer.FullName == "Non deterministic test customer")
        });

        Assert.Equal(first.DemoCustomerIds, second.CustomerIds);
        Assert.False(second.ExtraCustomerExists);
    }

    private async Task SeedAsync()
    {
        using var scope = _app.Services.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<DevSeedService>();
        await service.SeedAsync();
    }
}
