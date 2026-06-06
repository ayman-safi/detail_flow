using System.Security.Claims;
using System.Threading.RateLimiting;
using DetailFlow.Api.Features.Analytics;
using DetailFlow.Api.Features.Auth;
using DetailFlow.Api.Features.Bookings;
using DetailFlow.Api.Features.Dev;
using DetailFlow.Api.Features.Notifications;
using DetailFlow.Api.Features.Photos;
using DetailFlow.Api.Features.PlatformAdmin;
using DetailFlow.Api.Features.Plans;
using DetailFlow.Api.Features.Services;
using DetailFlow.Api.Features.Staff;
using DetailFlow.Api.Features.TenantProfile;
using DetailFlow.Api.Features.WorkOrders;
using DetailFlow.Api.Services;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Infrastructure;

public static class DetailFlowServiceCollectionExtensions
{
    public static IServiceCollection AddDetailFlowApplicationServices(this IServiceCollection services)
    {
        services.AddHttpClient();
        services.AddHttpContextAccessor();
        services.AddScoped<ITenantContext, TenantContext>();
        services.AddScoped<TenantSettingsService>();
        services.AddSingleton<IR2StorageService, R2StorageService>();
        services.AddSingleton<BoardEventService>();
        services.AddScoped<ReceiptService>();
        services.AddScoped<AuthService>();
        services.AddScoped<AccountActionTokenService>();
        services.AddScoped<PlatformAdminAuthService>();
        services.AddScoped<PlatformAdminService>();
        services.AddScoped<ServiceCatalogService>();
        services.AddScoped<BookingService>();
        services.AddScoped<PublicBookingService>();
        services.AddScoped<WorkOrderService>();
        services.AddScoped<PhotoService>();
        services.AddScoped<StaffService>();
        services.AddScoped<AnalyticsService>();
        services.AddScoped<TenantProfileService>();
        services.AddScoped<WhatsAppNotificationService>();
        services.AddScoped<PlanEnforcementService>();
        services.AddScoped<DevSeedService>();
        services.AddSingleton<GlobalExceptionHandler>();
        services.AddExceptionHandler<GlobalExceptionHandler>();
        services.Configure<ExceptionHandlerOptions>(options =>
        {
            options.ExceptionHandler = async ctx =>
            {
                var ex = ctx.Features.Get<IExceptionHandlerFeature>()?.Error
                    ?? new InvalidOperationException("An unhandled error occurred.");
                var handler = ctx.RequestServices.GetRequiredService<GlobalExceptionHandler>();
                await handler.TryHandleAsync(ctx, ex, ctx.RequestAborted);
            };
        });
        services.AddProblemDetails();

        return services;
    }

    public static IServiceCollection AddDetailFlowRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                await context.HttpContext.Response.WriteAsJsonAsync(new
                {
                    error = "Too many requests. Please slow down and try again.",
                    code = "RATE_LIMITED",
                    statusCode = StatusCodes.Status429TooManyRequests
                }, ct);
            };

            options.AddPolicy("auth-login", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(GetAnonymousPartition(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 5,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

            options.AddPolicy("auth-register", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(GetAnonymousPartition(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 3,
                    Window = TimeSpan.FromHours(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

            options.AddPolicy("public-track", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(GetAnonymousPartition(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 60,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

            options.AddPolicy("public-receipt", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(GetAnonymousPartition(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(5),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

            options.AddPolicy("public-booking-read", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(GetPublicShopPartition(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 90,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

            options.AddPolicy("public-booking-create", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(GetPublicShopPartition(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 6,
                    Window = TimeSpan.FromMinutes(15),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

            options.AddPolicy("webhook", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(GetAnonymousPartition(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 120,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

            options.AddPolicy("api-reads", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(GetUserPartition(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 240,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

            options.AddPolicy("api-mutations", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(GetUserPartition(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 90,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

            options.AddPolicy("uploads", httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(GetUserPartition(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 20,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

            options.AddPolicy("sse-auth", httpContext =>
                RateLimitPartition.GetConcurrencyLimiter(GetUserPartition(httpContext), _ => new ConcurrencyLimiterOptions
                {
                    PermitLimit = 5,
                    QueueLimit = 0
                }));

            options.AddPolicy("sse-public", httpContext =>
                RateLimitPartition.GetConcurrencyLimiter(GetPublicTokenPartition(httpContext), _ => new ConcurrencyLimiterOptions
                {
                    PermitLimit = 3,
                    QueueLimit = 0
                }));
        });

        return services;
    }

    private static string GetAnonymousPartition(HttpContext context) =>
        $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";

    private static string GetUserPartition(HttpContext context)
    {
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return string.IsNullOrWhiteSpace(userId) ? GetAnonymousPartition(context) : $"user:{userId}";
    }

    private static string GetPublicTokenPartition(HttpContext context)
    {
        var token = context.Request.RouteValues.TryGetValue("token", out var value) ? value?.ToString() : null;
        return string.IsNullOrWhiteSpace(token)
            ? GetAnonymousPartition(context)
            : $"{GetAnonymousPartition(context)}:track:{token}";
    }

    private static string GetPublicShopPartition(HttpContext context)
    {
        var tenantSlug = context.Request.RouteValues.TryGetValue("tenantSlug", out var value) ? value?.ToString() : null;
        return string.IsNullOrWhiteSpace(tenantSlug)
            ? GetAnonymousPartition(context)
            : $"{GetAnonymousPartition(context)}:shop:{tenantSlug.ToLowerInvariant()}";
    }
}
