using DetailFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.PlatformAdmin;

[ApiController]
[Route("api/platform/auth")]
public class PlatformAuthController(PlatformAdminAuthService auth) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> Login([FromBody] PlatformAdminLoginRequest input)
    {
        return Ok(await auth.LoginAsync(input));
    }

    [HttpGet("me")]
    [Authorize(Policy = "PlatformAdmin")]
    [EnableRateLimiting("api-reads")]
    public IActionResult Me()
    {
        return Ok(auth.Me());
    }
}

[ApiController]
[Authorize(Policy = "PlatformAdmin")]
[Route("api/platform/admin")]
public class PlatformAdminController(PlatformAdminService service) : ControllerBase
{
    [HttpGet("tenants")]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> ListTenants(
        [FromQuery] string? search,
        [FromQuery] TenantPlan? plan,
        [FromQuery] bool? active,
        [FromQuery] TenantBillingStatus? billingStatus,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        return Ok(await service.ListTenantsAsync(search, plan, active, billingStatus, page, pageSize, cancellationToken));
    }

    [HttpGet("tenants/{tenantId:guid}")]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetTenant(Guid tenantId, CancellationToken cancellationToken)
    {
        return Ok(await service.GetTenantAsync(tenantId, cancellationToken));
    }

    [HttpPatch("tenants/{tenantId:guid}")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> UpdateTenant(
        Guid tenantId,
        [FromBody] PlatformTenantUpdateRequest input,
        CancellationToken cancellationToken)
    {
        return Ok(await service.UpdateTenantAsync(tenantId, input, cancellationToken));
    }

    [HttpPost("tenants/{tenantId:guid}/support-session")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> StartSupportSession(
        Guid tenantId,
        [FromBody] PlatformSupportSessionRequest input,
        CancellationToken cancellationToken)
    {
        return Ok(await service.StartSupportSessionAsync(tenantId, input, cancellationToken));
    }
}
