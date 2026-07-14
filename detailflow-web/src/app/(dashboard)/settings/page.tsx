'use client';

import { useEffect, useMemo, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { BadgeDollarSign, CalendarX, Check, Clock, Copy, GripVertical, MessageCircle, MoreVertical, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { usePlanStatus } from '@/hooks/usePlanStatus';
import { fallbackReceiptSettings, useReceiptSettings, useTenantCurrency } from '@/hooks/useTenantCurrency';
import { isUnlimitedLimit } from '@/lib/planLimits';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { DayOfWeek, NotificationEventType, NotificationLogEntry, ReceiptSettings, ServiceType, StaffMember, TenantCurrency, TenantSettings, WhatsAppSettings, WhatsAppTemplateSettings, WorkingDay } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlanUpgradePanel } from '@/components/plans/PlanUpgradePanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/i18n/I18nProvider';
import { getRoleKey } from '@/i18n/domain';

type TenantProfile = { name?: string; logoUrl?: string };
type LogoUploadResponse = { logoUrl: string };
const weekdays: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const whatsAppTemplateEventTypes: NotificationEventType[] = ['TrackingLink', 'ReadyForPickup', 'StaffInvite', 'PasswordReset'];

function defaultWhatsAppTemplates(): WhatsAppTemplateSettings[] {
  return whatsAppTemplateEventTypes.map((eventType) => ({
    eventType,
    templateName: '',
    languageCode: 'en_US',
  }));
}

function mergeWhatsAppTemplates(templates?: WhatsAppTemplateSettings[]) {
  const byType = new Map((templates ?? []).map((template) => [template.eventType, template]));
  return defaultWhatsAppTemplates().map((template) => ({
    ...template,
    ...(byType.get(template.eventType) ?? {}),
  }));
}

function timeInputValue(value?: string) {
  return value?.slice(0, 5) || '08:00';
}

function apiTimeValue(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function todayInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function defaultWorkingDay(day: DayOfWeek): WorkingDay {
  return {
    day,
    isOpen: day !== 'Friday',
    openTime: '08:00',
    closeTime: '20:00',
  };
}

function normalizeAvailabilitySettings(settings?: TenantSettings): TenantSettings {
  const byDay = new Map((settings?.workingDays ?? []).map((day) => [day.day, day]));
  return {
    bayCapacity: settings?.bayCapacity ?? 3,
    currency: settings?.currency ?? 'SAR',
    workingDays: weekdays.map((day) => {
      const value = byDay.get(day);
      return value
        ? { ...value, openTime: timeInputValue(value.openTime), closeTime: timeInputValue(value.closeTime) }
        : defaultWorkingDay(day);
    }),
    closurePeriods: settings?.closurePeriods ?? [],
  };
}

function serializeAvailabilitySettings(settings: TenantSettings): TenantSettings {
  return {
    bayCapacity: Math.max(1, Math.trunc(settings.bayCapacity || 1)),
    currency: settings.currency ?? 'SAR',
    workingDays: settings.workingDays.map((day) => ({
      ...day,
      openTime: apiTimeValue(day.openTime),
      closeTime: apiTimeValue(day.closeTime),
    })),
    closurePeriods: settings.closurePeriods.map((period) => ({
      from: period.from,
      to: period.to,
      reason: period.reason?.trim() || null,
    })),
  };
}

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <div className="p-4">
      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:inline-flex lg:w-auto">
          <TabsTrigger className="px-3 sm:px-4" value="profile">{t('settings.tabs.profile')}</TabsTrigger>
          <TabsTrigger className="px-3 sm:px-4" value="services">{t('settings.tabs.services')}</TabsTrigger>
          <TabsTrigger className="px-3 sm:px-4" value="availability">{t('settings.tabs.availability')}</TabsTrigger>
          <TabsTrigger className="px-3 sm:px-4" value="receipts">{t('settings.tabs.receipts')}</TabsTrigger>
          <TabsTrigger className="px-3 sm:px-4" value="staff">{t('settings.tabs.staff')}</TabsTrigger>
          <TabsTrigger className="px-3 sm:px-4" value="notifications">{t('settings.tabs.notifications')}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="services"><ServicesTab /></TabsContent>
        <TabsContent value="availability"><AvailabilityTab /></TabsContent>
        <TabsContent value="receipts"><ReceiptTab /></TabsContent>
        <TabsContent value="staff"><StaffTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function AvailabilityTab() {
  const user = useAuthStore((state) => state.user);
  const qc = useQueryClient();
  const { isRtl, t } = useI18n();
  const allowed = user?.role === 'Owner' || user?.role === 'Manager';
  const [draft, setDraft] = useState<TenantSettings | null>(null);

  const { data: settings, isLoading } = useQuery<TenantSettings>({
    queryKey: ['availability-settings'],
    enabled: allowed,
    queryFn: () => api.get<TenantSettings>('/settings/availability').then((response) => response.data),
  });
  const baseForm = useMemo(() => normalizeAvailabilitySettings(settings), [settings]);
  const form = draft ?? baseForm;

  if (!allowed) {
    return <Card className="p-5">{t('settings.availability.restricted')}</Card>;
  }

  const updateWorkingDay = (day: DayOfWeek, patch: Partial<WorkingDay>) => {
    setDraft((current) => {
      const source = current ?? form;
      return {
        ...source,
        workingDays: source.workingDays.map((workingDay) =>
        workingDay.day === day ? { ...workingDay, ...patch } : workingDay,
      ),
      };
    });
  };

  const updateClosure = (index: number, patch: Partial<TenantSettings['closurePeriods'][number]>) => {
    setDraft((current) => {
      const source = current ?? form;
      return {
        ...source,
        closurePeriods: source.closurePeriods.map((period, currentIndex) =>
        currentIndex === index ? { ...period, ...patch } : period,
      ),
      };
    });
  };

  const addClosure = () => {
    const today = todayInputValue();
    setDraft((current) => {
      const source = current ?? form;
      return {
        ...source,
        closurePeriods: [...source.closurePeriods, { from: today, to: today, reason: '' }],
      };
    });
  };

  const removeClosure = (index: number) => {
    setDraft((current) => {
      const source = current ?? form;
      return {
        ...source,
        closurePeriods: source.closurePeriods.filter((_, currentIndex) => currentIndex !== index),
      };
    });
  };

  const save = async () => {
    try {
      await api.put('/settings/availability', serializeAvailabilitySettings(form));
      toast.success(t('settings.availability.saved'));
      await qc.invalidateQueries({ queryKey: ['availability-settings'] });
      setDraft(null);
      qc.invalidateQueries({ queryKey: ['availability'] });
      qc.invalidateQueries({ queryKey: ['public-availability'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.availability.saveFailed')));
    }
  };

  const workingDays = form.workingDays;
  const closurePeriods = form.closurePeriods;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
      <Card className="p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
            <Clock size={20} />
          </div>
          <div>
            <h2 className="font-[var(--font-display)] text-xl font-semibold">{t('settings.availability.title')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('settings.availability.subtitle')}</p>
          </div>
        </div>

        <div className="mb-5 max-w-xs">
          <Label htmlFor="bay-capacity">{t('settings.availability.bayCapacity')}</Label>
          <Input
            id="bay-capacity"
            type="number"
            min={1}
            value={form.bayCapacity}
            disabled={isLoading}
            onChange={(event) => setDraft((current) => ({ ...(current ?? form), bayCapacity: Number(event.target.value) }))}
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('settings.availability.bayCapacityHint')}</p>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-medium">{t('settings.availability.weeklyHours')}</h3>
        </div>
        <div className="space-y-3">
          {workingDays.map((day) => (
            <div key={day.day} className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-3 md:grid-cols-[minmax(120px,1fr)_120px_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{t(`weekdays.${day.day}`)}</p>
                <span className="text-xs text-[var(--color-text-muted)] md:hidden">
                  {day.isOpen ? t('settings.availability.open') : t('settings.availability.closed')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  aria-label={t(`weekdays.${day.day}`)}
                  checked={day.isOpen}
                  disabled={isLoading}
                  onCheckedChange={(checked) => updateWorkingDay(day.day, { isOpen: checked })}
                />
                <span className="hidden text-sm text-[var(--color-text-muted)] md:inline">
                  {day.isOpen ? t('settings.availability.open') : t('settings.availability.closed')}
                </span>
              </div>
              <div>
                <Label>{t('settings.availability.opens')}</Label>
                <Input
                  type="time"
                  value={day.openTime}
                  disabled={isLoading || !day.isOpen}
                  onChange={(event) => updateWorkingDay(day.day, { openTime: event.target.value })}
                />
              </div>
              <div>
                <Label>{t('settings.availability.closes')}</Label>
                <Input
                  type="time"
                  value={day.closeTime}
                  disabled={isLoading || !day.isOpen}
                  onChange={(event) => updateWorkingDay(day.day, { closeTime: event.target.value })}
                />
              </div>
            </div>
          ))}
        </div>

        <Button className="mt-5 w-full sm:w-auto" onClick={save} disabled={isLoading}>
          {t('common.actions.save')}
        </Button>
      </Card>

      <Card className="p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
              <CalendarX size={20} />
            </div>
            <div>
              <h2 className="font-[var(--font-display)] text-xl font-semibold">{t('settings.availability.closures')}</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('settings.availability.closuresHint')}</p>
            </div>
          </div>
          <Button variant="secondary" size="icon" onClick={addClosure} disabled={isLoading} aria-label={t('settings.availability.addClosure')}>
            <Plus size={16} />
          </Button>
        </div>

        {closurePeriods.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]">{t('settings.availability.noClosures')}</p>
        ) : (
          <div className="space-y-3">
            {closurePeriods.map((period, index) => (
              <div key={`${period.from}-${period.to}-${index}`} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('settings.availability.from')}</Label>
                    <Input type="date" value={period.from} disabled={isLoading} onChange={(event) => updateClosure(index, { from: event.target.value })} />
                  </div>
                  <div>
                    <Label>{t('settings.availability.to')}</Label>
                    <Input type="date" value={period.to} disabled={isLoading} onChange={(event) => updateClosure(index, { to: event.target.value })} />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    aria-label={t('settings.availability.reason')}
                    placeholder={t('settings.availability.reasonPlaceholder')}
                    value={period.reason ?? ''}
                    disabled={isLoading}
                    onChange={(event) => updateClosure(index, { reason: event.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeClosure(index)}
                    disabled={isLoading}
                    aria-label={t('settings.availability.removeClosure')}
                    className={cn('shrink-0', isRtl && 'order-first')}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ReceiptTab() {
  const user = useAuthStore((state) => state.user);
  const qc = useQueryClient();
  const { formatCurrency, isRtl, t } = useI18n();
  const allowed = user?.role === 'Owner' || user?.role === 'Manager';
  const { data, isLoading } = useReceiptSettings();
  const settings = data ?? fallbackReceiptSettings;
  const [draftCurrency, setDraftCurrency] = useState<TenantCurrency | null>(null);
  const currency = draftCurrency ?? data?.currency ?? 'SAR';
  const selectClassName = cn(
    'h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)]',
    isRtl ? 'text-right' : 'text-left',
  );

  if (!allowed) {
    return <Card className="p-5">{t('settings.receipts.restricted')}</Card>;
  }

  const save = async () => {
    try {
      const { data: saved } = await api.put<ReceiptSettings>('/settings/receipt', { currency });
      setDraftCurrency(saved.currency);
      toast.success(t('settings.receipts.saved'));
      qc.invalidateQueries({ queryKey: ['receipt-settings'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.receipts.saveFailed')));
    }
  };

  return (
    <Card className="max-w-[680px] p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
          <BadgeDollarSign size={20} />
        </div>
        <div>
          <h2 className="font-[var(--font-display)] text-xl font-semibold">{t('settings.receipts.title')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('settings.receipts.subtitle')}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="receipt-currency">{t('settings.receipts.currency')}</Label>
          <select
            id="receipt-currency"
            className={selectClassName}
            value={currency}
            disabled={isLoading}
            onChange={(event) => setDraftCurrency(event.target.value as TenantCurrency)}
          >
            {settings.supportedCurrencies.map((option) => (
              <option key={option.currency} value={option.currency}>
                {option.symbol} - {t(`settings.receipts.currencyOptions.${option.currency}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('settings.receipts.currencyHint')}</p>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{t('settings.receipts.previewLabel')}</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(220, currency)}</p>
        </div>

        <Button onClick={save} disabled={isLoading}>{t('common.actions.save')}</Button>
      </div>
    </Card>
  );
}

function ProfileTab() {
  const qc = useQueryClient();
  const { data } = useQuery<TenantProfile>({ queryKey: ['tenant-profile'], queryFn: () => api.get<TenantProfile>('/tenant/profile').then((response) => response.data) });
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!data) return;
    setName(data.name ?? '');
    setLogoUrl(data.logoUrl ?? '');
  }, [data]);

  const save = async () => {
    await api.patch('/tenant/profile', {
      name,
      logoUrl,
    });
    toast.success(t('settings.profile.saved'));
    qc.invalidateQueries({ queryKey: ['tenant-profile'] });
  };

  const upload = async (file?: File) => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setUploadProgress(0);
    try {
      const { data: response } = await api.post<LogoUploadResponse>('/tenant/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      setLogoUrl(response.logoUrl);
      toast.success(t('settings.profile.uploaded'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('board.workOrder.uploadFailed')));
    } finally {
      setUploadProgress(null);
    }
  };
  const displayedLogoUrl = logoUrl || data?.logoUrl || '';

  return (
    <Card className="max-w-[680px] p-5">
      <h2 className="mb-4 font-[var(--font-display)] text-xl font-semibold">{t('settings.profile.title')}</h2>
      <div className="space-y-4">
        <div><Label htmlFor="shop-name">{t('common.labels.shopName')}</Label><Input id="shop-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div>
          <Label htmlFor="shop-logo">{t('common.labels.logo')}</Label>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
            {displayedLogoUrl && <img src={displayedLogoUrl} alt="" className="h-20 w-20 rounded-[var(--radius-md)] object-cover" />}
            <div className="flex-1">
              <Input id="shop-logo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])} />
              {uploadProgress !== null && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div className="h-full bg-[var(--color-primary)]" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </div>
          </div>
        </div>
        <Button onClick={save}>{t('common.actions.save')}</Button>
      </div>
    </Card>
  );
}

function ServicesTab() {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const { data: services = [] } = useQuery<ServiceType[]>({
    queryKey: ['services', 'manage'],
    queryFn: () => api.get<ServiceType[]>('/services', { params: { includeInactive: true } }).then((response) => response.data),
  });
  const [editing, setEditing] = useState<Partial<ServiceType> | null>(null);
  const { formatCurrency, isRtl, t } = useI18n();
  const currency = useTenantCurrency();

  const save = async () => {
    if (!editing?.name) return;
    if (editing.id) await api.patch(`/services/${editing.id}`, editing);
    else await api.post('/services', editing);
    setEditing(null);
    toast.success(t('settings.services.saved'));
    qc.invalidateQueries({ queryKey: ['services'] });
  };

  const patchService = async (id: string, payload: Partial<ServiceType>) => {
    await api.patch(`/services/${id}`, payload);
    qc.invalidateQueries({ queryKey: ['services'] });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = services.findIndex((service) => service.id === active.id);
    const newIndex = services.findIndex((service) => service.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const ordered = arrayMove(services, oldIndex, newIndex);
    await api.patch('/services/reorder', { orderedIds: ordered.map((service) => service.id) });
    toast.success(t('settings.services.reordered'));
    qc.invalidateQueries({ queryKey: ['services'] });
  };

  const rows = [...services, ...(editing && !editing.id ? [editing as ServiceType] : [])];

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-[var(--font-display)] text-xl font-semibold">{t('settings.services.title')}</h2>
        <Button className="w-full sm:w-auto" onClick={() => setEditing({ name: '', basePrice: 1, durationMinutes: 30, sortOrder: services.length + 1, isActive: true })}><Plus size={16} />{t('settings.services.add')}</Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={services.map((service) => service.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            <div className={cn('hidden grid-cols-[40px_minmax(0,1.6fr)_120px_120px_88px_48px] gap-3 px-3 text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)] md:grid', isRtl ? 'text-right' : 'text-left')}>
              <span />
              <span>{t('common.labels.name')}</span>
              <span>{t('common.labels.duration')}</span>
              <span>{t('common.labels.price')}</span>
              <span>{t('common.labels.status')}</span>
              <span />
            </div>
            {rows.map((service) => <ServiceItem key={service.id ?? 'new'} service={service} editing={editing} setEditing={setEditing} save={save} patchService={patchService} formatCurrency={(value) => formatCurrency(value, currency)} />)}
          </div>
        </SortableContext>
      </DndContext>
    </Card>
  );
}

function ServiceItem({
  service,
  editing,
  setEditing,
  save,
  patchService,
  formatCurrency,
}: {
  service: ServiceType;
  editing: Partial<ServiceType> | null;
  setEditing: React.Dispatch<React.SetStateAction<Partial<ServiceType> | null>>;
  save: () => Promise<void>;
  patchService: (id: string, payload: Partial<ServiceType>) => Promise<void>;
  formatCurrency: (value: number) => string;
}) {
  const sortable = useSortable({ id: service.id ?? 'new', disabled: !service.id });
  const isEditing = editing === service || editing?.id === service.id;
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const { t } = useI18n();

  return (
    <div ref={sortable.setNodeRef} style={style} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-3">
      {isEditing ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_120px_120px_auto] md:items-end">
          <div>
            <Label>{t('common.labels.name')}</Label>
            <Input value={editing?.name ?? ''} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))} />
          </div>
          <div>
            <Label>{t('common.labels.duration')}</Label>
            <Input type="number" value={editing?.durationMinutes ?? 0} onChange={(event) => setEditing((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} />
          </div>
          <div>
            <Label>{t('common.labels.price')}</Label>
            <Input type="number" value={editing?.basePrice ?? 0} onChange={(event) => setEditing((current) => ({ ...current, basePrice: Number(event.target.value) }))} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button size="icon" aria-label={t('common.actions.save')} onClick={save}><Check size={16} /></Button>
            <Button size="icon" variant="ghost" aria-label={t('common.actions.cancel')} onClick={() => setEditing(null)}><X size={16} /></Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[40px_minmax(0,1.6fr)_120px_120px_88px_48px] md:items-center">
          <div className="flex items-center justify-between md:justify-start">
            <button type="button" className="grid h-9 w-9 cursor-grab place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]" aria-label={t('board.help.dragToMove')} {...sortable.attributes} {...sortable.listeners}><GripVertical size={16} /></button>
            <span className="text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)] md:hidden">{service.sortOrder}</span>
          </div>
          <div className="min-w-0">
            <p className="font-medium">{service.name}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)] md:hidden">{t('common.units.minutesShort', { value: service.durationMinutes })} | {formatCurrency(service.basePrice)}</p>
          </div>
          <div className="hidden text-sm md:block">{t('common.units.minutesShort', { value: service.durationMinutes })}</div>
          <div className="hidden text-sm md:block">{formatCurrency(service.basePrice)}</div>
          <div className="flex items-center gap-2">
            <Switch checked={service.isActive} onCheckedChange={(checked) => patchService(service.id, { isActive: checked })} aria-label={t('settings.services.toggleAria', { name: service.name })} />
            <span className="text-xs text-[var(--color-text-muted)] md:hidden">{service.isActive ? t('common.states.active') : t('common.states.inactive')}</span>
          </div>
          <div className="flex justify-end">
            <Button size="icon" variant="ghost" aria-label={t('common.labels.actions')} onClick={() => setEditing(service)}><Pencil size={16} /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationsTab() {
  const user = useAuthStore((state) => state.user);
  const qc = useQueryClient();
  const { data: plan, isLoading: planLoading } = usePlanStatus();
  const [form, setForm] = useState({
    isEnabled: false,
    businessPhoneNumberId: '',
    accessToken: '',
    clearAccessToken: false,
    templates: defaultWhatsAppTemplates(),
    autoSendReady: false,
  });
  const { formatNumber, formatRelativeTime, t } = useI18n();
  const owner = user?.role === 'Owner';
  const whatsAppEnabled = plan?.whatsAppEnabled === true;

  const { data: settings, isLoading } = useQuery<WhatsAppSettings>({
    queryKey: ['whatsapp-settings'],
    enabled: owner && whatsAppEnabled,
    queryFn: () => api.get<WhatsAppSettings>('/notifications/whatsapp/settings').then((response) => response.data),
  });
  const { data: logs = [], refetch: refetchLogs } = useQuery<NotificationLogEntry[]>({
    queryKey: ['whatsapp-logs'],
    enabled: owner && whatsAppEnabled,
    queryFn: () => api.get<NotificationLogEntry[]>('/notifications/whatsapp/logs', { params: { limit: 25 } }).then((response) => response.data),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!settings) return;
    setForm({
      isEnabled: settings.isEnabled,
      businessPhoneNumberId: settings.businessPhoneNumberId,
      accessToken: '',
      clearAccessToken: false,
      templates: mergeWhatsAppTemplates(settings.templates),
      autoSendReady: settings.autoSendReady,
    });
  }, [settings]);

  if (!owner) {
    return <Card className="p-5">{t('settings.notifications.restricted')}</Card>;
  }

  if (!planLoading && plan?.whatsAppEnabled === false) {
    return <PlanUpgradePanel title={t('settings.notifications.lockedTitle')} description={t('settings.notifications.lockedDescription')} />;
  }

  const save = async () => {
    try {
      await api.patch('/notifications/whatsapp/settings', form);
      setForm((current) => ({ ...current, accessToken: '', clearAccessToken: false }));
      toast.success(t('settings.notifications.saved'));
      qc.invalidateQueries({ queryKey: ['whatsapp-settings'] });
      qc.invalidateQueries({ queryKey: ['whatsapp-logs'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.notifications.saveFailed')));
    }
  };

  const statusText = (status: NotificationLogEntry['status']) => {
    const key = `settings.notifications.statuses.${status}`;
    const translated = t(key);
    return translated === key ? status : translated;
  };

  const updateTemplate = (eventType: NotificationEventType, patch: Partial<WhatsAppTemplateSettings>) => {
    setForm((current) => ({
      ...current,
      templates: current.templates.map((template) =>
        template.eventType === eventType ? { ...template, ...patch } : template,
      ),
    }));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
      <Card className="p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
            <MessageCircle size={20} />
          </div>
          <div>
            <h2 className="font-[var(--font-display)] text-xl font-semibold">{t('settings.notifications.title')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('settings.notifications.subtitle')}</p>
          </div>
        </div>

        <div className="space-y-5">
          {plan && (
            <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">{t('settings.notifications.quotaUsed')}</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(plan.whatsAppMessagesUsed)} / {formatNumber(plan.whatsAppMessagesLimit)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">{t('settings.notifications.quotaRemaining')}</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(plan.whatsAppMessagesRemaining)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">{t('settings.notifications.quotaAddon')}</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(plan.whatsAppMessagesAddon)}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-4">
            <div>
              <p className="font-medium">{t('settings.notifications.enabled')}</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('settings.notifications.enabledHint')}</p>
            </div>
            <Switch aria-label={t('settings.notifications.enabled')} checked={form.isEnabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, isEnabled: checked }))} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t('settings.notifications.phoneNumberId')}</Label>
              <Input value={form.businessPhoneNumberId} onChange={(event) => setForm((current) => ({ ...current, businessPhoneNumberId: event.target.value }))} />
            </div>
            <div>
              <Label>{t('settings.notifications.accessToken')}</Label>
              <Input
                type="password"
                value={form.accessToken}
                disabled={form.clearAccessToken}
                placeholder={settings?.hasAccessToken ? t('settings.notifications.accessTokenStored') : ''}
                onChange={(event) => setForm((current) => ({ ...current, accessToken: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-3">
            {form.templates.map((template) => (
              <div key={template.eventType} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <div className="mb-3">
                  <p className="font-medium">{t(`settings.notifications.eventTypes.${template.eventType}`)}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t(`settings.notifications.eventHints.${template.eventType}`)}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>{t('settings.notifications.templateName')}</Label>
                    <Input value={template.templateName} onChange={(event) => updateTemplate(template.eventType, { templateName: event.target.value })} />
                  </div>
                  <div>
                    <Label>{t('settings.notifications.templateLanguage')}</Label>
                    <Input value={template.languageCode} onChange={(event) => updateTemplate(template.eventType, { languageCode: event.target.value })} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
              <div>
                <p className="font-medium">{t('settings.notifications.clearToken')}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('settings.notifications.clearTokenHint')}</p>
              </div>
              <Switch aria-label={t('settings.notifications.clearToken')} checked={form.clearAccessToken} onCheckedChange={(checked) => setForm((current) => ({ ...current, clearAccessToken: checked, accessToken: checked ? '' : current.accessToken }))} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
              <div>
                <p className="font-medium">{t('settings.notifications.autoReady')}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('settings.notifications.autoReadyHint')}</p>
              </div>
              <Switch aria-label={t('settings.notifications.autoReady')} checked={form.autoSendReady} onCheckedChange={(checked) => setForm((current) => ({ ...current, autoSendReady: checked }))} />
            </div>
          </div>

          <Button onClick={save} disabled={isLoading || planLoading}>{t('common.actions.save')}</Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[var(--font-display)] text-xl font-semibold">{t('settings.notifications.activityTitle')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('settings.notifications.activitySubtitle')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void refetchLogs()} aria-label={t('common.actions.retry')}>
            <RefreshCw size={16} />
          </Button>
        </div>

        {logs.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]">{t('settings.notifications.activityEmpty')}</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{log.eventType}</p>
                    <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{log.recipientPhone}</p>
                  </div>
                  <span className="rounded-full bg-[var(--color-primary-muted)] px-2 py-1 text-xs text-[var(--color-primary)]">
                    {statusText(log.status)}
                  </span>
                </div>
                {log.errorMessage && <p className="mt-2 text-xs text-[var(--color-destructive)]">{log.errorMessage}</p>}
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                  {t('settings.notifications.lastEvent', { time: formatRelativeTime(log.updatedAt) })}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StaffTab() {
  const user = useAuthStore((state) => state.user);
  const qc = useQueryClient();
  const { data: plan } = usePlanStatus();
  const { data: staff = [] } = useQuery<StaffMember[]>({ queryKey: ['staff'], enabled: user?.role !== 'Staff', queryFn: () => api.get<StaffMember[]>('/staff').then((response) => response.data) });
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState({ fullName: '', email: '', phone: '', role: 'Staff' as StaffMember['role'] });
  const [generatedInvite, setGeneratedInvite] = useState<{ link: string; expiresAt: string } | null>(null);
  const { formatDate, formatNumber, isRtl, t } = useI18n();
  const selectClassName = `h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)] aria-[invalid=true]:border-[var(--color-destructive)] ${isRtl ? 'text-right' : 'text-left'}`;

  type WhatsAppDelivery = { status: 'Requested'|'Accepted'|'Sent'|'Delivered'|'Read'|'Failed'; errorCode?: string; errorMessage?: string; providerMessageId?: string };
  type StaffCreateResponse = { user: StaffMember; inviteLink: string; inviteExpiresAt: string; whatsAppDelivery?: WhatsAppDelivery };
  type InviteLinkResponse = { inviteLink: string; inviteExpiresAt: string; whatsAppDelivery?: WhatsAppDelivery };
  type ResetLinkResponse = { resetLink: string; resetExpiresAt: string; whatsAppDelivery?: WhatsAppDelivery };

  const copyLink = async (link: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(successMessage);
    } catch {
      toast.error(t('settings.staff.copyFailed'));
    }
  };

  const showWhatsAppDelivery = (delivery?: WhatsAppDelivery) => {
    if (!delivery) return;
    if (delivery.status === 'Accepted') {
      toast.success(t('settings.staff.whatsAppAccepted'));
      return;
    }

    if (delivery.status === 'Failed') {
      toast.error(delivery.errorMessage || t('settings.staff.whatsAppFailed'));
    }
  };

  const create = async () => {
    try {
      const { data } = await api.post<StaffCreateResponse>('/staff', invite);
      setInvite({ fullName: '', email: '', phone: '', role: 'Staff' });
      setGeneratedInvite({ link: data.inviteLink, expiresAt: data.inviteExpiresAt });
      toast.success(t('settings.staff.added'));
      showWhatsAppDelivery(data.whatsAppDelivery);
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['plan-status'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.staff.addFailed')));
    }
  };

  const patchStaff = async (id: string, payload: Partial<StaffMember>) => {
    await api.patch(`/staff/${id}`, payload);
    toast.success(t('settings.staff.updated'));
    qc.invalidateQueries({ queryKey: ['staff'] });
  };

  const copyInviteLink = async (id: string) => {
    try {
      const { data } = await api.post<InviteLinkResponse>(`/staff/${id}/invite-link`);
      await copyLink(data.inviteLink, t('settings.staff.inviteCopied'));
      showWhatsAppDelivery(data.whatsAppDelivery);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.staff.inviteLinkFailed')));
    }
  };

  const copyResetLink = async (id: string) => {
    try {
      const { data } = await api.post<ResetLinkResponse>(`/staff/${id}/reset-link`);
      await copyLink(data.resetLink, t('settings.staff.resetCopied'));
      showWhatsAppDelivery(data.whatsAppDelivery);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.staff.resetLinkFailed')));
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setInvite({ fullName: '', email: '', phone: '', role: 'Staff' });
      setGeneratedInvite(null);
    }
  };

  const updatePhone = async (member: StaffMember) => {
    const phone = window.prompt(t('settings.staff.phonePrompt'), member.phone ?? '');
    if (phone === null) return;
    await patchStaff(member.id, { phone });
  };

  if (user?.role === 'Staff') return <Card className="p-5">{t('settings.staff.restricted')}</Card>;

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-[var(--font-display)] text-xl font-semibold">{t('settings.staff.title')}</h2>
          {plan && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {isUnlimitedLimit(plan.staffLimit)
                ? t('planStatus.staffUnlimited', { used: formatNumber(plan.staffUsed) })
                : t('planStatus.staffUsage', { used: formatNumber(plan.staffUsed), limit: formatNumber(plan.staffLimit) })}
            </p>
          )}
        </div>
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild><Button className="w-full sm:w-auto"><Plus size={16} />{t('settings.staff.invite')}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('settings.staff.inviteTitle')}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <Input aria-label={t('settings.staff.fullNamePlaceholder')} placeholder={t('settings.staff.fullNamePlaceholder')} value={invite.fullName} onChange={(event) => setInvite({ ...invite, fullName: event.target.value })} />
              <Input aria-label={t('settings.staff.emailPlaceholder')} placeholder={t('settings.staff.emailPlaceholder')} value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} />
              <Input aria-label={t('settings.staff.phonePlaceholder')} placeholder={t('settings.staff.phonePlaceholder')} value={invite.phone} onChange={(event) => setInvite({ ...invite, phone: event.target.value })} />
              <select aria-label={t('common.labels.role')} className={selectClassName} value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value as StaffMember['role'] })}>
                <option value="Staff">{t('roles.Staff')}</option>
                {user?.role === 'Owner' && <option value="Manager">{t('roles.Manager')}</option>}
                {user?.role === 'Owner' && <option value="Owner">{t('roles.Owner')}</option>}
              </select>
              <Button onClick={create}>{t('settings.staff.createUser')}</Button>
              {generatedInvite && (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-3">
                  <Label htmlFor="staff-invite-link">{t('settings.staff.inviteLinkLabel')}</Label>
                  <div className="mt-2 flex gap-2">
                    <Input id="staff-invite-link" readOnly value={generatedInvite.link} />
                    <Button size="icon" aria-label={t('settings.staff.copyInviteLink')} onClick={() => copyLink(generatedInvite.link, t('settings.staff.inviteCopied'))}>
                      <Copy size={16} />
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    {t('settings.staff.linkExpires', { date: formatDate(generatedInvite.expiresAt, { dateStyle: 'medium', timeStyle: 'short' }) })}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-3">
        <div className={cn('hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)_120px_90px_52px] gap-3 px-3 text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)] md:grid', isRtl ? 'text-right' : 'text-left')}>
          <span>{t('common.labels.name')}</span>
          <span>{t('common.labels.email')}</span>
          <span>{t('common.labels.phone')}</span>
          <span>{t('common.labels.role')}</span>
          <span>{t('common.labels.status')}</span>
          <span className={isRtl ? 'text-left' : 'text-right'}>{t('common.labels.actions')}</span>
        </div>
        {staff.map((member) => {
          const isSelf = member.id === user?.id;
          const managerBlocked = user?.role === 'Manager' && member.role === 'Owner';
          const canEditRole = user?.role === 'Owner' && !isSelf;
          const status = member.isInvitePending
            ? t('settings.staff.pendingInvite')
            : member.isActive ? t('common.states.active') : t('common.states.inactive');
          return (
            <div key={member.id} className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)_120px_90px_52px] md:items-center">
              <div className="min-w-0">
                <p className="font-medium">{member.fullName}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)] md:hidden">{member.email}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)] md:hidden">{member.phone || t('settings.staff.noPhone')}</p>
              </div>
              <div className="hidden min-w-0 text-sm text-[var(--color-text-secondary)] md:block">{member.email}</div>
              <div className="hidden min-w-0 text-sm text-[var(--color-text-secondary)] md:block">{member.phone || t('settings.staff.noPhone')}</div>
              <div><span className="rounded-full bg-[var(--color-primary-muted)] px-2 py-1 text-xs text-[var(--color-primary)]">{t(getRoleKey(member.role))}</span></div>
              <div className={cn('text-sm', member.isActive && !member.isInvitePending ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]')}>{status}</div>
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={t('common.labels.actions')}><MoreVertical size={16} /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {member.isInvitePending
                      ? <DropdownMenuItem disabled={!member.isActive} onClick={() => copyInviteLink(member.id)}>{t('settings.staff.copyInviteLink')}</DropdownMenuItem>
                      : <DropdownMenuItem disabled={!member.isActive} onClick={() => copyResetLink(member.id)}>{t('settings.staff.copyResetLink')}</DropdownMenuItem>}
                    <DropdownMenuItem disabled={!member.isActive} onClick={() => updatePhone(member)}>{t('settings.staff.updatePhone')}</DropdownMenuItem>
                    {canEditRole && member.role !== 'Staff' && <DropdownMenuItem onClick={() => patchStaff(member.id, { role: 'Staff' })}>{t('settings.staff.makeStaff')}</DropdownMenuItem>}
                    {canEditRole && member.role !== 'Manager' && <DropdownMenuItem onClick={() => patchStaff(member.id, { role: 'Manager' })}>{t('settings.staff.makeManager')}</DropdownMenuItem>}
                    <DropdownMenuItem disabled={isSelf || managerBlocked} onClick={() => patchStaff(member.id, { isActive: !member.isActive })}>{member.isActive ? t('settings.staff.deactivate') : t('settings.staff.activate')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
