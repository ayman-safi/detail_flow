using Microsoft.AspNetCore.Mvc;

namespace DetailFlow.Api.Controllers;

[ApiController]
public class RootController : ControllerBase
{
    [HttpGet("/")]
    public IActionResult Get()
    {
        return Ok(new { name = "DetailFlow API", status = "ok" });
    }
}
