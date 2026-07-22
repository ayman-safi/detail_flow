import { useI18n } from '@/i18n/I18nProvider';

export function TopServicesChart({ data }: { data: { serviceName: string; count: number }[] }) {
  const { formatNumber, t } = useI18n();

  if (!data.length) {
    return <div className="grid h-72 place-items-center text-sm text-[var(--color-text-muted)]">{t('analytics.noData')}</div>;
  }

  const maximum = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="space-y-5 py-2">
      {data.map((item, index) => (
        <div key={item.serviceName} className="grid grid-cols-[minmax(88px,0.85fr)_minmax(110px,1.4fr)_auto] items-center gap-3 text-sm">
          <span className="truncate text-[var(--color-text-secondary)]" title={item.serviceName}>{item.serviceName}</span>
          <span className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-elevated)]">
            <span
              className="block h-full origin-left rounded-full bg-[var(--color-primary)] transition-[width] duration-500"
              style={{ width: `${Math.max((item.count / maximum) * 100, 4)}%`, opacity: 1 - index * 0.1 }}
            />
          </span>
          <span className="w-5 text-end font-[var(--font-mono)] text-xs text-[var(--color-text)]">{formatNumber(item.count)}</span>
        </div>
      ))}
    </div>
  );
}
