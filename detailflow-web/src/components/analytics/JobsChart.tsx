'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';
import { ChartTooltip } from './ChartTooltip';

export function JobsChart({ data }: { data: { date: string; count: number }[] }) {
  const { formatDate, formatNumber } = useI18n();
  const axisTick = { fill: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-body)' };

  return (
    <div dir="ltr" className="h-56 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={12} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            tick={axisTick}
            tickFormatter={(value) => formatDate(value, { weekday: 'short', day: 'numeric' })}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={axisTick}
            tickFormatter={(value) => formatNumber(Number(value))}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.10)' }}
            content={<ChartTooltip labelFormatter={(value) => formatDate(String(value), { weekday: 'short', day: 'numeric', month: 'short' })} />}
            wrapperStyle={{ outline: 'none' }}
          />
          <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} barSize={22} minPointSize={3} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
