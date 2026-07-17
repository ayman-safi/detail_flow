using System.Security.Claims;
using DetailFlow.Api.Data;
using DetailFlow.Api.Features.PlatformAdmin;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Infrastructure;

public class ActiveUserMiddleware(
    RequestDelegate next,
    IConfiguration config,
    IWebHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext context, DetailFlowDbContext db)
    {
        if (!ShouldValidate(context))
        {
            await next(context);
            return;
        }

        if (IsPlatformSession(context.User))
        {
            if (!await ValidatePlatformSessionAsync(context, db))
                return;

            await next(context);
            return;
        }

        var userIdValue = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var tenantIdValue = context.User.FindFirst("tenant_id")?.Value;
        if (!Guid.TryParse(userIdValue, out var userId) || !Guid.TryParse(tenantIdValue, out var tenantId))
        {
            await RejectAsync(context);
            return;
        }

        var isActive = await db.Users
            .IgnoreQueryFilters()
            .AnyAsync(user =>
                user.Id == userId &&
                user.TenantId == tenantId &&
                user.IsActive &&
                user.Tenant.IsActive);

        if (!isActive)
        {
            await RejectAsync(context);
            return;
        }

        await next(context);
    }

    private static bool IsPlatformSession(ClaimsPrincipal user) =>
        user.FindFirst(PlatformAdminAuthService.PlatformAdminClaim)?.Value == "true" ||
        user.FindFirst(PlatformAdminAuthService.PlatformSupportClaim)?.Value == "true";

    private async Task<bool> ValidatePlatformSessionAsync(HttpContext context, DetailFlowDbContext db)
    {
        var isPlatformAdmin = context.User.FindFirst(PlatformAdminAuthService.PlatformAdminClaim)?.Value == "true";
        var isSupportSession = context.User.FindFirst(PlatformAdminAuthService.PlatformSupportClaim)?.Value == "true";
        if (!isPlatformAdmin && !isSupportSession)
            return false;

        if (!ConfiguredAdminMatches(context.User))
        {
            await RejectAsync(context);
            return false;
        }

        if (isPlatformAdmin)
        {
            if (context.Request.Path.StartsWithSegments("/api/platform"))
                return true;

            await RejectAsync(context);
            return false;
        }

        var tenantIdValue = context.User.FindFirst("tenant_id")?.Value;
        if (!Guid.TryParse(tenantIdValue, out var tenantId))
        {
            await RejectAsync(context);
            return false;
        }

        var now = DateTimeOffset.UtcNow;
        var isAllowed = await db.Tenants
            .IgnoreQueryFilters()
            .AnyAsync(t =>
                t.Id == tenantId &&
                t.IsActive &&
                t.SupportAccessEnabled &&
                t.SupportAccessExpiresAt > now);

        if (!isAllowed)
        {
            await RejectAsync(context);
            return false;
        }

        return true;
    }

    private static bool ShouldValidate(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated != true)
            return false;

        var path = context.Request.Path;
        if (!path.StartsWithSegments("/api"))
            return false;

        return !IsAnonymousApiPath(path);
    }

    private static bool IsAnonymousApiPath(PathString path) =>
        path.StartsWithSegments("/api/health") ||
        path.StartsWithSegments("/api/auth/register-tenant") ||
        path.StartsWithSegments("/api/auth/login") ||
        path.StartsWithSegments("/api/auth/accept-invite") ||
        path.StartsWithSegments("/api/auth/reset-password") ||
        path.StartsWithSegments("/api/auth/logout") ||
        path.StartsWithSegments("/api/platform/auth/login") ||
        path.StartsWithSegments("/api/public") ||
        path.StartsWithSegments("/api/work-orders/track") ||
        path.StartsWithSegments("/api/integrations/whatsapp/webhook");

    private bool ConfiguredAdminMatches(ClaimsPrincipal user)
    {
        var configuredEmail = config["PLATFORM_ADMIN_EMAIL"]?.Trim();
        var tokenEmail = user.FindFirst(PlatformAdminAuthService.PlatformAdminEmailClaim)?.Value;
        return !string.IsNullOrWhiteSpace(configuredEmail) &&
            string.Equals(configuredEmail, tokenEmail, StringComparison.OrdinalIgnoreCase);
    }

    private async Task RejectAsync(HttpContext context)
    {
        context.Response.Cookies.Delete(AuthCookie.Name, AuthCookie.CreateExpiredOptions(config, env));
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new
        {
            error = "Invalid session.",
            code = "UNAUTHORIZED",
            statusCode = StatusCodes.Status401Unauthorized
        });
    }
}
