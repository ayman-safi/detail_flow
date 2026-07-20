using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Analytics;

[ApiController]
[Authorize]
[Route("api/analytics")]
public class AnalyticsController(AnalyticsService service) : ControllerBase
{
    [HttpGet("dashboard")]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetDashboard(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int? timezoneOffsetMinutes)
    {
        return Ok(await service.GetDashboardAsync(from, to, timezoneOffsetMinutes));
    }
}
