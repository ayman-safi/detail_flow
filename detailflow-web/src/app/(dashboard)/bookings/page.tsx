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
  const confirmedCount = data.filter((booking) => booking.status === 'Confirmed').length;
  const pendingCount = data.filter((booking) => booking.status === 'Pending').length;
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
    <div className="mx-auto w-full max-w-[1440px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <section className="min-w-0">
        <div className="mx-auto max-w-[760px] lg:mx-0">
          <BookingCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>
        <Card className="mt-4 overflow-hidden p-3 sm:p-4 lg:mt-6">
          <div className="mb-3 flex flex-col gap-3 lg:mb-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="font-[var(--font-display)] text-base font-semibold sm:text-lg">
              {t('bookings.countOnDate', { count: data.length, date: formatDate(selectedDate, { day: 'numeric', month: 'short', year: 'numeric' }) })}
            </h2>
            <dl className="grid grid-cols-3 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] lg:w-[480px] lg:gap-2 lg:overflow-visible lg:border-0">
              <div className="flex min-h-14 flex-col items-center justify-center border-e border-[var(--color-border)] px-2 lg:min-h-16 lg:rounded-[var(--radius-sm)] lg:border lg:px-4">
                <dd className="font-[var(--font-display)] text-base font-semibold">{data.length}</dd>
                <dt className="mt-0.5 text-center text-[11px] text-[var(--color-text-muted)] sm:text-xs">{t('bookings.summary.total')}</dt>
              </div>
              <div className="flex min-h-14 flex-col items-center justify-center border-e border-[var(--color-border)] px-2 lg:min-h-16 lg:rounded-[var(--radius-sm)] lg:border lg:px-4">
                <dd className="font-[var(--font-display)] text-base font-semibold">{confirmedCount}</dd>
                <dt className="mt-0.5 text-center text-[11px] text-[var(--color-success)] sm:text-xs">{t('bookings.summary.confirmed')}</dt>
              </div>
              <div className="flex min-h-14 flex-col items-center justify-center px-2 lg:min-h-16 lg:rounded-[var(--radius-sm)] lg:border lg:border-[var(--color-border)] lg:px-4">
                <dd className="font-[var(--font-display)] text-base font-semibold">{pendingCount}</dd>
                <dt className="mt-0.5 text-center text-[11px] text-[var(--color-warning)] sm:text-xs">{t('bookings.summary.pending')}</dt>
              </div>
            </dl>
          </div>
          {data.length === 0 ? (
            <EmptyState icon={CalendarOff} title={t('bookings.emptyTitle')} />
          ) : (
            <div className="space-y-2">
              {data.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  onEdit={setEditingBookingId}
                  onStatusChange={changeStatus}
                  onCancel={setCancelBooking}
                  onViewWorkOrder={setSelectedWorkOrderId}
                />
              ))}
            </div>
          )}
        </Card>
      </section>
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
