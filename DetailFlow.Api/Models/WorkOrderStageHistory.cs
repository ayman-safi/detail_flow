namespace DetailFlow.Api.Models;

public class WorkOrderStageHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkOrderId { get; set; }
    public WorkOrder WorkOrder { get; set; } = null!;
    public WorkOrderStage FromStage { get; set; }
    public WorkOrderStage ToStage { get; set; }
    public Guid ChangedByUserId { get; set; }
    public string ChangedByName { get; set; } = "";
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;
}
