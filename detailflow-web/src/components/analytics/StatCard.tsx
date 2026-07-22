import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/i18n/I18nProvider';

type StatCardProps = {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
  loading?: boolean;
  comparison?: number | null;
  className?: string;
};

export function StatCard({ title, value, subtitle, icon: Icon, color = 'var(--color-primary)', loading, comparison, className = 'p-5' }: StatCardProps) {
  const { formatNumber, t } = useI18n();
  const comparisonColor = comparison === null || comparison === 0 ? 'var(--color-text-muted)' : comparison && comparison > 0 ? 'var(--color-success)' : 'var(--color-destructive)';

  return (
    <Card className={className}>
      {loading ? (
        <><div className="skeleton h-7 w-28" /><div className="skeleton mt-5 h-9 w-20" /><div className="skeleton mt-3 h-4 w-32" /></>
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color }}>
              <Icon size={17} aria-hidden="true" />
            </span>
            <p className="min-w-0 text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
          </div>
          <p className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
          {comparison !== undefined && (
            <p className="mt-3 text-xs" style={{ color: comparisonColor }}>
              {comparison === null
                ? t('analytics.comparison.noPrevious')
                : t('analytics.comparison.percent', { value: formatNumber(Math.abs(comparison)), direction: comparison > 0 ? '↑' : comparison < 0 ? '↓' : '—' })}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
