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
    <div className="divide-y divide-[var(--color-border-subtle)]">
      {activity.map((item, index) => (
        <div key={index} className="py-4 first:pt-0 last:pb-0">
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
