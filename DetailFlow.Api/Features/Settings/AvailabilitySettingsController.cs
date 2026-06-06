using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Settings;

[ApiController]
[Route("api/settings/availability")]
[Authorize(Roles = "Owner,Manager")]
public class AvailabilitySettingsController(
    TenantSettingsService tenantSettings) : ControllerBase
{
    [HttpGet]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> Get()
    {
        var settings = await tenantSettings.GetAsync();
        return Ok(settings);
    }

    [HttpPut]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> Update([FromBody] TenantSettings input)
    {
        var current = await tenantSettings.GetAsync();
        input.Currency = current.Currency;
        await tenantSettings.SaveAsync(input);
        return Ok();
    }
}
