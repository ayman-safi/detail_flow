'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';
import { ChartTooltip } from './ChartTooltip';

export function JobsChart({ data }: { data: { date: string; count: number }[] }) {
  const { formatDate, formatNumber } = useI18n();
  const axisTick = { fill: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-body)' };

  return (
    <div dir="ltr" className="h-56 min-w-0 sm:h-72">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
          <defs>
            <linearGradient id="jobs-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            tick={axisTick}
            minTickGap={28}
            interval="preserveStartEnd"
            tickFormatter={(value) => formatDate(`${value}T00:00:00`, { month: 'short', day: 'numeric' })}
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
            cursor={{ fill: 'var(--color-chart-cursor)' }}
            content={<ChartTooltip labelFormatter={(value) => formatDate(`${String(value)}T00:00:00`, { weekday: 'short', day: 'numeric', month: 'short' })} />}
            wrapperStyle={{ outline: 'none' }}
          />
          <Area type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#jobs-area)" activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
