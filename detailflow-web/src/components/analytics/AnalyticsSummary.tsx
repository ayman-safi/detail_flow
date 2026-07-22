'use client';

import { Gauge } from 'lucide-react';
import type { DashboardData } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';

type SummaryRowProps = {
  label: string;
  value: string;
  comparison?: number | null;
};

function SummaryRow({ label, value, comparison }: SummaryRowProps) {
  const { formatNumber, t } = useI18n();
  const color = comparison === null || comparison === 0 ? 'var(--color-text-muted)' : comparison && comparison > 0 ? 'var(--color-success)' : 'var(--color-destructive)';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-[var(--color-border-subtle)] py-4 last:border-0">
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className="font-[var(--font-display)] text-base font-semibold">{value}</span>
      {comparison !== undefined && (
        <span className="col-span-2 text-end text-xs" style={{ color }}>
          {comparison === null
            ? t('analytics.comparison.noPrevious')
            : t('analytics.comparison.percent', { value: formatNumber(Math.abs(comparison)), direction: comparison > 0 ? '↑' : comparison < 0 ? '↓' : '—' })}
        </span>
      )}
    </div>
  );
}

export function AnalyticsSummary({ data }: { data?: DashboardData }) {
  const { formatNumber, t } = useI18n();
  const summary = data?.summary;
  const days = data?.range.days ?? 1;
  const repeatRate = summary?.totalWorkOrders ? ((data?.repeatCustomers ?? 0) / summary.totalWorkOrders) * 100 : 0;
  const averageJobs = (summary?.completedJobs ?? 0) / days;

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-muted)] text-[var(--color-accent)]">
          <Gauge size={17} aria-hidden="true" />
        </span>
        <h2 className="font-[var(--font-display)] font-semibold">{t('analytics.summary.title')}</h2>
      </div>
      <div className="mt-2">
        <SummaryRow label={t('analytics.summary.completed')} value={formatNumber(summary?.completedJobs ?? 0)} comparison={data?.comparison?.completedJobsPercent} />
        <SummaryRow label={t('analytics.summary.walkIns')} value={formatNumber(summary?.walkIns ?? 0)} comparison={data?.comparison?.walkInsPercent} />
        <SummaryRow label={t('analytics.summary.averagePerDay')} value={formatNumber(averageJobs, { maximumFractionDigits: 2 })} />
        <SummaryRow label={t('analytics.summary.repeatRate')} value={`${formatNumber(repeatRate, { maximumFractionDigits: 1 })}%`} comparison={data?.comparison?.repeatCustomersPercent} />
      </div>
    </div>
  );
}
