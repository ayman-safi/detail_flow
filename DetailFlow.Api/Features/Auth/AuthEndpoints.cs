using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Auth;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService service) : ControllerBase
{
    [HttpPost("register-tenant")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-register")]
    public async Task<IActionResult> RegisterTenant([FromBody] RegisterTenantRequest input)
    {
        return Ok(await service.RegisterTenantAsync(input));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest input)
    {
        return Ok(await service.LoginAsync(input));
    }

    [HttpPost("accept-invite")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> AcceptInvite([FromBody] AccountActionPasswordRequest input)
    {
        return Ok(await service.AcceptInviteAsync(input));
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> ResetPassword([FromBody] AccountActionPasswordRequest input)
    {
        return Ok(await service.ResetPasswordAsync(input));
    }

    [HttpGet("me")]
    [Authorize]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> Me()
    {
        return Ok(await service.MeAsync());
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    [EnableRateLimiting("api-mutations")]
    public IActionResult Logout()
    {
        return Ok(service.Logout());
    }
}

public record RegisterTenantRequest(
    [Required, MinLength(2)] string TenantName,
    [Required, RegularExpression("^[a-z0-9-]{3,30}$")] string Slug,
    [Required, EmailAddress] string OwnerEmail,
    [Required, MinLength(8)] string OwnerPassword,
    [Required, MinLength(2)] string OwnerFullName);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string TenantSlug,
    [Required] string Password);

public record AccountActionPasswordRequest(
    [Required] string Token,
    [Required, MinLength(8)] string Password);
