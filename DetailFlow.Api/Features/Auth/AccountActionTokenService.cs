using System.Security.Cryptography;
using System.Text;
using DetailFlow.Api.Data;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.Auth;

public class AccountActionTokenService(
    DetailFlowDbContext db,
    IConfiguration config,
    ITenantContext tenantContext)
{
    private static readonly TimeSpan InviteLifetime = TimeSpan.FromDays(7);
    private static readonly TimeSpan ResetLifetime = TimeSpan.FromHours(1);

    public Task<AccountActionLink> CreateInviteLinkAsync(User user) =>
        CreateLinkAsync(user, AccountActionTokenPurpose.StaffInvite, InviteLifetime);

    public Task<AccountActionLink> CreateResetLinkAsync(User user) =>
        CreateLinkAsync(user, AccountActionTokenPurpose.PasswordReset, ResetLifetime);

    public async Task<AccountActionToken> ConsumeAsync(AccountActionTokenPurpose purpose, string? rawToken)
    {
        var tokenText = RequireText(rawToken, "Token").Trim();
        var tokenHash = HashToken(tokenText);
        var now = DateTimeOffset.UtcNow;

        var token = await db.AccountActionTokens
            .IgnoreQueryFilters()
            .Include(t => t.Tenant)
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && t.Purpose == purpose);

        if (token is null ||
            token.UsedAt is not null ||
            token.ExpiresAt <= now ||
            !token.Tenant.IsActive ||
            !token.User.IsActive)
        {
            throw new ArgumentException("Invalid or expired token.");
        }

        token.UsedAt = now;
        var siblingTokens = await db.AccountActionTokens
            .IgnoreQueryFilters()
            .Where(t =>
                t.Id != token.Id &&
                t.TenantId == token.TenantId &&
                t.UserId == token.UserId &&
                t.Purpose == purpose &&
                t.UsedAt == null)
            .ToListAsync();

        foreach (var sibling in siblingTokens)
            sibling.UsedAt = now;

        return token;
    }

    private async Task<AccountActionLink> CreateLinkAsync(
        User user,
        AccountActionTokenPurpose purpose,
        TimeSpan lifetime)
    {
        var now = DateTimeOffset.UtcNow;
        var outstandingTokens = await db.AccountActionTokens
            .IgnoreQueryFilters()
            .Where(t =>
                t.TenantId == user.TenantId &&
                t.UserId == user.Id &&
                t.Purpose == purpose &&
                t.UsedAt == null)
            .ToListAsync();

        foreach (var outstanding in outstandingTokens)
            outstanding.UsedAt = now;

        var rawToken = Base64UrlTextEncoder.Encode(RandomNumberGenerator.GetBytes(32));
        var token = new AccountActionToken
        {
            TenantId = user.TenantId,
            UserId = user.Id,
            Purpose = purpose,
            TokenHash = HashToken(rawToken),
            ExpiresAt = now.Add(lifetime),
            CreatedByUserId = tenantContext.UserId == Guid.Empty ? null : tenantContext.UserId,
            CreatedByName = tenantContext.UserName
        };

        db.AccountActionTokens.Add(token);
        await db.SaveChangesAsync();

        return new AccountActionLink(BuildFrontendLink(purpose, rawToken), token.ExpiresAt);
    }

    private string BuildFrontendLink(AccountActionTokenPurpose purpose, string rawToken)
    {
        var path = purpose switch
        {
            AccountActionTokenPurpose.StaffInvite => "accept-invite",
            AccountActionTokenPurpose.PasswordReset => "reset-password",
            _ => throw new InvalidOperationException($"Unsupported account action purpose '{purpose}'.")
        };

        return $"{GetFrontendBaseUrl()}/{path}?token={Uri.EscapeDataString(rawToken)}";
    }

    private string GetFrontendBaseUrl()
    {
        var configured = config["FRONTEND_URL"] ?? "http://localhost:3000";
        var firstOrigin = configured
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault();

        return (string.IsNullOrWhiteSpace(firstOrigin) ? "http://localhost:3000" : firstOrigin).TrimEnd('/');
    }

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static string RequireText(string? value, string name) =>
        string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"{name} is required.") : value;
}

public sealed record AccountActionLink(string Link, DateTimeOffset ExpiresAt);
