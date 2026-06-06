'use client';

import type { TooltipContentProps } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';

type ChartTooltipProps = Partial<TooltipContentProps<number | string, string>> & {
  labelFormatter?: (label: unknown) => string;
};

export function ChartTooltip({ active, label, labelFormatter, payload }: ChartTooltipProps) {
  const { formatNumber, isRtl, t } = useI18n();

  if (!active || !payload?.length) return null;

  const item = payload[0];
  const rawValue = Array.isArray(item.value) ? item.value[0] : item.value;
  const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-w-36 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm shadow-xl shadow-black/20"
    >
      <p className="max-w-48 truncate font-medium text-[var(--color-text)]">{labelFormatter ? labelFormatter(label) : String(label ?? '')}</p>
      <div className="mt-2 flex items-center justify-between gap-6 text-xs text-[var(--color-text-muted)]">
        <span>{t('analytics.charts.count')}</span>
        <span className="font-[var(--font-display)] text-base font-semibold text-[var(--color-accent)]">
          {formatNumber(Number.isFinite(numericValue) ? numericValue : 0)}
        </span>
      </div>
    </div>
  );
}
