'use client';

import { useEffect, useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api, { getApiErrorMessage } from '@/lib/api';
import { useTenantCurrency } from '@/hooks/useTenantCurrency';
import type { AvailabilitySlot, BookingCreateResult, ServiceType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CustomerSearchInput } from '@/components/customers/CustomerSearchInput';
import { useI18n } from '@/i18n/I18nProvider';
import { getVehicleTypeKey, vehicleTypes } from '@/i18n/domain';

const today = () => format(new Date(), 'yyyy-MM-dd');
const dateInputValue = (date?: Date | string) => date ? format(new Date(date), 'yyyy-MM-dd') : today();
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
const whatsappPhone = (phone: string) => phone.replace(/\D/g, '');

type BookingFormData = {
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

export function BookingForm({ initialDate }: { initialDate?: Date | string } = {}) {
  const [success, setSuccess] = useState<BookingCreateResult | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const formId = useId();
  const initialScheduledDate = dateInputValue(initialDate);
  const qc = useQueryClient();
  const { data: services = [] } = useQuery<ServiceType[]>({ queryKey: ['services'], queryFn: () => api.get<ServiceType[]>('/services').then((response) => response.data) });
  const { formatCurrency, isRtl, t } = useI18n();
  const currency = useTenantCurrency();
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
  } = useForm<BookingFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerPhone: '',
      customerName: '',
      serviceTypeId: '',
      scheduledDate: initialScheduledDate,
      scheduledTime: '',
      vehiclePlate: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleColor: '',
      vehicleType: 'Sedan',
      notes: '',
    },
  });

  const scheduledDate = watch('scheduledDate');
  const serviceTypeId = watch('serviceTypeId');
  const scheduledTime = watch('scheduledTime');
  const customerPhone = watch('customerPhone');
  const selectClassName = `h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)] aria-[invalid=true]:border-[var(--color-destructive)] ${isRtl ? 'text-right' : 'text-left'}`;

  const { data: slots = [], isLoading } = useQuery<AvailabilitySlot[]>({
    queryKey: ['availability', scheduledDate, serviceTypeId],
    enabled: !!scheduledDate && !!serviceTypeId,
    queryFn: () => api.get<AvailabilitySlot[]>('/bookings/availability', {
      params: { date: scheduledDate, serviceTypeId, timezoneOffsetMinutes: browserTimezoneOffset(scheduledDate) },
    }).then((response) => response.data),
  });

  useEffect(() => {
    setValue('scheduledDate', initialScheduledDate, { shouldValidate: true });
  }, [initialScheduledDate, setValue]);

  const onSubmit = async (values: BookingFormData) => {
    try {
      const scheduledAt = toLocalDateTimeOffset(values.scheduledDate, values.scheduledTime);
      const { data } = await api.post<BookingCreateResult>('/bookings', { ...values, scheduledAt });
      setSuccess(data);
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['board'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['plan-status'] });
      toast.success(t('bookings.form.confirmed'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('bookings.form.failed')));
    }
  };

  if (success) {
    const trackingUrl = `${location.origin}/track/${success.trackingToken}`;
    const whatsappUrl = `https://wa.me/${whatsappPhone(success.customer.phone)}?text=${encodeURIComponent(t('bookings.success.whatsAppTemplate', { url: trackingUrl }))}`;
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-[var(--color-success)]" />
        <h3 className="mt-3 font-[var(--font-display)] text-xl font-bold">{t('bookings.success.title')}</h3>
        <p className="mt-2 break-all text-sm text-[var(--color-text-muted)]">{trackingUrl}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button onClick={async () => { await navigator.clipboard.writeText(trackingUrl); toast.success(t('common.copySuccess')); }}>{t('common.actions.copyLink')}</Button>
          <a className="inline-flex h-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-sm" href={whatsappUrl} target="_blank" rel="noreferrer">{t('common.actions.whatsApp')}</a>
          <Button variant="secondary" onClick={() => { setSuccess(null); reset({ customerPhone: '', customerName: '', serviceTypeId: '', scheduledDate: initialScheduledDate, scheduledTime: '', vehiclePlate: '', vehicleMake: '', vehicleModel: '', vehicleColor: '', vehicleType: 'Sedan', notes: '' }); }}>{t('bookings.success.new')}</Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <Label htmlFor={`${formId}-customer-phone`}>{t('common.labels.phone')}</Label>
        <CustomerSearchInput
          value={customerPhone}
          inputProps={{
            id: `${formId}-customer-phone`,
            autoComplete: 'tel',
            'aria-invalid': !!errors.customerPhone,
            'aria-describedby': errors.customerPhone ? `${formId}-customer-phone-error` : undefined,
          }}
          onChange={(value) => setValue('customerPhone', value, { shouldValidate: true })}
          onSelect={(customer) => {
            setValue('customerPhone', customer.phone, { shouldValidate: true });
            setValue('customerName', customer.fullName ?? '', { shouldValidate: true });
          }}
        />
        {errors.customerPhone && <p id={`${formId}-customer-phone-error`} className="mt-1 text-xs text-[var(--color-destructive)]">{errors.customerPhone.message}</p>}
      </div>

      <div>
        <Label htmlFor={`${formId}-customer-name`}>{t('bookings.form.customerName')}</Label>
        <Input id={`${formId}-customer-name`} autoComplete="name" aria-invalid={!!errors.customerName} aria-describedby={errors.customerName ? `${formId}-customer-name-error` : undefined} {...register('customerName')} />
        {errors.customerName && <p id={`${formId}-customer-name-error`} className="mt-1 text-xs text-[var(--color-destructive)]">{errors.customerName.message}</p>}
      </div>

      <div>
        <Label htmlFor={`${formId}-service`}>{t('common.labels.service')}</Label>
        <select id={`${formId}-service`} className={selectClassName} aria-invalid={!!errors.serviceTypeId} aria-describedby={errors.serviceTypeId ? `${formId}-service-error` : undefined} {...register('serviceTypeId')}>
          <option value="">{t('bookings.form.servicePlaceholder')}</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} - {t('common.units.minutesShort', { value: service.durationMinutes })} - {formatCurrency(service.basePrice, currency)}
            </option>
          ))}
        </select>
        {errors.serviceTypeId && <p id={`${formId}-service-error`} className="mt-1 text-xs text-[var(--color-destructive)]">{errors.serviceTypeId.message}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${formId}-date`}>{t('common.labels.date')}</Label>
          <Input id={`${formId}-date`} type="date" min={today()} aria-invalid={!!errors.scheduledDate} aria-describedby={errors.scheduledDate ? `${formId}-date-error` : undefined} {...register('scheduledDate')} />
          {errors.scheduledDate && <p id={`${formId}-date-error`} className="mt-1 text-xs text-[var(--color-destructive)]">{errors.scheduledDate.message}</p>}
        </div>
        <div>
          <Label htmlFor={`${formId}-time`}>{t('common.labels.time')}</Label>
          <Input id={`${formId}-time`} value={scheduledTime} readOnly aria-invalid={!!errors.scheduledTime} aria-describedby={errors.scheduledTime ? `${formId}-time-error` : undefined} placeholder={t('bookings.form.timePlaceholder')} />
        </div>
      </div>
      {errors.scheduledTime && <p id={`${formId}-time-error`} className="text-xs text-[var(--color-destructive)]">{errors.scheduledTime.message}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {isLoading ? Array.from({ length: 8 }).map((_, index) => <div key={index} className="skeleton h-9" />) : slots.map((slot) => (
          <Button key={slot.time} type="button" size="sm" className="w-full" variant={scheduledTime === slot.time ? 'primary' : 'secondary'} disabled={!slot.available} onClick={() => setValue('scheduledTime', slot.time, { shouldValidate: true })}>
            {slot.time}
          </Button>
        ))}
        {!isLoading && slots.length === 0 && (
          <p className="col-span-full rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
            {serviceTypeId ? t('bookings.form.timePlaceholder') : t('bookings.form.servicePlaceholder')}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`${formId}-plate`}>{t('common.labels.plate')}</Label>
          <Input id={`${formId}-plate`} autoCapitalize="characters" aria-invalid={!!errors.vehiclePlate} aria-describedby={errors.vehiclePlate ? `${formId}-plate-error` : undefined} {...register('vehiclePlate')} onChange={(event) => setValue('vehiclePlate', event.target.value.toUpperCase(), { shouldValidate: true })} />
          {errors.vehiclePlate?.message && <p id={`${formId}-plate-error`} className="mt-1 text-xs text-[var(--color-destructive)]">{errors.vehiclePlate.message}</p>}
        </div>
        <div>
          <Label htmlFor={`${formId}-make`}>{t('common.labels.make')}</Label>
          <Input id={`${formId}-make`} aria-invalid={!!errors.vehicleMake} aria-describedby={errors.vehicleMake ? `${formId}-make-error` : undefined} {...register('vehicleMake')} />
          {errors.vehicleMake && <p id={`${formId}-make-error`} className="mt-1 text-xs text-[var(--color-destructive)]">{errors.vehicleMake.message}</p>}
        </div>
        <div>
          <Label htmlFor={`${formId}-model`}>{t('common.labels.model')}</Label>
          <Input id={`${formId}-model`} aria-invalid={!!errors.vehicleModel} aria-describedby={errors.vehicleModel ? `${formId}-model-error` : undefined} {...register('vehicleModel')} />
          {errors.vehicleModel && <p id={`${formId}-model-error`} className="mt-1 text-xs text-[var(--color-destructive)]">{errors.vehicleModel.message}</p>}
        </div>
        <div>
          <Label htmlFor={`${formId}-color`}>{t('common.labels.color')}</Label>
          <Input id={`${formId}-color`} aria-invalid={!!errors.vehicleColor} aria-describedby={errors.vehicleColor ? `${formId}-color-error` : undefined} {...register('vehicleColor')} />
          {errors.vehicleColor && <p id={`${formId}-color-error`} className="mt-1 text-xs text-[var(--color-destructive)]">{errors.vehicleColor.message}</p>}
        </div>
        <div>
          <Label htmlFor={`${formId}-type`}>{t('common.labels.type')}</Label>
          <select id={`${formId}-type`} className={selectClassName} {...register('vehicleType')}>
            {vehicleTypes.map((value) => <option key={value} value={value}>{t(getVehicleTypeKey(value))}</option>)}
          </select>
        </div>
      </div>

      {!notesOpen ? (
        <button type="button" className="text-sm text-[var(--color-primary)]" onClick={() => setNotesOpen(true)}>{t('common.actions.addNotes')}</button>
      ) : (
        <Textarea aria-label={t('common.labels.notes')} placeholder={t('bookings.form.notesPlaceholder')} {...register('notes')} />
      )}

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('common.actions.confirmBooking')}
      </Button>
    </form>
  );
}
