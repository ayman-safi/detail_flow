using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Notifications;

[ApiController]
[Route("api")]
public class NotificationsController(WhatsAppNotificationService service) : ControllerBase
{
    [Authorize]
    [HttpGet("notifications/whatsapp/settings")]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetSettings()
    {
        return Ok(await service.GetSettingsAsync());
    }

    [Authorize]
    [HttpPatch("notifications/whatsapp/settings")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> UpdateSettings([FromBody] TenantWhatsAppSettingsRequest input)
    {
        return Ok(await service.UpdateSettingsAsync(input));
    }

    [Authorize]
    [HttpGet("notifications/whatsapp/logs")]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetLogs([FromQuery] int? limit)
    {
        return Ok(await service.ListLogsAsync(limit));
    }

    [AllowAnonymous]
    [HttpGet("integrations/whatsapp/webhook")]
    [EnableRateLimiting("webhook")]
    public async Task<IActionResult> VerifyWebhook(
        [FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? verifyToken,
        [FromQuery(Name = "hub.challenge")] string? challenge)
    {
        return Content(await service.VerifyWebhookAsync(mode, verifyToken, challenge), "text/plain");
    }

    [AllowAnonymous]
    [HttpPost("integrations/whatsapp/webhook")]
    [EnableRateLimiting("webhook")]
    public async Task<IActionResult> ReceiveWebhook()
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var payload = await reader.ReadToEndAsync();
        await service.HandleWebhookAsync(payload, Request.Headers["X-Hub-Signature-256"].ToString());
        return Ok(new { received = true });
    }
}
