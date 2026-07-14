using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Tests;

public class NotificationsApiTests
{
    [Fact]
    public async Task Free_plan_cannot_enable_whatsapp_automation()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        await TestApi.RegisterTenantAsync(client);

        var response = await client.PatchAsJsonAsync("/api/notifications/whatsapp/settings", new
        {
            isEnabled = true,
            businessPhoneNumberId = "123456789",
            accessToken = "secret-token",
            clearAccessToken = false,
            templates = WhatsAppTemplates(),
            autoSendReady = true
        });

        await TestApi.AssertStatusAsync(response, HttpStatusCode.PaymentRequired);
    }

    [Fact]
    public async Task Pro_owner_can_save_whatsapp_settings_without_exposing_token()
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

        var updateResponse = await client.PatchAsJsonAsync("/api/notifications/whatsapp/settings", new
        {
            isEnabled = true,
            businessPhoneNumberId = "123456789",
            accessToken = "secret-token",
            clearAccessToken = false,
            templates = WhatsAppTemplates(),
            autoSendReady = true
        });
        await TestApi.AssertStatusAsync(updateResponse, HttpStatusCode.OK);
        using (var updateJson = await TestApi.ReadJsonAsync(updateResponse))
        {
            Assert.True(updateJson.RootElement.GetProperty("isEnabled").GetBoolean());
            Assert.True(updateJson.RootElement.GetProperty("hasAccessToken").GetBoolean());
            Assert.False(updateJson.RootElement.TryGetProperty("accessToken", out _));
            Assert.Contains(
                updateJson.RootElement.GetProperty("templates").EnumerateArray(),
                item => item.GetProperty("eventType").GetString() == "ReadyForPickup" &&
                        item.GetProperty("templateName").GetString() == "ready_for_pickup");
        }

        var getResponse = await client.GetAsync("/api/notifications/whatsapp/settings");
        await TestApi.AssertStatusAsync(getResponse, HttpStatusCode.OK);
        using var getJson = await TestApi.ReadJsonAsync(getResponse);
        Assert.Equal("123456789", getJson.RootElement.GetProperty("businessPhoneNumberId").GetString());
        Assert.True(getJson.RootElement.GetProperty("hasAccessToken").GetBoolean());
        Assert.Contains(
            getJson.RootElement.GetProperty("templates").EnumerateArray(),
            item => item.GetProperty("eventType").GetString() == "TrackingLink" &&
                    item.GetProperty("templateName").GetString() == "tracking_link");
        Assert.Contains(
            getJson.RootElement.GetProperty("templates").EnumerateArray(),
            item => item.GetProperty("eventType").GetString() == "StaffInvite" &&
                    item.GetProperty("templateName").GetString() == "staff_invite");
        Assert.Contains(
            getJson.RootElement.GetProperty("templates").EnumerateArray(),
            item => item.GetProperty("eventType").GetString() == "PasswordReset" &&
                    item.GetProperty("templateName").GetString() == "password_reset");
    }

    [Fact]
    public async Task WhatsApp_webhook_verifies_challenge_and_updates_status_log()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);

        var verifyResponse = await client.GetAsync("/api/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge-123");
        await TestApi.AssertStatusAsync(verifyResponse, HttpStatusCode.OK);
        Assert.Equal("challenge-123", await verifyResponse.Content.ReadAsStringAsync());

        await app.ExecuteDbContextAsync(async db =>
        {
            db.NotificationLogs.Add(new NotificationLog
            {
                TenantId = tenant.Id,
                ProviderMessageId = "wamid.123",
                RecipientPhone = "15550102000",
                Status = NotificationStatus.Accepted
            });
            await db.SaveChangesAsync();
        });

        const string payload = """
            {
              "entry": [
                {
                  "changes": [
                    {
                      "value": {
                        "statuses": [
                          { "id": "wamid.123", "status": "delivered" }
                        ]
                      }
                    }
                  ]
                }
              ]
            }
            """;

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        content.Headers.Add("X-Hub-Signature-256", BuildWebhookSignature(payload));
        var webhookResponse = await client.PostAsync("/api/integrations/whatsapp/webhook", content);
        await TestApi.AssertStatusAsync(webhookResponse, HttpStatusCode.OK);

        await app.ExecuteDbContextAsync(async db =>
        {
            var log = await db.NotificationLogs.IgnoreQueryFilters().SingleAsync(l => l.ProviderMessageId == "wamid.123");
            Assert.Equal(NotificationStatus.Delivered, log.Status);
        });
    }

    [Fact]
    public async Task Free_plan_can_prepare_manual_whatsapp_shares_without_consuming_quota()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, TestApi.NextOpenSlot());

        var response = await client.PostAsync($"/api/work-orders/{booking.WorkOrderId}/share/whatsapp?eventType=TrackingLink&locale=ar-SA", content: null);
        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);
        using (var json = await TestApi.ReadJsonAsync(response))
        {
            Assert.Equal("TrackingLink", json.RootElement.GetProperty("eventType").GetString());
            Assert.Equal("15550102000", json.RootElement.GetProperty("customerPhone").GetString());
            Assert.Contains($"/track/{booking.TrackingToken}", json.RootElement.GetProperty("trackingUrl").GetString());
            Assert.Contains("locale=ar-SA", json.RootElement.GetProperty("receiptUrl").GetString());
            Assert.Contains(booking.TrackingToken, json.RootElement.GetProperty("whatsAppText").GetString());
        }

        var readyResponse = await client.PostAsync($"/api/work-orders/{booking.WorkOrderId}/share/whatsapp?eventType=ReadyForPickup&locale=en", content: null);
        await TestApi.AssertStatusAsync(readyResponse, HttpStatusCode.OK);
        using (var readyJson = await TestApi.ReadJsonAsync(readyResponse))
        {
            Assert.Equal("ReadyForPickup", readyJson.RootElement.GetProperty("eventType").GetString());
            Assert.Contains("ready for pickup", readyJson.RootElement.GetProperty("whatsAppText").GetString(), StringComparison.OrdinalIgnoreCase);
            Assert.Contains("Receipt:", readyJson.RootElement.GetProperty("whatsAppText").GetString());
        }

        await app.ExecuteDbContextAsync(async db =>
        {
            var logs = await db.NotificationLogs.IgnoreQueryFilters()
                .Where(l => l.WorkOrderId == booking.WorkOrderId)
                .OrderBy(l => l.EventType)
                .ToListAsync();
            Assert.Equal(2, logs.Count);
            Assert.All(logs, log =>
            {
                Assert.Equal(NotificationDispatchType.Manual, log.DispatchType);
                Assert.Equal(NotificationStatus.Requested, log.Status);
                Assert.Equal("Owner User", log.RequestedByName);
            });
        });

        var planResponse = await client.GetAsync("/api/plan/status");
        await TestApi.AssertStatusAsync(planResponse, HttpStatusCode.OK);
        using var planJson = await TestApi.ReadJsonAsync(planResponse);
        Assert.Equal(0, planJson.RootElement.GetProperty("whatsAppMessagesUsed").GetInt32());
    }

    [Fact]
    public async Task Ready_stage_auto_sends_whatsapp_when_pro_settings_are_enabled()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, TestApi.NextOpenSlot());

        await app.ExecuteDbContextAsync(async db =>
        {
            var currentTenant = await db.Tenants.SingleAsync(t => t.Id == tenant.Id);
            currentTenant.Plan = TenantPlan.Pro;
            await db.SaveChangesAsync();
        });

        var settingsResponse = await client.PatchAsJsonAsync("/api/notifications/whatsapp/settings", new
        {
            isEnabled = true,
            businessPhoneNumberId = "123456789",
            accessToken = "secret-token",
            clearAccessToken = false,
            templates = WhatsAppTemplates(),
            autoSendReady = true
        });
        await TestApi.AssertStatusAsync(settingsResponse, HttpStatusCode.OK);

        var stageResponse = await client.PatchAsJsonAsync($"/api/work-orders/{booking.WorkOrderId}/stage", new
        {
            newStage = "Ready"
        });
        await TestApi.AssertStatusAsync(stageResponse, HttpStatusCode.OK);

        await app.ExecuteDbContextAsync(async db =>
        {
            var log = await db.NotificationLogs.IgnoreQueryFilters().SingleAsync(l =>
                l.WorkOrderId == booking.WorkOrderId &&
                l.EventType == NotificationEventType.ReadyForPickup);
            Assert.Equal(NotificationDispatchType.Automatic, log.DispatchType);
            Assert.Equal(NotificationStatus.Accepted, log.Status);
            Assert.Equal("wamid.test-message", log.ProviderMessageId);
        });
    }

    [Fact]
    public async Task Ready_stage_auto_send_logs_quota_exceeded_when_pro_quota_is_used()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, TestApi.NextOpenSlot());

        await app.ExecuteDbContextAsync(async db =>
        {
            var currentTenant = await db.Tenants.SingleAsync(t => t.Id == tenant.Id);
            currentTenant.Plan = TenantPlan.Pro;
            for (var i = 0; i < 500; i++)
            {
                db.NotificationLogs.Add(new NotificationLog
                {
                    TenantId = tenant.Id,
                    Channel = NotificationChannel.WhatsApp,
                    EventType = NotificationEventType.ReadyForPickup,
                    DispatchType = NotificationDispatchType.Automatic,
                    RecipientPhone = $"15550102{i:000}",
                    ProviderMessageId = $"wamid.used-{i}",
                    Status = NotificationStatus.Accepted
                });
            }

            await db.SaveChangesAsync();
        });

        var settingsResponse = await client.PatchAsJsonAsync("/api/notifications/whatsapp/settings", new
        {
            isEnabled = true,
            businessPhoneNumberId = "123456789",
            accessToken = "secret-token",
            clearAccessToken = false,
            templates = WhatsAppTemplates(),
            autoSendReady = true
        });
        await TestApi.AssertStatusAsync(settingsResponse, HttpStatusCode.OK);

        var stageResponse = await client.PatchAsJsonAsync($"/api/work-orders/{booking.WorkOrderId}/stage", new
        {
            newStage = "Ready"
        });
        await TestApi.AssertStatusAsync(stageResponse, HttpStatusCode.OK);

        await app.ExecuteDbContextAsync(async db =>
        {
            var log = await db.NotificationLogs.IgnoreQueryFilters().SingleAsync(l =>
                l.WorkOrderId == booking.WorkOrderId &&
                l.EventType == NotificationEventType.ReadyForPickup);
            Assert.Equal(NotificationDispatchType.Automatic, log.DispatchType);
            Assert.Equal(NotificationStatus.Failed, log.Status);
            Assert.Equal("QUOTA_EXCEEDED", log.ErrorCode);
            Assert.Null(log.ProviderMessageId);
        });
    }

    private static string BuildWebhookSignature(string payload)
    {
        var hash = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes("test-whatsapp-secret"),
            Encoding.UTF8.GetBytes(payload));

        return $"sha256={Convert.ToHexString(hash).ToLowerInvariant()}";
    }

    private static object[] WhatsAppTemplates() =>
    [
        new
        {
            eventType = "TrackingLink",
            templateName = "tracking_link",
            languageCode = "en_US"
        },
        new
        {
            eventType = "ReadyForPickup",
            templateName = "ready_for_pickup",
            languageCode = "en_US"
        },
        new
        {
            eventType = "StaffInvite",
            templateName = "staff_invite",
            languageCode = "en_US"
        },
        new
        {
            eventType = "PasswordReset",
            templateName = "password_reset",
            languageCode = "en_US"
        }
    ];
}
