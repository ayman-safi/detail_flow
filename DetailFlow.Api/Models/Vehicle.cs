namespace DetailFlow.Api.Models;

public class Vehicle
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public string PlateNumber { get; set; } = "";
    public string Make { get; set; } = "";
    public string Model { get; set; } = "";
    public string Color { get; set; } = "";
    public VehicleType VehicleType { get; set; } = VehicleType.Sedan;
}

public enum VehicleType { Sedan, SUV, Truck, Van, Motorcycle, Other }
