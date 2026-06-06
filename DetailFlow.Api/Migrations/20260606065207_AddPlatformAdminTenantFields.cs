using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DetailFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPlatformAdminTenantFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Settings",
                table: "Tenants",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{\"BayCapacity\":3,\"Currency\":0,\"WorkingDays\":[{\"Day\":0,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":1,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":2,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":3,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":4,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":5,\"IsOpen\":false,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":6,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"}],\"ClosurePeriods\":[]}'::jsonb",
                oldClrType: typeof(string),
                oldType: "jsonb",
                oldDefaultValueSql: "'{\"BayCapacity\":3,\"WorkingDays\":[{\"Day\":0,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":1,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":2,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":3,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":4,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":5,\"IsOpen\":false,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":6,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"}],\"ClosurePeriods\":[]}'::jsonb");

            migrationBuilder.AddColumn<string>(
                name: "BillingNotes",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BillingStatus",
                table: "Tenants",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "SupportAccessEnabled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SupportAccessExpiresAt",
                table: "Tenants",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BillingNotes",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "BillingStatus",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "SupportAccessEnabled",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "SupportAccessExpiresAt",
                table: "Tenants");

            migrationBuilder.AlterColumn<string>(
                name: "Settings",
                table: "Tenants",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{\"BayCapacity\":3,\"WorkingDays\":[{\"Day\":0,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":1,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":2,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":3,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":4,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":5,\"IsOpen\":false,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":6,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"}],\"ClosurePeriods\":[]}'::jsonb",
                oldClrType: typeof(string),
                oldType: "jsonb",
                oldDefaultValueSql: "'{\"BayCapacity\":3,\"Currency\":0,\"WorkingDays\":[{\"Day\":0,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":1,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":2,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":3,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":4,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":5,\"IsOpen\":false,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":6,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"}],\"ClosurePeriods\":[]}'::jsonb");
        }
    }
}
