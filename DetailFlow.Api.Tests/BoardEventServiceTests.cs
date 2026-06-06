using System.Threading.Channels;
using DetailFlow.Api.Infrastructure;

namespace DetailFlow.Api.Tests;

public class BoardEventServiceTests
{
    [Fact]
    public async Task Tenant_and_token_subscribers_receive_events_until_disposed()
    {
        var service = new BoardEventService();
        var tenantId = Guid.NewGuid();
        var tenantChannel = Channel.CreateUnbounded<BoardEvent>();
        var tokenChannel = Channel.CreateUnbounded<BoardEvent>();

        using var tenantSub = service.SubscribeTenant(tenantId, new BoardSubscriber(Guid.NewGuid(), tenantChannel));
        using var tokenSub = service.SubscribeToken("TRACK123", new BoardSubscriber(Guid.NewGuid(), tokenChannel));

        await service.BroadcastToTenantAsync(tenantId, new BoardEvent("tenant-event", new { id = 1 }));
        await service.BroadcastToTokenAsync("TRACK123", new BoardEvent("token-event", new { id = 2 }));

        Assert.True(tenantChannel.Reader.TryRead(out var tenantEvent));
        Assert.Equal("tenant-event", tenantEvent.Type);
        Assert.True(tokenChannel.Reader.TryRead(out var tokenEvent));
        Assert.Equal("token-event", tokenEvent.Type);

        tenantSub.Dispose();
        tokenSub.Dispose();

        await service.BroadcastToTenantAsync(tenantId, new BoardEvent("after-dispose", new { }));
        await service.BroadcastToTokenAsync("TRACK123", new BoardEvent("after-dispose", new { }));

        Assert.False(tenantChannel.Reader.TryRead(out _));
        Assert.False(tokenChannel.Reader.TryRead(out _));
    }
}
