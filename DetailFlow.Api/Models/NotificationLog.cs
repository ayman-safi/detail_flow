namespace DetailFlow.Api.Models;

public class NotificationLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public Guid? WorkOrderId { get; set; }
    public WorkOrder? WorkOrder { get; set; }
    public NotificationChannel Channel { get; set; } = NotificationChannel.WhatsApp;
    public NotificationEventType EventType { get; set; } = NotificationEventType.ReadyForPickup;
    public NotificationDispatchType DispatchType { get; set; } = NotificationDispatchType.Automatic;
    public string RecipientPhone { get; set; } = "";
    public string? ProviderMessageId { get; set; }
    public NotificationStatus Status { get; set; } = NotificationStatus.Requested;
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public Guid? RequestedByUserId { get; set; }
    public string? RequestedByName { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum NotificationChannel
{
    WhatsApp = 0
}

public enum NotificationEventType
{
    ReadyForPickup = 0,
    TrackingLink = 1
}

public enum NotificationDispatchType
{
    Manual = 0,
    Automatic = 1
}

public enum NotificationStatus
{
    Requested = 0,
    Accepted = 1,
    Sent = 2,
    Delivered = 3,
    Read = 4,
    Failed = 5
}
