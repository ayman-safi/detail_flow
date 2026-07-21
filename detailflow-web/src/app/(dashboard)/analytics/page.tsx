'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Car, CheckCircle, RefreshCw, Users } from 'lucide-react';
import api from '@/lib/api';
import type { DashboardData } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/analytics/StatCard';
import { JobsChart } from '@/components/analytics/JobsChart';
import { TopServicesChart } from '@/components/analytics/TopServicesChart';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { PlanUpgradePanel } from '@/components/plans/PlanUpgradePanel';
import { usePlanStatus } from '@/hooks/usePlanStatus';
import { useI18n } from '@/i18n/I18nProvider';

type RangePreset = '7' | '30' | '90' | 'custom';

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function presetRange(days: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days + 1);
  return { from: dateKey(from), to: dateKey(to) };
}

function rangeDays(from: string, to: string) {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export default function AnalyticsPage() {
  const { formatDate, formatNumber, t } = useI18n();
  const [preset, setPreset] = useState<RangePreset>('30');
  const [range, setRange] = useState(() => presetRange(30));
  const [draftRange, setDraftRange] = useState(() => presetRange(30));
  const [rangeError, setRangeError] = useState('');
  const { data: plan, isLoading: planLoading } = usePlanStatus();
  const analyticsEnabled = plan?.analyticsEnabled === true;
  const timezoneOffsetMinutes = new Date(`${range.to}T12:00:00`).getTimezoneOffset();
  const { data, isFetching, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', range.from, range.to, timezoneOffsetMinutes],
    enabled: analyticsEnabled,
    queryFn: () => api.get('/analytics/dashboard', {
      params: { from: range.from, to: range.to, timezoneOffsetMinutes },
    }).then((response) => response.data),
    placeholderData: (previous) => previous,
    refetchInterval: 60_000,
  });

  const selectPreset = (nextPreset: Exclude<RangePreset, 'custom'>) => {
    const nextRange = presetRange(Number(nextPreset));
    setPreset(nextPreset);
    setRange(nextRange);
    setDraftRange(nextRange);
    setRangeError('');
  };

  const applyCustomRange = () => {
    const days = rangeDays(draftRange.from, draftRange.to);
    if (!draftRange.from || !draftRange.to || days < 1) {
      setRangeError(t('analytics.range.invalid'));
      return;
    }
    if (days > 90) {
      setRangeError(t('analytics.range.tooLong'));
      return;
    }
    setRange(draftRange);
    setRangeError('');
  };

  if (!planLoading && plan?.analyticsEnabled === false) {
    return (
      <div className="p-4">
        <PlanUpgradePanel title={t('analytics.lockedTitle')} description={t('analytics.lockedDescription')} />
      </div>
    );
  }
  const loading = planLoading || isLoading;
  const summary = data?.summary;
  const displayedRange = data?.range ?? { ...range, days: rangeDays(range.from, range.to) };
  const rangeLabel = `${formatDate(`${displayedRange.from}T00:00:00`, { day: 'numeric', month: 'short', year: 'numeric' })} - ${formatDate(`${displayedRange.to}T00:00:00`, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="font-[var(--font-display)] text-lg font-semibold">{t('analytics.range.title')}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">{t('analytics.range.description')}</p>
            <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]" aria-live="polite">
              {rangeLabel} / {t('analytics.range.days', { count: formatNumber(displayedRange.days) })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('analytics.range.title')}>
            {(['7', '30', '90'] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={preset === value ? 'primary' : 'secondary'}
                aria-pressed={preset === value}
                onClick={() => selectPreset(value)}
              >
                {t(`analytics.range.last${value}`)}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant={preset === 'custom' ? 'primary' : 'secondary'}
              aria-pressed={preset === 'custom'}
              onClick={() => { setPreset('custom'); setRangeError(''); }}
            >
              {t('analytics.range.custom')}
            </Button>
          </div>
        </div>
        {preset === 'custom' && (
          <div className="mt-4 grid gap-3 border-t border-[var(--color-border-subtle)] pt-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)_auto] lg:items-end">
            <label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              {t('analytics.range.from')}
              <Input type="date" value={draftRange.from} max={draftRange.to} onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              {t('analytics.range.to')}
              <Input type="date" value={draftRange.to} min={draftRange.from} max={dateKey(new Date())} onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))} />
            </label>
            <Button type="button" className="w-full lg:w-auto" onClick={applyCustomRange}>{t('analytics.range.apply')}</Button>
            {rangeError && <p className="text-sm text-[var(--color-destructive)] sm:col-span-2 lg:col-span-3" role="alert">{rangeError}</p>}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard className="p-4 sm:p-5" title={t('analytics.stats.bookings')} value={summary?.totalBookings ?? 0} subtitle={t('analytics.stats.walkIns', { count: formatNumber(summary?.walkIns ?? 0) })} icon={CalendarDays} loading={loading} />
        <StatCard className="p-4 sm:p-5" title={t('analytics.stats.activeVehicles')} value={summary?.activeVehicles ?? 0} subtitle={t('analytics.stats.liveSnapshot')} icon={Car} color="var(--color-accent)" loading={loading} />
        <StatCard className="p-4 sm:p-5" title={t('analytics.stats.completed')} value={summary?.completedJobs ?? 0} icon={CheckCircle} color="var(--color-success)" loading={loading} />
        <StatCard className="p-4 sm:p-5" title={t('analytics.stats.repeatCustomers')} value={data?.repeatCustomers ?? 0} icon={Users} color="var(--color-info)" loading={loading} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <Card className="min-w-0 p-4 sm:p-6">
          <div className="mb-5">
            <h2 className="font-[var(--font-display)] font-semibold">{t('analytics.completedTrend')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('analytics.completedTrendDescription')}</p>
          </div>
          <JobsChart data={data?.jobsByDay ?? []} />
        </Card>
        <Card className="min-w-0 p-4 sm:p-6">
          <div className="mb-5">
            <h2 className="font-[var(--font-display)] font-semibold">{t('analytics.topServices')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('analytics.topServicesDescription')}</p>
          </div>
          <TopServicesChart data={data?.topServices ?? []} />
        </Card>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-[var(--font-display)] font-semibold">{t('analytics.recentActivity')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('analytics.recentActivityDescription')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label={t('analytics.refresh')}>
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </Button>
        </div>
        <ActivityFeed activity={data?.recentActivity ?? []} />
      </Card>
    </div>
  );
}
