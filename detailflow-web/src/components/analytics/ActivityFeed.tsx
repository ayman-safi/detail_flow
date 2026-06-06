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
    <div className="space-y-3">
      {activity.map((item, index) => (
        <div key={index} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]/45 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StageBadge stage={item.fromStage} />
            <ArrowRight size={14} />
            <StageBadge stage={item.toStage} />
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {t('analytics.activityItem', {
              name: item.changedByName,
              plate: item.vehiclePlate,
              time: formatRelativeTime(item.changedAt),
            })}
          </p>
        </div>
      ))}
    </div>
  );
}
