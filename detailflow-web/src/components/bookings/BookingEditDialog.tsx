'use client';

import { useEffect, useId, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api, { getApiErrorMessage } from '@/lib/api';
import { useTenantCurrency } from '@/hooks/useTenantCurrency';
import type { AvailabilitySlot, BookingDetail, ServiceType } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CustomerSearchInput } from '@/components/customers/CustomerSearchInput';
import { useI18n } from '@/i18n/I18nProvider';
import { getVehicleTypeKey, vehicleTypes } from '@/i18n/domain';

const today = () => format(new Date(), 'yyyy-MM-dd');
const browserTimezoneOffset = (date: string) => new Date(`${date}T00:00:00`).getTimezoneOffset();
const toLocalDateTimeOffset = (date: string, time: string) => {
  const localDate = new Date(`${date}T${time}:00`);
  const offsetMinutes = -localDate.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
  const minutes = String(absolute % 60).padStart(2, '0');
  return `${date}T${time}:00${sign}${hours}:${minutes}`;
};
const dateInputValue = (value: string) => format(new Date(value), 'yyyy-MM-dd');
const timeInputValue = (value: string) => format(new Date(value), 'HH:mm');

type BookingEditFormData = {
  customerPhone: string;
  customerName: string;
  serviceTypeId: string;
  scheduledDate: string;
  scheduledTime: string;
  vehiclePlate: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleType: (typeof vehicleTypes)[number];
  notes?: string;
};

