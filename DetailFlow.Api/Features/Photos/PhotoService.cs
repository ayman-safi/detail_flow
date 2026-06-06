using DetailFlow.Api.Data;
using DetailFlow.Api.Features.Plans;
using DetailFlow.Api.Features.WorkOrders;
using DetailFlow.Api.Infrastructure;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.Photos;

public class PhotoService(
    DetailFlowDbContext db,
    ITenantContext tenantContext,
    IR2StorageService r2,
    BoardEventService events,
    PlanEnforcementService planEnforcement)
{
    public async Task<object> UploadAsync(Guid id, IFormFile file, string type)
    {
        if (!Enum.TryParse<PhotoType>(type, true, out var photoType))
            throw new ArgumentException("Invalid photo type.");

        var workOrder = await WorkOrderMappings.BaseQuery(db).FirstOrDefaultAsync(w => w.Id == id)
            ?? throw new KeyNotFoundException("Work order not found.");
        await planEnforcement.AssertCanUploadPhotoAsync(tenantContext.TenantId, id);
        await using var stream = file.OpenReadStream();
        var image = await ImageUploadValidator.ValidateAsync(file, stream, 10 * 1024 * 1024);
        var key = $"photos/{tenantContext.TenantId}/{id}/{photoType.ToString().ToLowerInvariant()}/{Guid.NewGuid()}{image.Extension}";
        var url = await r2.UploadAsync(stream, key, image.ContentType);

        var photo = new WorkOrderPhoto
        {
            WorkOrderId = id,
            PhotoUrl = url,
            R2Key = key,
            Type = photoType,
            UploadedByUserId = tenantContext.UserId
        };
        db.WorkOrderPhotos.Add(photo);
        workOrder.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("work_order_updated", new
        {
            workOrder = WorkOrderMappings.ToCard(workOrder)
        }));

        return new { photo.Id, photo.PhotoUrl, photo.Type, photo.UploadedAt };
    }

    public async Task DeleteAsync(Guid id, Guid photoId)
    {
        var workOrder = await WorkOrderMappings.BaseQuery(db).FirstOrDefaultAsync(w => w.Id == id)
            ?? throw new KeyNotFoundException("Work order not found.");
        var photo = workOrder.Photos.FirstOrDefault(p => p.Id == photoId)
            ?? throw new KeyNotFoundException("Photo not found.");

        if (tenantContext.Role == UserRole.Staff && photo.UploadedByUserId != tenantContext.UserId)
            throw new UnauthorizedAccessException("You can only delete your own photos.");

        await r2.DeleteAsync(photo.R2Key);
        workOrder.Photos.Remove(photo);
        db.WorkOrderPhotos.Remove(photo);
        workOrder.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        await events.BroadcastToTenantAsync(tenantContext.TenantId, new BoardEvent("work_order_updated", new
        {
            workOrder = WorkOrderMappings.ToCard(workOrder)
        }));
    }

    public async Task<object> ListAsync(Guid id)
    {
        var workOrder = await db.WorkOrders.Include(w => w.Photos).FirstOrDefaultAsync(w => w.Id == id)
            ?? throw new KeyNotFoundException("Work order not found.");

        return new
        {
            before = workOrder.Photos.Where(p => p.Type == PhotoType.Before).OrderBy(p => p.UploadedAt).Select(PhotoDto.From),
            after = workOrder.Photos.Where(p => p.Type == PhotoType.After).OrderBy(p => p.UploadedAt).Select(PhotoDto.From)
        };
    }
}
