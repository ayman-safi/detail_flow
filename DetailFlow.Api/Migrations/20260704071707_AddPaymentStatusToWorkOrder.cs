using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DetailFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentStatusToWorkOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PaymentStatus",
                table: "WorkOrders",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentStatus",
                table: "WorkOrders");
        }
    }
}
