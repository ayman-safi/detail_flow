namespace DetailFlow.Api.Infrastructure;

public static class AuthCookie
{
    public const string Name = "detailflow_auth";

    public static CookieOptions CreateOptions(IConfiguration config, IWebHostEnvironment env, DateTimeOffset expires)
    {
        var secure = bool.TryParse(config["AUTH_COOKIE_SECURE"], out var configuredSecure)
            ? configuredSecure
            : env.IsProduction();

        return new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Expires = expires,
            Path = "/",
            IsEssential = true
        };
    }

    public static CookieOptions CreateExpiredOptions(IConfiguration config, IWebHostEnvironment env) =>
        CreateOptions(config, env, DateTimeOffset.UtcNow.AddDays(-1));
}
