namespace DetailFlow.Api.Infrastructure;

public sealed record ValidatedImageUpload(string ContentType, string Extension);

public static class ImageUploadValidator
{
    private const int HeaderBytes = 12;

    public static async Task<ValidatedImageUpload> ValidateAsync(IFormFile file, Stream stream, long maxBytes, CancellationToken ct = default)
    {
        if (file.Length == 0)
            throw new ArgumentException("File is required.");
        if (file.Length > maxBytes)
            throw new ArgumentException($"File must be {maxBytes / 1024 / 1024}MB or less.");
        if (!stream.CanSeek)
            throw new ArgumentException("Uploaded file stream must be seekable.");

        var header = new byte[HeaderBytes];
        var read = await stream.ReadAsync(header.AsMemory(0, header.Length), ct);
        stream.Position = 0;

        if (IsJpeg(header, read))
            return new ValidatedImageUpload("image/jpeg", ".jpg");
        if (IsPng(header, read))
            return new ValidatedImageUpload("image/png", ".png");
        if (IsWebp(header, read))
            return new ValidatedImageUpload("image/webp", ".webp");

        throw new ArgumentException("Only JPEG, PNG, and WEBP images are allowed.");
    }

    private static bool IsJpeg(byte[] bytes, int read) =>
        read >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;

    private static bool IsPng(byte[] bytes, int read) =>
        read >= 8 &&
        bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4E &&
        bytes[3] == 0x47 &&
        bytes[4] == 0x0D &&
        bytes[5] == 0x0A &&
        bytes[6] == 0x1A &&
        bytes[7] == 0x0A;

    private static bool IsWebp(byte[] bytes, int read) =>
        read >= 12 &&
        bytes[0] == 0x52 &&
        bytes[1] == 0x49 &&
        bytes[2] == 0x46 &&
        bytes[3] == 0x46 &&
        bytes[8] == 0x57 &&
        bytes[9] == 0x45 &&
        bytes[10] == 0x42 &&
        bytes[11] == 0x50;
}
