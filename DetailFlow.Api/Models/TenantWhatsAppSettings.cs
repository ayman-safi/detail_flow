namespace DetailFlow.Api.Models;

public class TenantWhatsAppSettings
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public bool IsEnabled { get; set; }
    public string? BusinessPhoneNumberId { get; set; }
    public string? AccessTokenCiphertext { get; set; }
    public string? ReadyTemplateName { get; set; }
    public string TemplateLanguageCode { get; set; } = "en_US";
    public string? TrackingTemplateName { get; set; }
    public string TrackingTemplateLanguageCode { get; set; } = "en_US";
    public string? StaffInviteTemplateName { get; set; }
    public string StaffInviteTemplateLanguageCode { get; set; } = "en_US";
    public string? PasswordResetTemplateName { get; set; }
    public string PasswordResetTemplateLanguageCode { get; set; } = "en_US";
    public bool AutoSendReady { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
