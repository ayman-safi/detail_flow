using System.Text;
using System.Text.Json.Serialization;
using DetailFlow.Api.Data;
using DetailFlow.Api.Features.Dev;
using DetailFlow.Api.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Microsoft.AspNetCore.Routing.Constraints;
using QuestPDF.Infrastructure;

var builder = WebApplication.CreateSlimBuilder(args);
builder.WebHost.UseKestrelHttpsConfiguration();
var config = builder.Configuration;
var frontendOrigins = GetConfiguredOrigins(config["FRONTEND_URL"]);

builder.Services.Configure<RouteOptions>(options =>
{
    options.SetParameterPolicy<GuidRouteConstraint>("guid");
    options.SetParameterPolicy<IntRouteConstraint>("int");
    options.SetParameterPolicy<RegexInlineRouteConstraint>("regex");
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(frontendOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwtSecret = config["JWT_SECRET"] ?? "development-secret-development-secret";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = config["JWT_ISSUER"],
            ValidateAudience = true,
            ValidAudience = config["JWT_AUDIENCE"],
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (string.IsNullOrEmpty(context.Token) &&
                    context.Request.Cookies.TryGetValue(AuthCookie.Name, out var cookieToken))
                {
                    context.Token = cookieToken;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("PlatformAdmin", policy =>
        policy.RequireClaim("platform_admin", "true"));
});
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "DetailFlow API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header
    });
});

var dbConnectionString = config["DB_CONNECTION_STRING"]
    ?? config.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("DB_CONNECTION_STRING or ConnectionStrings:DefaultConnection is required.");
builder.Services.AddDbContext<DetailFlowDbContext>(opts =>
    opts.UseNpgsql(dbConnectionString));
builder.Services.AddMemoryCache();
var dataProtectionBuilder = builder.Services.AddDataProtection()
    .SetApplicationName("DetailFlow.Api");
var dataProtectionKeysPath = config["DATA_PROTECTION_KEYS_PATH"];
if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    Directory.CreateDirectory(dataProtectionKeysPath);
    dataProtectionBuilder.PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath));
}
builder.Services.AddDetailFlowApplicationServices();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});
builder.Services.AddDetailFlowRateLimiting();

QuestPDF.Settings.License = LicenseType.Community;

var app = builder.Build();

RequireConfiguration(app.Configuration, "JWT_SECRET", minLength: 32);
RequireConfiguration(app.Configuration, "JWT_ISSUER");
RequireConfiguration(app.Configuration, "JWT_AUDIENCE");
RequireConfiguration(app.Configuration, "R2_ACCOUNT_ID");
RequireConfiguration(app.Configuration, "R2_ACCESS_KEY_ID");
RequireConfiguration(app.Configuration, "R2_SECRET_ACCESS_KEY");
RequireConfiguration(app.Configuration, "R2_BUCKET_NAME");
var r2PublicBaseUrl = RequireConfiguration(app.Configuration, "R2_PUBLIC_BASE_URL");
if (!Uri.TryCreate(r2PublicBaseUrl, UriKind.Absolute, out var r2PublicBaseUri) ||
    r2PublicBaseUri.Scheme is not ("http" or "https"))
{
    throw new InvalidOperationException("R2_PUBLIC_BASE_URL must be an absolute HTTP or HTTPS URL.");
}

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseCors("Frontend");
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.Value?.EndsWith("/stream") == true)
        ctx.Response.Headers.Append("Cache-Control", "no-cache");
    await next();
});
app.UseAuthentication();
app.UseMiddleware<ActiveUserMiddleware>();
app.UseRateLimiter();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    await using var scope = app.Services.CreateAsyncScope();
    var seedService = scope.ServiceProvider.GetRequiredService<DevSeedService>();
    await seedService.SeedAsync();
}

app.MapControllers();

app.Run();

static string[] GetConfiguredOrigins(string? configuredValue)
{
    var origins = configuredValue?
        .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    return origins is { Length: > 0 } ? origins : ["http://localhost:3000"];
}

static string RequireConfiguration(IConfiguration config, string key, int? minLength = null)
{
    var value = config[key];
    if (string.IsNullOrWhiteSpace(value))
        throw new InvalidOperationException($"{key} is required.");
    if (minLength.HasValue && value.Length < minLength.Value)
        throw new InvalidOperationException($"{key} must be at least {minLength.Value} characters.");

    return value;
}

public partial class Program;
