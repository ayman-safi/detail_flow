'use client';

import { MoreVertical } from 'lucide-react';
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
    <div className={cn('grid min-h-16 grid-cols-[92px_minmax(0,1fr)] items-center gap-3 border-b border-[var(--color-border)] px-2 py-3 md:grid-cols-[92px_minmax(0,1fr)_minmax(0,1fr)_auto_auto]', booking.status === 'Cancelled' && 'bg-[var(--color-surface-elevated)]/30')}>
      <span className="rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] px-2 py-1 text-center font-[var(--font-mono)] text-sm">
        {formatDate(booking.scheduledAt, { hour: 'numeric', minute: '2-digit' })}
      </span>
      <div>
        <p className="text-sm font-bold">{booking.customer.fullName ?? booking.customer.phone}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{booking.customer.phone}</p>
      </div>
      <div className="col-start-2 md:col-start-auto">
        <p className="plate text-sm">{booking.vehicle?.plateNumber ?? t('common.states.vehiclePending')}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{booking.vehicle ? `${booking.vehicle.make} ${booking.vehicle.model}` : t('bookings.vehiclePendingHelp')}</p>
      </div>
      <span className="col-start-2 w-fit rounded-full bg-[var(--color-accent-muted)] px-2 py-1 text-xs text-[var(--color-accent)] md:col-start-auto">
        {booking.serviceName}
      </span>
      <div className="col-start-2 flex items-center gap-2 md:col-start-auto">
        <span className={`rounded-full px-2 py-1 text-xs ${colors[booking.status]}`}>{t(getBookingStatusKey(booking.status))}</span>
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
    </div>
  );
}
