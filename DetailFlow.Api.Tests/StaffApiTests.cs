using System.Net;
using System.Net.Http.Json;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.WebUtilities;

namespace DetailFlow.Api.Tests;

public class StaffApiTests
{
    [Fact]
    public async Task Owner_can_invite_staff_accept_invite_and_create_reset_link()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        await TestApi.RegisterTenantAsync(client);

        var createResponse = await client.PostAsJsonAsync("/api/staff", new
        {
            fullName = "Alex Porter",
            email = "alex@example.test",
            phone = "+15550103000",
            role = "Staff"
        });
        await TestApi.AssertStatusAsync(createResponse, HttpStatusCode.OK);
        using var createJson = await TestApi.ReadJsonAsync(createResponse);
        var root = createJson.RootElement;
        var userId = Guid.Parse(root.GetProperty("user").GetProperty("id").GetString()!);
        var inviteLink = root.GetProperty("inviteLink").GetString()!;
        var inviteToken = QueryHelpers.ParseQuery(new Uri(inviteLink).Query)["token"].ToString();

        Assert.False(string.IsNullOrWhiteSpace(inviteToken));
        Assert.True(root.GetProperty("user").GetProperty("isInvitePending").GetBoolean());

        var acceptResponse = await client.PostAsJsonAsync("/api/auth/accept-invite", new
        {
            token = inviteToken,
            password = "NewPassword!123"
        });
        await TestApi.AssertStatusAsync(acceptResponse, HttpStatusCode.OK);

        var resetResponse = await client.PostAsync($"/api/staff/{userId}/reset-link", content: null);
        await TestApi.AssertStatusAsync(resetResponse, HttpStatusCode.OK);
        using (var resetJson = await TestApi.ReadJsonAsync(resetResponse))
        {
            Assert.Contains("/reset-password?token=", resetJson.RootElement.GetProperty("resetLink").GetString());
        }

        var updateResponse = await client.PatchAsJsonAsync($"/api/staff/{userId}", new
        {
            fullName = "Alex Manager",
            phone = "+15550103001",
            role = "Manager",
            isActive = true
        });
        await TestApi.AssertStatusAsync(updateResponse, HttpStatusCode.OK);
        using var updateJson = await TestApi.ReadJsonAsync(updateResponse);
        Assert.Equal("Alex Manager", updateJson.RootElement.GetProperty("fullName").GetString());
        Assert.Equal("+15550103001", updateJson.RootElement.GetProperty("phone").GetString());
        Assert.Equal("Manager", updateJson.RootElement.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Pro_tenant_sends_invite_and_reset_links_by_whatsapp()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        await ConfigureProWhatsAppAsync(app, tenant.Id);
        await SaveWhatsAppSettingsAsync(client);

        var createResponse = await client.PostAsJsonAsync("/api/staff", new
        {
            fullName = "WhatsApp Staff",
            email = "whatsapp-staff@example.test",
            phone = "+15550103002",
            role = "Staff"
        });
        await TestApi.AssertStatusAsync(createResponse, HttpStatusCode.OK);
        using var createJson = await TestApi.ReadJsonAsync(createResponse);
        var userId = Guid.Parse(createJson.RootElement.GetProperty("user").GetProperty("id").GetString()!);
        Assert.Equal("Accepted", createJson.RootElement.GetProperty("whatsAppDelivery").GetProperty("status").GetString());

        string latestInviteLink;
        var inviteResponse = await client.PostAsync($"/api/staff/{userId}/invite-link", content: null);
        await TestApi.AssertStatusAsync(inviteResponse, HttpStatusCode.OK);
        using (var inviteJson = await TestApi.ReadJsonAsync(inviteResponse))
        {
            latestInviteLink = inviteJson.RootElement.GetProperty("inviteLink").GetString()!;
            Assert.Equal("Accepted", inviteJson.RootElement.GetProperty("whatsAppDelivery").GetProperty("status").GetString());
        }

        var inviteToken = QueryHelpers.ParseQuery(new Uri(latestInviteLink).Query)["token"].ToString();
        var acceptResponse = await client.PostAsJsonAsync("/api/auth/accept-invite", new
        {
            token = inviteToken,
            password = "NewPassword!123"
        });
        await TestApi.AssertStatusAsync(acceptResponse, HttpStatusCode.OK);
        TestApi.SetBearerToken(client, tenant, UserRole.Owner);

        var resetResponse = await client.PostAsync($"/api/staff/{userId}/reset-link", content: null);
        await TestApi.AssertStatusAsync(resetResponse, HttpStatusCode.OK);
        using (var resetJson = await TestApi.ReadJsonAsync(resetResponse))
        {
            Assert.Equal("Accepted", resetJson.RootElement.GetProperty("whatsAppDelivery").GetProperty("status").GetString());
        }

        await app.ExecuteDbContextAsync(async db =>
        {
            var logs = await db.NotificationLogs.IgnoreQueryFilters()
                .Where(l => l.TenantId == tenant.Id && l.WorkOrderId == null)
                .OrderBy(l => l.CreatedAt)
                .ToListAsync();
            Assert.Equal(3, logs.Count);
            Assert.All(logs, log => Assert.Equal(NotificationStatus.Accepted, log.Status));
            Assert.Contains(logs, log => log.EventType == NotificationEventType.StaffInvite);
            Assert.Contains(logs, log => log.EventType == NotificationEventType.PasswordReset);
        });
    }

    [Fact]
    public async Task Staff_whatsapp_delivery_failures_keep_link_fallback()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        await ConfigureProWhatsAppAsync(app, tenant.Id);

