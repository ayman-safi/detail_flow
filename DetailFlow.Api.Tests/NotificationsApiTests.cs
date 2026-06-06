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
            readyTemplateName = "ready_for_pickup",
            templateLanguageCode = "en_US",
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
            readyTemplateName = "ready_for_pickup",
            templateLanguageCode = "en_US",
            autoSendReady = true
        });
        await TestApi.AssertStatusAsync(updateResponse, HttpStatusCode.OK);
        using (var updateJson = await TestApi.ReadJsonAsync(updateResponse))
        {
            Assert.True(updateJson.RootElement.GetProperty("isEnabled").GetBoolean());
            Assert.True(updateJson.RootElement.GetProperty("hasAccessToken").GetBoolean());
            Assert.False(updateJson.RootElement.TryGetProperty("accessToken", out _));
        }

        var getResponse = await client.GetAsync("/api/notifications/whatsapp/settings");
        await TestApi.AssertStatusAsync(getResponse, HttpStatusCode.OK);
        using var getJson = await TestApi.ReadJsonAsync(getResponse);
        Assert.Equal("123456789", getJson.RootElement.GetProperty("businessPhoneNumberId").GetString());
        Assert.True(getJson.RootElement.GetProperty("hasAccessToken").GetBoolean());
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
    public async Task Manual_tracking_share_requires_pro_and_records_requested_log()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, TestApi.NextOpenSlot());

        var freeResponse = await client.PostAsync($"/api/work-orders/{booking.WorkOrderId}/share/whatsapp?locale=ar-SA", content: null);
        await TestApi.AssertStatusAsync(freeResponse, HttpStatusCode.PaymentRequired);

        await app.ExecuteDbContextAsync(async db =>
        {
            var currentTenant = await db.Tenants.SingleAsync(t => t.Id == tenant.Id);
            currentTenant.Plan = TenantPlan.Pro;
            await db.SaveChangesAsync();
        });

        var response = await client.PostAsync($"/api/work-orders/{booking.WorkOrderId}/share/whatsapp?locale=ar-SA", content: null);
        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);
        using (var json = await TestApi.ReadJsonAsync(response))
        {
            Assert.Equal("15550102000", json.RootElement.GetProperty("customerPhone").GetString());
            Assert.Contains($"/track/{booking.TrackingToken}", json.RootElement.GetProperty("trackingUrl").GetString());
            Assert.Contains("locale=ar-SA", json.RootElement.GetProperty("receiptUrl").GetString());
            Assert.Contains(booking.TrackingToken, json.RootElement.GetProperty("whatsAppText").GetString());
        }

        await app.ExecuteDbContextAsync(async db =>
        {
            var log = await db.NotificationLogs.IgnoreQueryFilters().SingleAsync(l =>
                l.WorkOrderId == booking.WorkOrderId &&
                l.EventType == NotificationEventType.TrackingLink);
            Assert.Equal(NotificationDispatchType.Manual, log.DispatchType);
            Assert.Equal(NotificationStatus.Requested, log.Status);
            Assert.Equal("Owner User", log.RequestedByName);
        });
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
            readyTemplateName = "ready_for_pickup",
            templateLanguageCode = "en_US",
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

    private static string BuildWebhookSignature(string payload)
    {
        var hash = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes("test-whatsapp-secret"),
            Encoding.UTF8.GetBytes(payload));

        return $"sha256={Convert.ToHexString(hash).ToLowerInvariant()}";
    }
}
