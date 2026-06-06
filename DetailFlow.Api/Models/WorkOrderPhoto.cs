namespace DetailFlow.Api.Models;

public class WorkOrderPhoto
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkOrderId { get; set; }
    public WorkOrder WorkOrder { get; set; } = null!;
    public string PhotoUrl { get; set; } = "";
    public string R2Key { get; set; } = "";
    public PhotoType Type { get; set; }
    public Guid UploadedByUserId { get; set; }
    public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum PhotoType { Before, After }
