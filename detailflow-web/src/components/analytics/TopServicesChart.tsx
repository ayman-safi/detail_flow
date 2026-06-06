'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';
import { ChartTooltip } from './ChartTooltip';

export function TopServicesChart({ data }: { data: { serviceName: string; count: number }[] }) {
  const { formatNumber } = useI18n();
  const chartHeight = Math.max(220, data.length * 38 + 48);
  const formatServiceLabel = (value: string) => (value.length > 18 ? `${value.slice(0, 17)}...` : value);
  const axisTick = { fill: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-body)' };

  return (
    <div dir="ltr" className="min-w-0" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} barCategoryGap={10} margin={{ top: 4, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
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
            width={136}
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
          <Bar dataKey="count" fill="var(--color-accent)" radius={[0, 6, 6, 0]} barSize={22} minPointSize={3} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
