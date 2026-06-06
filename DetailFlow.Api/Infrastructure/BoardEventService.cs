using System.Collections.Concurrent;
using System.Threading.Channels;

namespace DetailFlow.Api.Infrastructure;

public record BoardEvent(string Type, object Payload);
public record BoardSubscriber(Guid Id, Channel<BoardEvent> Channel);

public class BoardEventService
{
    private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<Guid, BoardSubscriber>> _tenantSubs = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<Guid, BoardSubscriber>> _tokenSubs = new();

    public IDisposable SubscribeTenant(Guid tenantId, BoardSubscriber sub)
    {
        var subscribers = _tenantSubs.GetOrAdd(tenantId, _ => new ConcurrentDictionary<Guid, BoardSubscriber>());
        subscribers[sub.Id] = sub;
        return Disposable.Create(() => RemoveSub(_tenantSubs, tenantId, sub.Id));
    }

    public IDisposable SubscribeToken(string token, BoardSubscriber sub)
    {
        var subscribers = _tokenSubs.GetOrAdd(token, _ => new ConcurrentDictionary<Guid, BoardSubscriber>());
        subscribers[sub.Id] = sub;
        return Disposable.Create(() => RemoveSub(_tokenSubs, token, sub.Id));
    }

    public Task BroadcastToTenantAsync(Guid tenantId, BoardEvent evt)
    {
        if (!_tenantSubs.TryGetValue(tenantId, out var subs))
            return Task.CompletedTask;
        foreach (var sub in subs.Values)
            sub.Channel.Writer.TryWrite(evt);
        return Task.CompletedTask;
    }

    public Task BroadcastToTokenAsync(string token, BoardEvent evt)
    {
        if (!_tokenSubs.TryGetValue(token, out var subs))
            return Task.CompletedTask;
        foreach (var sub in subs.Values)
            sub.Channel.Writer.TryWrite(evt);
        return Task.CompletedTask;
    }

    private static void RemoveSub<TKey>(
        ConcurrentDictionary<TKey, ConcurrentDictionary<Guid, BoardSubscriber>> dict,
        TKey key,
        Guid subId)
        where TKey : notnull
    {
        if (!dict.TryGetValue(key, out var subscribers)) return;
        subscribers.TryRemove(subId, out _);
        if (subscribers.IsEmpty)
            dict.TryRemove(key, out _);
    }
}

public class Disposable(Action onDispose) : IDisposable
{
    public static Disposable Create(Action a) => new(a);
    public void Dispose() => onDispose();
}
