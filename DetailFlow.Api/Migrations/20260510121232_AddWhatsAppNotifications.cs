using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DetailFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NotificationLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    Channel = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<int>(type: "integer", nullable: false),
                    DispatchType = table.Column<int>(type: "integer", nullable: false),
                    RecipientPhone = table.Column<string>(type: "text", nullable: false),
                    ProviderMessageId = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ErrorCode = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    RequestedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequestedByName = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotificationLogs_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_NotificationLogs_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "TenantWhatsAppSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    BusinessPhoneNumberId = table.Column<string>(type: "text", nullable: true),
                    AccessTokenCiphertext = table.Column<string>(type: "text", nullable: true),
                    ReadyTemplateName = table.Column<string>(type: "text", nullable: true),
                    TemplateLanguageCode = table.Column<string>(type: "text", nullable: false),
                    AutoSendReady = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantWhatsAppSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantWhatsAppSettings_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationLogs_ProviderMessageId",
                table: "NotificationLogs",
                column: "ProviderMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationLogs_TenantId_WorkOrderId_EventType_DispatchTyp~",
                table: "NotificationLogs",
                columns: new[] { "TenantId", "WorkOrderId", "EventType", "DispatchType", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationLogs_WorkOrderId",
                table: "NotificationLogs",
                column: "WorkOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantWhatsAppSettings_TenantId",
                table: "TenantWhatsAppSettings",
                column: "TenantId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NotificationLogs");

            migrationBuilder.DropTable(
                name: "TenantWhatsAppSettings");
        }
    }
}
