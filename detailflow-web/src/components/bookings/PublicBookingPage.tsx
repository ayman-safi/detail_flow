'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  UserRound,
  Wrench,
} from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from 'date-fns';
import toast from 'react-hot-toast';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';
import type { AvailabilitySlot, BookingCreateResult, ServiceType, TenantCurrency, VehicleType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { useI18n } from '@/i18n/I18nProvider';
import { getVehicleTypeKey, vehicleTypes } from '@/i18n/domain';

type PublicShop = { name: string; slug: string; logoUrl?: string; currency?: TenantCurrency };
type MonthDay = { date: string; status: 'available' | 'full' | 'closed' | 'past' };
type LookupVehicle = {
  id: string;
  maskedPlate: string;
  make: string;
  model: string;
  color: string;
  vehicleType: VehicleType;
};
type VehicleChoice = 'later' | 'existing' | 'new';
type NewVehicleDraft = { plateNumber: string; make: string; model: string; color: string; vehicleType: VehicleType };
type ApiErrorBody = { error?: string; message?: string; title?: string; upgrade?: boolean };

const emptyVehicleDraft = (): NewVehicleDraft => ({ plateNumber: '', make: '', model: '', color: '', vehicleType: 'Sedan' });

const browserTimezoneOffset = (date: string) => new Date(`${date}T00:00:00`).getTimezoneOffset();
const toLocalDateTimeOffset = (date: string, time: string) => {
  const localDate = new Date(`${date}T${time}:00`);
  const offsetMinutes = -localDate.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  return `${date}T${time}:00${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
};
const isFutureSlot = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime() > Date.now();

async function publicApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  let body: ApiErrorBody | T | null = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const error = body as ApiErrorBody | null;
    throw new Error(error?.message ?? error?.error ?? error?.title ?? 'Request failed.');
  }
  return body as T;
}

function normalizeTrackingUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${window.location.origin}${path}`;
}

export function PublicBookingPage({ tenantSlug }: { tenantSlug: string }) {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [phone, setPhone] = useState('');
  const [debouncedPhone, setDebouncedPhone] = useState('');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [vehicleChoice, setVehicleChoice] = useState<VehicleChoice>('later');
  const [newVehicle, setNewVehicle] = useState<NewVehicleDraft>(emptyVehicleDraft);
  const [success, setSuccess] = useState<BookingCreateResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const reduceMotion = useReducedMotion();
  const { formatCurrency, isRtl, t } = useI18n();
  const basePath = `/public/shops/${encodeURIComponent(tenantSlug)}`;

  useEffect(() => {
    const root = document.documentElement;
    const previousSurface = root.dataset.publicSurface;
    root.dataset.publicSurface = 'light';
    return () => {
      if (previousSurface) root.dataset.publicSurface = previousSurface;
      else delete root.dataset.publicSurface;
    };
  }, []);

  const shopQuery = useQuery({ queryKey: ['public-shop', tenantSlug], queryFn: () => publicApi<PublicShop>(basePath), retry: false });
  const servicesQuery = useQuery({ queryKey: ['public-services', tenantSlug], queryFn: () => publicApi<ServiceType[]>(`${basePath}/services`), retry: false });
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const selectedService = services.find((service) => service.id === serviceId);

  const monthKey = format(visibleMonth, 'yyyy-MM-01');
  const monthQuery = useQuery({
    queryKey: ['public-month-availability', tenantSlug, monthKey, serviceId],
    enabled: Boolean(serviceId),
    queryFn: () => publicApi<MonthDay[]>(`${basePath}/availability/month?month=${monthKey}&serviceTypeId=${serviceId}&timezoneOffsetMinutes=${browserTimezoneOffset(monthKey)}`),
    retry: false,
  });
  const monthStatus = useMemo(() => new Map((monthQuery.data ?? []).map((day) => [day.date, day.status])), [monthQuery.data]);

  const slotsQuery = useQuery({
    queryKey: ['public-availability', tenantSlug, selectedDate, serviceId],
    enabled: Boolean(selectedDate && serviceId),
    queryFn: () => publicApi<AvailabilitySlot[]>(`${basePath}/availability?date=${selectedDate}&serviceTypeId=${serviceId}&timezoneOffsetMinutes=${browserTimezoneOffset(selectedDate)}`),
    retry: false,
  });
  const slots = useMemo(
    () => (slotsQuery.data ?? []).filter((slot) => slot.available && isFutureSlot(selectedDate, slot.time)),
    [selectedDate, slotsQuery.data],
  );

  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    const timer = window.setTimeout(() => setDebouncedPhone(digits.length >= 7 ? phone : ''), 650);
    return () => window.clearTimeout(timer);
  }, [phone]);

  const lookupQuery = useQuery({
    queryKey: ['public-vehicle-lookup', tenantSlug, debouncedPhone],
    enabled: Boolean(debouncedPhone),
    queryFn: () => publicApi<{ vehicles: LookupVehicle[] }>(`${basePath}/vehicle-lookup`, {
      method: 'POST',
      body: JSON.stringify({ customerPhone: debouncedPhone }),
    }),
    retry: false,
  });
  const vehicles = lookupQuery.data?.vehicles ?? [];
  const selectedVehicle = vehicleChoice === 'existing'
    ? vehicles.find((vehicle) => vehicle.id === vehicleId)
    : vehicleChoice === 'new'
      ? { id: 'new', maskedPlate: newVehicle.plateNumber, ...newVehicle }
      : undefined;

  const hasValidTime = Boolean(selectedTime && slots.some((slot) => slot.time === selectedTime));
  const hasCompleteNewVehicle = Object.entries(newVehicle)
    .filter(([key]) => key !== 'vehicleType')
    .every(([, value]) => value.trim().length > 0);

  const selectService = (id: string) => {
    if (id !== serviceId) {
      setServiceId(id);
      setSelectedDate('');
      setSelectedTime('');
      setVisibleMonth(startOfMonth(new Date()));
    }
    setFormError(null);
  };

  const updatePhone = (value: string) => {
    setPhone(value);
    setVehicleId(null);
    setVehicleChoice('later');
    setNewVehicle(emptyVehicleDraft());
    setFormError(null);
  };

  const chooseVehicle = (choice: VehicleChoice, id: string | null = null) => {
    setVehicleChoice(choice);
    setVehicleId(choice === 'existing' ? id : null);
    setFormError(null);
  };

  const goNext = () => {
    if (step === 1 && !serviceId) return setFormError(t('publicBooking.validation.service'));
    if (step === 2 && (!selectedDate || !hasValidTime)) return setFormError(t('publicBooking.validation.time'));
    setFormError(null);
    setStep((current) => Math.min(3, current + 1));
  };

  const submit = async () => {
    if (phone.replace(/\D/g, '').length < 7) return setFormError(t('publicBooking.validation.phone'));
    if (vehicleChoice === 'new' && !hasCompleteNewVehicle) return setFormError(t('publicBooking.validation.vehicleDetails'));
    setIsSubmitting(true);
    setFormError(null);
    try {
      const result = await publicApi<BookingCreateResult>(`${basePath}/bookings`, {
        method: 'POST',
        body: JSON.stringify({
          customerPhone: phone,
          serviceTypeId: serviceId,
          scheduledAt: toLocalDateTimeOffset(selectedDate, selectedTime),
          existingVehicleId: vehicleChoice === 'existing' ? vehicleId : null,
          vehicle: vehicleChoice === 'new' ? newVehicle : null,
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

  if (shopQuery.isLoading || servicesQuery.isLoading) return <BookingLoading />;
  if (shopQuery.isError || !shopQuery.data) return <BookingNotFound />;

  const shop = shopQuery.data;
  const currency = shop.currency ?? 'SAR';
  const canContinue = step === 1
    ? Boolean(serviceId)
    : step === 2
      ? Boolean(selectedDate && hasValidTime)
      : phone.replace(/\D/g, '').length >= 7 && (vehicleChoice !== 'new' || hasCompleteNewVehicle);

  return (
    <main data-theme="light" className="min-h-[100svh] overflow-x-clip bg-[#f5f8fd] text-[#0f1d3a]">
      <div className="mx-auto min-h-[100svh] w-full max-w-[1240px] bg-white shadow-[0_24px_80px_rgba(31,75,150,0.08)] lg:my-5 lg:min-h-[calc(100svh-2.5rem)] lg:rounded-[26px] lg:border lg:border-[#e8eef8]">
        <BookingHeader shop={shop} />
        <div className="border-t border-[#e8eef8] px-4 pb-28 pt-5 sm:px-8 lg:px-9 lg:pb-8 lg:pt-7">
          <Stepper current={success ? 3 : step} complete={Boolean(success)} />

          {success ? (
            <SuccessPanel result={success} onReset={() => {
              setStep(1); setServiceId(''); setSelectedDate(''); setSelectedTime(''); setPhone(''); setVehicleId(null); setVehicleChoice('later'); setNewVehicle(emptyVehicleDraft()); setSuccess(null);
            }} />
          ) : (
            <div className="mt-7 grid gap-7 lg:grid-cols-[268px_minmax(0,1fr)] lg:items-start">
              <BookingSummary shopName={shop.name} service={selectedService} date={selectedDate} time={selectedTime} vehicle={selectedVehicle} currency={currency} />
              <section className="min-w-0">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={step}
                    initial={reduceMotion ? false : { opacity: 0, x: isRtl ? -18 : 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: isRtl ? 18 : -18 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    {step === 1 && <ServiceStep services={services} selectedId={serviceId} currency={currency} onSelect={selectService} />}
                    {step === 2 && (
                      <ScheduleStep
                        visibleMonth={visibleMonth}
                        selectedDate={selectedDate}
                        selectedTime={selectedTime}
                        monthStatus={monthStatus}
                        monthLoading={monthQuery.isFetching}
                        slots={slots}
                        slotsLoading={slotsQuery.isFetching}
                        service={selectedService}
                        currency={currency}
                        onMonthChange={setVisibleMonth}
                        onDateChange={(date) => { setSelectedDate(date); setSelectedTime(''); setFormError(null); }}
                        onTimeChange={(time) => { setSelectedTime(time); setFormError(null); }}
                      />
                    )}
                    {step === 3 && (
                      <ConfirmStep
                        phone={phone}
                        onPhoneChange={updatePhone}
                        lookupLoading={lookupQuery.isFetching}
                        lookupDone={Boolean(debouncedPhone && !lookupQuery.isFetching)}
                        lookupError={lookupQuery.isError}
                        vehicles={vehicles}
                        selectedVehicleId={vehicleId}
                        vehicleChoice={vehicleChoice}
                        newVehicle={newVehicle}
                        onVehicleChoice={chooseVehicle}
                        onNewVehicleChange={(field, value) => setNewVehicle((current) => ({ ...current, [field]: value } as NewVehicleDraft))}
                        service={selectedService}
                        date={selectedDate}
                        time={selectedTime}
                        currency={currency}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {formError && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>}
                <div className="mt-7 hidden items-center gap-3 border-t border-[#e8eef8] pt-5 lg:flex">
                  {step > 1 && <Button variant="ghost" className="h-12 px-5" onClick={() => { setStep(step - 1); setFormError(null); }}>{isRtl ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}{t('common.actions.back')}</Button>}
                  <Button className="ms-auto h-12 min-w-56 rounded-xl bg-[#1268ee] text-base" disabled={!canContinue || isSubmitting} onClick={step === 3 ? submit : goNext}>
                    {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                    {step === 3 ? t('common.actions.confirmBooking') : t('publicBooking.actions.continue')}
                    {!isSubmitting && (isRtl ? <ArrowLeft size={18} /> : <ArrowRight size={18} />)}
                  </Button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      <TrustStrip />

      {!success && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#dce6f5] bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(20,54,110,0.12)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-[760px] items-center gap-3">
            {step > 1 && <Button size="icon" variant="secondary" className="h-12 w-12 shrink-0 rounded-xl" onClick={() => { setStep(step - 1); setFormError(null); }} aria-label={t('common.actions.back')}>{isRtl ? <ArrowRight /> : <ArrowLeft />}</Button>}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#6d7b98]">{t('common.labels.total')}</p>
              <p className="truncate font-bold text-[#1268ee]">{selectedService ? formatCurrency(selectedService.basePrice, currency) : '—'}</p>
            </div>
            <Button className="h-12 min-w-[164px] rounded-xl bg-[#1268ee]" disabled={!canContinue || isSubmitting} onClick={step === 3 ? submit : goNext}>
              {isSubmitting && <Loader2 size={17} className="animate-spin" />}
              {step === 3 ? t('common.actions.confirmBooking') : t('publicBooking.actions.continue')}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function BookingHeader({ shop }: { shop: PublicShop }) {
  const { t } = useI18n();
  return (
    <header className="grid min-h-[76px] grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 px-4 py-3 sm:min-h-[88px] sm:grid-cols-[1fr_auto_1fr] sm:px-8 lg:px-9">
      <div className="hidden justify-self-start sm:block"><LocaleSwitcher compact /></div>
      <details className="group relative justify-self-start sm:hidden">
        <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border border-[#dfe7f3] bg-white text-[#526582] [&::-webkit-details-marker]:hidden" aria-label={t('publicBooking.header.languages')}><Menu size={20} /></summary>
        <div className="absolute start-0 top-12 z-50 rounded-xl border border-[#dfe7f3] bg-white p-2 shadow-[0_16px_40px_rgba(31,75,150,.18)]"><LocaleSwitcher compact /></div>
      </details>

      <div className="min-w-0 text-center">
        <h1 className="truncate text-[15px] font-bold sm:text-lg">{shop.name}</h1>
        <p className="truncate text-[10px] text-[#7b89a5] sm:text-xs">{t('publicBooking.header.subtitle')}</p>
      </div>

      <div className="hidden justify-self-end sm:flex sm:items-center sm:gap-2 sm:text-xs sm:text-[#53627f]"><span className="text-end"><strong className="block font-semibold text-[#263858]">{t('publicBooking.header.secure')}</strong><small className="text-[10px] text-[#8a97ad]">{t('publicBooking.header.guarantee')}</small></span><ShieldCheck className="text-[#1268ee]" size={28} /></div>
      {shop.logoUrl ? <img src={shop.logoUrl} alt="" className="h-10 w-10 justify-self-end rounded-xl object-cover sm:hidden" /> : <span className="grid h-10 w-10 justify-self-end place-items-center rounded-lg bg-[#13213c] text-xs font-bold text-white sm:hidden">{shop.name.slice(0, 2).toUpperCase()}</span>}
    </header>
  );
}

function Stepper({ current, complete }: { current: number; complete: boolean }) {
  const { t } = useI18n();
  const labels = [t('publicBooking.steps.service'), t('publicBooking.steps.schedule'), t('publicBooking.steps.confirm')];
  return <nav aria-label={t('publicBooking.steps.label')} className="mx-auto flex max-w-[820px] items-start px-1 sm:px-5">
    {labels.map((label, index) => {
      const number = index + 1;
      const active = number === current;
      const done = complete || number < current;
      return <div key={label} className="flex min-w-0 flex-1 items-start last:flex-none">
        <div className="flex w-[76px] flex-col items-center sm:w-32">
          <span className={cn('grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition sm:h-9 sm:w-9 sm:text-sm', active ? 'border-[#1268ee] bg-[#1268ee] text-white shadow-[0_6px_18px_rgba(18,104,238,.28)]' : done ? 'border-[#1268ee] bg-[#eef5ff] text-[#1268ee]' : 'border-[#d8e2f1] bg-white text-[#73819b]')}>{done ? <Check size={16} /> : number}</span>
          <span className={cn('mt-2 text-center text-[10px] leading-4 sm:text-xs', active ? 'font-semibold text-[#1268ee]' : 'text-[#65738f]')}>{label}</span>
        </div>
        {number < 3 && <span className={cn('mt-4 h-px flex-1 border-t border-dashed sm:mt-[18px]', number < current || complete ? 'border-[#7fb0f7]' : 'border-[#cdd9ea]')} />}
      </div>;
    })}
  </nav>;
}

function ServiceStep({ services, selectedId, currency, onSelect }: { services: ServiceType[]; selectedId: string; currency: TenantCurrency; onSelect: (id: string) => void }) {
  const { formatCurrency, t } = useI18n();
  return <div>
    <StepHeading icon={<Sparkles />} title={t('publicBooking.service.title')} subtitle={t('publicBooking.service.subtitle')} />
    {services.length === 0 ? <EmptyMessage text={t('publicBooking.service.empty')} /> : (
      <div role="radiogroup" aria-label={t('publicBooking.service.choose')} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => {
          const selected = service.id === selectedId;
          return <motion.button
            layout
            key={service.id}
            type="button"
            role="radio"
            aria-checked={selected}
            whileTap={{ scale: 0.985 }}
            onClick={() => onSelect(service.id)}
            className={cn('group relative grid min-h-[126px] grid-cols-[108px_minmax(0,1fr)] overflow-hidden rounded-xl border bg-white text-start transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1268ee] sm:block sm:min-h-0 sm:rounded-2xl', selected ? 'border-[#1268ee] bg-[#f8fbff] shadow-[0_10px_32px_rgba(18,104,238,.14)]' : 'border-[#dfe7f3] hover:border-[#9fc3f8] hover:shadow-lg')}
          >
            <div className="relative h-full min-h-[126px] overflow-hidden bg-[#edf3fb] sm:h-36 sm:min-h-0">
              {service.imageUrl ? <img src={service.imageUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_70%_28%,#fff_0,transparent_27%),linear-gradient(145deg,#dceaff,#f5f9ff)]"><span className="grid h-12 w-12 place-items-center rounded-full border border-white/80 bg-white/85 text-[#6fa6f4] shadow-sm"><Wrench size={25} /></span></div>}
              {selected && <span className="absolute end-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-[#1268ee] text-white shadow"><Check size={16} /></span>}
              {service.imageUrl && <span className="absolute bottom-3 start-1/2 hidden h-10 w-10 -translate-x-1/2 place-items-center rounded-full border border-[#dce7f6] bg-white/95 text-[#1268ee] shadow-sm sm:grid"><Wrench size={19} /></span>}
            </div>
            <div className="flex min-w-0 flex-col justify-center p-3.5 sm:block sm:p-4 sm:pt-6">
              <h3 className="truncate font-bold text-[#152547] sm:text-center">{service.name}</h3>
              {service.description && <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-5 text-[#71809c] sm:text-center">{service.description}</p>}
              <div className="mt-2 flex items-center justify-between border-t border-[#edf1f7] pt-2 text-xs sm:mt-3 sm:pt-3">
                <span className="flex items-center gap-1 text-[#71809c]"><Clock3 size={14} />{t('common.units.minutesShort', { value: service.durationMinutes })}</span>
                <span className="rounded-lg bg-[#edf4ff] px-2 py-1 font-bold text-[#1268ee]">{formatCurrency(service.basePrice, currency)}</span>
              </div>
            </div>
          </motion.button>;
        })}
      </div>
    )}
  </div>;
}

function ScheduleStep(props: {
  visibleMonth: Date; selectedDate: string; selectedTime: string; monthStatus: Map<string, MonthDay['status']>;
  monthLoading: boolean; slots: AvailabilitySlot[]; slotsLoading: boolean; onMonthChange: (date: Date) => void;
  onDateChange: (date: string) => void; onTimeChange: (time: string) => void;
  service?: ServiceType; currency: TenantCurrency;
}) {
  const { formatCurrency, formatDate, locale, t } = useI18n();
  const days = eachDayOfInterval({ start: startOfMonth(props.visibleMonth), end: endOfMonth(props.visibleMonth) });
  const leading = getDay(startOfMonth(props.visibleMonth));
  const weekdays = Array.from({ length: 7 }, (_, index) => formatDate(new Date(2026, 7, 2 + index), { weekday: 'short' }));
  return <div className="mx-auto w-full max-w-[760px]">
    <StepHeading icon={<CalendarDays />} title={t('publicBooking.schedule.chooseTitle')} subtitle={t('publicBooking.schedule.chooseSubtitle')} />
    {props.service && <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#dfe7f3] bg-[#fbfdff] p-3 lg:hidden">
      <span className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#eaf2fd]">{props.service.imageUrl ? <img src={props.service.imageUrl} alt="" className="h-full w-full object-cover" /> : <Wrench size={22} className="text-[#78aaf0]" />}</span>
      <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{props.service.name}</strong><small className="mt-1 flex items-center gap-1 text-[#71809c]"><Clock3 size={13} />{t('common.units.minutesShort', { value: props.service.durationMinutes })}</small></span>
      <strong className="text-sm text-[#1268ee]">{formatCurrency(props.service.basePrice, props.currency)}</strong>
    </div>}
    <div className="mt-5 rounded-2xl border border-[#dfe7f3] bg-white p-3.5 sm:p-5">
      <div className="flex items-center justify-between">
        <Button size="icon" variant="ghost" aria-label={t('publicBooking.schedule.previousMonth')} disabled={isSameMonth(props.visibleMonth, new Date())} onClick={() => props.onMonthChange(addMonths(props.visibleMonth, -1))}><ChevronLeft className={locale === 'ar' ? 'rotate-180' : ''} /></Button>
        <h3 className="font-bold capitalize">{formatDate(props.visibleMonth, { month: 'long', year: 'numeric' })}</h3>
        <Button size="icon" variant="ghost" aria-label={t('publicBooking.schedule.nextMonth')} onClick={() => props.onMonthChange(addMonths(props.visibleMonth, 1))}><ChevronRight className={locale === 'ar' ? 'rotate-180' : ''} /></Button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-[#7b89a5] sm:text-xs">{weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-1.5">
        {Array.from({ length: leading }).map((_, index) => <span key={`empty-${index}`} />)}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const status = props.monthStatus.get(key);
          const enabled = status === 'available';
          const selected = props.selectedDate === key;
          return <button key={key} type="button" disabled={!enabled || props.monthLoading} aria-pressed={selected} onClick={() => props.onDateChange(key)} className={cn('relative h-9 rounded-lg text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1268ee] sm:h-10 sm:text-sm', selected ? 'bg-[#1268ee] font-bold text-white shadow-[0_7px_18px_rgba(18,104,238,.28)]' : enabled ? 'bg-[#f7faff] text-[#263858] hover:bg-[#eaf3ff]' : 'text-[#b7c0d0] disabled:cursor-not-allowed', isSameDay(day, new Date()) && !selected && 'ring-1 ring-[#94baf3]')}>{formatDate(day, { day: 'numeric' })}{enabled && !selected && <i className="absolute bottom-1 start-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-400" />}</button>;
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 border-t border-[#edf1f7] pt-4 text-[11px] text-[#71809c]"><Legend color="bg-emerald-400" text={t('publicBooking.schedule.available')} /><Legend color="bg-[#c7d0de]" text={t('publicBooking.schedule.unavailable')} /><Legend color="bg-[#1268ee]" text={t('publicBooking.schedule.selected')} /></div>
      <div className="mt-4 border-t border-[#edf1f7] pt-4">
        <h4 className="flex items-center gap-2 font-semibold"><Clock3 size={18} className="text-[#1268ee]" />{t('publicBooking.schedule.availableSlots')}</h4>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {props.slotsLoading ? Array.from({ length: 8 }).map((_, index) => <span key={index} className="skeleton h-10" />) : !props.selectedDate ? <p className="col-span-full text-sm text-[#71809c]">{t('publicBooking.schedule.chooseDate')}</p> : props.slots.length === 0 ? <p className="col-span-full text-sm text-[#71809c]">{t('publicBooking.schedule.noSlots')}</p> : props.slots.map((slot) => <button key={slot.time} type="button" onClick={() => props.onTimeChange(slot.time)} className={cn('h-10 rounded-lg border text-sm font-medium transition', props.selectedTime === slot.time ? 'border-[#1268ee] bg-[#1268ee] text-white shadow' : 'border-[#dce5f2] bg-white text-[#334463] hover:border-[#8db6f2]')}>{slot.time}</button>)}
        </div>
      </div>
    </div>
  </div>;
}

function ConfirmStep(props: {
  phone: string; onPhoneChange: (value: string) => void; lookupLoading: boolean; lookupDone: boolean; lookupError: boolean;
  vehicles: LookupVehicle[]; selectedVehicleId: string | null; vehicleChoice: VehicleChoice; newVehicle: NewVehicleDraft;
  onVehicleChoice: (choice: VehicleChoice, id?: string | null) => void;
  onNewVehicleChange: (field: keyof NewVehicleDraft, value: string) => void;
  service?: ServiceType; date: string; time: string; currency: TenantCurrency;
}) {
  const { formatCurrency, formatDate, t } = useI18n();
  return <div>
    <StepHeading icon={<ShieldCheck />} title={t('publicBooking.confirm.title')} subtitle={t('publicBooking.confirm.subtitle')} />
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-[#dfe7f3] p-5">
        <h3 className="flex items-center gap-2 font-bold"><Phone size={18} className="text-[#1268ee]" />{t('publicBooking.confirm.phoneTitle')}</h3>
        <p className="mt-1 text-xs text-[#71809c]">{t('publicBooking.confirm.phoneHelp')}</p>
        <Input className="mt-4 h-12 text-base" type="tel" inputMode="tel" autoComplete="tel" value={props.phone} onChange={(event) => props.onPhoneChange(event.target.value)} placeholder={t('publicBooking.confirm.phonePlaceholder')} aria-label={t('publicBooking.customer.phone')} />
        {props.lookupLoading && <p className="mt-3 flex items-center gap-2 text-xs text-[#71809c]"><Loader2 size={14} className="animate-spin" />{t('publicBooking.confirm.lookingUp')}</p>}
        {props.lookupError && <p className="mt-3 text-xs text-red-600">{t('publicBooking.confirm.lookupFailed')}</p>}
        {props.lookupDone && !props.lookupError && props.vehicles.length === 0 && <p className="mt-3 rounded-lg bg-[#f6f9fd] p-3 text-xs text-[#71809c]">{t('publicBooking.confirm.noVehicles')}</p>}
      </section>
      <section className="rounded-2xl border border-[#dfe7f3] p-5">
        <h3 className="flex items-center gap-2 font-bold"><Car size={18} className="text-[#1268ee]" />{t('publicBooking.confirm.vehicleTitle')} <span className="text-xs font-normal text-[#8a97ad]">{t('publicBooking.confirm.optional')}</span></h3>
        <p className="mt-1 text-xs text-[#71809c]">{t('publicBooking.confirm.vehicleHelp')}</p>
        <div className="mt-4 space-y-2">
          {props.vehicles.map((vehicle) => {
            const selected = props.vehicleChoice === 'existing' && props.selectedVehicleId === vehicle.id;
            return <button key={vehicle.id} type="button" aria-pressed={selected} onClick={() => props.onVehicleChoice(selected ? 'later' : 'existing', selected ? null : vehicle.id)} className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-start transition', selected ? 'border-[#1268ee] bg-[#f0f6ff]' : 'border-[#e1e8f3] hover:border-[#9bbff5]')}><span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#1268ee]"><Car size={20} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{vehicle.make} {vehicle.model}</strong><span className="text-xs text-[#71809c]">{vehicle.maskedPlate} · {vehicle.color}</span></span>{selected && <CheckCircle2 size={20} className="text-[#1268ee]" />}</button>;
          })}
          <button type="button" aria-pressed={props.vehicleChoice === 'new'} className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-start text-sm transition', props.vehicleChoice === 'new' ? 'border-[#1268ee] bg-[#f0f6ff] text-[#1268ee]' : 'border-[#e1e8f3] text-[#40516e] hover:border-[#9bbff5]')} onClick={() => props.onVehicleChoice('new')}><span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-[#1268ee]"><Car size={18} /></span><span className="flex-1"><strong className="block">{t('publicBooking.confirm.addNew')}</strong><small className="mt-0.5 block font-normal text-[#71809c]">{t('publicBooking.confirm.addNewHelp')}</small></span>{props.vehicleChoice === 'new' && <CheckCircle2 size={19} />}</button>
          <button type="button" aria-pressed={props.vehicleChoice === 'later'} className={cn('w-full rounded-xl border p-3 text-start text-sm transition', props.vehicleChoice === 'later' ? 'border-[#1268ee] bg-[#f0f6ff] text-[#1268ee]' : 'border-[#e1e8f3] text-[#71809c] hover:border-[#9bbff5]')} onClick={() => props.onVehicleChoice('later')}>{t('publicBooking.confirm.addLater')}</button>
        </div>
      </section>
    </div>
    <AnimatePresence initial={false}>
      {props.vehicleChoice === 'new' && <motion.section key="new-vehicle" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
        <div className="mt-4 rounded-2xl border border-[#b9d3f8] bg-[#f8fbff] p-5">
          <h3 className="flex items-center gap-2 font-bold"><Car size={18} className="text-[#1268ee]" />{t('publicBooking.confirm.newVehicleTitle')}</h3>
          <p className="mt-1 text-xs text-[#71809c]">{t('publicBooking.confirm.newVehicleHelp')}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <VehicleField label={t('common.labels.plate')}><Input className="h-11 uppercase" value={props.newVehicle.plateNumber} onChange={(event) => props.onNewVehicleChange('plateNumber', event.target.value)} autoComplete="off" /></VehicleField>
            <VehicleField label={t('common.labels.make')}><Input className="h-11" value={props.newVehicle.make} onChange={(event) => props.onNewVehicleChange('make', event.target.value)} autoComplete="off" /></VehicleField>
            <VehicleField label={t('common.labels.model')}><Input className="h-11" value={props.newVehicle.model} onChange={(event) => props.onNewVehicleChange('model', event.target.value)} autoComplete="off" /></VehicleField>
            <VehicleField label={t('common.labels.color')}><Input className="h-11" value={props.newVehicle.color} onChange={(event) => props.onNewVehicleChange('color', event.target.value)} autoComplete="off" /></VehicleField>
            <VehicleField label={t('common.labels.type')}><select className="h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1268ee]" value={props.newVehicle.vehicleType} onChange={(event) => props.onNewVehicleChange('vehicleType', event.target.value)}>{vehicleTypes.map((type) => <option key={type} value={type}>{t(getVehicleTypeKey(type))}</option>)}</select></VehicleField>
          </div>
        </div>
      </motion.section>}
    </AnimatePresence>
    <section className="mt-4 rounded-2xl border border-[#dfe7f3] bg-[#fbfdff] p-5">
      <h3 className="font-bold">{t('publicBooking.confirm.review')}</h3>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3"><ReviewItem label={t('common.labels.service')} value={props.service?.name ?? '—'} /><ReviewItem label={t('common.labels.date')} value={props.date ? formatDate(new Date(`${props.date}T12:00:00`), { weekday: 'short', month: 'long', day: 'numeric' }) : '—'} /><ReviewItem label={t('common.labels.time')} value={props.time || '—'} /></div>
      <div className="mt-4 flex items-center justify-between border-t border-[#e4ebf5] pt-4"><span className="text-[#71809c]">{t('common.labels.total')}</span><strong className="text-lg text-[#1268ee]">{props.service ? formatCurrency(props.service.basePrice, props.currency) : '—'}</strong></div>
    </section>
  </div>;
}

function BookingSummary({ shopName, service, date, time, vehicle, currency }: { shopName: string; service?: ServiceType; date: string; time: string; vehicle?: LookupVehicle; currency: TenantCurrency }) {
  const { formatCurrency, formatDate, t } = useI18n();
  return <aside className="sticky top-5 hidden rounded-xl border border-[#dfe7f3] bg-[#fbfdff] p-4 shadow-[0_8px_28px_rgba(31,75,150,.05)] lg:block">
    <h2 className="flex items-center justify-between font-bold"><span>{t('publicBooking.summary.title')}</span><CalendarDays size={18} className="text-[#1268ee]" /></h2>
    <div className="mt-4 overflow-hidden rounded-xl border border-[#e4ebf5] bg-white">
      <div className="h-24 bg-[#eef4fc]">{service?.imageUrl ? <img src={service.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_65%_20%,#fff,transparent_30%),linear-gradient(145deg,#e3edfb,#f8fbff)]"><Car className="text-[#aec2df]" size={48} /></div>}</div>
      <div className="p-3.5"><p className="font-bold">{service?.name ?? t('publicBooking.summary.noService')}</p>{service?.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#71809c]">{service.description}</p>}</div>
    </div>
    <div className="mt-4 divide-y divide-[#edf1f7] border-y border-[#edf1f7] text-sm">
      <SummaryRow icon={<Clock3 />} label={t('common.labels.duration')} value={service ? t('common.units.minutesShort', { value: service.durationMinutes }) : '—'} />
      <SummaryRow icon={<CalendarDays />} label={t('common.labels.date')} value={date ? formatDate(new Date(`${date}T12:00:00`), { weekday: 'short', month: 'short', day: 'numeric' }) : '—'} />
      <SummaryRow icon={<Clock3 />} label={t('common.labels.time')} value={time || '—'} />
      <SummaryRow icon={<MapPin />} label={t('publicBooking.summary.location')} value={shopName} />
      <SummaryRow icon={<Car />} label={t('common.labels.vehicle')} value={vehicle ? `${vehicle.make} ${vehicle.model}` : t('publicBooking.summary.vehicleLater')} />
    </div>
    <div className="flex items-center justify-between border-b border-[#edf1f7] py-4 text-sm"><span className="text-[#71809c]">{t('common.labels.total')}</span><strong className="text-base text-[#1268ee]">{service ? formatCurrency(service.basePrice, currency) : formatCurrency(0, currency)}</strong></div>
    <div className="mt-4 rounded-xl bg-[#eef5ff] p-3.5 text-xs leading-5 text-[#536985]"><ShieldCheck className="mb-1.5 text-[#1268ee]" size={21} />{t('publicBooking.summary.guarantee')}</div>
    <div className="mt-3 space-y-2 px-1 text-[11px] text-[#71809c]"><p className="flex gap-2"><CheckCircle2 size={15} className="shrink-0 text-[#1268ee]" />{t('publicBooking.summary.professional')}</p><p className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-[#1268ee]" />{t('publicBooking.summary.safe')}</p></div>
  </aside>;
}

function TrustStrip() {
  const { t } = useI18n();
  const items = [
    { icon: <ThumbsUp />, title: t('publicBooking.trust.easyTitle'), body: t('publicBooking.trust.easyBody') },
    { icon: <UserRound />, title: t('publicBooking.trust.teamTitle'), body: t('publicBooking.trust.teamBody') },
    { icon: <Clock3 />, title: t('publicBooking.trust.flexibleTitle'), body: t('publicBooking.trust.flexibleBody') },
    { icon: <ShieldCheck />, title: t('publicBooking.trust.qualityTitle'), body: t('publicBooking.trust.qualityBody') },
  ];
  return <section aria-label={t('publicBooking.trust.label')} className="mx-auto hidden max-w-[1140px] grid-cols-4 divide-x divide-[#dfe7f3] px-6 py-7 lg:grid rtl:divide-x-reverse">
    {items.map((item) => <div key={item.title} className="flex items-start justify-center gap-3 px-6"><span className="text-[#1268ee] [&>svg]:h-8 [&>svg]:w-8">{item.icon}</span><span><strong className="block text-sm text-[#263858]">{item.title}</strong><small className="mt-1 block max-w-44 text-[11px] leading-4 text-[#71809c]">{item.body}</small></span></div>)}
  </section>;
}

function SuccessPanel({ result, onReset }: { result: BookingCreateResult; onReset: () => void }) {
  const { t } = useI18n();
  const url = normalizeTrackingUrl(result.trackingUrl);
  return <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-10 max-w-xl rounded-3xl border border-[#dce7f6] bg-white p-6 text-center shadow-[0_18px_50px_rgba(25,74,145,.12)] sm:p-10">
    <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={34} /></span>
    <h2 className="mt-5 text-2xl font-bold">{t('publicBooking.confirmation.title')}</h2><p className="mt-2 text-sm text-[#71809c]">{t('publicBooking.confirmation.description')}</p>
    <a href={url} className="mt-6 block break-all rounded-xl bg-[#f4f8fe] p-3 text-sm font-medium text-[#1268ee]">{url}</a>
    <div className="mt-5 grid gap-2 sm:grid-cols-2"><Button className="h-11" onClick={async () => { await navigator.clipboard.writeText(url); toast.success(t('publicBooking.confirmation.copyToast')); }}>{t('publicBooking.confirmation.copyLink')}</Button><Button className="h-11" variant="secondary" onClick={onReset}>{t('publicBooking.confirmation.bookAnother')}</Button></div>
  </motion.section>;
}

function StepHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) { return <div><h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl"><span className="text-[#1268ee]">{icon}</span>{title}</h2><p className="mt-2 text-sm text-[#71809c]">{subtitle}</p></div>; }
function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3 py-3"><span className="text-[#7f96b6] [&>svg]:h-[17px] [&>svg]:w-[17px]">{icon}</span><span className="min-w-0 flex-1"><small className="block text-[10px] text-[#8a97ad]">{label}</small><strong className="block truncate text-xs font-medium text-[#263858]">{value}</strong></span></div>; }
function ReviewItem({ label, value }: { label: string; value: string }) { return <div><span className="text-xs text-[#8a97ad]">{label}</span><strong className="mt-1 block text-[#263858]">{value}</strong></div>; }
function VehicleField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-xs font-medium text-[#52627e]"><span className="mb-2 block">{label}</span>{children}</label>; }
function Legend({ color, text }: { color: string; text: string }) { return <span className="flex items-center gap-1.5"><i className={cn('h-2 w-2 rounded-full', color)} />{text}</span>; }
function EmptyMessage({ text }: { text: string }) { return <p className="mt-6 rounded-2xl border border-dashed border-[#ccd9eb] p-8 text-center text-sm text-[#71809c]">{text}</p>; }
function BookingLoading() { return <main data-theme="light" className="min-h-screen bg-[#f5f8fd] p-4"><div className="mx-auto max-w-[1180px] space-y-4"><div className="skeleton h-20" /><div className="skeleton h-[620px]" /></div></main>; }
function BookingNotFound() { const { t } = useI18n(); return <main data-theme="light" className="grid min-h-screen place-items-center bg-[#f5f8fd] p-6 text-center"><div><Wrench className="mx-auto text-[#8ba2c3]" size={48} /><h1 className="mt-4 text-2xl font-bold">{t('publicBooking.notFound.title')}</h1><p className="mt-2 text-sm text-[#71809c]">{t('publicBooking.notFound.description')}</p></div></main>; }
