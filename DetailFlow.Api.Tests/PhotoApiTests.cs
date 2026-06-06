using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Tests;

public class PhotoApiTests
{
    [Fact]
    public async Task Authenticated_user_can_upload_list_and_delete_work_order_photo()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, TestApi.NextOpenSlot());

        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("Before"), "type");
        content.Add(new ByteArrayContent(PngBytes()), "file", "before.png");

        var uploadResponse = await client.PostAsync($"/api/work-orders/{booking.WorkOrderId}/photos", content);
        await TestApi.AssertStatusAsync(uploadResponse, HttpStatusCode.OK);
        using var uploadJson = await TestApi.ReadJsonAsync(uploadResponse);
        var photoId = Guid.Parse(uploadJson.RootElement.GetProperty("id").GetString()!);
        Assert.Equal("Before", uploadJson.RootElement.GetProperty("type").GetString());
        Assert.StartsWith("https://r2.example.test/photos/", uploadJson.RootElement.GetProperty("photoUrl").GetString());

        var listResponse = await client.GetAsync($"/api/work-orders/{booking.WorkOrderId}/photos");
        await TestApi.AssertStatusAsync(listResponse, HttpStatusCode.OK);
        using (var listJson = await TestApi.ReadJsonAsync(listResponse))
        {
            Assert.Single(listJson.RootElement.GetProperty("before").EnumerateArray());
            Assert.Empty(listJson.RootElement.GetProperty("after").EnumerateArray());
        }

        var deleteResponse = await client.DeleteAsync($"/api/work-orders/{booking.WorkOrderId}/photos/{photoId}");
        await TestApi.AssertStatusAsync(deleteResponse, HttpStatusCode.NoContent);

        await app.ExecuteDbContextAsync(async db =>
        {
            Assert.False(await db.WorkOrderPhotos.IgnoreQueryFilters().AnyAsync(p => p.Id == photoId));
        });
    }

    [Fact]
    public async Task Free_plan_photo_limit_blocks_fourth_photo_for_work_order()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, TestApi.NextOpenSlot());

        for (var i = 0; i < 3; i++)
        {
            var okResponse = await UploadBeforePhotoAsync(client, booking.WorkOrderId);
            await TestApi.AssertStatusAsync(okResponse, HttpStatusCode.OK);
        }

        var response = await UploadBeforePhotoAsync(client, booking.WorkOrderId);
        await TestApi.AssertStatusAsync(response, HttpStatusCode.PaymentRequired);
    }

    [Fact]
    public async Task Upload_rejects_non_image_payload()
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);
        var tenant = await TestApi.RegisterTenantAsync(client);
        var serviceId = await TestApi.GetExteriorWashServiceIdAsync(client, tenant.Slug);
        var booking = await TestApi.CreatePublicBookingAsync(client, tenant.Slug, serviceId, TestApi.NextOpenSlot());

        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("Before"), "type");
        content.Add(new ByteArrayContent("not an image"u8.ToArray()), "file", "note.txt");

        var response = await client.PostAsync($"/api/work-orders/{booking.WorkOrderId}/photos", content);
        await TestApi.AssertStatusAsync(response, HttpStatusCode.BadRequest);
    }

    private static async Task<HttpResponseMessage> UploadBeforePhotoAsync(HttpClient client, Guid workOrderId)
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("Before"), "type");
        content.Add(new ByteArrayContent(PngBytes()), "file", $"{Guid.NewGuid():N}.png");
        return await client.PostAsync($"/api/work-orders/{workOrderId}/photos", content);
    }

    private static byte[] PngBytes() =>
    [
        0x89, 0x50, 0x4E, 0x47,
        0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D
    ];
}
