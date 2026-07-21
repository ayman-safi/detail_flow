namespace DetailFlow.Api.Models;

public class Customer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string? FullName { get; set; }
    public string Phone { get; set; } = "";
    public int TotalVisits { get; set; } = 0;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
