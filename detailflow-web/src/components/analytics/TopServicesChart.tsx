'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';
import { ChartTooltip } from './ChartTooltip';

export function TopServicesChart({ data }: { data: { serviceName: string; count: number }[] }) {
  const { formatNumber, t } = useI18n();
  const chartHeight = Math.max(288, data.length * 42 + 58);
  const formatServiceLabel = (value: string) => (value.length > 17 ? `${value.slice(0, 16)}...` : value);
  const axisTick = { fill: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-body)' };

  if (!data.length) {
    return <div className="grid h-72 place-items-center text-sm text-[var(--color-text-muted)]">{t('analytics.noData')}</div>;
  }

  return (
    <div dir="ltr" className="min-w-0" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} barCategoryGap={10} margin={{ top: 4, right: 8, bottom: 8, left: 8 }}>
          <XAxis
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={axisTick}
            tickFormatter={(value) => formatNumber(Number(value))}
          />
          <YAxis
            type="category"
            dataKey="serviceName"
            width={122}
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            tick={axisTick}
            tickFormatter={formatServiceLabel}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.10)' }}
            content={<ChartTooltip />}
            wrapperStyle={{ outline: 'none' }}
          />
          <Bar dataKey="count" fill="var(--color-accent)" radius={[0, 5, 5, 0]} barSize={18} minPointSize={3} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
