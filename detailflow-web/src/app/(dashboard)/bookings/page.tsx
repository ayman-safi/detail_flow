'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { CalendarOff } from 'lucide-react';
import api from '@/lib/api';
import type { Booking } from '@/types';
import { Card } from '@/components/ui/card';
import { BookingCalendar } from '@/components/bookings/BookingCalendar';
import { BookingForm } from '@/components/bookings/BookingForm';
import { BookingRow } from '@/components/bookings/BookingRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { WorkOrderSheet } from '@/components/board/WorkOrderSheet';
import { useI18n } from '@/i18n/I18nProvider';

export default function BookingsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { formatDate, t } = useI18n();
  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const key = ['bookings', dateKey];
  const { data = [] } = useQuery<Booking[]>({
    queryKey: key,
    queryFn: () => api.get('/bookings', {
      params: { date: dateKey, timezoneOffsetMinutes: new Date(`${dateKey}T00:00:00`).getTimezoneOffset() },
    }).then((response) => response.data),
    staleTime: 60_000,
  });
  const changeStatus = async (id: string, status: string) => {
    await api.patch(`/bookings/${id}/status`, { status });
    toast.success(t('bookings.statusUpdated'));
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0">
        <BookingCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />
        <Card className="mt-4 p-4">
          <h2 className="mb-3 font-[var(--font-display)] text-lg font-semibold">{t('bookings.countOnDate', { count: data.length, date: formatDate(selectedDate, { day: 'numeric', month: 'short', year: 'numeric' }) })}</h2>
          {data.length === 0 ? <EmptyState icon={CalendarOff} title={t('bookings.emptyTitle')} /> : data.map((booking) => <BookingRow key={booking.id} booking={booking} onStatusChange={changeStatus} onViewWorkOrder={setSelectedWorkOrderId} />)}
        </Card>
      </section>
      <Card className="p-5"><h2 className="mb-4 font-[var(--font-display)] text-xl font-semibold">{t('bookings.title')}</h2><BookingForm initialDate={selectedDate} /></Card>
      <WorkOrderSheet workOrderId={selectedWorkOrderId} onClose={() => setSelectedWorkOrderId(null)} />
    </div>
  );
}
