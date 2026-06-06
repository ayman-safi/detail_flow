'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarDays, Car, CheckCircle2, Clock, Loader2, Phone, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';
import type { AvailabilitySlot, BookingCreateResult, ServiceType, TenantCurrency } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { useI18n } from '@/i18n/I18nProvider';
import { getVehicleTypeKey, vehicleTypes } from '@/i18n/domain';

type PublicShop = {
  name: string;
  slug: string;
  logoUrl?: string;
  currency?: TenantCurrency;
};

type PublicBookingForm = {
  customerName: string;
  customerPhone: string;
  serviceTypeId: string;
  scheduledDate: string;
  scheduledTime: string;
  vehiclePlate: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleType: (typeof vehicleTypes)[number];
  notes: string;
};

type ApiErrorBody = {
  error?: string;
  message?: string;
  title?: string;
  upgrade?: boolean;
};

const today = () => format(new Date(), 'yyyy-MM-dd');

const initialValues = (): PublicBookingForm => ({
  customerName: '',
  customerPhone: '',
  serviceTypeId: '',
  scheduledDate: today(),
  scheduledTime: '',
  vehiclePlate: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleColor: '',
  vehicleType: 'Sedan',
  notes: '',
});

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

const isSlotInFuture = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime() > Date.now();

const serviceCardThemes = [
  {
    card: 'border-sky-200 bg-sky-50 hover:border-sky-400 hover:bg-sky-100',
    selected: 'border-sky-500 bg-sky-100 shadow-[inset_0_0_0_1px_#0ea5e9]',
    title: 'text-sky-950',
    meta: 'text-sky-700',
    price: 'bg-sky-600 text-white',
  },
  {
    card: 'border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100',
    selected: 'border-emerald-500 bg-emerald-100 shadow-[inset_0_0_0_1px_#10b981]',
    title: 'text-emerald-950',
    meta: 'text-emerald-700',
    price: 'bg-emerald-600 text-white',
  },
  {
    card: 'border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100',
    selected: 'border-amber-500 bg-amber-100 shadow-[inset_0_0_0_1px_#f59e0b]',
    title: 'text-amber-950',
    meta: 'text-amber-800',
    price: 'bg-amber-500 text-white',
  },
  {
    card: 'border-rose-200 bg-rose-50 hover:border-rose-400 hover:bg-rose-100',
    selected: 'border-rose-500 bg-rose-100 shadow-[inset_0_0_0_1px_#f43f5e]',
    title: 'text-rose-950',
    meta: 'text-rose-700',
    price: 'bg-rose-600 text-white',
  },
  {
    card: 'border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100',
    selected: 'border-violet-500 bg-violet-100 shadow-[inset_0_0_0_1px_#8b5cf6]',
    title: 'text-violet-950',
    meta: 'text-violet-700',
    price: 'bg-violet-600 text-white',
  },
];

async function publicApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  let body: ApiErrorBody | T | null = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new Error(
      errorBody?.upgrade && errorBody.message
        ? errorBody.message
        : errorBody?.error ?? errorBody?.message ?? errorBody?.title ?? 'Request failed.',
    );
  }

  return body as T;
}

function normalizeTrackingUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${window.location.origin}${path}`;
}

export function PublicBookingPage({ tenantSlug }: { tenantSlug: string }) {
  const [values, setValues] = useState<PublicBookingForm>(initialValues);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookingCreateResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { formatCurrency, formatDate, isRtl, t } = useI18n();
  const encodedSlug = encodeURIComponent(tenantSlug);
  const basePath = `/public/shops/${encodedSlug}`;

  const shopQuery = useQuery({
    queryKey: ['public-shop', tenantSlug],
    queryFn: () => publicApi<PublicShop>(basePath),
    retry: false,
  });
  const servicesQuery = useQuery({
    queryKey: ['public-services', tenantSlug],
    queryFn: () => publicApi<ServiceType[]>(`${basePath}/services`),
    retry: false,
  });

  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const selectClassName = `h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)] ${isRtl ? 'text-right' : 'text-left'}`;

  useEffect(() => {
    if (!values.serviceTypeId && services.length > 0) {
      setValues((current) => ({ ...current, serviceTypeId: services[0].id }));
    }
  }, [services, values.serviceTypeId]);

  const slotsQuery = useQuery({
    queryKey: ['public-availability', tenantSlug, values.scheduledDate, values.serviceTypeId],
    enabled: Boolean(values.scheduledDate && values.serviceTypeId),
    queryFn: () => publicApi<AvailabilitySlot[]>(
      `${basePath}/availability?date=${values.scheduledDate}&serviceTypeId=${values.serviceTypeId}&timezoneOffsetMinutes=${browserTimezoneOffset(values.scheduledDate)}`,
    ),
    retry: false,
  });

  const availableSlots = useMemo(() => {
    return (slotsQuery.data ?? []).filter((slot) => slot.available && isSlotInFuture(values.scheduledDate, slot.time));
  }, [slotsQuery.data, values.scheduledDate]);

  useEffect(() => {
    if (values.scheduledTime && !availableSlots.some((slot) => slot.time === values.scheduledTime)) {
      setValues((current) => ({ ...current, scheduledTime: '' }));
    }
  }, [availableSlots, values.scheduledTime]);

  const updateField = <K extends keyof PublicBookingForm>(field: K, value: PublicBookingForm[K]) => {
    const normalizedValue = (field === 'vehiclePlate' ? value.toUpperCase() : value) as PublicBookingForm[K];
    setFormError(null);
    setValues((current) => ({
      ...current,
      [field]: normalizedValue,
      ...(field === 'serviceTypeId' || field === 'scheduledDate' ? { scheduledTime: '' } : {}),
    }));
  };

  const validate = () => {
    if (!values.serviceTypeId) return t('publicBooking.validation.service');
    if (!values.scheduledDate) return t('publicBooking.validation.date');
    if (!values.scheduledTime) return t('publicBooking.validation.time');
    if (values.customerName.trim().length < 2) return t('publicBooking.validation.name');
    if (values.customerPhone.replace(/\D/g, '').length < 7) return t('publicBooking.validation.phone');
    if (values.vehicleMake.trim().length < 1) return t('publicBooking.validation.make');
    if (values.vehicleModel.trim().length < 1) return t('publicBooking.validation.model');
    if (values.vehicleColor.trim().length < 1) return t('publicBooking.validation.color');
    if (values.vehiclePlate.trim().length < 2) return t('publicBooking.validation.plate');
    return null;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const scheduledAt = toLocalDateTimeOffset(values.scheduledDate, values.scheduledTime);
      const result = await publicApi<BookingCreateResult>(`${basePath}/bookings`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: values.customerName.trim(),
          customerPhone: values.customerPhone.trim(),
          vehiclePlate: values.vehiclePlate.trim(),
          vehicleMake: values.vehicleMake.trim(),
          vehicleModel: values.vehicleModel.trim(),
          vehicleColor: values.vehicleColor.trim(),
          vehicleType: values.vehicleType,
          serviceTypeId: values.serviceTypeId,
          scheduledAt,
          notes: values.notes.trim() || null,
        }),
      });
      setSuccess(result);
      toast.success(t('publicBooking.confirmation.toast'));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('publicBooking.validation.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (shopQuery.isLoading || servicesQuery.isLoading) {
    return (
      <main data-theme="light" className="min-h-screen bg-[var(--color-bg)] p-4 text-[var(--color-text)]">
        <div className="mx-auto max-w-[720px] space-y-4">
          <div className="skeleton h-16" />
          <div className="skeleton h-[560px]" />
        </div>
      </main>
    );
  }

  if (shopQuery.isError || !shopQuery.data) {
    return (
      <main data-theme="light" className="grid min-h-screen place-items-center bg-[var(--color-bg)] p-6 text-center text-[var(--color-text)]">
        <div>
          <Wrench className="mx-auto h-12 w-12 text-[var(--color-text-muted)]" />
          <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold">{t('publicBooking.notFound.title')}</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('publicBooking.notFound.description')}</p>
        </div>
      </main>
    );
  }

  const shop = shopQuery.data;
  const currency = shop.currency ?? 'SAR';
  const trackingUrl = success ? normalizeTrackingUrl(success.trackingUrl) : null;

  return (
    <main data-theme="light" className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[760px] flex-col px-4 py-5 sm:px-6 sm:py-8">
        <header className="flex items-center gap-3 pb-5">
          {shop.logoUrl ? (
            <img src={shop.logoUrl} alt={shop.name} className="h-12 w-12 rounded-[var(--radius-sm)] object-cover" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-white">
              <Wrench size={22} />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t('publicBooking.eyebrow')}</p>
            <h1 className="truncate font-[var(--font-display)] text-2xl font-bold">{shop.name}</h1>
          </div>
          <div className={cn(isRtl ? 'mr-auto' : 'ml-auto')}>
            <LocaleSwitcher compact />
          </div>
        </header>

        {success && trackingUrl ? (
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-7">
            <CheckCircle2 className="h-12 w-12 text-[var(--color-success)]" />
            <h2 className="mt-4 font-[var(--font-display)] text-2xl font-bold">{t('publicBooking.confirmation.title')}</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {t('publicBooking.confirmation.description')}
            </p>
            <a
              href={trackingUrl}
              className="mt-5 block break-all rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 text-sm text-[var(--color-primary)]"
            >
              {trackingUrl}
            </a>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(trackingUrl);
                  toast.success(t('publicBooking.confirmation.copyToast'));
                }}
              >
                {t('publicBooking.confirmation.copyLink')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSuccess(null);
                  setValues(initialValues());
                }}
              >
                {t('publicBooking.confirmation.bookAnother')}
              </Button>
            </div>
          </section>
        ) : (
          <form className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-7" onSubmit={submit}>
            <div className="grid gap-5">
              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                  <Wrench size={16} />
                  {t('common.labels.service')}
                </div>
                <p id="public-service-label" className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                  {t('publicBooking.service.choose')}
                </p>
                {services.length > 0 ? (
                  <div role="group" aria-labelledby="public-service-label" className="grid gap-2 sm:grid-cols-2">
                    {services.map((service, index) => {
                      const selected = service.id === values.serviceTypeId;
                      const theme = serviceCardThemes[index % serviceCardThemes.length];
                      return (
                        <button
                          key={service.id}
                          type="button"
                          aria-pressed={selected}
                          className={cn(
                            'min-h-[96px] rounded-[var(--radius-sm)] border p-3 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
                            isRtl && 'text-right',
                            selected ? theme.selected : theme.card,
                          )}
                          onClick={() => updateField('serviceTypeId', service.id)}
                        >
                          <span className={cn('block font-[var(--font-display)] text-sm font-bold', theme.title)}>{service.name}</span>
                          <span className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span className={cn('rounded-full px-2 py-1 font-semibold', theme.price)}>{formatCurrency(service.basePrice, currency)}</span>
                            <span className={cn('rounded-full bg-white/70 px-2 py-1 font-medium', theme.meta)}>{t('common.units.minutesShort', { value: service.durationMinutes })}</span>
                          </span>
                          {service.description && (
                            <span className={cn('mt-2 line-clamp-2 block text-xs', theme.meta)}>{service.description}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
                    {t('publicBooking.service.empty')}
                  </p>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                  <CalendarDays size={16} />
                  {t('publicBooking.schedule.title')}
                </div>
                <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                  <div>
                    <Label htmlFor="public-date">{t('common.labels.date')}</Label>
                    <Input
                      id="public-date"
                      type="date"
                      min={today()}
                      value={values.scheduledDate}
                      onChange={(event) => updateField('scheduledDate', event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t('publicBooking.schedule.availableSlots')}</Label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slotsQuery.isFetching ? (
                        Array.from({ length: 8 }).map((_, index) => <div key={index} className="skeleton h-10" />)
                      ) : availableSlots.length > 0 ? (
                        availableSlots.map((slot) => (
                          <Button
                            key={slot.time}
                            type="button"
                            size="sm"
                            variant={values.scheduledTime === slot.time ? 'primary' : 'secondary'}
                            className="h-10"
                            onClick={() => updateField('scheduledTime', slot.time)}
                          >
                            {slot.time}
                          </Button>
                        ))
                      ) : (
                        <p className="col-span-full rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
                          {values.serviceTypeId ? t('publicBooking.schedule.noSlots') : t('publicBooking.schedule.chooseServiceFirst')}
                        </p>
                      )}
                    </div>
                    {slotsQuery.isError && (
                      <p className="mt-2 text-xs text-[var(--color-destructive)]">{t('publicBooking.schedule.loadFailed')}</p>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                  <Phone size={16} />
                  {t('common.labels.customer')}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="public-name">{t('common.labels.name')}</Label>
                    <Input
                      id="public-name"
                      autoComplete="name"
                      value={values.customerName}
                      onChange={(event) => updateField('customerName', event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="public-phone">{t('publicBooking.customer.phone')}</Label>
                    <Input
                      id="public-phone"
                      autoComplete="tel"
                      inputMode="tel"
                      value={values.customerPhone}
                      onChange={(event) => updateField('customerPhone', event.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                  <Car size={16} />
                  {t('common.labels.vehicle')}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="public-make">{t('common.labels.make')}</Label>
                    <Input
                      id="public-make"
                      autoComplete="off"
                      value={values.vehicleMake}
                      onChange={(event) => updateField('vehicleMake', event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="public-model">{t('common.labels.model')}</Label>
                    <Input
                      id="public-model"
                      autoComplete="off"
                      value={values.vehicleModel}
                      onChange={(event) => updateField('vehicleModel', event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="public-plate">{t('common.labels.plate')}</Label>
                    <Input
                      id="public-plate"
                      autoCapitalize="characters"
                      className="plate"
                      value={values.vehiclePlate}
                      onChange={(event) => updateField('vehiclePlate', event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="public-color">{t('common.labels.color')}</Label>
                    <Input
                      id="public-color"
                      autoComplete="off"
                      value={values.vehicleColor}
                      onChange={(event) => updateField('vehicleColor', event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="public-type">{t('common.labels.type')}</Label>
                    <select
                      id="public-type"
                      className={selectClassName}
                      value={values.vehicleType}
                      onChange={(event) => updateField('vehicleType', event.target.value as PublicBookingForm['vehicleType'])}
                    >
                      {vehicleTypes.map((value) => (
                        <option key={value} value={value}>{t(getVehicleTypeKey(value))}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <Label htmlFor="public-notes">{t('common.labels.notes')}</Label>
                <Textarea
                  id="public-notes"
                  placeholder={t('publicBooking.notes.placeholder')}
                  value={values.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                />
              </section>

              {formError && (
                <p className="rounded-[var(--radius-sm)] bg-[var(--color-destructive-muted)] px-3 py-2 text-sm text-[var(--color-destructive)]">
                  {formError}
                </p>
              )}

              <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <Clock size={16} />
                  <span className="truncate">
                    {values.scheduledTime
                      ? t('publicBooking.schedule.summary', {
                        date: formatDate(new Date(`${values.scheduledDate}T${values.scheduledTime}:00`), { weekday: 'short', month: 'short', day: 'numeric' }),
                        time: values.scheduledTime,
                      })
                      : t('publicBooking.schedule.selectTime')}
                  </span>
                </div>
                <Button type="submit" className="h-11 sm:min-w-44" disabled={isSubmitting || services.length === 0}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('common.actions.confirmBooking')}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
