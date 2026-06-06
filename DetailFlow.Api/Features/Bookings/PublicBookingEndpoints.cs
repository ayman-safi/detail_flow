using System.ComponentModel.DataAnnotations;
using DetailFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Bookings;

[ApiController]
[AllowAnonymous]
[Route("api/public/shops/{tenantSlug}")]
public class PublicBookingsController(PublicBookingService service) : ControllerBase
{
    [HttpGet]
    [EnableRateLimiting("public-booking-read")]
    public async Task<IActionResult> GetShop(string tenantSlug)
    {
        return Ok(await service.GetShopAsync(tenantSlug));
    }

    [HttpGet("services")]
    [EnableRateLimiting("public-booking-read")]
    public async Task<IActionResult> GetServices(string tenantSlug)
    {
        return Ok(await service.ListServicesAsync(tenantSlug));
    }

    [HttpGet("availability")]
    [EnableRateLimiting("public-booking-read")]
    public async Task<IActionResult> GetAvailability(
        string tenantSlug,
        [FromQuery] DateTime date,
        [FromQuery] Guid serviceTypeId,
        [FromQuery] int? timezoneOffsetMinutes)
    {
        return Ok(await service.GetAvailabilityAsync(tenantSlug, date, serviceTypeId, timezoneOffsetMinutes));
    }

    [HttpPost("bookings")]
    [EnableRateLimiting("public-booking-create")]
    public async Task<IActionResult> CreateBooking(string tenantSlug, [FromBody] PublicBookingCreateRequest input)
    {
        return Ok(await service.CreateAsync(tenantSlug, input));
    }
}

public record PublicBookingCreateRequest(
    [Required, MinLength(2)] string CustomerName,
    [Required, MinLength(7)] string CustomerPhone,
    [Required, MinLength(2)] string VehiclePlate,
    [Required] string VehicleMake,
    [Required] string VehicleModel,
    [Required] string VehicleColor,
    [Required] VehicleType? VehicleType,
    Guid ServiceTypeId,
    DateTimeOffset ScheduledAt,
    string? Notes);
