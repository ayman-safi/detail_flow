using System.Net;
using System.Net.Http.Json;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Tests;

public class WorkOrderApiTests
{
    [Fact]
    public async Task Owner_can_create_walk_in_assign_staff_and_update_price()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);

        var staffResponse = await client.PostAsJsonAsync("/api/staff", new
        {
            fullName = "Assigned Staff",
            email = "assigned@example.test",
            role = "Staff"
        });
        await TestApi.AssertStatusAsync(staffResponse, HttpStatusCode.OK);
        using var staffJson = await TestApi.ReadJsonAsync(staffResponse);
        var staffId = Guid.Parse(staffJson.RootElement.GetProperty("user").GetProperty("id").GetString()!);

        var walkInResponse = await client.PostAsJsonAsync("/api/work-orders", new
        {
            customerName = "Walk In Customer",
            customerPhone = "+1 555 010 3030",
            vehiclePlate = "WLK-001",
            vehicleMake = "Ford",
            vehicleModel = "Focus",
            vehicleColor = "Blue",
            vehicleType = "Sedan",
            serviceTypeId = serviceId,
            notes = "Walk-in test"
        });
        await TestApi.AssertStatusAsync(walkInResponse, HttpStatusCode.OK);
        using var walkInJson = await TestApi.ReadJsonAsync(walkInResponse);
        var workOrderId = Guid.Parse(walkInJson.RootElement.GetProperty("id").GetString()!);
        Assert.Equal("Arrived", walkInJson.RootElement.GetProperty("stage").GetString());

        var assignResponse = await client.PatchAsJsonAsync($"/api/work-orders/{workOrderId}/assign", new
        {
            staffUserId = staffId
        });
        await TestApi.AssertStatusAsync(assignResponse, HttpStatusCode.OK);
        using (var assignJson = await TestApi.ReadJsonAsync(assignResponse))
        {
            Assert.Equal(staffId.ToString(), assignJson.RootElement.GetProperty("assignedStaff").GetProperty("id").GetString());
        }

        var priceResponse = await client.PatchAsJsonAsync($"/api/work-orders/{workOrderId}/price", new
        {
            actualPrice = 75,
            notes = "Adjusted after inspection"
        });
        await TestApi.AssertStatusAsync(priceResponse, HttpStatusCode.OK);
        using (var priceJson = await TestApi.ReadJsonAsync(priceResponse))
        {
            Assert.Equal(75, priceJson.RootElement.GetProperty("actualPrice").GetDecimal());
            Assert.Equal("Adjusted after inspection", priceJson.RootElement.GetProperty("notes").GetString());
        }
    }

    [Fact]
    public async Task Delivered_work_order_cannot_be_moved_again()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, TestApi.NextOpenSlot());

        await app.ExecuteDbContextAsync(async db =>
        {
            var workOrder = await db.WorkOrders.IgnoreQueryFilters().SingleAsync(w => w.Id == booking.WorkOrderId);
            workOrder.Stage = WorkOrderStage.Delivered;
            await db.SaveChangesAsync();
        });

        var response = await client.PatchAsJsonAsync($"/api/work-orders/{booking.WorkOrderId}/stage", new
        {
            newStage = "Ready"
        });

        await TestApi.AssertStatusAsync(response, HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Ready_work_order_requires_paid_status_before_delivery()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, TestApi.NextOpenSlot());

        var readyResponse = await client.PatchAsJsonAsync($"/api/work-orders/{booking.WorkOrderId}/stage", new
        {
            newStage = "Ready"
        });
        await TestApi.AssertStatusAsync(readyResponse, HttpStatusCode.OK);

        var unpaidDeliveryResponse = await client.PatchAsJsonAsync($"/api/work-orders/{booking.WorkOrderId}/stage", new
        {
            newStage = "Delivered"
        });
        await TestApi.AssertStatusAsync(unpaidDeliveryResponse, HttpStatusCode.BadRequest);

        var paymentResponse = await client.PatchAsJsonAsync($"/api/work-orders/{booking.WorkOrderId}/payment-status", new
        {
            status = "Paid"
        });
        await TestApi.AssertStatusAsync(paymentResponse, HttpStatusCode.OK);
        using (var paymentJson = await TestApi.ReadJsonAsync(paymentResponse))
        {
            Assert.Equal("Paid", paymentJson.RootElement.GetProperty("paymentStatus").GetString());
        }

        var paidDeliveryResponse = await client.PatchAsJsonAsync($"/api/work-orders/{booking.WorkOrderId}/stage", new
        {
            newStage = "Delivered"
        });
        await TestApi.AssertStatusAsync(paidDeliveryResponse, HttpStatusCode.OK);
        using var deliveredJson = await TestApi.ReadJsonAsync(paidDeliveryResponse);
        Assert.Equal("Delivered", deliveredJson.RootElement.GetProperty("stage").GetString());
    }

    [Fact]
    public async Task Authenticated_and_public_receipts_generate_pdf_files()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, TestApi.NextOpenSlot());

        await app.ExecuteDbContextAsync(async db =>
        {
            var currentTenant = await db.Tenants.SingleAsync(t => t.Id == tenant.Id);
            currentTenant.LogoUrl = $"https://r2.example.test/logos/{tenant.Id}/logo.png";
            currentTenant.Settings.Currency = TenantCurrency.USD;
            db.Entry(currentTenant).Property(t => t.Settings).IsModified = true;

            var workOrder = await db.WorkOrders.IgnoreQueryFilters().SingleAsync(w => w.Id == booking.WorkOrderId);
            workOrder.ActualPrice = 88;
            await db.SaveChangesAsync();
        });

        var ownerReceipt = await client.GetAsync($"/api/work-orders/{booking.WorkOrderId}/receipt?locale=en-US");
        await TestApi.AssertStatusAsync(ownerReceipt, HttpStatusCode.OK);
        Assert.Equal("application/pdf", ownerReceipt.Content.Headers.ContentType?.MediaType);
        Assert.StartsWith("attachment; filename=receipt-", ownerReceipt.Content.Headers.ContentDisposition?.ToString());
        Assert.True((await ownerReceipt.Content.ReadAsByteArrayAsync()).AsSpan(0, 4).SequenceEqual("%PDF"u8));

        var publicReceipt = await client.GetAsync($"/api/work-orders/track/{booking.TrackingToken}/receipt?locale=ar-SA");
        await TestApi.AssertStatusAsync(publicReceipt, HttpStatusCode.OK);
        Assert.Equal("application/pdf", publicReceipt.Content.Headers.ContentType?.MediaType);
        Assert.True((await publicReceipt.Content.ReadAsByteArrayAsync()).AsSpan(0, 4).SequenceEqual("%PDF"u8));
    }

    [Fact]
    public async Task Invalid_tracking_token_and_repeated_missing_token_return_errors()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        await TestApi.RegisterTenantAsync(client);

        var invalidResponse = await client.GetAsync("/api/work-orders/track/not-valid");
        await TestApi.AssertStatusAsync(invalidResponse, HttpStatusCode.BadRequest);

        var missingResponse1 = await client.GetAsync("/api/work-orders/track/BCDEFGH");
        await TestApi.AssertStatusAsync(missingResponse1, HttpStatusCode.NotFound);
        var missingResponse2 = await client.GetAsync("/api/work-orders/track/BCDEFGH");
        await TestApi.AssertStatusAsync(missingResponse2, HttpStatusCode.NotFound);
        var suppressedResponse = await client.GetAsync("/api/work-orders/track/BCDEFGH");
        await TestApi.AssertStatusAsync(suppressedResponse, HttpStatusCode.NotFound);
    }
}
