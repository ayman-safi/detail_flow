using System.Data;
using System.Data.Common;
using DetailFlow.Api.Data;
using DetailFlow.Api.Infrastructure;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.TestHost;

namespace DetailFlow.Api.Tests;

public sealed class DetailFlowApiFactory : WebApplicationFactory<Program>
{
    public const string JwtAudience = "DetailFlow.Tests";
    public const string JwtIssuer = "DetailFlow.Tests";
    public const string JwtSecret = "test-secret-with-enough-length-for-hmac-signing";

    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly string _dataProtectionKeysPath = Path.Combine(
        Path.GetTempPath(),
        "DetailFlow.Api.Tests",
        Guid.NewGuid().ToString("N"),
        "data-protection-keys");
    private readonly ServiceProvider _sqliteServices = new ServiceCollection()
        .AddEntityFrameworkSqlite()
        .BuildServiceProvider();

    private static readonly Dictionary<string, string?> TestConfiguration = new()
    {
        ["AUTH_COOKIE_SECURE"] = "false",
        ["DB_CONNECTION_STRING"] = "Host=localhost;Database=detailflow_tests;Username=test;Password=test",
        ["FRONTEND_URL"] = "http://localhost:3000",
        ["JWT_AUDIENCE"] = JwtAudience,
        ["JWT_ISSUER"] = JwtIssuer,
        ["JWT_SECRET"] = JwtSecret,
        ["R2_ACCESS_KEY_ID"] = "test-access-key",
        ["R2_ACCOUNT_ID"] = "test-account",
        ["R2_BUCKET_NAME"] = "test-bucket",
        ["R2_PUBLIC_BASE_URL"] = "https://r2.example.test",
        ["R2_SECRET_ACCESS_KEY"] = "test-secret-key",
        ["PUBLIC_API_URL"] = "http://localhost:3000/api",
        ["PLATFORM_ADMIN_EMAIL"] = "admin@example.test",
        ["PLATFORM_ADMIN_NAME"] = "Test Platform Admin",
        ["PLATFORM_ADMIN_PASSWORD"] = "AdminPassword!123",
        ["WHATSAPP_APP_SECRET"] = "test-whatsapp-secret",
        ["WHATSAPP_WEBHOOK_VERIFY_TOKEN"] = "verify-token"
    };

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(TestConfiguration);
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DATA_PROTECTION_KEYS_PATH"] = _dataProtectionKeysPath
            });
        });

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IDbContextOptionsConfiguration<DetailFlowDbContext>>();
            services.RemoveAll<DbContextOptions<DetailFlowDbContext>>();
            services.RemoveAll<DbConnection>();

            services.AddSingleton<DbConnection>(_connection);
            services.AddDbContext<DetailFlowDbContext>((sp, options) =>
                options
                    .UseSqlite(sp.GetRequiredService<DbConnection>())
                    .UseInternalServiceProvider(_sqliteServices));
            services.RemoveAll<IR2StorageService>();
            services.AddSingleton<IR2StorageService, FakeR2StorageService>();
            services.RemoveAll<IHttpClientFactory>();
            services.AddSingleton<IHttpClientFactory, FakeHttpClientFactory>();
            Directory.CreateDirectory(_dataProtectionKeysPath);
            services.AddDataProtection()
                .SetApplicationName("DetailFlow.Api.Tests")
                .PersistKeysToFileSystem(new DirectoryInfo(_dataProtectionKeysPath));
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        if (_connection.State != ConnectionState.Open)
            _connection.Open();

        var host = base.CreateHost(builder);

        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DetailFlowDbContext>();
        db.Database.EnsureCreated();

        return host;
    }

    public async Task ExecuteDbContextAsync(Func<DetailFlowDbContext, Task> action)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DetailFlowDbContext>();
        await action(db);
    }

    public async Task<T> ExecuteDbContextAsync<T>(Func<DetailFlowDbContext, Task<T>> action)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DetailFlowDbContext>();
        return await action(db);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _connection.Dispose();
        _sqliteServices.Dispose();
    }
}

internal sealed class FakeR2StorageService : IR2StorageService
{
    public readonly List<string> DeletedKeys = [];
    public readonly List<string> UploadedKeys = [];

    public Task<string> UploadAsync(Stream file, string key, string contentType)
    {
        UploadedKeys.Add(key);
        return Task.FromResult($"https://r2.example.test/{key}");
    }

    public Task DeleteAsync(string key)
    {
        DeletedKeys.Add(key);
        return Task.CompletedTask;
    }

    public Task<string> GetPresignedUrlAsync(string key, int expiryMinutes = 60) =>
        Task.FromResult($"https://r2.example.test/signed/{key}");
}

internal sealed class FakeHttpClientFactory : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new(new FakeHttpMessageHandler());
}

internal sealed class FakeHttpMessageHandler : HttpMessageHandler
{
    private static readonly byte[] PngBytes = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/az8PqkAAAAASUVORK5CYII=");

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (request.RequestUri?.Host == "graph.facebook.com")
        {
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent("""{"messages":[{"id":"wamid.test-message"}]}""")
            });
        }

        if (request.RequestUri?.Host == "r2.example.test")
        {
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new ByteArrayContent(PngBytes)
                {
                    Headers =
                    {
                        ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png"),
                        ContentLength = PngBytes.Length
                    }
                }
            });
        }

        return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.NotFound));
    }
}
