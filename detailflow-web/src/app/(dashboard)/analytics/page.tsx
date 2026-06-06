'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Car, CheckCircle, RefreshCw, Users } from 'lucide-react';
import api from '@/lib/api';
import type { DashboardData } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/analytics/StatCard';
import { JobsChart } from '@/components/analytics/JobsChart';
import { TopServicesChart } from '@/components/analytics/TopServicesChart';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { PlanUpgradePanel } from '@/components/plans/PlanUpgradePanel';
import { usePlanStatus } from '@/hooks/usePlanStatus';
import { useI18n } from '@/i18n/I18nProvider';

export default function AnalyticsPage() {
  const { t } = useI18n();
  const { data: plan, isLoading: planLoading } = usePlanStatus();
  const analyticsEnabled = plan?.analyticsEnabled === true;
  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    enabled: analyticsEnabled,
    queryFn: () => api.get('/analytics/dashboard').then((response) => response.data),
    refetchInterval: 60_000,
  });

  if (!planLoading && plan?.analyticsEnabled === false) {
    return (
      <div className="p-4">
        <PlanUpgradePanel title={t('analytics.lockedTitle')} description={t('analytics.lockedDescription')} />
      </div>
    );
  }
  const loading = planLoading || isLoading;

  return (
    <div className="space-y-5 p-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t('analytics.stats.bookingsToday')} value={data?.today.totalBookings ?? 0} icon={CalendarDays} loading={loading} />
        <StatCard title={t('analytics.stats.activeVehicles')} value={data?.today.activeVehicles ?? 0} icon={Car} color="var(--color-accent)" loading={loading} />
        <StatCard title={t('analytics.stats.completedToday')} value={data?.today.completedJobs ?? 0} icon={CheckCircle} color="var(--color-success)" loading={loading} />
        <StatCard title={t('analytics.stats.repeatCustomers')} value={data?.repeatCustomers ?? 0} icon={Users} color="#6366f1" loading={loading} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="p-5">
          <h2 className="mb-4 font-[var(--font-display)] font-semibold">{t('analytics.jobsThisWeek')}</h2>
          <JobsChart data={data?.jobsByDay ?? []} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-[var(--font-display)] font-semibold">{t('analytics.topServices')}</h2>
          <TopServicesChart data={data?.topServices ?? []} />
        </Card>
      </div>
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-[var(--font-display)] font-semibold">{t('analytics.recentActivity')}</h2>
          <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label={t('common.actions.retry')}>
            <RefreshCw size={16} />
          </Button>
        </div>
        <ActivityFeed activity={data?.recentActivity ?? []} />
      </Card>
    </div>
  );
}
