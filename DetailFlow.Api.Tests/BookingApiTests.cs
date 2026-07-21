using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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
    public async Task Updating_booking_reschedules_changes_service_and_updates_linked_work_order()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var exteriorWashId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var interiorCleanId = await GetServiceIdByNameAsync(client, tenant.Slug, "Full Interior Clean");
        var originalSlot = TestApi.NextOpenSlot(daysFromNow: 3);
        var newSlot = TestApi.NextOpenSlot(daysFromNow: 4).AddHours(1);
        var booking = await CreateAdminBookingAsync(client, exteriorWashId, originalSlot, "EDIT-001");

        var updateResponse = await client.PutAsJsonAsync($"/api/bookings/{booking.BookingId}", BuildBookingUpdatePayload(
            interiorCleanId,
            newSlot,
            "Edited Customer",
            "+1 555 010 9090",
            "EDIT-009",
            "Nissan",
            "Altima",
            "Black",
            "SUV",
            "Updated notes"));

        await TestApi.AssertStatusAsync(updateResponse, HttpStatusCode.OK);
        using (var updateJson = await TestApi.ReadJsonAsync(updateResponse))
        {
            Assert.Equal("Edited Customer", updateJson.RootElement.GetProperty("customer").GetProperty("fullName").GetString());
            Assert.Equal("Full Interior Clean", updateJson.RootElement.GetProperty("serviceType").GetProperty("name").GetString());
            Assert.Equal("EDIT-009", updateJson.RootElement.GetProperty("vehicle").GetProperty("plateNumber").GetString());
        }

        var oldDayResponse = await client.GetAsync($"/api/bookings?date={originalSlot:yyyy-MM-dd}&timezoneOffsetMinutes=0");
        await TestApi.AssertStatusAsync(oldDayResponse, HttpStatusCode.OK);
        using (var oldDayJson = await TestApi.ReadJsonAsync(oldDayResponse))
        {
            Assert.Empty(oldDayJson.RootElement.EnumerateArray());
        }

        var newDayResponse = await client.GetAsync($"/api/bookings?date={newSlot:yyyy-MM-dd}&timezoneOffsetMinutes=0");
        await TestApi.AssertStatusAsync(newDayResponse, HttpStatusCode.OK);
        using (var newDayJson = await TestApi.ReadJsonAsync(newDayResponse))
        {
            var item = Assert.Single(newDayJson.RootElement.EnumerateArray());
            Assert.Equal("Full Interior Clean", item.GetProperty("serviceName").GetString());
            Assert.Equal("EDIT-009", item.GetProperty("vehicle").GetProperty("plateNumber").GetString());
            Assert.Equal("Black", item.GetProperty("vehicle").GetProperty("color").GetString());
        }

        await app.ExecuteDbContextAsync(async db =>
        {
            var workOrder = await db.WorkOrders
                .IgnoreQueryFilters()
                .Include(w => w.Customer)
                .Include(w => w.Vehicle)
                .Include(w => w.ServiceType)
                .SingleAsync(w => w.Id == booking.WorkOrderId);

            Assert.Equal("Edited Customer", workOrder.Customer.FullName);
            Assert.Equal("EDIT-009", workOrder.Vehicle.PlateNumber);
            Assert.Equal("Full Interior Clean", workOrder.ServiceType.Name);
            Assert.Equal("Updated notes", workOrder.Notes);
        });
    }

    [Fact]
    public async Task Updating_booking_rejects_full_overlapping_slot()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var occupiedSlot = TestApi.NextOpenSlot(daysFromNow: 3);
        var editableSlot = TestApi.NextOpenSlot(daysFromNow: 4);

        var availabilityUpdate = await client.PutAsJsonAsync("/api/settings/availability", new { bayCapacity = 1 });
        await TestApi.AssertStatusAsync(availabilityUpdate, HttpStatusCode.OK);
        await CreateAdminBookingAsync(client, serviceId, occupiedSlot, "FULL-001");
        var editable = await CreateAdminBookingAsync(client, serviceId, editableSlot, "FULL-002");

        var response = await client.PutAsJsonAsync($"/api/bookings/{editable.BookingId}", BuildBookingUpdatePayload(
            serviceId,
            occupiedSlot,
            "Full Slot Customer",
            "+1 555 010 3030",
            "FULL-002"));

        await TestApi.AssertStatusAsync(response, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Updating_booking_relinks_customer_vehicle_and_transfers_visit_count()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var first = await CreateAdminBookingAsync(client, serviceId, TestApi.NextOpenSlot(daysFromNow: 3), "LINK-001", "First Customer", "+1 555 010 1111");
        var second = await CreateAdminBookingAsync(client, serviceId, TestApi.NextOpenSlot(daysFromNow: 4), "LINK-002", "Second Customer", "+1 555 010 2222");

        var response = await client.PutAsJsonAsync($"/api/bookings/{first.BookingId}", BuildBookingUpdatePayload(
            serviceId,
            TestApi.NextOpenSlot(daysFromNow: 3).AddHours(1),
            "Second Customer Updated",
            "+1 555 010 2222",
            "LINK-002",
            "Honda",
            "Accord",
            "Green"));

        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);

        await app.ExecuteDbContextAsync(async db =>
        {
            var firstCustomer = await db.Customers.IgnoreQueryFilters().SingleAsync(c => c.TenantId == tenant.Id && c.Phone == "15550101111");
            var secondCustomer = await db.Customers.IgnoreQueryFilters().SingleAsync(c => c.TenantId == tenant.Id && c.Phone == "15550102222");
            var firstWorkOrder = await db.WorkOrders.IgnoreQueryFilters().SingleAsync(w => w.Id == first.WorkOrderId);
            var secondWorkOrder = await db.WorkOrders.IgnoreQueryFilters().SingleAsync(w => w.Id == second.WorkOrderId);

            Assert.Equal(0, firstCustomer.TotalVisits);
            Assert.Equal(2, secondCustomer.TotalVisits);
            Assert.Equal(secondCustomer.Id, firstWorkOrder.CustomerId);
            Assert.Equal(secondCustomer.Id, secondWorkOrder.CustomerId);
            Assert.Equal(firstWorkOrder.VehicleId, secondWorkOrder.VehicleId);
        });
    }

    [Fact]
    public async Task Cancelling_booked_booking_deletes_work_order_and_corrects_customer_history()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await CreateAdminBookingAsync(client, serviceId, TestApi.NextOpenSlot(daysFromNow: 3), "CXL-001");

        var response = await client.PatchAsJsonAsync($"/api/bookings/{booking.BookingId}/status", new { status = "Cancelled" });

        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);

        await app.ExecuteDbContextAsync(async db =>
        {
            Assert.False(await db.WorkOrders.IgnoreQueryFilters().AnyAsync(w => w.Id == booking.WorkOrderId));
            var customer = await db.Customers.IgnoreQueryFilters().SingleAsync(c => c.TenantId == tenant.Id && c.Phone == "15550104040");
            Assert.Equal(0, customer.TotalVisits);
        });

        var customersResponse = await client.GetAsync("/api/customers?page=1&limit=10");
        await TestApi.AssertStatusAsync(customersResponse, HttpStatusCode.OK);
        using var customersJson = await TestApi.ReadJsonAsync(customersResponse);
        var customerItem = Assert.Single(customersJson.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal(0, customerItem.GetProperty("recentWorkOrders").GetArrayLength());

        var boardResponse = await client.GetAsync("/api/work-orders/board");
        await TestApi.AssertStatusAsync(boardResponse, HttpStatusCode.OK);
        using var boardJson = await TestApi.ReadJsonAsync(boardResponse);
        Assert.Equal(0, boardJson.RootElement.GetProperty("booked").GetArrayLength());
    }

    [Fact]
    public async Task Cancelling_after_arrival_returns_conflict_and_preserves_visit_count()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await CreateAdminBookingAsync(client, serviceId, TestApi.NextOpenSlot(daysFromNow: 3), "ARR-001");

        var stageResponse = await client.PatchAsJsonAsync($"/api/work-orders/{booking.WorkOrderId}/stage", new { newStage = "Arrived" });
        await TestApi.AssertStatusAsync(stageResponse, HttpStatusCode.OK);

        var cancelResponse = await client.PatchAsJsonAsync($"/api/bookings/{booking.BookingId}/status", new { status = "Cancelled" });

        await TestApi.AssertStatusAsync(cancelResponse, HttpStatusCode.Conflict);
        await app.ExecuteDbContextAsync(async db =>
        {
            Assert.True(await db.WorkOrders.IgnoreQueryFilters().AnyAsync(w => w.Id == booking.WorkOrderId));
            var customer = await db.Customers.IgnoreQueryFilters().SingleAsync(c => c.TenantId == tenant.Id && c.Phone == "15550104040");
            Assert.Equal(1, customer.TotalVisits);
        });
    }

    [Fact]
    public async Task Confirming_pending_booking_creates_one_work_order_and_counts_visit_once()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var bookingId = await SeedPendingBookingAsync(app, tenant.Id, serviceId, TestApi.NextOpenSlot(daysFromNow: 3));

        var firstResponse = await client.PatchAsJsonAsync($"/api/bookings/{bookingId}/status", new { status = "Confirmed" });
        await TestApi.AssertStatusAsync(firstResponse, HttpStatusCode.OK);
        var secondResponse = await client.PatchAsJsonAsync($"/api/bookings/{bookingId}/status", new { status = "Confirmed" });
        await TestApi.AssertStatusAsync(secondResponse, HttpStatusCode.OK);

        await app.ExecuteDbContextAsync(async db =>
        {
            Assert.Equal(1, await db.WorkOrders.IgnoreQueryFilters().CountAsync(w => w.BookingId == bookingId));
            var customer = await db.Customers.IgnoreQueryFilters().SingleAsync(c => c.TenantId == tenant.Id && c.Phone == "15550107777");
            Assert.Equal(1, customer.TotalVisits);
        });
    }

    [Fact]
    public async Task Staff_role_can_create_edit_confirm_and_cancel_bookings()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        TestApi.SetBearerToken(client, tenant, UserRole.Staff, "Staff User");
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await CreateAdminBookingAsync(client, serviceId, TestApi.NextOpenSlot(daysFromNow: 3), "STF-001");

        var editResponse = await client.PutAsJsonAsync($"/api/bookings/{booking.BookingId}", BuildBookingUpdatePayload(
            serviceId,
            TestApi.NextOpenSlot(daysFromNow: 3).AddHours(1),
            "Staff Edited",
            "+1 555 010 5050",
            "STF-002"));
        await TestApi.AssertStatusAsync(editResponse, HttpStatusCode.OK);

        var cancelResponse = await client.PatchAsJsonAsync($"/api/bookings/{booking.BookingId}/status", new { status = "Cancelled" });
        await TestApi.AssertStatusAsync(cancelResponse, HttpStatusCode.OK);

        var pendingId = await SeedPendingBookingAsync(app, tenant.Id, serviceId, TestApi.NextOpenSlot(daysFromNow: 5), "STF-PND", "15550108888");
        var confirmResponse = await client.PatchAsJsonAsync($"/api/bookings/{pendingId}/status", new { status = "Confirmed" });
        await TestApi.AssertStatusAsync(confirmResponse, HttpStatusCode.OK);
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
                customerPhone = "+1 555 010 6060",
                vehicle = new
                {
                    plateNumber = "PUB-CLR",
                    make = "Toyota",
                    model = "RAV4",
                    color = "Pearl White",
                    vehicleType = "SUV"
                },
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

    [Fact]
    public async Task Phone_only_public_booking_can_be_completed_by_staff_before_work_starts()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var slot = TestApi.NextOpenSlot(daysFromNow: 6);

        var create = await client.PostAsJsonAsync($"/api/public/shops/{tenant.Slug}/bookings", new
        {
            customerPhone = "+1 (555) 010-9191",
            serviceTypeId = serviceId,
            scheduledAt = slot
        });
        await TestApi.AssertStatusAsync(create, HttpStatusCode.OK);
        Guid bookingId;
        Guid workOrderId;
        using (var json = await TestApi.ReadJsonAsync(create))
        {
            bookingId = Guid.Parse(json.RootElement.GetProperty("bookingId").GetString()!);
            workOrderId = Guid.Parse(json.RootElement.GetProperty("workOrderId").GetString()!);
            Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("vehicle").ValueKind);
            Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("customer").GetProperty("fullName").ValueKind);
        }

        var blocked = await client.PatchAsJsonAsync($"/api/work-orders/{workOrderId}/stage", new { newStage = "Arrived" });
        await TestApi.AssertStatusAsync(blocked, HttpStatusCode.Conflict);

        var complete = await client.PatchAsJsonAsync($"/api/bookings/{bookingId}/vehicle", new
        {
            vehiclePlate = "LATER-91",
            vehicleMake = "Toyota",
            vehicleModel = "Corolla",
            vehicleColor = "White",
            vehicleType = "Sedan"
        });
        await TestApi.AssertStatusAsync(complete, HttpStatusCode.OK);

        var moved = await client.PatchAsJsonAsync($"/api/work-orders/{workOrderId}/stage", new { newStage = "Arrived" });
        await TestApi.AssertStatusAsync(moved, HttpStatusCode.OK);
    }

    [Fact]
    public async Task Public_vehicle_lookup_is_masked_tenant_scoped_and_selectable()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, TestApi.NextOpenSlot(daysFromNow: 7), "LOOK-123");

        var lookup = await client.PostAsJsonAsync($"/api/public/shops/{tenant.Slug}/vehicle-lookup", new { customerPhone = "1 555 010 2000" });
        await TestApi.AssertStatusAsync(lookup, HttpStatusCode.OK);
        Guid vehicleId;
        using (var json = await TestApi.ReadJsonAsync(lookup))
        {
            var vehicle = json.RootElement.GetProperty("vehicles")[0];
            vehicleId = Guid.Parse(vehicle.GetProperty("id").GetString()!);
            Assert.Equal("••••23", vehicle.GetProperty("maskedPlate").GetString());
            Assert.False(vehicle.TryGetProperty("plateNumber", out _));
        }

        var second = await client.PostAsJsonAsync($"/api/public/shops/{tenant.Slug}/bookings", new
        {
            customerPhone = "15550102000",
            serviceTypeId = serviceId,
            scheduledAt = TestApi.NextOpenSlot(daysFromNow: 8),
            existingVehicleId = vehicleId
        });
        await TestApi.AssertStatusAsync(second, HttpStatusCode.OK);
        using var secondJson = await TestApi.ReadJsonAsync(second);
        Assert.Equal("LOOK-123", secondJson.RootElement.GetProperty("vehicle").GetProperty("plateNumber").GetString());
    }

    private static async Task<Guid> GetServiceIdByNameAsync(HttpClient client, string tenantSlug, string name)
    {
        var response = await client.GetAsync($"/api/public/shops/{tenantSlug}/services");
        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);

        using var json = await TestApi.ReadJsonAsync(response);
        var service = json.RootElement
            .EnumerateArray()
            .First(item => item.GetProperty("name").GetString() == name);

        return Guid.Parse(service.GetProperty("id").GetString()!);
    }

    private static async Task<BookingResult> CreateAdminBookingAsync(
        HttpClient client,
        Guid serviceId,
        DateTimeOffset scheduledAt,
        string plate,
        string customerName = "Admin Customer",
        string customerPhone = "+1 555 010 4040")
    {
        var response = await client.PostAsJsonAsync("/api/bookings", new
        {
            customerName,
            customerPhone,
            vehiclePlate = plate,
            vehicleMake = "Mazda",
            vehicleModel = "3",
            vehicleColor = "Red",
            vehicleType = "Sedan",
            serviceTypeId = serviceId,
            scheduledAt,
            notes = "Admin booking"
        });

        await TestApi.AssertStatusAsync(response, HttpStatusCode.OK);
        using var json = await TestApi.ReadJsonAsync(response);
        return new BookingResult(
            Guid.Parse(json.RootElement.GetProperty("bookingId").GetString()!),
            Guid.Parse(json.RootElement.GetProperty("workOrderId").GetString()!),
            json.RootElement.GetProperty("trackingToken").GetString()!);
    }

    private static object BuildBookingUpdatePayload(
        Guid serviceId,
        DateTimeOffset scheduledAt,
        string customerName,
        string customerPhone,
        string plate,
        string make = "Mazda",
        string model = "3",
        string color = "Red",
        string vehicleType = "Sedan",
        string? notes = "Updated booking") => new
        {
            customerName,
            customerPhone,
            vehiclePlate = plate,
            vehicleMake = make,
            vehicleModel = model,
            vehicleColor = color,
            vehicleType,
            serviceTypeId = serviceId,
            scheduledAt,
            notes
        };

    private static async Task<Guid> SeedPendingBookingAsync(
        DetailFlowApiFactory app,
        Guid tenantId,
        Guid serviceId,
        DateTimeOffset scheduledAt,
        string plate = "PND-001",
        string phone = "15550107777")
    {
        return await app.ExecuteDbContextAsync(async db =>
        {
            var customer = new Customer
            {
                TenantId = tenantId,
                FullName = "Pending Customer",
                Phone = phone
            };
            var vehicle = new Vehicle
            {
                TenantId = tenantId,
                Customer = customer,
                PlateNumber = plate,
                Make = "Toyota",
                Model = "Corolla",
                Color = "White",
                VehicleType = VehicleType.Sedan
            };
            var booking = new Booking
            {
                TenantId = tenantId,
                Customer = customer,
                Vehicle = vehicle,
                ServiceTypeId = serviceId,
                ScheduledAt = scheduledAt,
                Status = BookingStatus.Pending,
                Notes = "Pending booking"
            };
            db.Bookings.Add(booking);
            await db.SaveChangesAsync();
            return booking.Id;
        });
    }
}
