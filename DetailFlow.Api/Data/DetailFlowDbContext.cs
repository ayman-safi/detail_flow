using System.Text.Json;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace DetailFlow.Api.Data;

public class DetailFlowDbContext(DbContextOptions<DetailFlowDbContext> options, ITenantContext tenantContext)
    : DbContext(options)
{
    private readonly Guid _tenantId = tenantContext.TenantId;

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<AccountActionToken> AccountActionTokens => Set<AccountActionToken>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<ServiceType> ServiceTypes => Set<ServiceType>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<WorkOrderStageHistory> WorkOrderStageHistory => Set<WorkOrderStageHistory>();
    public DbSet<WorkOrderPhoto> WorkOrderPhotos => Set<WorkOrderPhoto>();
    public DbSet<TenantWhatsAppSettings> TenantWhatsAppSettings => Set<TenantWhatsAppSettings>();
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var defaultTenantSettings = JsonSerializer.Serialize(new TenantSettings(), (JsonSerializerOptions?)null)
            .Replace("'", "''");

        modelBuilder.Entity<Tenant>().HasIndex(t => t.Slug).IsUnique();
        modelBuilder.Entity<Tenant>()
            .Property(t => t.DashboardLocale)
            .HasMaxLength(5)
            .HasDefaultValue(DashboardLanguages.Default);
        modelBuilder.Entity<Tenant>()
            .Property(t => t.Settings)
            .HasColumnType("jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => JsonSerializer.Deserialize<TenantSettings>(v, (JsonSerializerOptions?)null) ?? new())
            .HasDefaultValueSql(Database.ProviderName == "Microsoft.EntityFrameworkCore.Sqlite"
                ? $"'{defaultTenantSettings}'"
                : $"'{defaultTenantSettings}'::jsonb");
        modelBuilder.Entity<User>().HasIndex(u => new { u.TenantId, u.Email }).IsUnique();
        modelBuilder.Entity<User>().HasQueryFilter(e => e.TenantId == _tenantId);

        modelBuilder.Entity<AccountActionToken>().HasIndex(t => t.TokenHash).IsUnique();
        modelBuilder.Entity<AccountActionToken>()
            .HasIndex(t => new { t.TenantId, t.UserId, t.Purpose, t.UsedAt, t.ExpiresAt })
            .HasDatabaseName("IX_AccountActionTokens_Tenant_User_Purpose_Used_Expires");
        modelBuilder.Entity<AccountActionToken>().HasQueryFilter(e => e.TenantId == _tenantId);
        modelBuilder.Entity<AccountActionToken>()
            .HasOne(t => t.User)
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Customer>().HasIndex(c => new { c.TenantId, c.Phone }).IsUnique();
        modelBuilder.Entity<Customer>().HasQueryFilter(e => e.TenantId == _tenantId);

        modelBuilder.Entity<Vehicle>().HasIndex(v => new { v.TenantId, v.PlateNumber }).IsUnique();
        modelBuilder.Entity<Vehicle>().HasQueryFilter(e => e.TenantId == _tenantId);

        modelBuilder.Entity<ServiceType>().HasQueryFilter(e => e.TenantId == _tenantId);
        modelBuilder.Entity<Booking>().HasIndex(b => new { b.TenantId, b.ScheduledAt });
        modelBuilder.Entity<Booking>().HasQueryFilter(e => e.TenantId == _tenantId);

        modelBuilder.Entity<WorkOrder>().HasIndex(w => w.TrackingToken).IsUnique();
        modelBuilder.Entity<WorkOrder>().HasIndex(w => new { w.TenantId, w.Stage });
        modelBuilder.Entity<WorkOrder>().HasIndex(w => new { w.TenantId, w.CreatedAt });
        modelBuilder.Entity<WorkOrder>().HasQueryFilter(e => e.TenantId == _tenantId);
        modelBuilder.Entity<WorkOrderPhoto>().HasQueryFilter(e => e.WorkOrder.TenantId == _tenantId);
        modelBuilder.Entity<WorkOrderStageHistory>().HasQueryFilter(e => e.WorkOrder.TenantId == _tenantId);

        modelBuilder.Entity<WorkOrder>()
            .HasOne(w => w.AssignedStaff)
            .WithMany()
            .HasForeignKey(w => w.AssignedStaffId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<TenantWhatsAppSettings>()
            .HasIndex(s => s.TenantId)
            .IsUnique();
        modelBuilder.Entity<TenantWhatsAppSettings>()
            .HasQueryFilter(e => e.TenantId == _tenantId);

        modelBuilder.Entity<NotificationLog>()
            .HasIndex(l => new { l.TenantId, l.WorkOrderId, l.EventType, l.DispatchType, l.Status });
        modelBuilder.Entity<NotificationLog>()
            .HasIndex(l => l.ProviderMessageId);
        modelBuilder.Entity<NotificationLog>()
            .HasQueryFilter(e => e.TenantId == _tenantId);

        if (Database.ProviderName == "Microsoft.EntityFrameworkCore.Sqlite")
            ConfigureSqliteDateTimeOffsetConverters(modelBuilder);
    }

    private static void ConfigureSqliteDateTimeOffsetConverters(ModelBuilder modelBuilder)
    {
        var dateTimeOffsetConverter = new ValueConverter<DateTimeOffset, long>(
            value => value.UtcTicks,
            value => new DateTimeOffset(new DateTime(value, DateTimeKind.Utc)));
        var nullableDateTimeOffsetConverter = new ValueConverter<DateTimeOffset?, long?>(
            value => value.HasValue ? value.Value.UtcTicks : null,
            value => value.HasValue ? new DateTimeOffset(new DateTime(value.Value, DateTimeKind.Utc)) : null);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTimeOffset))
                    property.SetValueConverter(dateTimeOffsetConverter);
                else if (property.ClrType == typeof(DateTimeOffset?))
                    property.SetValueConverter(nullableDateTimeOffsetConverter);
            }
        }
    }
}
