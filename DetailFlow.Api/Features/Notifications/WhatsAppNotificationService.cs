using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DetailFlow.Api.Data;
using DetailFlow.Api.Features.Plans;
using DetailFlow.Api.Features.WorkOrders;
using DetailFlow.Api.Infrastructure;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.Notifications;

public class WhatsAppNotificationService(
    DetailFlowDbContext db,
    ITenantContext tenantContext,
    IConfiguration config,
    IDataProtectionProvider dataProtectionProvider,
    IHttpClientFactory httpClientFactory,
    PlanEnforcementService planEnforcement,
    ILogger<WhatsAppNotificationService> logger)
{
    private readonly IDataProtector _tokenProtector = dataProtectionProvider.CreateProtector("DetailFlow.Api.Notifications.WhatsApp.AccessToken");

    public async Task<object> GetSettingsAsync()
    {
        EnsureOwner();
        var settings = await db.TenantWhatsAppSettings.AsNoTracking().FirstOrDefaultAsync();
        return ToSettingsDto(settings);
    }

    public async Task<object> UpdateSettingsAsync(TenantWhatsAppSettingsRequest input)
    {
        EnsureOwner();
        if (input.IsEnabled || input.AutoSendReady)
            await planEnforcement.AssertWhatsAppEnabledAsync(tenantContext.TenantId);

        var settings = await db.TenantWhatsAppSettings.FirstOrDefaultAsync();
        if (settings is null)
        {
            settings = new TenantWhatsAppSettings { TenantId = tenantContext.TenantId };
            db.TenantWhatsAppSettings.Add(settings);
        }

        settings.IsEnabled = input.IsEnabled;
        settings.BusinessPhoneNumberId = NormalizeOptional(input.BusinessPhoneNumberId);
        var readyTemplate = GetTemplateInput(input, NotificationEventType.ReadyForPickup);
        var trackingTemplate = GetTemplateInput(input, NotificationEventType.TrackingLink);
        settings.ReadyTemplateName = NormalizeOptional(readyTemplate?.TemplateName);
        settings.TemplateLanguageCode = NormalizeOptional(readyTemplate?.LanguageCode) ?? "en_US";
        settings.TrackingTemplateName = NormalizeOptional(trackingTemplate?.TemplateName);
        settings.TrackingTemplateLanguageCode = NormalizeOptional(trackingTemplate?.LanguageCode) ?? "en_US";
        var staffInviteTemplate = GetTemplateInput(input, NotificationEventType.StaffInvite);
        var passwordResetTemplate = GetTemplateInput(input, NotificationEventType.PasswordReset);
        settings.StaffInviteTemplateName = NormalizeOptional(staffInviteTemplate?.TemplateName);
        settings.StaffInviteTemplateLanguageCode = NormalizeOptional(staffInviteTemplate?.LanguageCode) ?? "en_US";
        settings.PasswordResetTemplateName = NormalizeOptional(passwordResetTemplate?.TemplateName);
        settings.PasswordResetTemplateLanguageCode = NormalizeOptional(passwordResetTemplate?.LanguageCode) ?? "en_US";
        settings.AutoSendReady = input.AutoSendReady;
        settings.UpdatedAt = DateTimeOffset.UtcNow;

        if (input.ClearAccessToken)
            settings.AccessTokenCiphertext = null;
        else if (!string.IsNullOrWhiteSpace(input.AccessToken))
            settings.AccessTokenCiphertext = _tokenProtector.Protect(input.AccessToken.Trim());

        if (settings.IsEnabled &&
            (string.IsNullOrWhiteSpace(settings.BusinessPhoneNumberId) ||
             string.IsNullOrWhiteSpace(settings.AccessTokenCiphertext)))
        {
            throw new ArgumentException("Business phone number and access token are required when WhatsApp provider delivery is enabled.");
        }

        if (settings.IsEnabled &&
            settings.AutoSendReady &&
            string.IsNullOrWhiteSpace(settings.ReadyTemplateName))
        {
            throw new ArgumentException("Ready template is required when automatic Ready notifications are enabled.");
        }

        await db.SaveChangesAsync();
        return ToSettingsDto(settings);
    }

    public async Task<IReadOnlyList<object>> ListLogsAsync(int? limit)
    {
        EnsureOwner();
        var take = Math.Clamp(limit ?? 50, 1, 200);
        return await db.NotificationLogs
            .AsNoTracking()
            .OrderByDescending(log => log.CreatedAt)
            .Take(take)
            .Select(log => (object)new
            {
                log.Id,
                log.WorkOrderId,
                log.Channel,
                log.EventType,
                log.DispatchType,
                log.RecipientPhone,
                log.ProviderMessageId,
                log.Status,
                log.ErrorCode,
                log.ErrorMessage,
                log.RequestedByUserId,
                log.RequestedByName,
                log.CreatedAt,
                log.UpdatedAt
            })
            .ToListAsync();
    }

    public async Task<object> CreateManualTrackingShareAsync(Guid workOrderId, NotificationEventType? eventType, string? locale)
    {
        var workOrder = await LoadWorkOrderAsync(workOrderId)
            ?? throw new KeyNotFoundException("Work order not found.");

        var recipientPhone = NormalizeRecipientPhone(workOrder.Customer.Phone);
        if (recipientPhone is null)
            throw new ArgumentException("Customer phone must include at least 7 digits.");

        var selectedEventType = eventType ?? InferManualEventType(workOrder);
        EnsureSupportedShareEventType(selectedEventType);
        var share = BuildSharePayload(workOrder, selectedEventType, locale);
        db.NotificationLogs.Add(new NotificationLog
        {
            TenantId = workOrder.TenantId,
            WorkOrderId = workOrder.Id,
            Channel = NotificationChannel.WhatsApp,
            EventType = selectedEventType,
            DispatchType = NotificationDispatchType.Manual,
            RecipientPhone = recipientPhone,
            Status = NotificationStatus.Requested,
            RequestedByUserId = tenantContext.UserId,
            RequestedByName = tenantContext.UserName
        });
        await db.SaveChangesAsync();

        return share;
    }

    public async Task<WhatsAppDeliveryDto> SendAccountActionLinkAsync(User user, NotificationEventType eventType, string link)
    {
        EnsureSupportedAccountActionEventType(eventType);

        var recipientPhone = NormalizeRecipientPhone(user.Phone);
        if (recipientPhone is null)
            return await RecordAccountActionFailedAttemptAsync(user, eventType, "PHONE_INVALID", "Staff phone must include at least 7 digits.");

        var quota = await planEnforcement.GetWhatsAppQuotaStatusAsync(user.TenantId);
        if (!quota.ProviderSendEnabled)
            return await RecordAccountActionFailedAttemptAsync(user, eventType, "PLAN_REQUIRED", "WhatsApp notifications require Pro plan.");

        var settings = await db.TenantWhatsAppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == user.TenantId);
        var template = settings is null ? null : GetTemplateSettings(settings, eventType);
        if (settings is null ||
            !settings.IsEnabled ||
            string.IsNullOrWhiteSpace(settings.BusinessPhoneNumberId) ||
            string.IsNullOrWhiteSpace(settings.AccessTokenCiphertext) ||
            string.IsNullOrWhiteSpace(template?.Name))
        {
            return await RecordAccountActionFailedAttemptAsync(user, eventType, "SETTINGS_INCOMPLETE", "WhatsApp settings are incomplete for account action notifications.");
        }

        if (quota.Remaining <= 0)
            return await RecordAccountActionFailedAttemptAsync(user, eventType, "QUOTA_EXCEEDED", "WhatsApp message quota reached. Add more messages to send account action notifications.");

        string accessToken;
        try
        {
            accessToken = _tokenProtector.Unprotect(settings.AccessTokenCiphertext);
        }
        catch
        {
            return await RecordAccountActionFailedAttemptAsync(user, eventType, "TOKEN_INVALID", "WhatsApp access token could not be decrypted.");
        }

        return await SendTemplateMessageAsync(
            user.TenantId,
            workOrderId: null,
            eventType,
            recipientPhone,
            settings.BusinessPhoneNumberId,
            accessToken,
            template.Name,
            template.LanguageCode,
            [link],
            tenantContext.UserId == Guid.Empty ? null : tenantContext.UserId,
            tenantContext.UserName);
    }

    public async Task TryAutoSendReadyAsync(Guid workOrderId)
    {
        try
        {
            var workOrder = await LoadWorkOrderAsync(workOrderId);
            if (workOrder is null || workOrder.Stage != WorkOrderStage.Ready)
                return;

            var quota = await planEnforcement.GetWhatsAppQuotaStatusAsync(workOrder.TenantId);
            if (!quota.ProviderSendEnabled)
                return;

            var settings = await db.TenantWhatsAppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == workOrder.TenantId);
            if (settings is null || !settings.IsEnabled || !settings.AutoSendReady)
                return;

            var recipientPhone = NormalizeRecipientPhone(workOrder.Customer.Phone);
            if (recipientPhone is null)
            {
                await RecordFailedAttemptAsync(workOrder, NotificationEventType.ReadyForPickup, "PHONE_INVALID", "Customer phone must include at least 7 digits.");
                return;
            }

            var hasPriorSuccessfulAttempt = await db.NotificationLogs.AnyAsync(log =>
                log.WorkOrderId == workOrder.Id &&
                log.Channel == NotificationChannel.WhatsApp &&
                log.EventType == NotificationEventType.ReadyForPickup &&
                log.DispatchType == NotificationDispatchType.Automatic &&
                log.Status != NotificationStatus.Failed);

            if (hasPriorSuccessfulAttempt)
                return;

            if (quota.Remaining <= 0)
            {
                await RecordFailedAttemptAsync(workOrder, NotificationEventType.ReadyForPickup, "QUOTA_EXCEEDED", "WhatsApp message quota reached. Add more messages to send automatic Ready notifications.");
                return;
            }

            if (string.IsNullOrWhiteSpace(settings.BusinessPhoneNumberId) ||
                string.IsNullOrWhiteSpace(settings.AccessTokenCiphertext) ||
                string.IsNullOrWhiteSpace(settings.ReadyTemplateName))
            {
                await RecordFailedAttemptAsync(workOrder, NotificationEventType.ReadyForPickup, "SETTINGS_INCOMPLETE", "WhatsApp settings are incomplete for automatic Ready notifications.");
                return;
            }

            string accessToken;
            try
            {
                accessToken = _tokenProtector.Unprotect(settings.AccessTokenCiphertext);
            }
            catch
            {
                await RecordFailedAttemptAsync(workOrder, NotificationEventType.ReadyForPickup, "TOKEN_INVALID", "WhatsApp access token could not be decrypted.");
                return;
            }

            var share = BuildSharePayload(workOrder, NotificationEventType.ReadyForPickup, settings.TemplateLanguageCode);
            await SendTemplateMessageAsync(
                workOrder.TenantId,
                workOrder.Id,
                NotificationEventType.ReadyForPickup,
                recipientPhone,
                settings.BusinessPhoneNumberId,
                accessToken,
                settings.ReadyTemplateName,
                settings.TemplateLanguageCode,
                [share.TrackingUrl, share.ReceiptUrl],
                requestedByUserId: null,
                requestedByName: null);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Automatic WhatsApp Ready notification failed for work order {WorkOrderId}", workOrderId);
        }
    }

    public Task<string> VerifyWebhookAsync(string? mode, string? verifyToken, string? challenge)
    {
        var configuredToken = config["WHATSAPP_WEBHOOK_VERIFY_TOKEN"];
        if (!string.Equals(mode, "subscribe", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(configuredToken) ||
            !string.Equals(verifyToken, configuredToken, StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(challenge))
        {
            throw new AuthenticationFailedException("Invalid WhatsApp webhook verification request.");
        }

        return Task.FromResult(challenge);
    }

    public async Task HandleWebhookAsync(string rawPayload, string? signature)
    {
        ValidateWebhookSignature(rawPayload, signature);
        using var payload = JsonDocument.Parse(rawPayload);
        foreach (var status in EnumerateStatuses(payload.RootElement))
        {
            if (string.IsNullOrWhiteSpace(status.MessageId))
                continue;

            var log = await db.NotificationLogs
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(entry => entry.ProviderMessageId == status.MessageId);
            if (log is null)
                continue;

            log.Status = status.Status;
            log.ErrorCode = status.ErrorCode;
            log.ErrorMessage = status.ErrorMessage;
            log.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync();
    }

    private async Task<WorkOrder?> LoadWorkOrderAsync(Guid workOrderId)
    {
        return await db.WorkOrders
            .Include(w => w.Customer)
            .Include(w => w.Vehicle)
            .Include(w => w.ServiceType)
            .Include(w => w.Tenant)
            .FirstOrDefaultAsync(w => w.Id == workOrderId);
    }

    private WhatsAppShareDto BuildSharePayload(WorkOrder workOrder, NotificationEventType eventType, string? locale)
    {
        EnsureSupportedShareEventType(eventType);
        var frontendUrl = RequireAbsoluteUrl(config["FRONTEND_URL"], "FRONTEND_URL");
        var publicApiUrl = RequireAbsoluteUrl(
            string.IsNullOrWhiteSpace(config["PUBLIC_API_URL"]) ? $"{frontendUrl}/api" : config["PUBLIC_API_URL"],
            "PUBLIC_API_URL");
        var trackingUrl = $"{frontendUrl}/track/{workOrder.TrackingToken}";
        var encodedLocale = !string.IsNullOrWhiteSpace(locale)
            ? $"?locale={Uri.EscapeDataString(locale)}"
            : string.Empty;
        var receiptUrl = $"{publicApiUrl}/work-orders/track/{workOrder.TrackingToken}/receipt{encodedLocale}";
        var isArabic = !string.IsNullOrWhiteSpace(locale) && locale.StartsWith("ar", StringComparison.OrdinalIgnoreCase);
        var whatsAppText = isArabic
            ? BuildArabicShareMessage(eventType, trackingUrl, receiptUrl)
            : BuildEnglishShareMessage(eventType, trackingUrl, receiptUrl);

        return new WhatsAppShareDto(eventType, workOrder.Customer.Phone, trackingUrl, receiptUrl, whatsAppText);
    }

    private async Task RecordFailedAttemptAsync(WorkOrder workOrder, NotificationEventType eventType, string code, string message)
    {
        db.NotificationLogs.Add(new NotificationLog
        {
            TenantId = workOrder.TenantId,
            WorkOrderId = workOrder.Id,
            Channel = NotificationChannel.WhatsApp,
            EventType = eventType,
            DispatchType = NotificationDispatchType.Automatic,
            RecipientPhone = NormalizeRecipientPhone(workOrder.Customer.Phone) ?? workOrder.Customer.Phone,
            Status = NotificationStatus.Failed,
            ErrorCode = code,
            ErrorMessage = message
        });
        await db.SaveChangesAsync();
    }

    private async Task<WhatsAppDeliveryDto> RecordAccountActionFailedAttemptAsync(User user, NotificationEventType eventType, string code, string message)
    {
        var log = new NotificationLog
        {
            TenantId = user.TenantId,
            WorkOrderId = null,
            Channel = NotificationChannel.WhatsApp,
            EventType = eventType,
            DispatchType = NotificationDispatchType.Automatic,
            RecipientPhone = NormalizeRecipientPhone(user.Phone) ?? user.Phone ?? "",
            Status = NotificationStatus.Failed,
            ErrorCode = code,
            ErrorMessage = message,
            RequestedByUserId = tenantContext.UserId == Guid.Empty ? null : tenantContext.UserId,
            RequestedByName = tenantContext.UserName
        };
        db.NotificationLogs.Add(log);
        await db.SaveChangesAsync();
        return ToDeliveryDto(log);
    }

    private async Task<WhatsAppDeliveryDto> SendTemplateMessageAsync(
        Guid tenantId,
        Guid? workOrderId,
        NotificationEventType eventType,
        string recipientPhone,
        string businessPhoneNumberId,
        string accessToken,
        string templateName,
        string languageCode,
        IReadOnlyList<string> bodyParameters,
        Guid? requestedByUserId,
        string? requestedByName)
    {
        var requestLog = new NotificationLog
        {
            TenantId = tenantId,
            WorkOrderId = workOrderId,
            Channel = NotificationChannel.WhatsApp,
            EventType = eventType,
            DispatchType = NotificationDispatchType.Automatic,
            RecipientPhone = recipientPhone,
            Status = NotificationStatus.Requested,
            RequestedByUserId = requestedByUserId,
            RequestedByName = requestedByName
        };
        db.NotificationLogs.Add(requestLog);
        await db.SaveChangesAsync();

        var graphVersion = config["WHATSAPP_GRAPH_API_VERSION"] ?? "v23.0";
        var endpoint = $"https://graph.facebook.com/{graphVersion}/{businessPhoneNumberId}/messages";
        var body = new
        {
            messaging_product = "whatsapp",
            recipient_type = "individual",
            to = recipientPhone,
            type = "template",
            template = new
            {
                name = templateName,
                language = new { code = languageCode },
                components = new[]
                {
                    new
                    {
                        type = "body",
                        parameters = bodyParameters
                            .Select(parameter => new { type = "text", text = parameter })
                            .ToArray()
                    }
                }
            }
        };

        using var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request);
        var payload = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            requestLog.Status = NotificationStatus.Failed;
            requestLog.ErrorCode = $"HTTP_{(int)response.StatusCode}";
            requestLog.ErrorMessage = ExtractErrorMessage(payload) ?? "Meta WhatsApp send request failed.";
            requestLog.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
            return ToDeliveryDto(requestLog);
        }

        string? providerMessageId = null;
        try
        {
            using var json = JsonDocument.Parse(payload);
            providerMessageId = json.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
        }
        catch
        {
            logger.LogWarning(
                "Meta WhatsApp send succeeded but provider message id was not parsed for event {EventType} and work order {WorkOrderId}",
                eventType,
                workOrderId);
        }

        requestLog.ProviderMessageId = providerMessageId;
        requestLog.Status = NotificationStatus.Accepted;
        requestLog.ErrorCode = null;
        requestLog.ErrorMessage = null;
        requestLog.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return ToDeliveryDto(requestLog);
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string? NormalizeRecipientPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return null;

        var digits = new string(phone.Where(char.IsDigit).ToArray());
        return digits.Length >= 7 ? digits : null;
    }

    private static string RequireAbsoluteUrl(string? value, string settingName)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
            throw new InvalidOperationException($"{settingName} must be a valid absolute URL.");
        if (uri.Scheme is not ("http" or "https"))
            throw new InvalidOperationException($"{settingName} must use HTTP or HTTPS.");

        return uri.ToString().TrimEnd('/');
    }

    private void ValidateWebhookSignature(string payload, string? signature)
    {
        var appSecret = config["WHATSAPP_APP_SECRET"];
        if (string.IsNullOrWhiteSpace(appSecret))
            throw new InvalidOperationException("WHATSAPP_APP_SECRET is required to verify WhatsApp webhooks.");
        if (string.IsNullOrWhiteSpace(signature) || !signature.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
            throw new AuthenticationFailedException("Invalid WhatsApp webhook signature.");

        var expected = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(appSecret),
            Encoding.UTF8.GetBytes(payload));
        var actualHex = signature["sha256=".Length..];
        if (actualHex.Length != expected.Length * 2)
            throw new AuthenticationFailedException("Invalid WhatsApp webhook signature.");

        byte[] actual;
        try
        {
            actual = Convert.FromHexString(actualHex);
        }
        catch (FormatException)
        {
            throw new AuthenticationFailedException("Invalid WhatsApp webhook signature.");
        }

        if (!CryptographicOperations.FixedTimeEquals(expected, actual))
            throw new AuthenticationFailedException("Invalid WhatsApp webhook signature.");
    }

    private static string? ExtractErrorMessage(string payload)
    {
        try
        {
            using var json = JsonDocument.Parse(payload);
            return json.RootElement.GetProperty("error").GetProperty("message").GetString();
        }
        catch
        {
            return null;
        }
    }

    private static IEnumerable<WebhookStatusUpdate> EnumerateStatuses(JsonElement root)
    {
        if (!root.TryGetProperty("entry", out var entries) || entries.ValueKind != JsonValueKind.Array)
            yield break;

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes) || changes.ValueKind != JsonValueKind.Array)
                continue;

            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value) ||
                    !value.TryGetProperty("statuses", out var statuses) ||
                    statuses.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var status in statuses.EnumerateArray())
                {
                    var messageId = status.TryGetProperty("id", out var idNode) ? idNode.GetString() : null;
                    var rawStatus = status.TryGetProperty("status", out var statusNode) ? statusNode.GetString() : null;
                    var errorCode = default(string);
                    var errorMessage = default(string);

                    if (status.TryGetProperty("errors", out var errorsNode) &&
                        errorsNode.ValueKind == JsonValueKind.Array &&
                        errorsNode.GetArrayLength() > 0)
                    {
                        var firstError = errorsNode[0];
                        if (firstError.TryGetProperty("code", out var codeNode))
                            errorCode = codeNode.ToString();
                        if (firstError.TryGetProperty("title", out var titleNode))
                            errorMessage = titleNode.GetString();
                        else if (firstError.TryGetProperty("message", out var messageNode))
                            errorMessage = messageNode.GetString();
                    }

                    yield return new WebhookStatusUpdate(
                        messageId,
                        MapStatus(rawStatus),
                        errorCode,
                        errorMessage);
                }
            }
        }
    }

    private static NotificationStatus MapStatus(string? rawStatus)
    {
        return rawStatus?.ToLowerInvariant() switch
        {
            "sent" => NotificationStatus.Sent,
            "delivered" => NotificationStatus.Delivered,
            "read" => NotificationStatus.Read,
            "failed" => NotificationStatus.Failed,
            _ => NotificationStatus.Accepted
        };
    }

    private object ToSettingsDto(TenantWhatsAppSettings? settings)
    {
        return new
        {
            isEnabled = settings?.IsEnabled ?? false,
            businessPhoneNumberId = settings?.BusinessPhoneNumberId ?? "",
            hasAccessToken = !string.IsNullOrWhiteSpace(settings?.AccessTokenCiphertext),
            templates = new[]
            {
                new WhatsAppTemplateSettingsDto(
                    NotificationEventType.TrackingLink,
                    settings?.TrackingTemplateName ?? "",
                    settings?.TrackingTemplateLanguageCode ?? "en_US"),
                new WhatsAppTemplateSettingsDto(
                    NotificationEventType.ReadyForPickup,
                    settings?.ReadyTemplateName ?? "",
                    settings?.TemplateLanguageCode ?? "en_US"),
                new WhatsAppTemplateSettingsDto(
                    NotificationEventType.StaffInvite,
                    settings?.StaffInviteTemplateName ?? "",
                    settings?.StaffInviteTemplateLanguageCode ?? "en_US"),
                new WhatsAppTemplateSettingsDto(
                    NotificationEventType.PasswordReset,
                    settings?.PasswordResetTemplateName ?? "",
                    settings?.PasswordResetTemplateLanguageCode ?? "en_US")
            },
            autoSendReady = settings?.AutoSendReady ?? false,
            updatedAt = settings?.UpdatedAt
        };
    }

    private void EnsureOwner()
    {
        if (tenantContext.Role != UserRole.Owner)
            throw new UnauthorizedAccessException("Owner role required.");
    }

    private sealed record WebhookStatusUpdate(
        string? MessageId,
        NotificationStatus Status,
        string? ErrorCode,
        string? ErrorMessage);

    private static WhatsAppTemplateSettingsRequest? GetTemplateInput(TenantWhatsAppSettingsRequest input, NotificationEventType eventType)
    {
        var template = input.Templates?.FirstOrDefault(t => t.EventType == eventType);
        if (template is not null)
            return template;

        if (eventType == NotificationEventType.ReadyForPickup &&
            (!string.IsNullOrWhiteSpace(input.ReadyTemplateName) || !string.IsNullOrWhiteSpace(input.TemplateLanguageCode)))
        {
            return new WhatsAppTemplateSettingsRequest(
                NotificationEventType.ReadyForPickup,
                input.ReadyTemplateName,
                input.TemplateLanguageCode);
        }

        return null;
    }

    private static WhatsAppTemplateSettings? GetTemplateSettings(TenantWhatsAppSettings settings, NotificationEventType eventType)
    {
        return eventType switch
        {
            NotificationEventType.TrackingLink => new WhatsAppTemplateSettings(settings.TrackingTemplateName, settings.TrackingTemplateLanguageCode),
            NotificationEventType.ReadyForPickup => new WhatsAppTemplateSettings(settings.ReadyTemplateName, settings.TemplateLanguageCode),
            NotificationEventType.StaffInvite => new WhatsAppTemplateSettings(settings.StaffInviteTemplateName, settings.StaffInviteTemplateLanguageCode),
            NotificationEventType.PasswordReset => new WhatsAppTemplateSettings(settings.PasswordResetTemplateName, settings.PasswordResetTemplateLanguageCode),
            _ => null
        };
    }

    private static WhatsAppDeliveryDto ToDeliveryDto(NotificationLog log) =>
        new(log.Status, log.ErrorCode, log.ErrorMessage, log.ProviderMessageId);

    private static NotificationEventType InferManualEventType(WorkOrder workOrder)
    {
        return workOrder.Stage is WorkOrderStage.Ready or WorkOrderStage.Delivered
            ? NotificationEventType.ReadyForPickup
            : NotificationEventType.TrackingLink;
    }

    private static void EnsureSupportedShareEventType(NotificationEventType eventType)
    {
        if (eventType is not (NotificationEventType.ReadyForPickup or NotificationEventType.TrackingLink))
            throw new ArgumentException("Unsupported WhatsApp notification event type.");
    }

    private static void EnsureSupportedAccountActionEventType(NotificationEventType eventType)
    {
        if (eventType is not (NotificationEventType.StaffInvite or NotificationEventType.PasswordReset))
            throw new ArgumentException("Unsupported WhatsApp account action event type.");
    }

    private static string BuildEnglishShareMessage(NotificationEventType eventType, string trackingUrl, string receiptUrl)
    {
        if (eventType == NotificationEventType.ReadyForPickup)
            return $"Your vehicle is ready for pickup.{Environment.NewLine}Track status: {trackingUrl}{Environment.NewLine}Receipt: {receiptUrl}";

        return $"Track your vehicle status: {trackingUrl}";
    }

    private static string BuildArabicShareMessage(NotificationEventType eventType, string trackingUrl, string receiptUrl)
    {
        if (eventType == NotificationEventType.ReadyForPickup)
        {
            return "\u0633\u064a\u0627\u0631\u062a\u0643 \u062c\u0627\u0647\u0632\u0629 \u0644\u0644\u0627\u0633\u062a\u0644\u0627\u0645."
                + $"{Environment.NewLine}\u062a\u062a\u0628\u0639 \u0627\u0644\u062d\u0627\u0644\u0629: {trackingUrl}"
                + $"{Environment.NewLine}\u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629: {receiptUrl}";
        }

        return $"\u062a\u0627\u0628\u0639 \u062d\u0627\u0644\u0629 \u0633\u064a\u0627\u0631\u062a\u0643: {trackingUrl}";
    }
}

public class TenantWhatsAppSettingsRequest
{
    public bool IsEnabled { get; init; }
    public string? BusinessPhoneNumberId { get; init; }
    public string? AccessToken { get; init; }
    public bool ClearAccessToken { get; init; }
    public IReadOnlyList<WhatsAppTemplateSettingsRequest>? Templates { get; init; }
    public string? ReadyTemplateName { get; init; }
    public string? TemplateLanguageCode { get; init; }
    public bool AutoSendReady { get; init; }
}

public record WhatsAppTemplateSettingsRequest(
    NotificationEventType EventType,
    string? TemplateName,
    string? LanguageCode);

public record WhatsAppTemplateSettingsDto(
    NotificationEventType EventType,
    string TemplateName,
    string LanguageCode);

public record WhatsAppShareDto(
    NotificationEventType EventType,
    string CustomerPhone,
    string TrackingUrl,
    string ReceiptUrl,
    string WhatsAppText);

public record WhatsAppDeliveryDto(
    NotificationStatus Status,
    string? ErrorCode,
    string? ErrorMessage,
    string? ProviderMessageId);

internal sealed record WhatsAppTemplateSettings(string? Name, string LanguageCode);
