using DetailFlow.Api.Data;
using DetailFlow.Api.Infrastructure;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.TenantProfile;

public class TenantProfileService(
    DetailFlowDbContext db,
    ITenantContext tenantContext,
    IR2StorageService r2,
    IConfiguration config)
{
    public async Task<object> GetProfileAsync()
    {
        var tenant = await db.Tenants.FirstAsync(t => t.Id == tenantContext.TenantId);
        return new { tenant.Id, tenant.Name, tenant.Slug, tenant.LogoUrl, tenant.Plan };
    }

    public async Task<object> UpdateProfileAsync(TenantProfileRequest input)
    {
        EnsureOwner();
        var tenant = await db.Tenants.FirstAsync(t => t.Id == tenantContext.TenantId);
        if (input.Name is not null)
            tenant.Name = RequireText(input.Name, "Shop name").Trim();
        if (input.LogoUrl is not null)
            tenant.LogoUrl = NormalizeLogoUrl(input.LogoUrl);
        await db.SaveChangesAsync();
        return new { tenant.Id, tenant.Name, tenant.Slug, tenant.LogoUrl, tenant.Plan };
    }

    public async Task<object> UploadLogoAsync(IFormFile file)
    {
        EnsureOwner();
        await using var stream = file.OpenReadStream();
        var image = await ImageUploadValidator.ValidateAsync(file, stream, 5 * 1024 * 1024);
        var key = $"logos/{tenantContext.TenantId}/logo{image.Extension}";
        var logoUrl = await r2.UploadAsync(stream, key, image.ContentType);

        var tenant = await db.Tenants.FirstAsync(t => t.Id == tenantContext.TenantId);
        tenant.LogoUrl = logoUrl;
        await db.SaveChangesAsync();
        return new { logoUrl };
    }

    private void EnsureOwner()
    {
        if (tenantContext.Role != UserRole.Owner)
            throw new UnauthorizedAccessException("Owner role required.");
    }

    private string? NormalizeLogoUrl(string logoUrl)
    {
        if (string.IsNullOrWhiteSpace(logoUrl))
            return null;

        if (!Uri.TryCreate(logoUrl.Trim(), UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
            throw new ArgumentException("Logo URL must be an HTTP URL produced by the logo upload endpoint.");

        if (!Uri.TryCreate(config["R2_PUBLIC_BASE_URL"], UriKind.Absolute, out var publicBaseUri))
            throw new InvalidOperationException("R2_PUBLIC_BASE_URL must be configured before setting logo URLs.");

        var basePath = publicBaseUri.AbsolutePath.TrimEnd('/') + "/";
        var trusted = string.Equals(uri.Scheme, publicBaseUri.Scheme, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(uri.Host, publicBaseUri.Host, StringComparison.OrdinalIgnoreCase) &&
            uri.Port == publicBaseUri.Port &&
            uri.AbsolutePath.StartsWith(basePath, StringComparison.Ordinal);

        if (!trusted)
            throw new ArgumentException("Logo URL must be produced by the logo upload endpoint.");

        return uri.ToString();
    }

    private static string RequireText(string? value, string name) =>
        string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"{name} is required.") : value;
}
