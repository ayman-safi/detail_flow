using System.Security.Claims;
using DetailFlow.Api.Features.PlatformAdmin;
using DetailFlow.Api.Models;

namespace DetailFlow.Api.Services;

public class TenantContext(IHttpContextAccessor accessor) : ITenantContext
{
    public Guid TenantId => TryGetGuid("tenant_id");
    public Guid UserId => TryGetGuid(ClaimTypes.NameIdentifier);
    public UserRole Role
    {
        get
        {
            var user = accessor.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true)
                return UserRole.Staff;

            var value = user.FindFirst(ClaimTypes.Role)?.Value;
            return Enum.TryParse<UserRole>(value, out var role)
                ? role
                : throw new UnauthorizedAccessException("Authenticated user is missing a valid role claim.");
        }
    }
    public string UserName => accessor.HttpContext?.User.FindFirst("name")?.Value ?? "Unknown";

    private Guid TryGetGuid(string type)
    {
        var user = accessor.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
            return Guid.Empty;

        var value = user.FindFirst(type)?.Value;
        if (string.IsNullOrWhiteSpace(value) &&
            user.FindFirst(PlatformAdminAuthService.PlatformAdminClaim)?.Value == "true")
        {
            return Guid.Empty;
        }

        return Guid.TryParse(value, out var id)
            ? id
            : throw new UnauthorizedAccessException($"Authenticated user is missing a valid {type} claim.");
    }
}
