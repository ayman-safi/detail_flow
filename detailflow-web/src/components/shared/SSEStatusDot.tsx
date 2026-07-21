'use client';

import { useI18n } from '@/i18n/I18nProvider';

export function SSEStatusDot({ status }: { status: 'connecting'|'connected'|'error'|'closed' }) {
  const { t } = useI18n();
  const map = {
    connected: ['var(--color-success)', t('sse.connected')],
    connecting: ['var(--color-warning)', t('sse.connecting')],
    error: ['var(--color-destructive)', t('sse.error')],
    closed: ['var(--color-text-muted)', t('sse.closed')],
  } as const;
  const [color, title] = map[status];
  return <span title={title} className="h-2 w-2 rounded-full" style={{ background: color, animation: status === 'connected' || status === 'connecting' ? 'livePulse 1.4s infinite' : undefined }} />;
}
