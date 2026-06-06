'use client';

import { useI18n } from '@/i18n/I18nProvider';

export function SSEStatusDot({ status }: { status: 'connecting'|'connected'|'error'|'closed' }) {
  const { t } = useI18n();
  const map = {
    connected: ['#22c55e', t('sse.connected')],
    connecting: ['#f59e0b', t('sse.connecting')],
    error: ['#ef4444', t('sse.error')],
    closed: ['#64748b', t('sse.closed')],
  } as const;
  const [color, title] = map[status];
  return <span title={title} className="h-2 w-2 rounded-full" style={{ background: color, animation: status === 'connected' || status === 'connecting' ? 'livePulse 1.4s infinite' : undefined }} />;
}
