using Amazon.S3;
using Amazon.S3.Model;

namespace DetailFlow.Api.Infrastructure;

public interface IR2StorageService
{
    Task<string> UploadAsync(Stream file, string key, string contentType);
    Task DeleteAsync(string key);
    Task<string> GetPresignedUrlAsync(string key, int expiryMinutes = 60);
}

public class R2StorageService : IR2StorageService
{
    private readonly IAmazonS3 _s3;
    private readonly string _bucket;
    private readonly string _publicBaseUrl;

    public R2StorageService(IConfiguration config)
    {
        _bucket = config["R2_BUCKET_NAME"]!;
        _publicBaseUrl = config["R2_PUBLIC_BASE_URL"]!.TrimEnd('/');
        _s3 = new AmazonS3Client(
            config["R2_ACCESS_KEY_ID"],
            config["R2_SECRET_ACCESS_KEY"],
            new AmazonS3Config
            {
                ServiceURL = $"https://{config["R2_ACCOUNT_ID"]}.r2.cloudflarestorage.com",
                ForcePathStyle = true
            });
    }

    public async Task<string> UploadAsync(Stream file, string key, string contentType)
    {
        await _s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = file,
            ContentType = contentType
        });
        return $"{_publicBaseUrl}/{key}";
    }

    public async Task DeleteAsync(string key) =>
        await _s3.DeleteObjectAsync(_bucket, key);

    public Task<string> GetPresignedUrlAsync(string key, int expiryMinutes = 60)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _bucket,
            Key = key,
            Expires = DateTime.UtcNow.AddMinutes(expiryMinutes)
        };
        return _s3.GetPreSignedURLAsync(request);
    }
}
