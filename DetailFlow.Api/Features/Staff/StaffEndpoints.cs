using System.ComponentModel.DataAnnotations;
using DetailFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Staff;

[ApiController]
[Authorize]
[Route("api/staff")]
public class StaffController(StaffService service) : ControllerBase
{
    [HttpGet]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetStaff()
    {
        return Ok(await service.ListAsync());
    }

    [HttpPost]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> CreateStaff([FromBody] StaffCreateRequest input)
    {
        return Ok(await service.CreateAsync(input));
    }

    [HttpPost("{id:guid}/invite-link")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> CreateInviteLink(Guid id)
    {
        return Ok(await service.CreateInviteLinkAsync(id));
    }

    [HttpPost("{id:guid}/reset-link")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> CreateResetLink(Guid id)
    {
        return Ok(await service.CreateResetLinkAsync(id));
    }

    [HttpPatch("{id:guid}")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> UpdateStaff(Guid id, [FromBody] StaffPatchRequest input)
    {
        return Ok(await service.UpdateAsync(id, input));
    }
}

public record StaffCreateRequest(
    [Required, MinLength(2)] string FullName,
    [Required, EmailAddress] string Email,
    [Required, MinLength(7)] string Phone,
    UserRole Role);
public record StaffPatchRequest(string? FullName, string? Phone, UserRole? Role, bool? IsActive);
