using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Settings;

[ApiController]
[Route("api/settings/dashboard-language")]
[Authorize]
public class DashboardLanguageSettingsController(
    TenantSettingsService tenantSettings) : ControllerBase
{
    [HttpGet]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> Get()
    {
        var language = await tenantSettings.GetDashboardLanguageAsync();
        return Ok(BuildResponse(language));
    }

    [HttpPatch]
    [Authorize(Roles = "Owner,Manager")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> Update([FromBody] DashboardLanguageSettingsRequest input)
    {
        var language = await tenantSettings.SaveDashboardLanguageAsync(input.DashboardLocale);
        return Ok(BuildResponse(language));
    }

    private static object BuildResponse(string language) => new
    {
        dashboardLocale = DashboardLanguages.Normalize(language),
        supportedLocales = DashboardLanguages.Supported
    };
}

public sealed record DashboardLanguageSettingsRequest(string? DashboardLocale);
