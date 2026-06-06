using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DetailFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Settings",
                table: "Tenants",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{\"BayCapacity\":3,\"WorkingDays\":[{\"Day\":0,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":1,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":2,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":3,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":4,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":5,\"IsOpen\":false,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"},{\"Day\":6,\"IsOpen\":true,\"OpenTime\":\"08:00:00\",\"CloseTime\":\"20:00:00\"}],\"ClosurePeriods\":[]}'::jsonb");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Settings",
                table: "Tenants");
        }
    }
}
