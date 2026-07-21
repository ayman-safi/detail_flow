using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using DetailFlow.Api.Data;
using DetailFlow.Api.Features.PlatformAdmin;
using DetailFlow.Api.Infrastructure;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace DetailFlow.Api.Features.Auth;

public class AuthService(
    DetailFlowDbContext db,
    IConfiguration config,
    ITenantContext tenantContext,
    IHttpContextAccessor httpContextAccessor,
    IWebHostEnvironment env,
    AccountActionTokenService accountActionTokens)
{
    public async Task<object> RegisterTenantAsync(RegisterTenantRequest input)
    {
        var slug = RequireText(input.Slug, "Slug").Trim();
        var tenantName = RequireText(input.TenantName, "Tenant name").Trim();
        var ownerEmail = RequireText(input.OwnerEmail, "Owner email").Trim().ToLowerInvariant();
        var ownerFullName = RequireText(input.OwnerFullName, "Owner full name").Trim();
        var ownerPassword = RequireText(input.OwnerPassword, "Password");

        if (!Regex.IsMatch(slug, "^[a-z0-9-]{3,30}$"))
            throw new ArgumentException("Slug must be 3-30 lowercase letters, numbers, or hyphens.");

        if (ownerPassword.Length < 8)
            throw new ArgumentException("Password must be at least 8 characters.");

        if (await db.Tenants.AnyAsync(t => t.Slug == slug))
            throw new ArgumentException("Slug is already taken.");

        if (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == ownerEmail))
            throw new ArgumentException("Email is already registered.");

        await using var tx = await db.Database.BeginTransactionAsync();
        var tenant = new Tenant
        {
            Name = tenantName,
            Slug = slug
        };
        db.Tenants.Add(tenant);

        var owner = new User
        {
            TenantId = tenant.Id,
            Email = ownerEmail,
            FullName = ownerFullName,
            Role = UserRole.Owner,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(ownerPassword, workFactor: 12),
            PasswordSetAt = DateTimeOffset.UtcNow
        };
        db.Users.Add(owner);
        db.ServiceTypes.AddRange(DefaultServiceSeeder.SeedDefaultServices(tenant.Id));

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        return BuildAuthResponse(owner, tenant);
    }

    public async Task<object> LoginAsync(LoginRequest input)
    {
        var tenantSlug = RequireText(input.TenantSlug, "Tenant slug").Trim();
        var email = RequireText(input.Email, "Email").Trim().ToLowerInvariant();
        var password = RequireText(input.Password, "Password");

        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Slug == tenantSlug && t.IsActive)
            ?? throw new AuthenticationFailedException("Invalid credentials");

        var user = await db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.TenantId == tenant.Id && u.Email == email && u.IsActive)
            ?? throw new AuthenticationFailedException("Invalid credentials");

        if (user.PasswordSetAt is null || string.IsNullOrWhiteSpace(user.PasswordHash))
            throw new AuthenticationFailedException("Invalid credentials");

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            throw new AuthenticationFailedException("Invalid credentials");

        return BuildAuthResponse(user, tenant);
    }

    public async Task<object> AcceptInviteAsync(AccountActionPasswordRequest input)
    {
        var token = await accountActionTokens.ConsumeAsync(AccountActionTokenPurpose.StaffInvite, input.Token);
        if (token.User.PasswordSetAt is not null)
            throw new ArgumentException("Invalid or expired token.");

        return await SetPasswordAndAuthenticateAsync(token, input.Password);
    }

    public async Task<object> ResetPasswordAsync(AccountActionPasswordRequest input)
    {
        var token = await accountActionTokens.ConsumeAsync(AccountActionTokenPurpose.PasswordReset, input.Token);
        if (token.User.PasswordSetAt is null)
            throw new ArgumentException("Invalid or expired token.");

        return await SetPasswordAndAuthenticateAsync(token, input.Password);
    }

    public async Task<object> MeAsync()
    {
        if (IsPlatformSupportSession())
            return await BuildSupportSessionMeAsync();

        var user = await db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == tenantContext.UserId && u.TenantId == tenantContext.TenantId && u.IsActive)
            ?? throw new AuthenticationFailedException("Invalid session.");
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantContext.TenantId && t.IsActive)
            ?? throw new AuthenticationFailedException("Invalid session.");

        return new { user = BuildUserDto(user, tenant) };
    }

    public object Logout()
    {
        httpContextAccessor.HttpContext?.Response.Cookies.Delete(
            AuthCookie.Name,
            AuthCookie.CreateExpiredOptions(config, env));
        return new { loggedOut = true };
    }

    private object BuildAuthResponse(User user, Tenant tenant)
    {
        var expires = DateTimeOffset.UtcNow.AddHours(GetJwtExpiryHours());
        var claims =
            new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim("tenant_id", tenant.Id.ToString()),
                new Claim(ClaimTypes.Role, user.Role.ToString()),
                new Claim("tenant_slug", tenant.Slug),
                new Claim("name", user.FullName)
            };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["JWT_SECRET"]!));
        var token = new JwtSecurityToken(
            issuer: config["JWT_ISSUER"],
            audience: config["JWT_AUDIENCE"],
            claims: claims,
            expires: expires.UtcDateTime,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        var tokenText = new JwtSecurityTokenHandler().WriteToken(token);
        var httpContext = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("HTTP context is required to issue an auth cookie.");
        httpContext.Response.Cookies.Append(AuthCookie.Name, tokenText, AuthCookie.CreateOptions(config, env, expires));

        return new { user = BuildUserDto(user, tenant) };
    }

    private object BuildUserDto(User user, Tenant tenant) => new
    {
        id = user.Id,
        user.FullName,
        user.Email,
        role = user.Role,
        tenantId = tenant.Id,
        tenantSlug = tenant.Slug,
        dashboardLocale = DashboardLanguages.Normalize(tenant.DashboardLocale)
    };

    private async Task<object> BuildSupportSessionMeAsync()
    {
        var now = DateTimeOffset.UtcNow;
        var tenant = await db.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t =>
                t.Id == tenantContext.TenantId &&
                t.IsActive &&
                t.SupportAccessEnabled &&
                t.SupportAccessExpiresAt > now)
            ?? throw new AuthenticationFailedException("Invalid session.");

        var user = httpContextAccessor.HttpContext?.User
            ?? throw new AuthenticationFailedException("Invalid session.");
        var email = user.FindFirst(PlatformAdminAuthService.PlatformAdminEmailClaim)?.Value ?? "";

        return new
        {
            user = new
            {
                id = tenantContext.UserId,
                fullName = tenantContext.UserName,
                email,
                role = "Owner",
                tenantId = tenant.Id,
                tenantSlug = tenant.Slug,
                dashboardLocale = DashboardLanguages.Normalize(tenant.DashboardLocale),
                isSupportSession = true,
                supportTenantName = tenant.Name,
                supportExpiresAt = tenant.SupportAccessExpiresAt
            }
        };
    }

    private bool IsPlatformSupportSession() =>
        httpContextAccessor.HttpContext?.User.FindFirst(PlatformAdminAuthService.PlatformSupportClaim)?.Value == "true";

    private int GetJwtExpiryHours() =>
        int.TryParse(config["JWT_EXPIRY_HOURS"], out var hours) ? Math.Clamp(hours, 1, 168) : 12;

    private async Task<object> SetPasswordAndAuthenticateAsync(AccountActionToken token, string? password)
    {
        var passwordText = RequireText(password, "Password");
        if (passwordText.Length < 8)
            throw new ArgumentException("Password must be at least 8 characters.");

        token.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(passwordText, workFactor: 12);
        token.User.PasswordSetAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync();
        return BuildAuthResponse(token.User, token.Tenant);
    }

    private static string RequireText(string? value, string name) =>
        string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"{name} is required.") : value;
}
