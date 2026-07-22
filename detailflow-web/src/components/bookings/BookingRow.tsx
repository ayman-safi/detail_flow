'use client';

import { Clock3, MoreVertical } from 'lucide-react';
import type { Booking } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useI18n } from '@/i18n/I18nProvider';
import { getBookingStatusKey } from '@/i18n/domain';

export function BookingRow({
  booking,
  onEdit,
  onStatusChange,
  onCancel,
  onViewWorkOrder,
}: {
  booking: Booking;
  onEdit: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onCancel: (booking: Booking) => void;
  onViewWorkOrder: (id: string) => void;
}) {
  const { formatDate, t } = useI18n();
  const colors = {
    Pending: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
    Confirmed: 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
    Cancelled: 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]',
  };

  return (
    <article className={cn('grid min-h-[76px] grid-cols-[76px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-[border-color,background-color,box-shadow] hover:border-[var(--color-primary)]/35 hover:bg-[var(--color-surface-hover)]/35 md:grid-cols-[118px_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-center md:gap-4 md:px-4 md:py-3', booking.status === 'Cancelled' && 'bg-[var(--color-surface-elevated)]/40 opacity-75')}>
      <span className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-primary-muted)] px-2 py-1 text-center font-[var(--font-mono)] text-xs font-semibold text-[var(--color-primary)] sm:text-sm">
        <Clock3 className="hidden md:block" size={15} aria-hidden="true" />
        {formatDate(booking.scheduledAt, { hour: 'numeric', minute: '2-digit' })}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold">{booking.customer.fullName ?? booking.customer.phone}</p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">{booking.customer.phone}</p>
      </div>
      <div className="col-start-2 min-w-0 md:col-start-auto">
        <p className="plate truncate text-sm font-medium">{booking.vehicle?.plateNumber ?? t('common.states.vehiclePending')}</p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">{booking.vehicle ? `${booking.vehicle.make} ${booking.vehicle.model}` : t('bookings.vehiclePendingHelp')}</p>
      </div>
      <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-1.5 md:col-start-auto md:flex-nowrap md:gap-3">
        <span className="max-w-full truncate rounded-full bg-[var(--color-accent-muted)] px-2 py-1 text-[11px] text-[var(--color-accent)] sm:text-xs">
          {booking.serviceName}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] sm:text-xs ${colors[booking.status]}`}>{t(getBookingStatusKey(booking.status))}</span>
      </div>
      <div className="col-start-3 row-span-3 row-start-1 self-center md:col-start-auto md:row-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('bookings.actionsLabel')}>
              <MoreVertical size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {booking.status !== 'Cancelled' && <DropdownMenuItem onClick={() => onEdit(booking.id)}>{t('bookings.edit.action')}</DropdownMenuItem>}
            {booking.status === 'Pending' && <DropdownMenuItem onClick={() => onStatusChange(booking.id, 'Confirmed')}>{t('bookings.confirm')}</DropdownMenuItem>}
            {booking.status !== 'Cancelled' && <DropdownMenuItem onClick={() => onCancel(booking)}>{t('bookings.cancel')}</DropdownMenuItem>}
            <DropdownMenuItem disabled={!booking.workOrderId} onClick={() => booking.workOrderId && onViewWorkOrder(booking.workOrderId)}>{t('bookings.viewWorkOrder')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
