using DetailFlow.Api.Models;

namespace DetailFlow.Api.Services;

public interface ITenantContext
{
    Guid TenantId { get; }
    Guid UserId { get; }
    UserRole Role { get; }
    string UserName { get; }
}
