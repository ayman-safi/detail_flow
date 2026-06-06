import { useEffect, useRef, useState } from 'react';

type SSEStatus = 'connecting' | 'connected' | 'error' | 'closed';

interface UseSSEOptions {
  onEvent: (type: string, data: unknown) => void;
  onConnected?: () => void;
  onError?: () => void;
  enabled?: boolean;
  eventTypes?: string[];
  withCredentials?: boolean;
}

const DEFAULT_EVENTS = ['stage_changed', 'work_order_created', 'work_order_updated', 'work_order_removed'];

export function useSSE(url: string | null, options: UseSSEOptions) {
  const [status, setStatus] = useState<SSEStatus>('connecting');
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const enabled = options.enabled !== false;
  const eventTypesKey = (options.eventTypes ?? DEFAULT_EVENTS).join('|');

  useEffect(() => {
    if (!url || !enabled) {
      setStatus('closed');
      return;
    }
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let closed = false;
    const eventTypes = eventTypesKey.split('|').filter(Boolean);

    const connect = () => {
      if (closed) return;
      setStatus('connecting');
      es = new EventSource(url, { withCredentials: optionsRef.current.withCredentials ?? false });
      es.addEventListener('connected', () => {
        setStatus('connected');
        optionsRef.current.onConnected?.();
      });
      eventTypes.forEach((type) => {
        es?.addEventListener(type, (event) => {
          try {
            optionsRef.current.onEvent(type, JSON.parse((event as MessageEvent).data));
          } catch (error) {
            console.warn(`Failed to parse ${type} SSE event`, error);
          }
        });
      });
      es.onerror = () => {
        if (closed) return;
        setStatus('error');
        optionsRef.current.onError?.();
        es?.close();
        retryTimeout = setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimeout);
      es?.close();
      setStatus('closed');
    };
  }, [url, enabled, eventTypesKey]);

  return { status };
}
