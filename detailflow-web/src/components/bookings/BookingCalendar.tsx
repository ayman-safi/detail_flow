'use client';

import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/I18nProvider';
import type { Booking } from '@/types';

export function BookingCalendar({ selectedDate, onSelect }: { selectedDate: Date; onSelect: (date: Date) => void }) {
  const [anchor, setAnchor] = useState(new Date());
  const { formatDate, isRtl, t } = useI18n();
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(anchor, index - 3)), [anchor]);
  const dayKeys = days.map((day) => format(day, 'yyyy-MM-dd'));
  const indicators = useQueries({
    queries: dayKeys.map((date) => ({
      queryKey: ['bookings-indicator', date],
      queryFn: () => api.get<Booking[]>('/bookings', { params: { date } }).then((response) => response.data.length),
      staleTime: 60_000,
    })),
  });

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label={t('common.actions.previous')} onClick={() => setAnchor((date) => addDays(date, -7))}>
        {isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </Button>
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((day, index) => {
          const active = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const hasBookings = (indicators[index].data ?? 0) > 0;
          return (
            <Button key={day.toISOString()} variant={active ? 'primary' : 'secondary'} className="relative h-16 min-w-16 flex-col" aria-pressed={active} aria-label={formatDate(day, { weekday: 'long', day: 'numeric', month: 'long' })} onClick={() => onSelect(day)}>
              <span className="text-xs">{formatDate(day, { weekday: 'short' })}</span>
              <span className="font-[var(--font-display)] text-lg">{formatDate(day, { day: 'numeric' })}</span>
              {hasBookings && <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />}
            </Button>
          );
        })}
      </div>
      <Button variant="ghost" size="icon" aria-label={t('common.actions.next')} onClick={() => setAnchor((date) => addDays(date, 7))}>
        {isRtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </Button>
    </div>
  );
}