        var createResponse = await client.PostAsJsonAsync("/api/staff", new
        {
            fullName = "No Settings",
            email = "no-settings@example.test",
            phone = "+15550103003",
            role = "Staff"
        });
        await TestApi.AssertStatusAsync(createResponse, HttpStatusCode.OK);
        using var createJson = await TestApi.ReadJsonAsync(createResponse);
        Assert.Contains("/accept-invite?token=", createJson.RootElement.GetProperty("inviteLink").GetString());
        Assert.Equal("Failed", createJson.RootElement.GetProperty("whatsAppDelivery").GetProperty("status").GetString());
        Assert.Equal("SETTINGS_INCOMPLETE", createJson.RootElement.GetProperty("whatsAppDelivery").GetProperty("errorCode").GetString());

        await app.ExecuteDbContextAsync(async db =>
        {
            var log = await db.NotificationLogs.IgnoreQueryFilters().SingleAsync(l => l.TenantId == tenant.Id);
            Assert.Equal(NotificationStatus.Failed, log.Status);
            Assert.Equal("SETTINGS_INCOMPLETE", log.ErrorCode);
            Assert.Null(log.WorkOrderId);
        });

        await SaveWhatsAppSettingsAsync(client);
        var invalidPhoneResponse = await client.PostAsJsonAsync("/api/staff", new
        {
            fullName = "Invalid Phone",
            email = "invalid-phone@example.test",
            phone = "abc1234",
            role = "Staff"
        });
        await TestApi.AssertStatusAsync(invalidPhoneResponse, HttpStatusCode.OK);
        using var invalidPhoneJson = await TestApi.ReadJsonAsync(invalidPhoneResponse);
        Assert.Contains("/accept-invite?token=", invalidPhoneJson.RootElement.GetProperty("inviteLink").GetString());
        Assert.Equal("Failed", invalidPhoneJson.RootElement.GetProperty("whatsAppDelivery").GetProperty("status").GetString());
        Assert.Equal("PHONE_INVALID", invalidPhoneJson.RootElement.GetProperty("whatsAppDelivery").GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Staff_whatsapp_delivery_logs_quota_exceeded_with_link_fallback()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        await ConfigureProWhatsAppAsync(app, tenant.Id);

        await app.ExecuteDbContextAsync(async db =>
        {
            for (var i = 0; i < 500; i++)
            {
                db.NotificationLogs.Add(new NotificationLog
                {
                    TenantId = tenant.Id,
                    Channel = NotificationChannel.WhatsApp,
                    EventType = NotificationEventType.StaffInvite,
                    DispatchType = NotificationDispatchType.Automatic,
                    RecipientPhone = $"15550104{i:000}",
                    ProviderMessageId = $"wamid.staff-used-{i}",
                    Status = NotificationStatus.Accepted
                });
            }

            await db.SaveChangesAsync();
        });

        await SaveWhatsAppSettingsAsync(client);
        var response = await client.PostAsJsonAsync("/api/staff", new
        {
            fullName = "Quota Staff",
            email = "quota-staff@example.test",
            phone = "+15550103007",
            role = "Staff"
        });
        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);
        using var json = await TestApi.ReadJsonAsync(response);
        Assert.Contains("/accept-invite?token=", json.RootElement.GetProperty("inviteLink").GetString());
        Assert.Equal("Failed", json.RootElement.GetProperty("whatsAppDelivery").GetProperty("status").GetString());
        Assert.Equal("QUOTA_EXCEEDED", json.RootElement.GetProperty("whatsAppDelivery").GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Free_plan_staff_limit_blocks_extra_staff_accounts()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        await TestApi.RegisterTenantAsync(client);

        var firstResponse = await client.PostAsJsonAsync("/api/staff", new
        {
            fullName = "First Staff",
            email = "first@example.test",
            phone = "+15550103004",
            role = "Staff"
        });
        await TestApi.AssertStatusAsync(firstResponse, HttpStatusCode.OK);

        var secondResponse = await client.PostAsJsonAsync("/api/staff", new
        {
            fullName = "Second Staff",
            email = "second@example.test",
            phone = "+15550103005",
            role = "Staff"
        });

        await TestApi.AssertStatusAsync(secondResponse, HttpStatusCode.PaymentRequired);
    }

    [Fact]
    public async Task Manager_cannot_create_another_manager()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        TestApi.SetBearerToken(client, tenant, UserRole.Manager);

        var response = await client.PostAsJsonAsync("/api/staff", new
        {
            fullName = "Unauthorized Manager",
            email = "manager@example.test",
            phone = "+15550103006",
            role = "Manager"
        });

        await TestApi.AssertStatusAsync(response, HttpStatusCode.Forbidden);
    }

    private static async Task ConfigureProWhatsAppAsync(DetailFlowApiFactory app, Guid tenantId)
    {
        await app.ExecuteDbContextAsync(async db =>
        {
            var currentTenant = await db.Tenants.SingleAsync(t => t.Id == tenantId);
            currentTenant.Plan = TenantPlan.Pro;
            await db.SaveChangesAsync();
        });
    }

    private static async Task SaveWhatsAppSettingsAsync(HttpClient client)
    {
        var settingsResponse = await client.PatchAsJsonAsync("/api/notifications/whatsapp/settings", new
        {
            isEnabled = true,
            businessPhoneNumberId = "123456789",
            accessToken = "secret-token",
            clearAccessToken = false,
            templates = new object[]
            {
                new { eventType = "TrackingLink", templateName = "tracking_link", languageCode = "en_US" },
                new { eventType = "ReadyForPickup", templateName = "ready_for_pickup", languageCode = "en_US" },
                new { eventType = "StaffInvite", templateName = "staff_invite", languageCode = "en_US" },
                new { eventType = "PasswordReset", templateName = "password_reset", languageCode = "en_US" }
            },
            autoSendReady = true
        });
        await TestApi.AssertStatusAsync(settingsResponse, HttpStatusCode.OK);
    }
}
