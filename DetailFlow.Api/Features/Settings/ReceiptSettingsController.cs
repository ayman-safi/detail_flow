using System.ComponentModel.DataAnnotations;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DetailFlow.Api.Features.Settings;

[ApiController]
[Authorize]
[Route("api/settings/receipt")]
public class ReceiptSettingsController(
    TenantSettingsService tenantSettings) : ControllerBase
{
    [HttpGet]
    [EnableRateLimiting("api-reads")]
    public async Task<IActionResult> Get()
    {
        var settings = await tenantSettings.GetAsync();
        return Ok(ToResponse(settings.Currency));
    }

    [HttpPut]
    [Authorize(Roles = "Owner,Manager")]
    [EnableRateLimiting("api-mutations")]
    public async Task<IActionResult> Update([FromBody] ReceiptSettingsRequest input)
    {
        if (!TenantCurrencies.IsSupported(input.Currency))
            throw new ArgumentException("Unsupported receipt currency.");

        var settings = await tenantSettings.GetAsync();
        settings.Currency = input.Currency;
        await tenantSettings.SaveAsync(settings);
        return Ok(ToResponse(settings.Currency));
    }

    private static ReceiptSettingsResponse ToResponse(TenantCurrency currency) =>
        new(
            TenantCurrencies.Normalize(currency),
            TenantCurrencies.Supported.Select(value => new ReceiptCurrencyOption(
                value,
                TenantCurrencies.Label(value),
                TenantCurrencies.Symbol(value))).ToList());
}

public record ReceiptSettingsRequest([Required] TenantCurrency Currency);

public record ReceiptSettingsResponse(
    TenantCurrency Currency,
    IReadOnlyList<ReceiptCurrencyOption> SupportedCurrencies);

public record ReceiptCurrencyOption(
    TenantCurrency Currency,
    string Label,
    string Symbol);
