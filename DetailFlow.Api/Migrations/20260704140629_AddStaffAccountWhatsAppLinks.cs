using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DetailFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffAccountWhatsAppLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PasswordResetTemplateLanguageCode",
                table: "TenantWhatsAppSettings",
                type: "text",
                nullable: false,
                defaultValue: "en_US");

            migrationBuilder.AddColumn<string>(
                name: "PasswordResetTemplateName",
                table: "TenantWhatsAppSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StaffInviteTemplateLanguageCode",
                table: "TenantWhatsAppSettings",
                type: "text",
                nullable: false,
                defaultValue: "en_US");

            migrationBuilder.AddColumn<string>(
                name: "StaffInviteTemplateName",
                table: "TenantWhatsAppSettings",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Phone",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PasswordResetTemplateLanguageCode",
                table: "TenantWhatsAppSettings");

            migrationBuilder.DropColumn(
                name: "PasswordResetTemplateName",
                table: "TenantWhatsAppSettings");

            migrationBuilder.DropColumn(
                name: "StaffInviteTemplateLanguageCode",
                table: "TenantWhatsAppSettings");

            migrationBuilder.DropColumn(
                name: "StaffInviteTemplateName",
                table: "TenantWhatsAppSettings");
        }
    }
}
