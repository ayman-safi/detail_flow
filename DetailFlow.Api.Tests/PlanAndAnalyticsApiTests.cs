using System.Net;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Tests;

public class PlanAndAnalyticsApiTests
{
    [Fact]
    public async Task Plan_status_reports_free_plan_usage_and_limits()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        await TestApi.RegisterTenantAsync(client);

        var response = await client.GetAsync("/api/plan/status");
        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);

        using var json = await TestApi.ReadJsonAsync(response);
        var root = json.RootElement;
        Assert.Equal("Free", root.GetProperty("plan").GetString());
        Assert.Equal(0, root.GetProperty("bookingsUsed").GetInt32());
        Assert.Equal(30, root.GetProperty("bookingsLimit").GetInt32());
        Assert.Equal(1, root.GetProperty("staffUsed").GetInt32());
        Assert.Equal(2, root.GetProperty("staffLimit").GetInt32());
        Assert.False(root.GetProperty("analyticsEnabled").GetBoolean());
    }

    [Fact]
    public async Task Free_plan_cannot_access_analytics_dashboard()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        await TestApi.RegisterTenantAsync(client);

        var response = await client.GetAsync("/api/analytics/dashboard");

        await TestApi.AssertStatusAsync(response, HttpStatusCode.PaymentRequired);
    }

    [Fact]
    public async Task Pro_plan_can_read_analytics_dashboard_metrics()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);

        await app.ExecuteDbContextAsync(async db =>
        {
            var currentTenant = await db.Tenants.SingleAsync(t => t.Id == tenant.Id);
            currentTenant.Plan = TenantPlan.Pro;

            var customer = new Customer
            {
                TenantId = tenant.Id,
                FullName = "Repeat Customer",
                Phone = "15550102000",
                TotalVisits = 2
            };
            var vehicle = new Vehicle
            {
                TenantId = tenant.Id,
                Customer = customer,
                PlateNumber = "ANL-001",
                Make = "Honda",
                Model = "Civic",
                Color = "White"
            };
            var booking = new Booking
            {
                TenantId = tenant.Id,
                Customer = customer,
                Vehicle = vehicle,
                ServiceTypeId = serviceId,
                ScheduledAt = DateTimeOffset.UtcNow.AddHours(1),
                Status = BookingStatus.Confirmed
            };
            var delivered = new WorkOrder
            {
                TenantId = tenant.Id,
                Booking = booking,
                Customer = customer,
                Vehicle = vehicle,
                ServiceTypeId = serviceId,
                Stage = WorkOrderStage.Delivered,
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-2),
                UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-15)
            };
            delivered.StageHistory.Add(new WorkOrderStageHistory
            {
                FromStage = WorkOrderStage.Ready,
                ToStage = WorkOrderStage.Delivered,
                ChangedByName = "Owner User"
            });

            db.WorkOrders.Add(delivered);
            db.WorkOrders.Add(new WorkOrder
            {
                TenantId = tenant.Id,
                Customer = customer,
                Vehicle = vehicle,
                ServiceTypeId = serviceId,
                Stage = WorkOrderStage.Arrived,
                CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-30),
                UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
            });

            await db.SaveChangesAsync();
        });

        var response = await client.GetAsync("/api/analytics/dashboard");
        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);

        using var json = await TestApi.ReadJsonAsync(response);
        var root = json.RootElement;
        var today = root.GetProperty("today");
        Assert.Equal(1, today.GetProperty("totalBookings").GetInt32());
        Assert.Equal(1, today.GetProperty("completedJobs").GetInt32());
        Assert.Equal(1, today.GetProperty("activeVehicles").GetInt32());
        Assert.Equal(1, today.GetProperty("walkIns").GetInt32());
        Assert.Equal(1, root.GetProperty("repeatCustomers").GetInt32());
        Assert.Contains(
            root.GetProperty("topServices").EnumerateArray(),
            item => item.GetProperty("serviceName").GetString() == "Exterior Wash" && item.GetProperty("count").GetInt32() == 2);
        Assert.Contains(
            root.GetProperty("recentActivity").EnumerateArray(),
            item => item.GetProperty("vehiclePlate").GetString() == "ANL-001" && item.GetProperty("toStage").GetString() == "Delivered");
    }
}
