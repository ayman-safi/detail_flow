using System.Net;
using System.Net.Http.Json;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Tests;

public class PlatformAdminApiTests
{
    [Fact]
    public async Task Tenant_owner_cannot_access_platform_admin_endpoints()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        await TestApi.RegisterTenantAsync(client);

        var response = await client.GetAsync("/api/platform/admin/tenants");

        await TestApi.AssertStatusAsync(response, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Super_admin_can_manage_tenant_and_start_support_session()
    {
        using var app = new DetailFlowApiFactory();
        var tenantClient = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(tenantClient);

        var platformClient = TestApi.CreateClient(app);
        await TestApi.LoginPlatformAdminAsync(platformClient);

        var listResponse = await platformClient.GetAsync("/api/platform/admin/tenants");
        await TestApi.AssertStatusAsync(listResponse, HttpStatusCode.OK);
        using (var listJson = await TestApi.ReadJsonAsync(listResponse))
        {
            Assert.Contains(
                listJson.RootElement.GetProperty("items").EnumerateArray(),
                item => item.GetProperty("id").GetString() == tenant.Id.ToString());
        }

        var updateResponse = await platformClient.PatchAsJsonAsync(
            $"/api/platform/admin/tenants/{tenant.Id}",
            new
            {
                plan = "Business",
                billingStatus = "Active",
                billingNotes = "Manual invoice paid through launch package.",
                whatsAppMonthlyAddonMessages = 250,
                dashboardLocale = "tr"
            });
        await TestApi.AssertStatusAsync(updateResponse, HttpStatusCode.OK);
        using (var updateJson = await TestApi.ReadJsonAsync(updateResponse))
        {
            Assert.Equal("Business", updateJson.RootElement.GetProperty("plan").GetString());
            Assert.Equal("Active", updateJson.RootElement.GetProperty("billingStatus").GetString());
            Assert.Equal("Manual invoice paid through launch package.", updateJson.RootElement.GetProperty("billingNotes").GetString());
            Assert.Equal(250, updateJson.RootElement.GetProperty("whatsAppMonthlyAddonMessages").GetInt32());
            Assert.Equal("tr", updateJson.RootElement.GetProperty("dashboardLocale").GetString());
        }

        await app.ExecuteDbContextAsync(async db =>
        {
            var updatedTenant = await db.Tenants.IgnoreQueryFilters().SingleAsync(t => t.Id == tenant.Id);
            Assert.Equal(TenantPlan.Business, updatedTenant.Plan);
            Assert.Equal(TenantBillingStatus.Active, updatedTenant.BillingStatus);
            Assert.Equal(250, updatedTenant.WhatsAppMonthlyAddonMessages);
            Assert.Equal("tr", updatedTenant.DashboardLocale);
        });

        var invalidLanguageResponse = await platformClient.PatchAsJsonAsync(
            $"/api/platform/admin/tenants/{tenant.Id}",
            new { dashboardLocale = "unsupported" });
        await TestApi.AssertStatusAsync(invalidLanguageResponse, HttpStatusCode.BadRequest);

        var supportResponse = await platformClient.PostAsJsonAsync(
            $"/api/platform/admin/tenants/{tenant.Id}/support-session",
            new { durationMinutes = 30 });
        await TestApi.AssertStatusAsync(supportResponse, HttpStatusCode.OK);
        TestApi.ApplyAuthCookieFromResponse(platformClient, supportResponse, "Support session should set the auth cookie.");

        var meResponse = await platformClient.GetAsync("/api/auth/me");
        await TestApi.AssertStatusAsync(meResponse, HttpStatusCode.OK);
        using var meJson = await TestApi.ReadJsonAsync(meResponse);
        var user = meJson.RootElement.GetProperty("user");
        Assert.Equal("Owner", user.GetProperty("role").GetString());
        Assert.Equal(tenant.Id.ToString(), user.GetProperty("tenantId").GetString());
        Assert.Equal(tenant.Slug, user.GetProperty("tenantSlug").GetString());
        Assert.Equal("tr", user.GetProperty("dashboardLocale").GetString());
        Assert.True(user.GetProperty("isSupportSession").GetBoolean());
    }

    [Fact]
    public async Task Disabled_tenant_cannot_login()
    {
        using var app = new DetailFlowApiFactory();
        var tenantClient = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(tenantClient);

        var platformClient = TestApi.CreateClient(app);
        await TestApi.LoginPlatformAdminAsync(platformClient);
        var disableResponse = await platformClient.PatchAsJsonAsync(
            $"/api/platform/admin/tenants/{tenant.Id}",
            new { isActive = false, billingStatus = "Suspended" });
        await TestApi.AssertStatusAsync(disableResponse, HttpStatusCode.OK);

        var loginResponse = await tenantClient.PostAsJsonAsync("/api/auth/login", new
        {
            email = $"{tenant.Slug}@example.test",
            tenantSlug = tenant.Slug,
            password = "TestPassword!123"
        });

        await TestApi.AssertStatusAsync(loginResponse, HttpStatusCode.Unauthorized);
    }
}
