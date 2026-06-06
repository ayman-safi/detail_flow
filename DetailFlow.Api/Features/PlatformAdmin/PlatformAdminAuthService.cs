using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DetailFlow.Api.Infrastructure;
using DetailFlow.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace DetailFlow.Api.Features.PlatformAdmin;

public class PlatformAdminAuthService(
    IConfiguration config,
    IHttpContextAccessor httpContextAccessor,
    IWebHostEnvironment env)
{
    public const string PlatformAdminClaim = "platform_admin";
    public const string PlatformSupportClaim = "platform_support";
    public const string PlatformAdminEmailClaim = "platform_admin_email";

    public Task<object> LoginAsync(PlatformAdminLoginRequest input)
    {
        var configured = GetConfiguredAccount();
        var email = RequireText(input.Email, "Email").Trim().ToLowerInvariant();
        var password = RequireText(input.Password, "Password");

        if (!string.Equals(email, configured.Email, StringComparison.OrdinalIgnoreCase) ||
            !VerifyPassword(password, configured))
        {
            throw new AuthenticationFailedException("Invalid credentials");
        }

        return Task.FromResult(BuildPlatformAuthResponse(configured));
    }

    public object Me()
    {
        var user = httpContextAccessor.HttpContext?.User
            ?? throw new AuthenticationFailedException("Invalid session.");

        if (user.FindFirst(PlatformAdminClaim)?.Value != "true")
            throw new AuthenticationFailedException("Invalid session.");

        var email = user.FindFirst(PlatformAdminEmailClaim)?.Value
            ?? throw new AuthenticationFailedException("Invalid session.");

        var configured = GetConfiguredAccount();
        if (!string.Equals(email, configured.Email, StringComparison.OrdinalIgnoreCase))
            throw new AuthenticationFailedException("Invalid session.");

        return new { user = BuildPlatformUserDto(configured) };
    }

    public object IssueSupportSession(Tenant tenant, DateTimeOffset supportExpiresAt)
    {
        var admin = GetConfiguredAccount();
        var now = DateTimeOffset.UtcNow;
        if (supportExpiresAt <= now)
            throw new ArgumentException("Support access must expire in the future.");

        var expires = Min(now.AddHours(GetJwtExpiryHours()), supportExpiresAt);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, admin.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()),
            new Claim(ClaimTypes.Role, "Owner"),
            new Claim("tenant_id", tenant.Id.ToString()),
            new Claim("tenant_slug", tenant.Slug),
            new Claim("name", $"Support: {admin.Name}"),
            new Claim(PlatformSupportClaim, "true"),
            new Claim(PlatformAdminEmailClaim, admin.Email)
        };

        var tokenText = WriteJwt(claims, expires);
        AppendAuthCookie(tokenText, expires);

        return new
        {
            user = new
            {
                id = admin.Id,
                fullName = $"Support: {admin.Name}",
                email = admin.Email,
                role = "Owner",
                tenantId = tenant.Id,
                tenantSlug = tenant.Slug,
                isSupportSession = true,
                supportTenantName = tenant.Name,
                supportExpiresAt = expires
            },
            redirectPath = "/board"
        };
    }

    private object BuildPlatformAuthResponse(PlatformAdminAccount configured)
    {
        var expires = DateTimeOffset.UtcNow.AddHours(GetJwtExpiryHours());
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, configured.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, configured.Id.ToString()),
            new Claim(ClaimTypes.Role, "SuperAdmin"),
            new Claim("name", configured.Name),
            new Claim(PlatformAdminClaim, "true"),
            new Claim(PlatformAdminEmailClaim, configured.Email)
        };

        var tokenText = WriteJwt(claims, expires);
        AppendAuthCookie(tokenText, expires);

        return new { user = BuildPlatformUserDto(configured) };
    }

    private object BuildPlatformUserDto(PlatformAdminAccount account) => new
    {
        id = account.Id,
        fullName = account.Name,
        email = account.Email,
        role = "SuperAdmin",
        tenantId = (Guid?)null,
        tenantSlug = (string?)null,
        isPlatformAdmin = true
    };

    private PlatformAdminAccount GetConfiguredAccount()
    {
        var email = config["PLATFORM_ADMIN_EMAIL"]?.Trim().ToLowerInvariant();
        var name = config["PLATFORM_ADMIN_NAME"]?.Trim();
        var password = config["PLATFORM_ADMIN_PASSWORD"];
        var passwordHash = config["PLATFORM_ADMIN_PASSWORD_HASH"];

        if (string.IsNullOrWhiteSpace(email) ||
            (string.IsNullOrWhiteSpace(password) && string.IsNullOrWhiteSpace(passwordHash)))
        {
            throw new InvalidOperationException("Platform admin account is not configured.");
        }

        return new PlatformAdminAccount(
            StableGuid(email),
            email,
            string.IsNullOrWhiteSpace(name) ? "Platform Support" : name,
            password,
            passwordHash);
    }

    private bool VerifyPassword(string password, PlatformAdminAccount account)
    {
        if (!string.IsNullOrWhiteSpace(account.PasswordHash))
            return BCrypt.Net.BCrypt.Verify(password, account.PasswordHash);

        return string.Equals(password, account.Password, StringComparison.Ordinal);
    }

    private string WriteJwt(IEnumerable<Claim> claims, DateTimeOffset expires)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["JWT_SECRET"]!));
        var token = new JwtSecurityToken(
            issuer: config["JWT_ISSUER"],
            audience: config["JWT_AUDIENCE"],
            claims: claims,
            expires: expires.UtcDateTime,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private void AppendAuthCookie(string tokenText, DateTimeOffset expires)
    {
        var httpContext = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("HTTP context is required to issue an auth cookie.");
        httpContext.Response.Cookies.Append(AuthCookie.Name, tokenText, AuthCookie.CreateOptions(config, env, expires));
    }

    private int GetJwtExpiryHours() =>
        int.TryParse(config["JWT_EXPIRY_HOURS"], out var hours) ? Math.Clamp(hours, 1, 168) : 12;

    private static Guid StableGuid(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"detailflow-platform-admin:{value}"));
        return new Guid(bytes.AsSpan(0, 16));
    }

    private static DateTimeOffset Min(DateTimeOffset left, DateTimeOffset right) =>
        left <= right ? left : right;

    private static string RequireText(string? value, string name) =>
        string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"{name} is required.") : value;
}

public record PlatformAdminLoginRequest(string? Email, string? Password);

internal sealed record PlatformAdminAccount(
    Guid Id,
    string Email,
    string Name,
    string? Password,
    string? PasswordHash);
