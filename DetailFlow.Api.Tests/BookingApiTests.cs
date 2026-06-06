using System.Net;
using System.Net.Http.Json;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Tests;

public class BookingApiTests
{
    [Fact]
    public async Task Authenticated_booking_flow_lists_updates_and_returns_customer_history()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var slot = TestApi.NextOpenSlot(daysFromNow: 3);

        var createResponse = await client.PostAsJsonAsync("/api/bookings", new
        {
            customerName = "Admin Customer",
            customerPhone = "+1 555 010 4040",
            vehiclePlate = "ADM-001",
            vehicleMake = "Mazda",
            vehicleModel = "3",
            vehicleColor = "Red",
            vehicleType = "Sedan",
            serviceTypeId = serviceId,
            scheduledAt = slot,
            notes = "Admin booking"
        });
        await TestApi.AssertStatusAsync(createResponse, HttpStatusCode.OK);
        using var createJson = await TestApi.ReadJsonAsync(createResponse);
        var bookingId = Guid.Parse(createJson.RootElement.GetProperty("bookingId").GetString()!);
        var workOrderId = Guid.Parse(createJson.RootElement.GetProperty("workOrderId").GetString()!);

        var listResponse = await client.GetAsync($"/api/bookings?date={slot:yyyy-MM-dd}&timezoneOffsetMinutes=0");
        await TestApi.AssertStatusAsync(listResponse, HttpStatusCode.OK);
        using (var listJson = await TestApi.ReadJsonAsync(listResponse))
        {
            var booking = Assert.Single(listJson.RootElement.EnumerateArray());
            Assert.Equal(bookingId.ToString(), booking.GetProperty("id").GetString());
            Assert.Equal(workOrderId.ToString(), booking.GetProperty("workOrderId").GetString());
            Assert.Equal("Admin Customer", booking.GetProperty("customer").GetProperty("fullName").GetString());
        }

        var getResponse = await client.GetAsync($"/api/bookings/{bookingId}");
        await TestApi.AssertStatusAsync(getResponse, HttpStatusCode.OK);
        using (var getJson = await TestApi.ReadJsonAsync(getResponse))
        {
            Assert.Equal("Admin booking", getJson.RootElement.GetProperty("notes").GetString());
            Assert.Equal("Booked", getJson.RootElement.GetProperty("workOrder").GetProperty("stage").GetString());
        }

        var customersResponse = await client.GetAsync("/api/customers?page=1&limit=10");
        await TestApi.AssertStatusAsync(customersResponse, HttpStatusCode.OK);
        using (var customersJson = await TestApi.ReadJsonAsync(customersResponse))
        {
            Assert.Equal(1, customersJson.RootElement.GetProperty("total").GetInt32());
            var customer = Assert.Single(customersJson.RootElement.GetProperty("items").EnumerateArray());
            Assert.Equal("Admin Customer", customer.GetProperty("fullName").GetString());
            Assert.Equal(1, customer.GetProperty("recentWorkOrders").GetArrayLength());
        }

        var updateResponse = await client.PatchAsJsonAsync($"/api/bookings/{bookingId}/status", new
        {
            status = "Cancelled"
        });
        await TestApi.AssertStatusAsync(updateResponse, HttpStatusCode.OK);
        using var updateJson = await TestApi.ReadJsonAsync(updateResponse);
        Assert.Equal("Cancelled", updateJson.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Authenticated_booking_availability_rejects_invalid_service()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        await TestApi.RegisterTenantAsync(client);

        var response = await client.GetAsync($"/api/bookings/availability?date={TestApi.NextOpenSlot():yyyy-MM-dd}&serviceTypeId={Guid.NewGuid()}&timezoneOffsetMinutes=0");

        await TestApi.AssertStatusAsync(response, HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Public_booking_respects_bay_capacity_and_availability()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var slot = TestApi.NextOpenSlot();

        var availabilityUpdate = await client.PutAsJsonAsync("/api/settings/availability", new
        {
            bayCapacity = 1
        });
        await TestApi.AssertStatusAsync(availabilityUpdate, HttpStatusCode.OK);

        await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, slot, "CAP-001");

        var availabilityResponse = await client.GetAsync(
            $"/api/public/shops/{tenant.Slug}/availability?date={slot:yyyy-MM-dd}&serviceTypeId={serviceId}&timezoneOffsetMinutes=0");
        await TestApi.AssertStatusAsync(availabilityResponse, HttpStatusCode.OK);
        using (var availabilityJson = await TestApi.ReadJsonAsync(availabilityResponse))
        {
            var tenAm = availabilityJson.RootElement.EnumerateArray()
                .Single(item => item.GetProperty("time").GetString() == "10:00");
            Assert.False(tenAm.GetProperty("available").GetBoolean());
            Assert.Equal(1, tenAm.GetProperty("bookingCount").GetInt32());
        }

        var conflictResponse = await client.PostAsJsonAsync(
            $"/api/public/shops/{tenant.Slug}/bookings",
            TestApi.BuildPublicBookingPayload(serviceId, slot, "CAP-002"));
        await TestApi.AssertStatusAsync(conflictResponse, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Public_booking_persists_vehicle_color_and_type()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var slot = TestApi.NextOpenSlot(daysFromNow: 4);

        var response = await client.PostAsJsonAsync(
            $"/api/public/shops/{tenant.Slug}/bookings",
            new
            {
                customerName = "Public Customer",
                customerPhone = "+1 555 010 6060",
                vehiclePlate = "PUB-CLR",
                vehicleMake = "Toyota",
                vehicleModel = "RAV4",
                vehicleColor = "Pearl White",
                vehicleType = "SUV",
                serviceTypeId = serviceId,
                scheduledAt = slot,
                notes = "Public vehicle details"
            });

        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);
        using (var json = await TestApi.ReadJsonAsync(response))
        {
            var vehicle = json.RootElement.GetProperty("vehicle");
            Assert.Equal("Pearl White", vehicle.GetProperty("color").GetString());
            Assert.Equal("SUV", vehicle.GetProperty("vehicleType").GetString());
        }

        await app.ExecuteDbContextAsync(async db =>
        {
            var vehicle = await db.Vehicles
                .IgnoreQueryFilters()
                .SingleAsync(v => v.TenantId == tenant.Id && v.PlateNumber == "PUB-CLR");

            Assert.Equal("Pearl White", vehicle.Color);
            Assert.Equal(VehicleType.SUV, vehicle.VehicleType);
        });
    }

    [Fact]
    public async Task Public_booking_rejects_closed_dates()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var slot = TestApi.NextOpenSlot(daysFromNow: 5);

        var availabilityUpdate = await client.PutAsJsonAsync("/api/settings/availability", new
        {
            closurePeriods = new[]
            {
                new { from = $"{slot:yyyy-MM-dd}", to = $"{slot:yyyy-MM-dd}", reason = "Launch setup" }
            }
        });
        await TestApi.AssertStatusAsync(availabilityUpdate, HttpStatusCode.OK);

        var response = await client.PostAsJsonAsync(
            $"/api/public/shops/{tenant.Slug}/bookings",
            TestApi.BuildPublicBookingPayload(serviceId, slot, "CLOSED-1"));

        await TestApi.AssertStatusAsync(response, HttpStatusCode.BadRequest);
    }
}
