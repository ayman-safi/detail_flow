namespace DetailFlow.Api.Models;

public static class DashboardLanguages
{
    public const string Default = "en";

    public static readonly string[] Supported = [Default, "ar", "tr"];

    public static bool IsSupported(string? language) =>
        Supported.Contains(language, StringComparer.Ordinal);

    public static string Normalize(string? language) =>
        IsSupported(language) ? language! : Default;

    public static string Validate(string? language)
    {
        var normalized = language?.Trim().ToLowerInvariant();
        if (!IsSupported(normalized))
            throw new ArgumentException("Unsupported dashboard language.");

        return normalized!;
    }
}
