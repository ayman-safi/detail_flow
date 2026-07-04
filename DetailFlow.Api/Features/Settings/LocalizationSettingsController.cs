using DetailFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Settings;

[ApiController]
[Route("api/settings/localization")]
[Authorize(Roles = "Owner,Manager")]
public class LocalizationSettingsController(
    TenantSettingsService tenantSettings) : ControllerBase
{
    [HttpGet]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> Get()
    {
        var settings = await tenantSettings.GetAsync();
        return Ok(new { settings.DefaultLocale, settings.AvailableLocales });
    }

    [HttpPatch]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> Update([FromBody] LocalizationSettingsRequest input)
    {
        var settings = await tenantSettings.GetAsync();
        settings.DefaultLocale = input.DefaultLocale;
        settings.AvailableLocales = input.AvailableLocales;
        await tenantSettings.SaveAsync(settings);
        return Ok(new { settings.DefaultLocale, settings.AvailableLocales });
    }
}

public record LocalizationSettingsRequest(string DefaultLocale, List<string> AvailableLocales);
