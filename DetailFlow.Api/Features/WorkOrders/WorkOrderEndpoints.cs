using DetailFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.WorkOrders;

[ApiController]
[Route("api/work-orders")]
public class WorkOrdersController(WorkOrderService service) : ControllerBase
{
    [HttpGet("board")]
    [Authorize]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetBoard()
    {
        return Ok(await service.GetBoardAsync());
    }

    [HttpPatch("{id:guid}/stage")]
    [Authorize]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> ChangeStage(Guid id, [FromBody] StageChangeRequest input)
    {
        return Ok(await service.ChangeStageAsync(id, input));
    }

    [HttpPost]
    [Authorize]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> CreateWalkIn([FromBody] WalkInCreateRequest input)
    {
        return Ok(await service.CreateWalkInAsync(input));
    }

    [HttpGet("{id:guid}")]
    [Authorize]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetWorkOrder(Guid id)
    {
        return Ok(await service.GetByIdAsync(id));
    }

    [HttpPatch("{id:guid}/assign")]
    [Authorize]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignRequest input)
    {
        return Ok(await service.AssignAsync(id, input));
    }

    [HttpPatch("{id:guid}/price")]
    [Authorize]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> UpdatePrice(Guid id, [FromBody] PriceRequest input)
    {
        return Ok(await service.UpdatePriceAsync(id, input));
    }

    [HttpPatch("{id:guid}/payment-status")]
    [Authorize]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> UpdatePaymentStatus(Guid id, [FromBody] PaymentStatusRequest input)
    {
        return Ok(await service.UpdatePaymentStatusAsync(id, input));
    }

    [HttpGet("track/{token}")]
    [AllowAnonymous]
    [EnableRateLimiting("public-track")]
    public async Task<IActionResult> Track(string token)
    {
        return Ok(await service.GetTrackingAsync(token));
    }

    [HttpGet("track/{token}/receipt")]
    [AllowAnonymous]
    [EnableRateLimiting("public-receipt")]
    public async Task<IActionResult> PublicReceipt(string token, [FromQuery] string? locale)
    {
        var receipt = await service.GeneratePublicReceiptAsync(token, locale);
        return File(receipt.Content, "application/pdf", receipt.FileName);
    }

    [HttpGet("{id:guid}/receipt")]
    [Authorize]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> Receipt(Guid id, [FromQuery] string? locale)
    {
        var receipt = await service.GenerateReceiptAsync(id, locale);
        return File(receipt.Content, "application/pdf", receipt.FileName);
    }

    [HttpPost("{id:guid}/share/whatsapp")]
    [Authorize]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> CreateManualTrackingShare(
        Guid id,
        [FromQuery] NotificationEventType? eventType,
        [FromQuery] string? locale)
    {
        return Ok(await service.CreateManualTrackingShareAsync(id, eventType, locale));
    }

    [HttpGet("board/stream")]
    [Authorize]
    [EnableRateLimiting("sse-auth")]
    public Task StreamBoard(CancellationToken cancellationToken)
    {
        return service.StreamBoardAsync(HttpContext, cancellationToken);
    }

    [HttpGet("track/{token}/stream")]
    [AllowAnonymous]
    [EnableRateLimiting("sse-public")]
    public Task StreamToken(string token, CancellationToken cancellationToken)
    {
        return service.StreamTokenAsync(token, HttpContext, cancellationToken);
    }
}
