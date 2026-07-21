using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using DetailFlow.Api.Data;
using DetailFlow.Api.Infrastructure;
using DetailFlow.Api.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.IdentityModel.Tokens;

namespace DetailFlow.Api.Tests;

internal static class TestApi
{
    public static HttpClient CreateClient(DetailFlowApiFactory app) =>
        app.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    public static async Task<TestTenant> RegisterTenantAsync(HttpClient client, string? slug = null)
    {
        slug ??= NewSlug();
        var response = await client.PostAsJsonAsync("/api/auth/register-tenant", new
        {
            tenantName = "Launch Detail",
            slug,
            ownerEmail = $"{slug}@example.test",
            ownerPassword = "TestPassword!123",
            ownerFullName = "Owner User"
        });

        await AssertStatusAsync(response, HttpStatusCode.OK);
        ApplyAuthCookieFromResponse(client, response, "Tenant registration should set the auth cookie.");

        using var json = await ReadJsonAsync(response);
        var user = json.RootElement.GetProperty("user");
        var tenant = new TestTenant(
            Guid.Parse(user.GetProperty("id").GetString()!),
            Guid.Parse(user.GetProperty("tenantId").GetString()!),
            user.GetProperty("tenantSlug").GetString()!);
        SetBearerToken(client, tenant);

        return tenant;
    }

    public static async Task LoginPlatformAdminAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/platform/auth/login", new
        {
            email = "admin@example.test",
            password = "AdminPassword!123"
        });

        await AssertStatusAsync(response, HttpStatusCode.OK);
        ApplyAuthCookieFromResponse(client, response, "Platform admin login should set the auth cookie.");
    }

    public static void SetBearerToken(HttpClient client, TestTenant tenant, UserRole role = UserRole.Owner, string userName = "Owner User")
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, tenant.UserId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, tenant.UserId.ToString()),
            new Claim("tenant_id", tenant.Id.ToString()),
            new Claim(ClaimTypes.Role, role.ToString()),
            new Claim("tenant_slug", tenant.Slug),
            new Claim("name", userName)
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(DetailFlowApiFactory.JwtSecret));
        var token = new JwtSecurityToken(
            issuer: DetailFlowApiFactory.JwtIssuer,
            audience: DetailFlowApiFactory.JwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        var tokenText = new JwtSecurityTokenHandler().WriteToken(token);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenText);
        client.DefaultRequestHeaders.Remove("Cookie");
        client.DefaultRequestHeaders.Add("Cookie", $"{AuthCookie.Name}={tokenText}");
    }

    public static async Task<Guid> GetExteriorWashServiceIdAsync(HttpClient client, string tenantSlug)
    {
        var response = await client.GetAsync($"/api/public/shops/{tenantSlug}/services");
        await AssertStatusAsync(response, HttpStatusCode.OK);

        using var json = await ReadJsonAsync(response);
        var service = json.RootElement
            .EnumerateArray()
            .First(item => item.GetProperty("name").GetString() == "Exterior Wash");

        return Guid.Parse(service.GetProperty("id").GetString()!);
    }

    public static async Task<BookingResult> CreatePublicBookingAsync(
        HttpClient client,
        string tenantSlug,
        Guid serviceId,
        DateTimeOffset scheduledAt,
        string plate = "TEST-101")
    {
        var response = await client.PostAsJsonAsync(
            $"/api/public/shops/{tenantSlug}/bookings",
            BuildPublicBookingPayload(serviceId, scheduledAt, plate));

        await AssertStatusAsync(response, HttpStatusCode.OK);

        using var json = await ReadJsonAsync(response);
        var root = json.RootElement;
        return new BookingResult(
            Guid.Parse(root.GetProperty("bookingId").GetString()!),
            Guid.Parse(root.GetProperty("workOrderId").GetString()!),
            root.GetProperty("trackingToken").GetString()!);
    }

    public static object BuildPublicBookingPayload(Guid serviceId, DateTimeOffset scheduledAt, string plate = "TEST-101") => new
    {
        customerName = "Maya Ortiz",
        customerPhone = "+1 (555) 010-2000",
        vehiclePlate = plate,
        vehicleMake = "Honda",
        vehicleModel = "Civic",
        vehicleColor = "Blue",
        vehicleType = "Sedan",
        serviceTypeId = serviceId,
        scheduledAt,
        notes = "Launch smoke test"
    };

    public static DateTimeOffset NextOpenSlot(int daysFromNow = 2)
    {
        var date = DateTimeOffset.UtcNow.Date.AddDays(daysFromNow);
        while (date.DayOfWeek == DayOfWeek.Friday)
            date = date.AddDays(2);

        return new DateTimeOffset(date.Year, date.Month, date.Day, 10, 0, 0, TimeSpan.Zero);
    }

    public static string NewSlug() => $"shop-{Guid.NewGuid():N}"[..18];

    public static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        await using var stream = await response.Content.ReadAsStreamAsync();
        return await JsonDocument.ParseAsync(stream);
    }

    public static async Task AssertStatusAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        if (response.StatusCode == expected)
            return;

        var body = await response.Content.ReadAsStringAsync();
        Assert.Fail($"Expected HTTP {(int)expected} {expected}, got {(int)response.StatusCode} {response.StatusCode}. Body: {body}");
    }

    public static void ApplyAuthCookieFromResponse(HttpClient client, HttpResponseMessage response, string failureMessage)
    {
        Assert.True(response.Headers.TryGetValues("Set-Cookie", out var values), failureMessage);
        var authCookie = values
            .Select(value => value.Split(';', 2)[0])
            .FirstOrDefault(value => value.StartsWith($"{AuthCookie.Name}=", StringComparison.Ordinal));

        Assert.False(string.IsNullOrWhiteSpace(authCookie));
        client.DefaultRequestHeaders.Remove("Cookie");
        client.DefaultRequestHeaders.Add("Cookie", authCookie);
    }
}

internal sealed record TestTenant(Guid UserId, Guid Id, string Slug);

internal sealed record BookingResult(Guid BookingId, Guid WorkOrderId, string TrackingToken);
