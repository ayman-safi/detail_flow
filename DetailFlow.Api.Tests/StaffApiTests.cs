using System.Net;
using System.Net.Http.Json;
using DetailFlow.Api.Models;
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
            role = "Manager",
            isActive = true
        });
        await TestApi.AssertStatusAsync(updateResponse, HttpStatusCode.OK);
        using var updateJson = await TestApi.ReadJsonAsync(updateResponse);
        Assert.Equal("Alex Manager", updateJson.RootElement.GetProperty("fullName").GetString());
        Assert.Equal("Manager", updateJson.RootElement.GetProperty("role").GetString());
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
            role = "Staff"
        });
        await TestApi.AssertStatusAsync(firstResponse, HttpStatusCode.OK);

        var secondResponse = await client.PostAsJsonAsync("/api/staff", new
        {
            fullName = "Second Staff",
            email = "second@example.test",
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
            role = "Manager"
        });

        await TestApi.AssertStatusAsync(response, HttpStatusCode.Forbidden);
    }
}
