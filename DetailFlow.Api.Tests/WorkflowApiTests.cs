using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using DetailFlow.Api.Data;
using DetailFlow.Api.Infrastructure;
using DetailFlow.Api.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace DetailFlow.Api.Tests;

public class WorkflowApiTests
{
    [Fact]
    public async Task Public_booking_creates_trackable_work_order()
    {
        using var app = new DetailFlowApiFactory();
        var client = CreateClient(app);
        var tenant = await RegisterTenantAsync(client, NewSlug());
        var serviceId = await GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var scheduledAt = NextOpenSlot();

        var booking = await CreatePublicBookingAsync(client, tenant.Slug, serviceId, scheduledAt);

        var trackingResponse = await client.GetAsync($"/api/work-orders/track/{booking.TrackingToken}");
        await AssertStatusAsync(trackingResponse, HttpStatusCode.OK);

        using var trackingJson = await ReadJsonAsync(trackingResponse);
        var tracking = trackingJson.RootElement;
        Assert.Equal("Booked", tracking.GetProperty("stage").GetString());
        Assert.Equal(JsonValueKind.Null, tracking.GetProperty("customerName").ValueKind);
        Assert.Equal("Civic", tracking.GetProperty("vehicleModel").GetString());
        Assert.Equal("Exterior Wash", tracking.GetProperty("serviceName").GetString());

        await app.ExecuteDbContextAsync(async db =>
        {
            Assert.Equal(1, await db.Bookings.IgnoreQueryFilters().CountAsync(b => b.TenantId == tenant.Id));
            var workOrder = await db.WorkOrders.IgnoreQueryFilters().SingleAsync(w => w.Id == booking.WorkOrderId);
            Assert.Equal(WorkOrderStage.Booked, workOrder.Stage);
            Assert.Equal(booking.TrackingToken, workOrder.TrackingToken);
        });
    }

    [Fact]
    public async Task Stage_change_records_history_and_updates_public_tracking()
    {
        using var app = new DetailFlowApiFactory();
        var client = CreateClient(app);
        var tenant = await RegisterTenantAsync(client, NewSlug());
        var serviceId = await GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await CreatePublicBookingAsync(client, tenant.Slug, serviceId, NextOpenSlot());

        var stageResponse = await client.PatchAsJsonAsync(
            $"/api/work-orders/{booking.WorkOrderId}/stage",
            new { newStage = "Arrived" });

        await AssertStatusAsync(stageResponse, HttpStatusCode.OK);
        using var stageJson = await ReadJsonAsync(stageResponse);
        Assert.Equal("Arrived", stageJson.RootElement.GetProperty("stage").GetString());

        await app.ExecuteDbContextAsync(async db =>
        {
            var history = await db.WorkOrderStageHistory
                .IgnoreQueryFilters()
                .SingleAsync(h => h.WorkOrderId == booking.WorkOrderId);

            Assert.Equal(WorkOrderStage.Booked, history.FromStage);
            Assert.Equal(WorkOrderStage.Arrived, history.ToStage);
            Assert.Equal("Owner User", history.ChangedByName);
        });

        var trackingResponse = await client.GetAsync($"/api/work-orders/track/{booking.TrackingToken}");
        await AssertStatusAsync(trackingResponse, HttpStatusCode.OK);
        using var trackingJson = await ReadJsonAsync(trackingResponse);
        Assert.Equal("Arrived", trackingJson.RootElement.GetProperty("stage").GetString());
    }

    [Fact]
    public async Task Free_plan_monthly_booking_limit_blocks_public_booking()
    {
        using var app = new DetailFlowApiFactory();
        var client = CreateClient(app);
        var tenant = await RegisterTenantAsync(client, NewSlug());
        var serviceId = await GetExteriorWashServiceIdAsync(client, tenant.Slug);

        await SeedMonthlyBookingsAsync(app, tenant.Id, serviceId, 30);

        var response = await client.PostAsJsonAsync(
            $"/api/public/shops/{tenant.Slug}/bookings",
            BuildPublicBookingPayload(serviceId, NextOpenSlot(daysFromNow: 7), plate: "LIMIT-31"));

        await AssertStatusAsync(response, HttpStatusCode.PaymentRequired);
        using var json = await ReadJsonAsync(response);
        Assert.Equal("plan_limit_exceeded", json.RootElement.GetProperty("error").GetString());
        Assert.True(json.RootElement.GetProperty("upgrade").GetBoolean());

        var bookingCount = await app.ExecuteDbContextAsync(db =>
            db.Bookings.IgnoreQueryFilters().CountAsync(b => b.TenantId == tenant.Id));
        Assert.Equal(30, bookingCount);
    }

