using System.Security.Claims;
using DetailFlow.Api.Models;

namespace DetailFlow.Api.Infrastructure;

public static class EndpointExtensions
{
    public static Guid GetTenantId(this HttpContext ctx) =>
        Guid.Parse(ctx.User.FindFirst("tenant_id")!.Value);

    public static Guid GetUserId(this HttpContext ctx) =>
        Guid.Parse(ctx.User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    public static UserRole GetRole(this HttpContext ctx) =>
        Enum.Parse<UserRole>(ctx.User.FindFirst(ClaimTypes.Role)!.Value);

    public static bool IsManagerOrAbove(this HttpContext ctx) =>
        ctx.GetRole() is UserRole.Manager or UserRole.Owner;
}
