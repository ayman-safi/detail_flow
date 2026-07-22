import { ArrowRight } from 'lucide-react';
import type { DashboardData } from '@/types';
import { StageBadge } from '@/components/shared/StageBadge';
import { useI18n } from '@/i18n/I18nProvider';

export function ActivityFeed({ activity }: { activity: DashboardData['recentActivity'] }) {
  const { formatRelativeTime, t } = useI18n();

  if (!activity.length) {
    return <p className="text-sm text-[var(--color-text-muted)]">{t('analytics.noActivity')}</p>;
  }

  return (
    <div className="relative before:absolute before:bottom-4 before:start-[5px] before:top-4 before:w-px before:bg-[var(--color-border)]">
      {activity.map((item, index) => (
        <div key={`${item.changedAt}-${index}`} className="relative grid gap-2 border-b border-[var(--color-border-subtle)] py-3 ps-6 last:border-0 sm:grid-cols-[minmax(230px,1.2fr)_minmax(100px,0.6fr)_minmax(150px,0.8fr)_auto] sm:items-center">
          <span className="absolute start-0 top-[22px] h-[11px] w-[11px] rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-primary)]" />
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <StageBadge stage={item.fromStage} />
            <ArrowRight className="rtl:rotate-180" size={14} aria-hidden="true" />
            <StageBadge stage={item.toStage} />
          </div>
          <span className="plate text-xs text-[var(--color-text)]">{item.vehiclePlate}</span>
          <span className="truncate text-xs text-[var(--color-text-muted)]">{item.changedByName}</span>
          <span className="text-xs text-[var(--color-text-muted)] sm:text-end">{formatRelativeTime(item.changedAt)}</span>
        </div>
      ))}
    </div>
  );
}
