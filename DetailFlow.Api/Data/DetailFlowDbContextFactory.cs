using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace DetailFlow.Api.Data;

public sealed class DetailFlowDbContextFactory : IDesignTimeDbContextFactory<DetailFlowDbContext>
{
    public DetailFlowDbContext CreateDbContext(string[] args)
    {
        var connectionString = GetConnectionString(args)
            ?? Environment.GetEnvironmentVariable("DB_CONNECTION_STRING")
            ?? "Host=localhost;Port=5432;Database=detailflow;Username=detailflow;Password=detailflow";

        var options = new DbContextOptionsBuilder<DetailFlowDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new DetailFlowDbContext(options, new DesignTimeTenantContext());
    }

    private static string? GetConnectionString(string[] args)
    {
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--connection")
                return args[i + 1];
        }

        return null;
    }

    private sealed class DesignTimeTenantContext : ITenantContext
    {
        public Guid TenantId => Guid.Empty;
        public Guid UserId => Guid.Empty;
        public UserRole Role => UserRole.Staff;
        public string UserName => "Design Time";
    }
}
