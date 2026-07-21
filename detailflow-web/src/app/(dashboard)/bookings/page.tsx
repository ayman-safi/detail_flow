'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { CalendarOff } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import type { Booking } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookingCalendar } from '@/components/bookings/BookingCalendar';
import { BookingEditDialog } from '@/components/bookings/BookingEditDialog';
import { BookingForm } from '@/components/bookings/BookingForm';
import { BookingRow } from '@/components/bookings/BookingRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { WorkOrderSheet } from '@/components/board/WorkOrderSheet';
import { useI18n } from '@/i18n/I18nProvider';

export default function BookingsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
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
  const refreshBookingSurfaces = () => {
    qc.invalidateQueries({ queryKey: ['bookings'] });
    qc.invalidateQueries({ queryKey: ['board'] });
    qc.invalidateQueries({ queryKey: ['customers'] });
    qc.invalidateQueries({ queryKey: ['plan-status'] });
  };
  const changeStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      toast.success(t('bookings.statusUpdated'));
      refreshBookingSurfaces();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('bookings.statusUpdateFailed')));
    }
  };
  const confirmCancel = async () => {
    if (!cancelBooking) return;
    try {
      await api.patch(`/bookings/${cancelBooking.id}/status`, { status: 'Cancelled' });
      toast.success(t('bookings.cancelled'));
      setCancelBooking(null);
      refreshBookingSurfaces();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('bookings.cancelFailed')));
    }
  };

  return (
    <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0">
        <BookingCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />
        <Card className="mt-4 p-4">
          <h2 className="mb-3 font-[var(--font-display)] text-lg font-semibold">{t('bookings.countOnDate', { count: data.length, date: formatDate(selectedDate, { day: 'numeric', month: 'short', year: 'numeric' }) })}</h2>
          {data.length === 0 ? <EmptyState icon={CalendarOff} title={t('bookings.emptyTitle')} /> : data.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              onEdit={setEditingBookingId}
              onStatusChange={changeStatus}
              onCancel={setCancelBooking}
              onViewWorkOrder={setSelectedWorkOrderId}
            />
          ))}
        </Card>
      </section>
      <Card className="p-5"><h2 className="mb-4 font-[var(--font-display)] text-xl font-semibold">{t('bookings.title')}</h2><BookingForm initialDate={selectedDate} /></Card>
      <BookingEditDialog
        bookingId={editingBookingId}
        open={!!editingBookingId}
        onOpenChange={(open) => !open && setEditingBookingId(null)}
        onSaved={refreshBookingSurfaces}
      />
      <Dialog open={!!cancelBooking} onOpenChange={(open) => !open && setCancelBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-[var(--font-display)] text-xl font-semibold">{t('bookings.cancelDialog.title')}</DialogTitle>
            <DialogDescription className="text-sm text-[var(--color-text-muted)]">
              {t('bookings.cancelDialog.description')}
            </DialogDescription>
          </DialogHeader>
          {cancelBooking && (
            <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 text-sm">
              <p className="font-semibold">{cancelBooking.customer.fullName ?? cancelBooking.customer.phone}</p>
              <p className="text-[var(--color-text-muted)]">{cancelBooking.vehicle?.plateNumber ?? t('common.states.vehiclePending')} - {cancelBooking.serviceName}</p>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCancelBooking(null)}>{t('common.actions.cancel')}</Button>
            <Button type="button" variant="danger" onClick={confirmCancel}>{t('bookings.cancelDialog.confirm')}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <WorkOrderSheet workOrderId={selectedWorkOrderId} onClose={() => setSelectedWorkOrderId(null)} />
    </div>
  );
}
