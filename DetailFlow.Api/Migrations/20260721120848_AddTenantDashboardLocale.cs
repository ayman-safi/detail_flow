using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DetailFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantDashboardLocale : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DashboardLocale",
                table: "Tenants",
                type: "character varying(5)",
                maxLength: 5,
                nullable: false,
                defaultValue: "en");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DashboardLocale",
                table: "Tenants");
        }
    }
}
