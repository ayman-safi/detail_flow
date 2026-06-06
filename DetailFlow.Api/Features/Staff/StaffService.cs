using DetailFlow.Api.Data;
using DetailFlow.Api.Features.Auth;
using DetailFlow.Api.Features.Plans;
using DetailFlow.Api.Models;
using DetailFlow.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace DetailFlow.Api.Features.Staff;

public class StaffService(
    DetailFlowDbContext db,
    ITenantContext tenantContext,
    PlanEnforcementService planEnforcement,
    AccountActionTokenService accountActionTokens)
{
    public async Task<IReadOnlyList<object>> ListAsync()
    {
        EnsureManagerOrOwner();
        var today = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero);
        return await db.Users
            .Select(u => (object)new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.Role,
                u.IsActive,
                isInvitePending = u.PasswordSetAt == null,
                completedJobsToday = db.WorkOrders.Count(w =>
                    w.AssignedStaffId == u.Id &&
                    w.Stage == WorkOrderStage.Delivered &&
                    w.UpdatedAt >= today)
            })
            .ToListAsync();
    }

    public async Task<object> CreateAsync(StaffCreateRequest input)
    {
        EnsureManagerOrOwner();
        if (tenantContext.Role == UserRole.Manager && input.Role != UserRole.Staff)
            throw new UnauthorizedAccessException("Managers can only create Staff members.");
        await planEnforcement.AssertCanAddStaffAsync(tenantContext.TenantId);

        var email = RequireText(input.Email, "Email").Trim().ToLowerInvariant();
        var fullName = RequireText(input.FullName, "Full name").Trim();

        if (await db.Users.AnyAsync(u => u.Email == email))
            throw new ArgumentException("Email already exists in this tenant.");

        var user = new User
        {
            TenantId = tenantContext.TenantId,
            FullName = fullName,
            Email = email,
            Role = input.Role,
            PasswordHash = "",
            PasswordSetAt = null
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var invite = await accountActionTokens.CreateInviteLinkAsync(user);
        return new
        {
            user = BuildStaffDto(user, 0),
            inviteLink = invite.Link,
            inviteExpiresAt = invite.ExpiresAt
        };
    }

    public async Task<object> CreateInviteLinkAsync(Guid id)
    {
        var user = await GetManagedUserAsync(id);
        if (user.PasswordSetAt is not null)
            throw new ArgumentException("This user has already accepted their invite.");
        if (!user.IsActive)
            throw new ArgumentException("Inactive users cannot receive invite links.");

        var invite = await accountActionTokens.CreateInviteLinkAsync(user);
        return new { inviteLink = invite.Link, inviteExpiresAt = invite.ExpiresAt };
    }

    public async Task<object> CreateResetLinkAsync(Guid id)
    {
        var user = await GetManagedUserAsync(id);
        if (user.PasswordSetAt is null)
            throw new ArgumentException("This user has not accepted their invite yet.");
        if (!user.IsActive)
            throw new ArgumentException("Inactive users cannot receive password reset links.");

        var reset = await accountActionTokens.CreateResetLinkAsync(user);
        return new { resetLink = reset.Link, resetExpiresAt = reset.ExpiresAt };
    }

    public async Task<object> UpdateAsync(Guid id, StaffPatchRequest input)
    {
        EnsureManagerOrOwner();
        if (id == tenantContext.UserId && input.IsActive == false)
            throw new UnauthorizedAccessException("You cannot deactivate yourself.");
        if (id == tenantContext.UserId && input.Role.HasValue)
            throw new UnauthorizedAccessException("You cannot change your own role.");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id)
            ?? throw new KeyNotFoundException("User not found.");

        if (user.Role == UserRole.Owner && tenantContext.Role != UserRole.Owner)
            throw new UnauthorizedAccessException("Only owners can change owner users.");

        if (tenantContext.Role == UserRole.Manager && input.Role.HasValue && input.Role.Value != UserRole.Staff)
            throw new UnauthorizedAccessException("Managers can only assign Staff role.");

        if (input.FullName is not null)
            user.FullName = RequireText(input.FullName, "Full name").Trim();
        if (input.Role.HasValue)
            user.Role = input.Role.Value;
        if (input.IsActive.HasValue)
            user.IsActive = input.IsActive.Value;

        await db.SaveChangesAsync();
        return BuildStaffDto(user, 0);
    }

    private void EnsureManagerOrOwner()
    {
        if (tenantContext.Role is not (UserRole.Manager or UserRole.Owner))
            throw new UnauthorizedAccessException("Manager or Owner role required.");
    }

    private async Task<User> GetManagedUserAsync(Guid id)
    {
        EnsureManagerOrOwner();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id)
            ?? throw new KeyNotFoundException("User not found.");

        if (user.Role == UserRole.Owner && tenantContext.Role != UserRole.Owner)
            throw new UnauthorizedAccessException("Only owners can manage owner users.");

        if (tenantContext.Role == UserRole.Manager && user.Role != UserRole.Staff)
            throw new UnauthorizedAccessException("Managers can only manage Staff members.");

        return user;
    }

    private static object BuildStaffDto(User user, int completedJobsToday) => new
    {
        user.Id,
        user.FullName,
        user.Email,
        user.Role,
        user.IsActive,
        isInvitePending = user.PasswordSetAt == null,
        completedJobsToday
    };

    private static string RequireText(string? value, string name) =>
        string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"{name} is required.") : value;
}
