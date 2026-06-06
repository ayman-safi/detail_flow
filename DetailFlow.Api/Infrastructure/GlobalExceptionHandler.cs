using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using DetailFlow.Api.Features.Plans;

namespace DetailFlow.Api.Infrastructure;

public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IWebHostEnvironment env) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        if (ex is PlanLimitException planEx)
        {
            ctx.Response.StatusCode = StatusCodes.Status402PaymentRequired;
            await ctx.Response.WriteAsJsonAsync(new
            {
                error = "plan_limit_exceeded",
                message = planEx.Message,
                upgrade = true,
                statusCode = StatusCodes.Status402PaymentRequired
            }, ct);
            return true;
        }

        var (status, code, message) = ex switch
        {
            AuthenticationFailedException => (401, "UNAUTHORIZED", ex.Message),
            UnauthorizedAccessException => (403, "FORBIDDEN", ex.Message),
            KeyNotFoundException => (404, "NOT_FOUND", ex.Message),
            ArgumentException => (400, "BAD_REQUEST", ex.Message),
            ConflictException => (409, "CONFLICT", ex.Message),
            DbUpdateConcurrencyException => (409, "CONFLICT", ex.Message),
            InvalidOperationException => (422, "UNPROCESSABLE", ex.Message),
            _ => (500, "INTERNAL_ERROR", env.IsDevelopment() ? ex.Message : "An unexpected error occurred.")
        };

        if (status == StatusCodes.Status500InternalServerError)
            logger.LogError(ex, "Unhandled request error for {Method} {Path}", ctx.Request.Method, ctx.Request.Path);

        ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsJsonAsync(new { error = message, code, statusCode = status }, ct);
        return true;
    }
}

public class ConflictException(string message) : Exception(message);
public class AuthenticationFailedException(string message) : Exception(message);
