using System.Net;
using System.Net.Http.Json;
using DetailFlow.Api.Models;

namespace DetailFlow.Api.Tests;

public class ServiceCatalogApiTests
{
    [Fact]
    public async Task Owner_can_create_update_and_reorder_services()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);

        var listResponse = await client.GetAsync("/api/services");
        await TestApi.AssertStatusAsync(listResponse, HttpStatusCode.OK);
        using var initialJson = await TestApi.ReadJsonAsync(listResponse);
        var initialIds = initialJson.RootElement
            .EnumerateArray()
            .Select(item => Guid.Parse(item.GetProperty("id").GetString()!))
            .Take(2)
            .ToArray();

        Assert.Equal(2, initialIds.Length);

        var createResponse = await client.PostAsJsonAsync("/api/services", new
        {
            name = "Express Wax",
            description = "Fast exterior finish",
            basePrice = 35,
            durationMinutes = 45,
            sortOrder = 99
        });
        await TestApi.AssertStatusAsync(createResponse, HttpStatusCode.OK);
        using var createJson = await TestApi.ReadJsonAsync(createResponse);
        var createdId = Guid.Parse(createJson.RootElement.GetProperty("id").GetString()!);
        Assert.Equal("Express Wax", createJson.RootElement.GetProperty("name").GetString());

        var updateResponse = await client.PatchAsJsonAsync($"/api/services/{createdId}", new
        {
            name = "Express Wax Plus",
            basePrice = 42,
            durationMinutes = 60,
            isActive = false
        });
        await TestApi.AssertStatusAsync(updateResponse, HttpStatusCode.OK);

        var publicServicesResponse = await client.GetAsync($"/api/public/shops/{tenant.Slug}/services");
        await TestApi.AssertStatusAsync(publicServicesResponse, HttpStatusCode.OK);
        using var publicServicesJson = await TestApi.ReadJsonAsync(publicServicesResponse);
        Assert.DoesNotContain(
            publicServicesJson.RootElement.EnumerateArray(),
            item => item.GetProperty("id").GetString() == createdId.ToString());

        var managementServicesResponse = await client.GetAsync("/api/services?includeInactive=true");
        await TestApi.AssertStatusAsync(managementServicesResponse, HttpStatusCode.OK);
        using var managementServicesJson = await TestApi.ReadJsonAsync(managementServicesResponse);
        Assert.Contains(
            managementServicesJson.RootElement.EnumerateArray(),
            item => item.GetProperty("id").GetString() == createdId.ToString() &&
                    item.GetProperty("isActive").GetBoolean() == false);

        var reorderResponse = await client.PatchAsJsonAsync("/api/services/reorder", new
        {
            orderedIds = new[] { initialIds[1], initialIds[0] }
        });
        await TestApi.AssertStatusAsync(reorderResponse, HttpStatusCode.OK);
        using var reorderJson = await TestApi.ReadJsonAsync(reorderResponse);
        var reorderedIds = reorderJson.RootElement
            .EnumerateArray()
            .Select(item => Guid.Parse(item.GetProperty("id").GetString()!))
            .Take(2)
            .ToArray();

        Assert.Equal([initialIds[1], initialIds[0]], reorderedIds);
    }

    [Fact]
    public async Task Staff_cannot_mutate_service_catalog()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        TestApi.SetBearerToken(client, tenant, UserRole.Staff);

        var response = await client.PostAsJsonAsync("/api/services", new
        {
            name = "Unauthorized Service",
            basePrice = 20,
            durationMinutes = 30
        });

        await TestApi.AssertStatusAsync(response, HttpStatusCode.Forbidden);

        var includeInactiveResponse = await client.GetAsync("/api/services?includeInactive=true");
        await TestApi.AssertStatusAsync(includeInactiveResponse, HttpStatusCode.Forbidden);
    }
}
