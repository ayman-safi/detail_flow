using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Services;

[ApiController]
[Authorize]
[Route("api/services")]
public class ServicesController(ServiceCatalogService service) : ControllerBase
{
    [HttpGet]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> GetServices([FromQuery] bool? includeInactive)
    {
        return Ok(await service.ListAsync(includeInactive == true));
    }

    [HttpPost]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> CreateService([FromBody] ServiceRequest input)
    {
        return Ok(await service.CreateAsync(input));
    }

    [HttpPatch("{id:guid}")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> UpdateService(Guid id, [FromBody] ServiceRequest input)
    {
        return Ok(await service.UpdateAsync(id, input));
    }

    [HttpPatch("reorder")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> ReorderServices([FromBody] ServiceReorderRequest input)
    {
        return Ok(await service.ReorderAsync(input));
    }

    [HttpPost("{id:guid}/image")]
    [Consumes("multipart/form-data")]
    [EnableRateLimiting("uploads")]
    public async Task<IActionResult> UploadImage(Guid id, [FromForm] ServiceImageUploadRequest input)
    {
        return Ok(await service.UploadImageAsync(id, input.File));
    }

    [HttpDelete("{id:guid}/image")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> DeleteImage(Guid id)
    {
        return Ok(await service.DeleteImageAsync(id));
    }
}

public record ServiceRequest(
    string? Name,
    string? Description,
    [Range(0.01, 999999)] decimal? BasePrice,
    [Range(1, 1440)] int? DurationMinutes,
    bool? IsActive,
    [Range(0, 10000)] int? SortOrder);

public record ServiceReorderRequest([Required, MinLength(1)] IReadOnlyList<Guid> OrderedIds);

public class ServiceImageUploadRequest
{
    [Required]
    public IFormFile File { get; set; } = null!;
}
