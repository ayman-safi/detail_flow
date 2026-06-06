using System.Globalization;
using DetailFlow.Api.Models;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace DetailFlow.Api.Services;

public class ReceiptService
{
    private const string ArabicFontResourceRegular = "DetailFlow.Api.Resources.Fonts.Amiri-Regular.ttf";
    private const string ArabicFontResourceBold = "DetailFlow.Api.Resources.Fonts.Amiri-Bold.ttf";
    private const int MaxLogoBytes = 2 * 1024 * 1024;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<ReceiptService> _logger;
    private readonly Uri? _trustedLogoBaseUri;
    private readonly HashSet<string> _trustedLogoHosts;

    public ReceiptService(IHttpClientFactory httpClientFactory, IConfiguration config, ILogger<ReceiptService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _trustedLogoBaseUri = Uri.TryCreate(config["R2_PUBLIC_BASE_URL"], UriKind.Absolute, out var baseUri) ? baseUri : null;
        _trustedLogoHosts = (config["TRUSTED_LOGO_HOSTS"] ?? "")
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(host => host.ToLowerInvariant())
            .ToHashSet();
    }

    static ReceiptService()
    {
        FontManager.RegisterFontFromEmbeddedResource(ArabicFontResourceRegular);
        FontManager.RegisterFontFromEmbeddedResource(ArabicFontResourceBold);
    }

    public async Task<byte[]> GenerateReceiptAsync(WorkOrder workOrder, string? locale)
    {
        var text = ReceiptText.ForLocale(locale);
        var currency = TenantCurrencies.Normalize(workOrder.Tenant.Settings.Currency);
        var totalPrice = workOrder.ActualPrice ?? workOrder.ServiceType.BasePrice;
        var logo = string.IsNullOrWhiteSpace(workOrder.Tenant.LogoUrl)
            ? null
            : await FetchLogoBytesAsync(workOrder.Tenant.LogoUrl);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A5);
                page.Margin(30, Unit.Point);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(style => style
                    .FontFamily(text.FontFamily)
                    .FontSize(10)
                    .FontColor("#0f172a"));

                if (text.IsRtl)
                    page.ContentFromRightToLeft();