    private static async Task<TestTenant> RegisterTenantAsync(HttpClient client, string slug)
    {
        var response = await client.PostAsJsonAsync("/api/auth/register-tenant", new
        {
            tenantName = "Launch Detail",
            slug,
            ownerEmail = $"{slug}@example.test",
            ownerPassword = "TestPassword!123",
            ownerFullName = "Owner User"
        });

        await AssertStatusAsync(response, HttpStatusCode.OK);

        Assert.True(response.Headers.TryGetValues("Set-Cookie", out var values), "Tenant registration should set the auth cookie.");
        var authCookie = values
            .Select(value => value.Split(';', 2)[0])
            .FirstOrDefault(value => value.StartsWith($"{AuthCookie.Name}=", StringComparison.Ordinal));

        Assert.False(string.IsNullOrWhiteSpace(authCookie));
        client.DefaultRequestHeaders.Remove("Cookie");
        client.DefaultRequestHeaders.Add("Cookie", authCookie);

        using var json = await ReadJsonAsync(response);
        var user = json.RootElement.GetProperty("user");
        var tenant = new TestTenant(
            Guid.Parse(user.GetProperty("id").GetString()!),
            Guid.Parse(user.GetProperty("tenantId").GetString()!),
            user.GetProperty("tenantSlug").GetString()!);
        SetBearerToken(client, tenant);

        return tenant;
    }

    private static async Task<Guid> GetExteriorWashServiceIdAsync(HttpClient client, string tenantSlug)
    {
        var response = await client.GetAsync($"/api/public/shops/{tenantSlug}/services");
        await AssertStatusAsync(response, HttpStatusCode.OK);

        using var json = await ReadJsonAsync(response);
        var service = json.RootElement
            .EnumerateArray()
            .First(item => item.GetProperty("name").GetString() == "Exterior Wash");

        return Guid.Parse(service.GetProperty("id").GetString()!);
    }

    private static async Task<BookingResult> CreatePublicBookingAsync(
        HttpClient client,
        string tenantSlug,
        Guid serviceId,
        DateTimeOffset scheduledAt)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/public/shops/{tenantSlug}/bookings",
            BuildPublicBookingPayload(serviceId, scheduledAt));

        await AssertStatusAsync(response, HttpStatusCode.OK);

        using var json = await ReadJsonAsync(response);
        var root = json.RootElement;
        return new BookingResult(
            Guid.Parse(root.GetProperty("bookingId").GetString()!),
            Guid.Parse(root.GetProperty("workOrderId").GetString()!),
            root.GetProperty("trackingToken").GetString()!);
    }

    private static object BuildPublicBookingPayload(Guid serviceId, DateTimeOffset scheduledAt, string plate = "TEST-101") => new
    {
        customerPhone = "+1 (555) 010-2000",
        vehicle = new
        {
            plateNumber = plate,
            make = "Honda",
            model = "Civic",
            color = "Blue",
            vehicleType = "Sedan"
        },
        serviceTypeId = serviceId,
        scheduledAt,
        notes = "Launch smoke test"
    };

    private static async Task SeedMonthlyBookingsAsync(
        DetailFlowApiFactory app,
        Guid tenantId,
        Guid serviceId,
        int count)
    {
        await app.ExecuteDbContextAsync(async db =>
        {
            var now = DateTimeOffset.UtcNow;

            for (var i = 0; i < count; i++)
            {
                var customer = new Customer
                {
                    TenantId = tenantId,
                    FullName = $"Quota Customer {i:00}",
                    Phone = $"155501{i:0000}"
                };
                var vehicle = new Vehicle
                {
                    TenantId = tenantId,
                    Customer = customer,
                    PlateNumber = $"QTA-{i:00}",
                    Make = "Toyota",
                    Model = "Corolla",
                    Color = "Silver"
                };

                db.Bookings.Add(new Booking
                {
                    TenantId = tenantId,
                    Customer = customer,
                    Vehicle = vehicle,
                    ServiceTypeId = serviceId,
                    ScheduledAt = NextOpenSlot(daysFromNow: 10 + i),
                    Status = BookingStatus.Confirmed,
                    CreatedAt = now
                });
            }

            await db.SaveChangesAsync();
        });
    }

    private static DateTimeOffset NextOpenSlot(int daysFromNow = 2)
    {
        var date = DateTimeOffset.UtcNow.Date.AddDays(daysFromNow);
        while (date.DayOfWeek == DayOfWeek.Friday)
            date = date.AddDays(1);

        return new DateTimeOffset(date.Year, date.Month, date.Day, 10, 0, 0, TimeSpan.Zero);
    }

    private static string NewSlug() => $"shop-{Guid.NewGuid():N}"[..18];

    private static HttpClient CreateClient(DetailFlowApiFactory app) =>
        app.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private static void SetBearerToken(HttpClient client, TestTenant tenant)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, tenant.UserId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, tenant.UserId.ToString()),
            new Claim("tenant_id", tenant.Id.ToString()),
            new Claim(ClaimTypes.Role, UserRole.Owner.ToString()),
            new Claim("tenant_slug", tenant.Slug),
            new Claim("name", "Owner User")
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(DetailFlowApiFactory.JwtSecret));
        var token = new JwtSecurityToken(
            issuer: DetailFlowApiFactory.JwtIssuer,
            audience: DetailFlowApiFactory.JwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(token));
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        await using var stream = await response.Content.ReadAsStreamAsync();
        return await JsonDocument.ParseAsync(stream);
    }

    private static async Task AssertStatusAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        if (response.StatusCode == expected)
            return;

        var body = await response.Content.ReadAsStringAsync();
        Assert.Fail($"Expected HTTP {(int)expected} {expected}, got {(int)response.StatusCode} {response.StatusCode}. Body: {body}");
    }

    private sealed record TestTenant(Guid UserId, Guid Id, string Slug);

    private sealed record BookingResult(Guid BookingId, Guid WorkOrderId, string TrackingToken);
}
