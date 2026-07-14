using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using DetailFlow.Api.Models;

namespace DetailFlow.Api.Features.Bookings;

[ApiController]
[Authorize]
[Route("api")]
public class BookingsController(BookingService service) : ControllerBase
{
    [HttpGet("bookings")]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetBookings([FromQuery] DateTime? date, [FromQuery] int? timezoneOffsetMinutes)
    {
        return Ok(await service.ListAsync(date, timezoneOffsetMinutes));
    }

    [HttpGet("bookings/availability")]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetAvailability(
        [FromQuery] DateTime date,
        [FromQuery] Guid serviceTypeId,
        [FromQuery] int? timezoneOffsetMinutes)
    {
        return Ok(await service.GetAvailabilityAsync(date, serviceTypeId, timezoneOffsetMinutes));
    }

    [HttpPost("bookings")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> CreateBooking([FromBody] BookingCreateRequest input)
    {
        return Ok(await service.CreateAsync(input));
    }

    [HttpPut("bookings/{id:guid}")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> UpdateBooking(Guid id, [FromBody] BookingUpdateRequest input)
    {
        return Ok(await service.UpdateAsync(id, input));
    }

    [HttpPatch("bookings/{id:guid}/status")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] BookingStatusRequest input)
    {
        return Ok(await service.UpdateStatusAsync(id, input));
    }

    [HttpGet("bookings/{id:guid}")]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetBooking(Guid id)
    {
        return Ok(await service.GetByIdAsync(id));
    }

    [HttpGet("customers")]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetCustomers([FromQuery] string? search, [FromQuery] int? page, [FromQuery] int? limit)
    {
        return Ok(await service.ListCustomersAsync(search, page, limit));
    }
}

public record BookingCreateRequest(
    [Required, MinLength(2)] string CustomerName,
    [Required, MinLength(7)] string CustomerPhone,
    [Required, MinLength(2)] string VehiclePlate,
    [Required] string VehicleMake,
    [Required] string VehicleModel,
    [Required] string VehicleColor,
    VehicleType VehicleType,
    Guid ServiceTypeId,
    DateTimeOffset ScheduledAt,
    string? Notes);
public record BookingUpdateRequest(
    [Required, MinLength(2)] string CustomerName,
    [Required, MinLength(7)] string CustomerPhone,
    [Required, MinLength(2)] string VehiclePlate,
    [Required] string VehicleMake,
    [Required] string VehicleModel,
    [Required] string VehicleColor,
    VehicleType VehicleType,
    Guid ServiceTypeId,
    DateTimeOffset ScheduledAt,
    string? Notes);
public record BookingStatusRequest([Required] BookingStatus Status);
