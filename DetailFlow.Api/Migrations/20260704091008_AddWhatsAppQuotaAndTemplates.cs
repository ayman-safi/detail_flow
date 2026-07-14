using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DetailFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppQuotaAndTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TrackingTemplateLanguageCode",
                table: "TenantWhatsAppSettings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TrackingTemplateName",
                table: "TenantWhatsAppSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Settings",
                table: "Tenants",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{\"BayCapacity\":3,\"Currency\":0,\"DefaultLocale\":\"en\",\"AvailableLocales\":[\"en\",\"ar\",\"tr\"],\"WorkingDays\":[{\"Day\":0,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":1,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":2,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":3,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":4,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":5,\"IsOpen\":false,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":6,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"}],\"ClosurePeriods\":[]}'::jsonb",
                oldClrType: typeof(string),
                oldType: "jsonb",
                oldDefaultValueSql: "'{\"BayCapacity\":3,\"Currency\":0,\"WorkingDays\":[{\"Day\":0,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":1,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":2,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":3,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":4,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":5,\"IsOpen\":false,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":6,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"}],\"ClosurePeriods\":[]}'::jsonb");

            migrationBuilder.AddColumn<int>(
                name: "WhatsAppMonthlyAddonMessages",
                table: "Tenants",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TrackingTemplateLanguageCode",
                table: "TenantWhatsAppSettings");

            migrationBuilder.DropColumn(
                name: "TrackingTemplateName",
                table: "TenantWhatsAppSettings");

            migrationBuilder.DropColumn(
                name: "WhatsAppMonthlyAddonMessages",
                table: "Tenants");

            migrationBuilder.AlterColumn<string>(
                name: "Settings",
                table: "Tenants",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{\"BayCapacity\":3,\"Currency\":0,\"WorkingDays\":[{\"Day\":0,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":1,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":2,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":3,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":4,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":5,\"IsOpen\":false,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":6,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"}],\"ClosurePeriods\":[]}'::jsonb",
                oldClrType: typeof(string),
                oldType: "jsonb",
                oldDefaultValueSql: "'{\"BayCapacity\":3,\"Currency\":0,\"DefaultLocale\":\"en\",\"AvailableLocales\":[\"en\",\"ar\",\"tr\"],\"WorkingDays\":[{\"Day\":0,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":1,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":2,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":3,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":4,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":5,\"IsOpen\":false,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":6,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"}],\"ClosurePeriods\":[]}'::jsonb");
        }
    }
}
