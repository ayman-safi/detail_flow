using System.Security.Cryptography;

namespace DetailFlow.Api.Models;

public class WorkOrder
{
    private const string TrackingTokenCharacters = "BCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public const int MinTrackingTokenLength = 7;
    public const int MaxTrackingTokenLength = 64;

    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public Guid ServiceTypeId { get; set; }
    public ServiceType ServiceType { get; set; } = null!;
    public WorkOrderStage Stage { get; set; } = WorkOrderStage.Booked;
    public Guid? AssignedStaffId { get; set; }
    public User? AssignedStaff { get; set; }
    public DateTimeOffset? EstimatedReadyAt { get; set; }
    public string TrackingToken { get; private set; } = GenerateTrackingToken();
    public decimal? ActualPrice { get; set; }
    public string? Notes { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<WorkOrderStageHistory> StageHistory { get; set; } = [];
    public List<WorkOrderPhoto> Photos { get; set; } = [];

    public static string GenerateTrackingToken()
    {
        return RandomNumberGenerator.GetString(TrackingTokenCharacters, 24);
    }

    public static bool IsValidTrackingToken(string token) =>
        token.Length is >= MinTrackingTokenLength and <= MaxTrackingTokenLength &&
        token.All(TrackingTokenCharacters.Contains);
}

public enum WorkOrderStage
{
    Booked = 0,
    Arrived = 1,
    Washing = 2,
    Detailing = 3,
    Polishing = 4,
    Ready = 5,
    Delivered = 6
}

public enum PaymentStatus
{
    Pending = 0,
    Paid = 1,
    Refunded = 2
}
