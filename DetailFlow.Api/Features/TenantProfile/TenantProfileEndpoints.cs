using DetailFlow.Api.Features.Plans;
using DetailFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.TenantProfile;

[ApiController]
[Authorize]
[Route("api/tenant")]
public class TenantProfileController(
    TenantProfileService service,
    PlanEnforcementService plans,
    ITenantContext tenantContext) : ControllerBase
{
    [HttpGet("profile")]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetProfile()
    {
        return Ok(await service.GetProfileAsync());
    }

    [HttpGet("/api/plan/status")]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetPlanStatus(CancellationToken cancellationToken)
    {
        return Ok(await plans.GetStatusAsync(tenantContext.TenantId, cancellationToken));
    }

    [HttpPatch("profile")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> UpdateProfile([FromBody] TenantProfileRequest input)
    {
        return Ok(await service.UpdateProfileAsync(input));
    }

    [HttpPost("logo")]
    [Consumes("multipart/form-data")]
    [EnableRateLimiting("uploads")]
    public async Task<IActionResult> UploadLogo([FromForm] TenantLogoUploadRequest input)
    {
        return Ok(await service.UploadLogoAsync(input.File));
    }
}

public record TenantProfileRequest(string? Name, string? LogoUrl);

public class TenantLogoUploadRequest
{
    public IFormFile File { get; set; } = null!;
}
