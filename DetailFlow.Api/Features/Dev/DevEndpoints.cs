using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Dev;

[ApiController]
[Route("api/dev")]
public class DevController(DevSeedService service, IWebHostEnvironment env) : ControllerBase
{
    [HttpPost("seed")]
    [AllowAnonymous]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> Seed()
    {
        if (!env.IsDevelopment())
            return NotFound();

        return Ok(await service.SeedAsync());
    }
}
