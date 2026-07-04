using System.ComponentModel.DataAnnotations;
using DetailFlow.Api.Data;
using DetailFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.WorkOrders;

internal static class WorkOrderMappings
{
    public static IQueryable<WorkOrder> BaseQuery(DetailFlowDbContext db) =>
        db.WorkOrders
            .Include(w => w.Booking)
            .Include(w => w.Customer)
            .Include(w => w.Vehicle)
            .Include(w => w.ServiceType)
            .Include(w => w.AssignedStaff)
            .Include(w => w.Photos);

    public static WorkOrderCardDto ToCard(WorkOrder workOrder) => new(
        workOrder.Id,
        workOrder.Stage,
        workOrder.TrackingToken,
        new CustomerMini(workOrder.Customer.Id, workOrder.Customer.FullName, workOrder.Customer.Phone),
        new VehicleMini(
            workOrder.Vehicle.PlateNumber,
            workOrder.Vehicle.Make,
            workOrder.Vehicle.Model,
            workOrder.Vehicle.Color,
            workOrder.Vehicle.VehicleType),
        workOrder.ServiceType.Name,
        workOrder.ServiceType.BasePrice,
        workOrder.AssignedStaff is null ? null : new StaffMini(workOrder.AssignedStaff.Id, workOrder.AssignedStaff.FullName),
        workOrder.EstimatedReadyAt,
        workOrder.ActualPrice,
        workOrder.Notes,
        workOrder.PaymentStatus,
        workOrder.Photos.Select(photo => photo.Id).Distinct().Count(),
        workOrder.CreatedAt,
        workOrder.UpdatedAt);

    public static void ValidateTransition(WorkOrderStage from, WorkOrderStage to, PaymentStatus paymentStatus)
    {
        if (from == WorkOrderStage.Delivered)
            throw new ArgumentException("Delivered work orders cannot be moved.");

        if (to == WorkOrderStage.Delivered && paymentStatus != PaymentStatus.Paid)
            throw new ArgumentException("Cannot move to Delivered without receiving payment.");

        if ((int)to < (int)from - 1)
            throw new ArgumentException("Can only move back one stage.");
    }

    public static string Humanize(WorkOrderStage stage) => stage.ToString();
}

public record StageChangeRequest([Required] WorkOrderStage NewStage);
public record WalkInCreateRequest(
    [Required, MinLength(2)] string CustomerName,
    [Required, MinLength(7)] string CustomerPhone,
    [Required, MinLength(2)] string VehiclePlate,
    [Required] string VehicleMake,
    [Required] string VehicleModel,
    [Required] string VehicleColor,
    VehicleType VehicleType,
    Guid ServiceTypeId,
    string? Notes);
public record AssignRequest(Guid? StaffUserId);
public record PriceRequest([Range(0, 999999)] decimal ActualPrice, string? Notes);
public record PaymentStatusRequest([Required] PaymentStatus Status);
public record CustomerMini(Guid Id, string FullName, string Phone);
public record VehicleMini(string PlateNumber, string Make, string Model, string Color, VehicleType VehicleType);
public record StaffMini(Guid Id, string FullName);
public record WorkOrderCardDto(
    Guid Id,
    WorkOrderStage Stage,
    string TrackingToken,
    CustomerMini Customer,
    VehicleMini Vehicle,
    string ServiceName,
    decimal ServiceBasePrice,
    StaffMini? AssignedStaff,
    DateTimeOffset? EstimatedReadyAt,
    decimal? ActualPrice,
    string? Notes,
    PaymentStatus PaymentStatus,
    int PhotoCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
public record PhotoDto(Guid Id, string PhotoUrl, PhotoType Type, DateTimeOffset UploadedAt)
{
    public static PhotoDto From(WorkOrderPhoto photo) => new(photo.Id, photo.PhotoUrl, photo.Type, photo.UploadedAt);
}
