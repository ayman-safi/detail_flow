using System.Net;
using System.Net.Http.Json;

namespace DetailFlow.Api.Tests;

public class AuthApiTests
{
    [Fact]
    public async Task Registered_owner_can_read_current_session()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);

        var response = await client.GetAsync("/api/auth/me");
        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);

        using var json = await TestApi.ReadJsonAsync(response);
        var user = json.RootElement.GetProperty("user");
        Assert.Equal(tenant.UserId.ToString(), user.GetProperty("id").GetString());
        Assert.Equal("Owner", user.GetProperty("role").GetString());
        Assert.Equal(tenant.Slug, user.GetProperty("tenantSlug").GetString());
    }

    [Fact]
    public async Task Duplicate_slug_and_bad_login_are_rejected()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var slug = TestApi.NewSlug();
        await TestApi.RegisterTenantAsync(client, slug);

        var duplicateResponse = await client.PostAsJsonAsync("/api/auth/register-tenant", new
        {
            tenantName = "Duplicate Shop",
            slug,
            ownerEmail = $"duplicate-{slug}@example.test",
            ownerPassword = "TestPassword!123",
            ownerFullName = "Duplicate Owner"
        });
        await TestApi.AssertStatusAsync(duplicateResponse, HttpStatusCode.BadRequest);

        var badLoginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = $"{slug}@example.test",
            tenantSlug = slug,
            password = "wrong-password"
        });
        await TestApi.AssertStatusAsync(badLoginResponse, HttpStatusCode.Unauthorized);
    }
}
