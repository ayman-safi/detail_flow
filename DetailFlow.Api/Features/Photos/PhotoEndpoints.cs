using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Photos;

[ApiController]
[Authorize]
[Route("api/work-orders/{id:guid}/photos")]
public class PhotosController(PhotoService service) : ControllerBase
{
    [HttpPost]
    [Consumes("multipart/form-data")]
    [EnableRateLimiting("uploads")]
    public async Task<IActionResult> Upload(Guid id, [FromForm] PhotoUploadRequest input)
    {
        return Ok(await service.UploadAsync(id, input.File, input.Type));
    }

    [HttpDelete("{photoId:guid}")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> Delete(Guid id, Guid photoId)
    {
        await service.DeleteAsync(id, photoId);
        return NoContent();
    }

    [HttpGet]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> List(Guid id)
    {
        return Ok(await service.ListAsync(id));
    }
}

public class PhotoUploadRequest
{
    public IFormFile File { get; set; } = null!;
    public string Type { get; set; } = "";
}