                page.Content().Column(column =>
                {
                    column.Spacing(14);

                    column.Item().Border(1).BorderColor("#e2e8f0").Background("#f8fafc").Padding(14).Row(row =>
                    {
                        if (logo is not null)
                            row.ConstantItem(60).Height(60).Image(logo).FitArea();

                        var tenantBlock = row.RelativeItem();
                        tenantBlock = text.IsRtl ? tenantBlock.AlignLeft() : tenantBlock.AlignRight();
                        tenantBlock.Column(info =>
                        {
                            info.Item().Text(workOrder.Tenant.Name).Bold().FontSize(16);
                            info.Item().PaddingTop(4).Text(text.Title).FontColor("#475569");
                        });
                    });

                    column.Item().Row(row =>
                    {
                        var referenceBlock = row.RelativeItem();
                        referenceBlock = text.IsRtl ? referenceBlock.AlignRight() : referenceBlock.AlignLeft();
                        referenceBlock.Text($"{text.ReceiptNumberLabel} WO-{workOrder.Id.ToString()[..8].ToUpperInvariant()}").Bold();

                        var updatedBlock = row.RelativeItem();
                        updatedBlock = text.IsRtl ? updatedBlock.AlignLeft() : updatedBlock.AlignRight();
                        updatedBlock.Text($"{text.UpdatedAtLabel} {text.FormatDate(workOrder.UpdatedAt)}").FontColor("#475569");
                    });

                    column.Item().Row(row =>
                    {
                        row.Spacing(12);

                        row.RelativeItem().Border(1).BorderColor("#e2e8f0").Background(Colors.White).Padding(12).Column(info =>
                        {
                            info.Spacing(2);
                            info.Item().Text(text.CustomerLabel).Bold().FontSize(9).FontColor("#64748b");
                            info.Item().Text(workOrder.Customer.FullName).Bold().FontSize(12);
                            info.Item().ContentFromLeftToRight().Text(workOrder.Customer.Phone);
                        });

                        row.RelativeItem().Border(1).BorderColor("#e2e8f0").Background(Colors.White).Padding(12).Column(info =>
                        {
                            info.Spacing(2);
                            info.Item().Text(text.VehicleLabel).Bold().FontSize(9).FontColor("#64748b");
                            info.Item().Text($"{workOrder.Vehicle.Make} {workOrder.Vehicle.Model}").Bold().FontSize(12);
                            info.Item().ContentFromLeftToRight().Text(workOrder.Vehicle.PlateNumber);
                            info.Item().Text(workOrder.Vehicle.Color).FontColor("#475569");
                        });
                    });

                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(3);
                            columns.RelativeColumn(1.25f);
                            columns.RelativeColumn(1.25f);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderCell).Element(container => text.IsRtl ? container.AlignRight() : container.AlignLeft()).Text(text.ServiceLabel).Bold();
                            header.Cell().Element(HeaderCell).AlignCenter().Text(text.DurationLabel).Bold();
                            header.Cell().Element(HeaderCell).Element(container => text.IsRtl ? container.AlignLeft() : container.AlignRight()).Text(text.PriceLabel).Bold();
                        });

                        table.Cell().Element(BodyCell).Element(container => text.IsRtl ? container.AlignRight() : container.AlignLeft()).Text(workOrder.ServiceType.Name);
                        table.Cell().Element(BodyCell).AlignCenter().Text(text.FormatDuration(workOrder.ServiceType.DurationMinutes));
                        table.Cell().Element(BodyCell).Element(container => text.IsRtl ? container.AlignLeft() : container.AlignRight()).ContentFromLeftToRight().Text(text.FormatCurrency(totalPrice, currency)).Bold();
                    });

                    if (!string.IsNullOrWhiteSpace(workOrder.AssignedStaff?.FullName))
                    {
                        var staffedByBlock = column.Item().PaddingTop(2);
                        staffedByBlock = text.IsRtl ? staffedByBlock.AlignRight() : staffedByBlock.AlignLeft();
                        staffedByBlock.Text($"{text.ServicedByLabel} {workOrder.AssignedStaff.FullName}").FontColor("#475569");
                    }

                    column.Item().LineHorizontal(1).LineColor("#e2e8f0");
                    column.Item().AlignCenter().Text(text.ThankYou(workOrder.Tenant.Name)).FontColor("#64748b").FontSize(9).Italic();
                });
            });
        }).GeneratePdf();
    }

    private static IContainer HeaderCell(IContainer container)
    {
        return container
            .Background("#f1f5f9")
            .BorderBottom(1)
            .BorderColor("#e2e8f0")
            .PaddingVertical(8)
            .PaddingHorizontal(10);
    }

    private static IContainer BodyCell(IContainer container)
    {
        return container
            .BorderBottom(1)
            .BorderColor("#e2e8f0")
            .PaddingVertical(10)
            .PaddingHorizontal(10);
    }

    private async Task<byte[]?> FetchLogoBytesAsync(string logoUrl)
    {
        try
        {
            if (!Uri.TryCreate(logoUrl, UriKind.Absolute, out var uri) || !IsTrustedLogoUri(uri))
                return null;

            using var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(5);
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            if (!response.IsSuccessStatusCode)
                return null;

            var mediaType = response.Content.Headers.ContentType?.MediaType;
            if (mediaType is not ("image/png" or "image/jpeg" or "image/jpg"))
                return null;
            if (response.Content.Headers.ContentLength > MaxLogoBytes)
                return null;

            await using var stream = await response.Content.ReadAsStreamAsync();
            await using var buffer = new MemoryStream();
            var bytesRead = 0;
            var chunk = new byte[81920];
            int read;
            while ((read = await stream.ReadAsync(chunk)) > 0)
            {
                bytesRead += read;
                if (bytesRead > MaxLogoBytes)
                    return null;
                buffer.Write(chunk, 0, read);
            }

            var bytes = buffer.ToArray();
            return IsSupportedImage(bytes) ? bytes : null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Receipt logo fetch failed for configured tenant logo.");
            return null;
        }
    }

    private bool IsTrustedLogoUri(Uri uri)
    {
        if (uri.Scheme is not ("http" or "https"))
            return false;

        if (_trustedLogoBaseUri is not null &&
            string.Equals(uri.Scheme, _trustedLogoBaseUri.Scheme, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(uri.Host, _trustedLogoBaseUri.Host, StringComparison.OrdinalIgnoreCase) &&
            uri.Port == _trustedLogoBaseUri.Port &&
            uri.AbsolutePath.StartsWith(_trustedLogoBaseUri.AbsolutePath.TrimEnd('/') + "/", StringComparison.Ordinal))
        {
            return true;
        }

        return _trustedLogoHosts.Contains(uri.Host.ToLowerInvariant());
    }

    private static bool IsSupportedImage(byte[] bytes)
    {
        if (bytes.Length < 4)
            return false;

        var isPng = bytes.Length >= 8
            && bytes[0] == 0x89
            && bytes[1] == 0x50
            && bytes[2] == 0x4E
            && bytes[3] == 0x47
            && bytes[4] == 0x0D
            && bytes[5] == 0x0A
            && bytes[6] == 0x1A
            && bytes[7] == 0x0A;

        var isJpeg = bytes[0] == 0xFF
            && bytes[1] == 0xD8
            && bytes[^2] == 0xFF
            && bytes[^1] == 0xD9;

        return isPng || isJpeg;
    }

    private sealed record ReceiptText(
        bool IsRtl,
        string FontFamily,
        CultureInfo Culture,
        string Title,
        string ReceiptNumberLabel,
        string UpdatedAtLabel,
        string CustomerLabel,
        string VehicleLabel,
        string ServiceLabel,
        string DurationLabel,
        string PriceLabel,
        string ServicedByLabel,
        string ThankYouTemplate,
        string MinutesSuffix)
    {
        public static ReceiptText ForLocale(string? locale)
        {
            if (!string.IsNullOrWhiteSpace(locale) &&
                locale.StartsWith("ar", StringComparison.OrdinalIgnoreCase))
            {
                return new ReceiptText(
                    true,
                    "Amiri",
                    CultureInfo.GetCultureInfo("ar-SA"),
                    "فاتورة الخدمة",
                    "رقم الفاتورة",
                    "آخر تحديث",
                    "العميل",
                    "المركبة",
                    "الخدمة",
                    "المدة",
                    "السعر",
                    "تمت الخدمة بواسطة:",
                    "شكرًا لاختياركم {0}",
                    "دقيقة");
            }

            return new ReceiptText(
                false,
                "Arial",
                CultureInfo.GetCultureInfo("en-US"),
                "Service Receipt",
                "Receipt #",
                "Updated",
                "Customer",
                "Vehicle",
                "Service",
                "Duration",
                "Price",
                "Serviced by:",
                "Thank you for choosing {0}",
                "min");
        }

        public string FormatCurrency(decimal value, TenantCurrency currency)
        {
            var amount = value.ToString("0.##", Culture);
            var symbol = TenantCurrencies.Symbol(currency);
            return currency == TenantCurrency.USD && !IsRtl
                ? $"{symbol}{amount}"
                : $"{amount} {symbol}";
        }

        public string FormatDate(DateTimeOffset value)
        {
            return value.ToString("dd MMM yyyy, HH:mm", Culture);
        }

        public string FormatDuration(int minutes)
        {
            return $"{minutes.ToString(Culture)} {MinutesSuffix}";
        }

        public string ThankYou(string tenantName)
        {
            return string.Format(Culture, ThankYouTemplate, tenantName);
        }
    }
}
