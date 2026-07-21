using System.Net;
using System.Net.Http.Json;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Tests;

public class TenantSettingsApiTests
{
    [Fact]
    public async Task Dashboard_language_is_tenant_scoped_and_limited_to_owner_and_manager()
    {
        using var app = new DetailFlowApiFactory();
        var firstClient = TestApi.CreateClient(app);
        var firstTenant = await TestApi.RegisterTenantAsync(firstClient);
        var secondClient = TestApi.CreateClient(app);
        await TestApi.RegisterTenantAsync(secondClient);

        var ownerUpdate = await firstClient.PatchAsJsonAsync(
            "/api/settings/dashboard-language",
            new { dashboardLocale = "tr" });
        await TestApi.AssertStatusAsync(ownerUpdate, HttpStatusCode.OK);

        TestApi.SetBearerToken(firstClient, firstTenant, UserRole.Manager);
        var managerUpdate = await firstClient.PatchAsJsonAsync(
            "/api/settings/dashboard-language",
            new { dashboardLocale = "ar" });
        await TestApi.AssertStatusAsync(managerUpdate, HttpStatusCode.OK);

        TestApi.SetBearerToken(firstClient, firstTenant, UserRole.Staff);
        var staffRead = await firstClient.GetAsync("/api/settings/dashboard-language");
        await TestApi.AssertStatusAsync(staffRead, HttpStatusCode.OK);
        using (var staffJson = await TestApi.ReadJsonAsync(staffRead))
        {
            Assert.Equal("ar", staffJson.RootElement.GetProperty("dashboardLocale").GetString());
        }

        var staffUpdate = await firstClient.PatchAsJsonAsync(
            "/api/settings/dashboard-language",
            new { dashboardLocale = "en" });
        await TestApi.AssertStatusAsync(staffUpdate, HttpStatusCode.Forbidden);

        var secondTenantRead = await secondClient.GetAsync("/api/settings/dashboard-language");
        await TestApi.AssertStatusAsync(secondTenantRead, HttpStatusCode.OK);
        using (var secondJson = await TestApi.ReadJsonAsync(secondTenantRead))
        {
            Assert.Equal("en", secondJson.RootElement.GetProperty("dashboardLocale").GetString());
        }

        TestApi.SetBearerToken(firstClient, firstTenant);
        var invalidUpdate = await firstClient.PatchAsJsonAsync(
            "/api/settings/dashboard-language",
            new { dashboardLocale = "invalid" });
        await TestApi.AssertStatusAsync(invalidUpdate, HttpStatusCode.BadRequest);

        var meResponse = await firstClient.GetAsync("/api/auth/me");
        await TestApi.AssertStatusAsync(meResponse, HttpStatusCode.OK);
        using var meJson = await TestApi.ReadJsonAsync(meResponse);
        Assert.Equal(
            "ar",
            meJson.RootElement.GetProperty("user").GetProperty("dashboardLocale").GetString());
    }

    [Fact]
    public async Task Authentication_falls_back_for_an_invalid_stored_dashboard_language()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);

        await app.ExecuteDbContextAsync(async db =>
        {
            var currentTenant = await db.Tenants.SingleAsync(t => t.Id == tenant.Id);
            currentTenant.DashboardLocale = "xx";
            await db.SaveChangesAsync();
        });

        var response = await client.GetAsync("/api/auth/me");
        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);
        using var json = await TestApi.ReadJsonAsync(response);
        Assert.Equal(
            "en",
            json.RootElement.GetProperty("user").GetProperty("dashboardLocale").GetString());
    }

    [Fact]
    public async Task Owner_can_update_profile_receipt_currency_and_availability()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        await TestApi.RegisterTenantAsync(client);

        var profileResponse = await client.PatchAsJsonAsync("/api/tenant/profile", new
        {
            name = "Updated Detail Shop",
            logoUrl = "https://r2.example.test/logos/test/logo.png"
        });
        await TestApi.AssertStatusAsync(profileResponse, HttpStatusCode.OK);
        using (var profileJson = await TestApi.ReadJsonAsync(profileResponse))
        {
            Assert.Equal("Updated Detail Shop", profileJson.RootElement.GetProperty("name").GetString());
            Assert.Equal("https://r2.example.test/logos/test/logo.png", profileJson.RootElement.GetProperty("logoUrl").GetString());
        }

        var receiptUpdate = await client.PutAsJsonAsync("/api/settings/receipt", new { currency = "USD" });
        await TestApi.AssertStatusAsync(receiptUpdate, HttpStatusCode.OK);
        using (var receiptJson = await TestApi.ReadJsonAsync(receiptUpdate))
        {
            Assert.Equal("USD", receiptJson.RootElement.GetProperty("currency").GetString());
            Assert.Contains(
                receiptJson.RootElement.GetProperty("supportedCurrencies").EnumerateArray(),
                item => item.GetProperty("currency").GetString() == "USD" && item.GetProperty("symbol").GetString() == "$");
        }

        var availabilityUpdate = await client.PutAsJsonAsync("/api/settings/availability", new
        {
            bayCapacity = 1,
            closurePeriods = new[]
            {
                new { from = "2030-01-02", to = "2030-01-03", reason = "Maintenance" }
            }
        });
        await TestApi.AssertStatusAsync(availabilityUpdate, HttpStatusCode.OK);

        var availabilityResponse = await client.GetAsync("/api/settings/availability");
        await TestApi.AssertStatusAsync(availabilityResponse, HttpStatusCode.OK);
        using (var availabilityJson = await TestApi.ReadJsonAsync(availabilityResponse))
        {
            Assert.Equal(1, availabilityJson.RootElement.GetProperty("bayCapacity").GetInt32());
            Assert.Equal("USD", availabilityJson.RootElement.GetProperty("currency").GetString());
            Assert.Equal("Maintenance", availabilityJson.RootElement.GetProperty("closurePeriods")[0].GetProperty("reason").GetString());
        }
    }

    [Fact]
    public async Task Profile_rejects_untrusted_logo_url()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        await TestApi.RegisterTenantAsync(client);

        var response = await client.PatchAsJsonAsync("/api/tenant/profile", new
        {
            logoUrl = "https://example.com/logo.png"
        });

        await TestApi.AssertStatusAsync(response, HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Owner_can_upload_logo_to_storage()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);

        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(PngBytes()), "file", "logo.png");

        var response = await client.PostAsync("/api/tenant/logo", content);
        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);
        using var json = await TestApi.ReadJsonAsync(response);
        var logoUrl = json.RootElement.GetProperty("logoUrl").GetString();
        Assert.StartsWith($"https://r2.example.test/logos/{tenant.Id}/logo", logoUrl);

        await app.ExecuteDbContextAsync(async db =>
        {
            var currentTenant = await db.Tenants.SingleAsync(t => t.Id == tenant.Id);
            Assert.Equal(logoUrl, currentTenant.LogoUrl);
        });
    }

    private static byte[] PngBytes() =>
    [
        0x89, 0x50, 0x4E, 0x47,
        0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D
    ];
}
