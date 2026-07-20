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
        Assert.False(root.GetProperty("whatsAppProviderSendEnabled").GetBoolean());
        Assert.Equal(0, root.GetProperty("whatsAppMessagesIncluded").GetInt32());
        Assert.Equal(0, root.GetProperty("whatsAppMessagesAddon").GetInt32());
        Assert.Equal(0, root.GetProperty("whatsAppMessagesUsed").GetInt32());
        Assert.Equal(0, root.GetProperty("whatsAppMessagesLimit").GetInt32());
        Assert.Equal(0, root.GetProperty("whatsAppMessagesRemaining").GetInt32());
    }

    [Fact]
    public async Task Plan_status_reports_pro_whatsapp_quota_and_addons()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);

        await app.ExecuteDbContextAsync(async db =>
        {
            var currentTenant = await db.Tenants.SingleAsync(t => t.Id == tenant.Id);
            currentTenant.Plan = TenantPlan.Pro;
            currentTenant.WhatsAppMonthlyAddonMessages = 200;
            db.NotificationLogs.Add(new NotificationLog
            {
                TenantId = tenant.Id,
                Channel = NotificationChannel.WhatsApp,
                EventType = NotificationEventType.ReadyForPickup,
                DispatchType = NotificationDispatchType.Automatic,
                RecipientPhone = "15550102000",
                ProviderMessageId = "wamid.used",
                Status = NotificationStatus.Accepted
            });
            db.NotificationLogs.Add(new NotificationLog
            {
                TenantId = tenant.Id,
                Channel = NotificationChannel.WhatsApp,
                EventType = NotificationEventType.TrackingLink,
                DispatchType = NotificationDispatchType.Manual,
                RecipientPhone = "15550102000",
                Status = NotificationStatus.Requested
            });
            await db.SaveChangesAsync();
        });

        var response = await client.GetAsync("/api/plan/status");
        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);

        using var json = await TestApi.ReadJsonAsync(response);
        var root = json.RootElement;
        Assert.True(root.GetProperty("whatsAppProviderSendEnabled").GetBoolean());
        Assert.Equal(500, root.GetProperty("whatsAppMessagesIncluded").GetInt32());
        Assert.Equal(200, root.GetProperty("whatsAppMessagesAddon").GetInt32());
        Assert.Equal(1, root.GetProperty("whatsAppMessagesUsed").GetInt32());
        Assert.Equal(700, root.GetProperty("whatsAppMessagesLimit").GetInt32());
        Assert.Equal(699, root.GetProperty("whatsAppMessagesRemaining").GetInt32());
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

    [Fact]
    public async Task Analytics_dashboard_filters_metrics_to_requested_historical_range()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var olderDate = DateTimeOffset.UtcNow.AddDays(-20);

        await app.ExecuteDbContextAsync(async db =>
        {
            var currentTenant = await db.Tenants.SingleAsync(t => t.Id == tenant.Id);
            currentTenant.Plan = TenantPlan.Pro;

            var customer = new Customer
            {
                TenantId = tenant.Id,
                FullName = "Historical Customer",
                Phone = "15550103000",
                TotalVisits = 2
            };
            var vehicle = new Vehicle
            {
                TenantId = tenant.Id,
                Customer = customer,
                PlateNumber = "HIS-001",
                Make = "Toyota",
                Model = "Camry",
                Color = "Black"
            };
            var booking = new Booking
            {
                TenantId = tenant.Id,
                Customer = customer,
                Vehicle = vehicle,
                ServiceTypeId = serviceId,
                ScheduledAt = olderDate,
                Status = BookingStatus.Confirmed,
                CreatedAt = olderDate.AddDays(-1)
            };
            var delivered = new WorkOrder
            {
                TenantId = tenant.Id,
                Booking = booking,
                Customer = customer,
                Vehicle = vehicle,
                ServiceTypeId = serviceId,
                Stage = WorkOrderStage.Delivered,
                CreatedAt = olderDate,
                UpdatedAt = olderDate.AddHours(2)
            };
            delivered.StageHistory.Add(new WorkOrderStageHistory
            {
                FromStage = WorkOrderStage.Ready,
                ToStage = WorkOrderStage.Delivered,
                ChangedByName = "Owner User",
                ChangedAt = olderDate.AddHours(2)
            });

            db.WorkOrders.Add(delivered);
            db.WorkOrders.Add(new WorkOrder
            {
                TenantId = tenant.Id,
                Customer = customer,
                Vehicle = vehicle,
                ServiceTypeId = serviceId,
                Stage = WorkOrderStage.Delivered,
                CreatedAt = olderDate.AddDays(2),
                UpdatedAt = olderDate.AddDays(2).AddHours(1)
            });
            await db.SaveChangesAsync();
        });

        var to = DateOnly.FromDateTime(DateTime.UtcNow);
        var from = to.AddDays(-29);
        var response = await client.GetAsync($"/api/analytics/dashboard?from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}&timezoneOffsetMinutes=0");
        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);

        using var json = await TestApi.ReadJsonAsync(response);
        var root = json.RootElement;
        Assert.Equal(30, root.GetProperty("range").GetProperty("days").GetInt32());
        Assert.Equal(1, root.GetProperty("summary").GetProperty("totalBookings").GetInt32());
        Assert.Equal(2, root.GetProperty("summary").GetProperty("completedJobs").GetInt32());
        Assert.Equal(2, root.GetProperty("summary").GetProperty("totalWorkOrders").GetInt32());
        Assert.Equal(1, root.GetProperty("summary").GetProperty("walkIns").GetInt32());
        Assert.Equal(1, root.GetProperty("repeatCustomers").GetInt32());
        Assert.Equal(30, root.GetProperty("jobsByDay").GetArrayLength());
        Assert.Contains(root.GetProperty("jobsByDay").EnumerateArray(), item => item.GetProperty("count").GetInt32() > 0);
        Assert.Contains(root.GetProperty("recentActivity").EnumerateArray(), item => item.GetProperty("vehiclePlate").GetString() == "HIS-001");

        var recentFrom = to.AddDays(-6);
        var recentResponse = await client.GetAsync($"/api/analytics/dashboard?from={recentFrom:yyyy-MM-dd}&to={to:yyyy-MM-dd}&timezoneOffsetMinutes=0");
        await TestApi.AssertStatusAsync(recentResponse, HttpStatusCode.OK);
        using var recentJson = await TestApi.ReadJsonAsync(recentResponse);
        Assert.Equal(0, recentJson.RootElement.GetProperty("summary").GetProperty("totalBookings").GetInt32());
        Assert.Equal(0, recentJson.RootElement.GetProperty("summary").GetProperty("totalWorkOrders").GetInt32());
        Assert.Empty(recentJson.RootElement.GetProperty("recentActivity").EnumerateArray());
    }

    [Fact]
    public async Task Analytics_dashboard_rejects_ranges_longer_than_ninety_days()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        await app.ExecuteDbContextAsync(async db =>
        {
            var currentTenant = await db.Tenants.SingleAsync(t => t.Id == tenant.Id);
            currentTenant.Plan = TenantPlan.Pro;
            await db.SaveChangesAsync();
        });

        var to = DateOnly.FromDateTime(DateTime.UtcNow);
        var from = to.AddDays(-90);
        var response = await client.GetAsync($"/api/analytics/dashboard?from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}");

        await TestApi.AssertStatusAsync(response, HttpStatusCode.BadRequest);
    }
}