export function BookingEditDialog({
  bookingId,
  open,
  onOpenChange,
  onSaved,
}: {
  bookingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const formId = useId();
  const { formatCurrency, isRtl, t } = useI18n();
  const currency = useTenantCurrency();
  const { data: services = [] } = useQuery<ServiceType[]>({
    queryKey: ['services'],
    queryFn: () => api.get<ServiceType[]>('/services').then((response) => response.data),
  });
  const { data: booking, isLoading: isBookingLoading } = useQuery<BookingDetail>({
    queryKey: ['booking', bookingId],
    enabled: open && !!bookingId,
    queryFn: () => api.get<BookingDetail>(`/bookings/${bookingId}`).then((response) => response.data),
  });

  const schema = z.object({
    customerPhone: z.string().min(7, t('bookings.form.validation.phone')),
    customerName: z.string().min(2, t('bookings.form.validation.name')),
    serviceTypeId: z.string().uuid(t('bookings.form.validation.service')),
    scheduledDate: z.string().min(1, t('bookings.form.validation.date')),
    scheduledTime: z.string().min(1, t('bookings.form.validation.time')),
    vehiclePlate: z.string().min(2).transform((value) => value.toUpperCase().trim()),
    vehicleMake: z.string().min(1, t('bookings.form.validation.make')),
    vehicleModel: z.string().min(1, t('bookings.form.validation.model')),
    vehicleColor: z.string().min(1, t('bookings.form.validation.color')),
    vehicleType: z.enum(vehicleTypes),
    notes: z.string().optional(),
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookingEditFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerPhone: '',
      customerName: '',
      serviceTypeId: '',
      scheduledDate: today(),
      scheduledTime: '',
      vehiclePlate: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleColor: '',
      vehicleType: 'Sedan',
      notes: '',
    },
  });

  useEffect(() => {
    if (!booking) return;
    reset({
      customerPhone: booking.customer.phone,
      customerName: booking.customer.fullName ?? '',
      serviceTypeId: booking.serviceType.id,
      scheduledDate: dateInputValue(booking.scheduledAt),
      scheduledTime: timeInputValue(booking.scheduledAt),
      vehiclePlate: booking.vehicle?.plateNumber ?? '',
      vehicleMake: booking.vehicle?.make ?? '',
      vehicleModel: booking.vehicle?.model ?? '',
      vehicleColor: booking.vehicle?.color ?? '',
      vehicleType: booking.vehicle?.vehicleType ?? 'Sedan',
      notes: booking.notes ?? '',
    });
  }, [booking, reset]);

  const scheduledDate = watch('scheduledDate');
  const serviceTypeId = watch('serviceTypeId');
  const scheduledTime = watch('scheduledTime');
  const customerPhone = watch('customerPhone');
  const selectClassName = `h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)] aria-[invalid=true]:border-[var(--color-destructive)] ${isRtl ? 'text-right' : 'text-left'}`;

  const { data: slots = [], isLoading: isSlotsLoading } = useQuery<AvailabilitySlot[]>({
    queryKey: ['availability', scheduledDate, serviceTypeId, 'edit', bookingId],
    enabled: open && !!scheduledDate && !!serviceTypeId,
    queryFn: () => api.get<AvailabilitySlot[]>('/bookings/availability', {
      params: { date: scheduledDate, serviceTypeId, timezoneOffsetMinutes: browserTimezoneOffset(scheduledDate) },
    }).then((response) => response.data),
  });
  const slotItems = useMemo(() => {
    if (!scheduledTime || slots.some((slot) => slot.time === scheduledTime)) return slots;
    return [...slots, { time: scheduledTime, available: true, bookingCount: 0 }]
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [scheduledTime, slots]);

  const onSubmit = async (values: BookingEditFormData) => {
    if (!bookingId) return;
    try {
      const scheduledAt = toLocalDateTimeOffset(values.scheduledDate, values.scheduledTime);
      await api.put(`/bookings/${bookingId}`, { ...values, scheduledAt });
      toast.success(t('bookings.edit.saved'));
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('bookings.edit.failed')));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="font-[var(--font-display)] text-xl font-semibold">{t('bookings.edit.title')}</DialogTitle>
        </DialogHeader>
        {isBookingLoading || !booking ? (
          <div className="grid min-h-40 place-items-center text-sm text-[var(--color-text-muted)]">{t('common.states.loading')}</div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`${formId}-customer-phone`}>{t('common.labels.phone')}</Label>
                <CustomerSearchInput
                  value={customerPhone}
                  inputProps={{
                    id: `${formId}-customer-phone`,
                    autoComplete: 'tel',
                    'aria-invalid': !!errors.customerPhone,
                  }}
                  onChange={(value) => setValue('customerPhone', value, { shouldValidate: true })}
                  onSelect={(customer) => {
                    setValue('customerPhone', customer.phone, { shouldValidate: true });
                    setValue('customerName', customer.fullName ?? '', { shouldValidate: true });
                  }}
                />
                {errors.customerPhone && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.customerPhone.message}</p>}
              </div>
              <div>
                <Label htmlFor={`${formId}-customer-name`}>{t('bookings.form.customerName')}</Label>
                <Input id={`${formId}-customer-name`} autoComplete="name" aria-invalid={!!errors.customerName} {...register('customerName')} />
                {errors.customerName && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.customerName.message}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor={`${formId}-service`}>{t('common.labels.service')}</Label>
              <select id={`${formId}-service`} className={selectClassName} aria-invalid={!!errors.serviceTypeId} {...register('serviceTypeId')}>
                <option value="">{t('bookings.form.servicePlaceholder')}</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {t('common.units.minutesShort', { value: service.durationMinutes })} - {formatCurrency(service.basePrice, currency)}
                  </option>
                ))}
              </select>
              {errors.serviceTypeId && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.serviceTypeId.message}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`${formId}-date`}>{t('common.labels.date')}</Label>
                <Input id={`${formId}-date`} type="date" min={today()} aria-invalid={!!errors.scheduledDate} {...register('scheduledDate')} />
                {errors.scheduledDate && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.scheduledDate.message}</p>}
              </div>
              <div>
                <Label htmlFor={`${formId}-time`}>{t('common.labels.time')}</Label>
                <Input id={`${formId}-time`} value={scheduledTime} readOnly aria-invalid={!!errors.scheduledTime} placeholder={t('bookings.form.timePlaceholder')} />
                {errors.scheduledTime && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.scheduledTime.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {isSlotsLoading ? Array.from({ length: 8 }).map((_, index) => <div key={index} className="skeleton h-9" />) : slotItems.map((slot) => {
                const selected = scheduledTime === slot.time;
                return (
                  <Button key={slot.time} type="button" size="sm" className="w-full" variant={selected ? 'primary' : 'secondary'} disabled={!slot.available && !selected} onClick={() => setValue('scheduledTime', slot.time, { shouldValidate: true })}>
                    {slot.time}
                  </Button>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor={`${formId}-plate`}>{t('common.labels.plate')}</Label>
                <Input id={`${formId}-plate`} autoCapitalize="characters" aria-invalid={!!errors.vehiclePlate} {...register('vehiclePlate')} onChange={(event) => setValue('vehiclePlate', event.target.value.toUpperCase(), { shouldValidate: true })} />
                {errors.vehiclePlate?.message && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.vehiclePlate.message}</p>}
              </div>
              <div>
                <Label htmlFor={`${formId}-make`}>{t('common.labels.make')}</Label>
                <Input id={`${formId}-make`} aria-invalid={!!errors.vehicleMake} {...register('vehicleMake')} />
                {errors.vehicleMake && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.vehicleMake.message}</p>}
              </div>
              <div>
                <Label htmlFor={`${formId}-model`}>{t('common.labels.model')}</Label>
                <Input id={`${formId}-model`} aria-invalid={!!errors.vehicleModel} {...register('vehicleModel')} />
                {errors.vehicleModel && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.vehicleModel.message}</p>}
              </div>
              <div>
                <Label htmlFor={`${formId}-color`}>{t('common.labels.color')}</Label>
                <Input id={`${formId}-color`} aria-invalid={!!errors.vehicleColor} {...register('vehicleColor')} />
                {errors.vehicleColor && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.vehicleColor.message}</p>}
              </div>
              <div>
                <Label htmlFor={`${formId}-type`}>{t('common.labels.type')}</Label>
                <select id={`${formId}-type`} className={selectClassName} {...register('vehicleType')}>
                  {vehicleTypes.map((value) => <option key={value} value={value}>{t(getVehicleTypeKey(value))}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor={`${formId}-notes`}>{t('common.labels.notes')}</Label>
              <Textarea id={`${formId}-notes`} placeholder={t('bookings.form.notesPlaceholder')} {...register('notes')} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.actions.cancel')}</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('bookings.edit.save')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
