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

    [HttpGet("availability/month")]
    [EnableRateLimiting("public-booking-read")]
    public async Task<IActionResult> GetMonthAvailability(
        string tenantSlug,
        [FromQuery] DateTime month,
        [FromQuery] Guid serviceTypeId,
        [FromQuery] int? timezoneOffsetMinutes)
    {
        return Ok(await service.GetMonthAvailabilityAsync(tenantSlug, month, serviceTypeId, timezoneOffsetMinutes));
    }

    [HttpPost("vehicle-lookup")]
    [EnableRateLimiting("public-booking-lookup")]
    public async Task<IActionResult> LookupVehicles(string tenantSlug, [FromBody] PublicVehicleLookupRequest input)
    {
        return Ok(await service.LookupVehiclesAsync(tenantSlug, input.CustomerPhone));
    }

    [HttpPost("bookings")]
    [EnableRateLimiting("public-booking-create")]
    public async Task<IActionResult> CreateBooking(string tenantSlug, [FromBody] PublicBookingCreateRequest input)
    {
        return Ok(await service.CreateAsync(tenantSlug, input));
    }
}

public record PublicBookingCreateRequest(
    [Required, MinLength(7)] string CustomerPhone,
    Guid ServiceTypeId,
    DateTimeOffset ScheduledAt,
    Guid? ExistingVehicleId,
    PublicBookingVehicleRequest? Vehicle,
    string? Notes);

public record PublicBookingVehicleRequest(
    [Required, MinLength(2)] string PlateNumber,
    [Required, MinLength(1)] string Make,
    [Required, MinLength(1)] string Model,
    [Required, MinLength(1)] string Color,
    VehicleType VehicleType);

public record PublicVehicleLookupRequest([Required, MinLength(7)] string CustomerPhone);
