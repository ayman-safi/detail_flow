'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertCircle, BadgeDollarSign, Building2, CalendarX, Check, ChevronLeft, ChevronRight, Clock, Copy, GripVertical, ImagePlus, Languages, MessageCircle, MoreVertical, Pencil, Plus, ReceiptText, RefreshCw, Trash2, Users, Wrench, X } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { usePlanStatus } from '@/hooks/usePlanStatus';
import { fallbackReceiptSettings, useReceiptSettings, useTenantCurrency } from '@/hooks/useTenantCurrency';
import { isUnlimitedLimit } from '@/lib/planLimits';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser, DashboardLanguageSettings, DayOfWeek, NotificationEventType, NotificationLogEntry, ReceiptSettings, ServiceType, StaffMember, TenantCurrency, TenantSettings, WhatsAppSettings, WhatsAppTemplateSettings, WorkingDay } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlanUpgradePanel } from '@/components/plans/PlanUpgradePanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/i18n/I18nProvider';
import { getRoleKey } from '@/i18n/domain';
import { supportedLocales, type AppLocale } from '@/i18n/config';

type TenantProfile = { name?: string; logoUrl?: string };
type LogoUploadResponse = { logoUrl: string };
const weekdays: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const whatsAppTemplateEventTypes: NotificationEventType[] = ['TrackingLink', 'ReadyForPickup', 'StaffInvite', 'PasswordReset'];
const serviceDesktopGrid = 'md:grid-cols-[40px_minmax(0,1.6fr)_120px_120px_100px_96px]';

function SettingsSectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--color-border-subtle)] px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="font-[var(--font-display)] text-xl font-semibold leading-tight">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>}
        </div>
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
    </div>
  );
}

function SettingsFormActions({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end border-t border-[var(--color-border-subtle)] px-4 py-4 sm:px-6">{children}</div>;
}

function SettingsState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-8 text-center" role={onRetry ? 'alert' : 'status'}>
      <AlertCircle size={20} className="text-[var(--color-text-muted)]" aria-hidden="true" />
      <p className="max-w-md text-sm text-[var(--color-text-muted)]">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}><RefreshCw size={15} />{t('common.actions.retry')}</Button>}
    </div>
  );
}

function StatusBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  const tones = {
    neutral: 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]',
    success: 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
    danger: 'bg-[var(--color-destructive-muted)] text-[var(--color-destructive)]',
    info: 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]',
  };
  return <span className={cn('inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-medium leading-none', tones[tone])}>{children}</span>;
}

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
  const { isRtl, t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const canManageDashboardLanguage = user?.role === 'Owner' || user?.role === 'Manager';
  const [activeTab, setActiveTab] = useState('profile');
  const tabsRef = useRef<HTMLDivElement>(null);
  const settingsTabs = [
    { value: 'profile', label: t('settings.tabs.profile') },
    ...(canManageDashboardLanguage ? [{ value: 'language', label: t('settings.tabs.language') }] : []),
    { value: 'services', label: t('settings.tabs.services') },
    { value: 'availability', label: t('settings.tabs.availability') },
    { value: 'receipts', label: t('settings.tabs.receipts') },
    { value: 'staff', label: t('settings.tabs.staff') },
    { value: 'notifications', label: t('settings.tabs.notifications') },
  ];
  const activeTabIndex = settingsTabs.findIndex((tab) => tab.value === activeTab);
  const previousTab = activeTabIndex > 0 ? settingsTabs[activeTabIndex - 1] : undefined;
  const nextTab = activeTabIndex < settingsTabs.length - 1 ? settingsTabs[activeTabIndex + 1] : undefined;

  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[data-state="active"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-5 lg:px-6 lg:py-6">
      <div className="mb-5">
        <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">{t('navigation.settings')}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">{t('settings.description')}</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="-mx-2 flex items-center gap-1 sm:mx-0 sm:block">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-10 shrink-0 sm:hidden"
            disabled={!previousTab}
            onClick={() => previousTab && setActiveTab(previousTab.value)}
            aria-label={previousTab ? `${t('common.actions.previous')}: ${previousTab.label}` : t('common.actions.previous')}
          >
            {isRtl ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
          </Button>
          <div ref={tabsRef} className="min-w-0 flex-1 overflow-hidden">
            <TabsList aria-label={t('navigation.settings')} className="flex w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-[var(--radius-md)] p-1 sm:w-fit">
              {settingsTabs.map((tab) => (
                <TabsTrigger key={tab.value} className="h-11 shrink-0 px-4" value={tab.value}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-10 shrink-0 sm:hidden"
            disabled={!nextTab}
            onClick={() => nextTab && setActiveTab(nextTab.value)}
            aria-label={nextTab ? `${t('common.actions.next')}: ${nextTab.label}` : t('common.actions.next')}
          >
            {isRtl ? <ChevronLeft size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
          </Button>
        </div>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        {canManageDashboardLanguage && <TabsContent value="language"><DashboardLanguageTab /></TabsContent>}
        <TabsContent value="services"><ServicesTab /></TabsContent>
        <TabsContent value="availability"><AvailabilityTab /></TabsContent>
        <TabsContent value="receipts"><ReceiptTab /></TabsContent>
        <TabsContent value="staff"><StaffTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
      </Tabs>
    </main>
  );
}

function DashboardLanguageTab() {
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const qc = useQueryClient();
  const { isRtl, t } = useI18n();
  const allowed = user?.role === 'Owner' || user?.role === 'Manager';
  const [draftLocale, setDraftLocale] = useState<AppLocale | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery<DashboardLanguageSettings>({
    queryKey: ['dashboard-language'],
    enabled: allowed,
    queryFn: () => api.get<DashboardLanguageSettings>('/settings/dashboard-language').then((response) => response.data),
  });
  const dashboardLocale = draftLocale ?? data?.dashboardLocale ?? user?.dashboardLocale ?? 'en';
  const locales = data?.supportedLocales ?? supportedLocales;
  const selectClassName = cn(
    'h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)]',
    isRtl ? 'text-right' : 'text-left',
  );

  if (!allowed) return null;

  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const { data: saved } = await api.patch<DashboardLanguageSettings>('/settings/dashboard-language', { dashboardLocale });
      qc.setQueryData(['dashboard-language'], saved);
      setDraftLocale(null);
      if (user) {
        const updatedUser = { ...user, dashboardLocale: saved.dashboardLocale };
        setAuth(updatedUser);
        qc.setQueryData<AuthUser>(['auth', 'me', user.id], (current) => current ? { ...current, dashboardLocale: saved.dashboardLocale } : updatedUser);
      }
      toast.success(t('settings.language.saved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.language.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <Card className="p-4 sm:p-6" aria-busy="true"><SettingsState message={t('common.states.loading')} /></Card>;
  if (isError) return <Card className="p-4 sm:p-6"><SettingsState message={t('settings.language.loadFailed')} onRetry={() => void refetch()} /></Card>;

  return (
    <Card className="max-w-[760px] overflow-hidden">
      <SettingsSectionHeader icon={Languages} title={t('settings.language.title')} description={t('settings.language.subtitle')} />
      <div className="px-4 py-5 sm:px-6">
        <div className="max-w-sm">
          <Label htmlFor="dashboard-language">{t('settings.language.label')}</Label>
          <select
            id="dashboard-language"
            className={selectClassName}
            value={dashboardLocale}
            disabled={isSaving}
            onChange={(event) => setDraftLocale(event.target.value as AppLocale)}
          >
            {locales.map((locale) => <option key={locale} value={locale}>{t(`common.locales.${locale}`)}</option>)}
          </select>
          <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{t('settings.language.hint')}</p>
        </div>
      </div>
      <SettingsFormActions>
        <Button className="w-full sm:w-auto" onClick={save} disabled={isSaving || dashboardLocale === data?.dashboardLocale} aria-busy={isSaving}>
          {t('common.actions.save')}
        </Button>
      </SettingsFormActions>
    </Card>
  );
}

function AvailabilityTab() {
  const user = useAuthStore((state) => state.user);
  const qc = useQueryClient();
  const { isRtl, t } = useI18n();
  const allowed = user?.role === 'Owner' || user?.role === 'Manager';
  const [draft, setDraft] = useState<TenantSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings, isLoading, isError, refetch } = useQuery<TenantSettings>({
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
    if (isSaving) return;
    setIsSaving(true);
    try {
      await api.put('/settings/availability', serializeAvailabilitySettings(form));
      toast.success(t('settings.availability.saved'));
      await qc.invalidateQueries({ queryKey: ['availability-settings'] });
      setDraft(null);
      qc.invalidateQueries({ queryKey: ['availability'] });
      qc.invalidateQueries({ queryKey: ['public-availability'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.availability.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const workingDays = form.workingDays;
  const closurePeriods = form.closurePeriods;

  if (isLoading) return <Card className="p-4 sm:p-6" aria-busy="true"><SettingsState message={t('common.states.loading')} /></Card>;
  if (isError) return <Card className="p-4 sm:p-6"><SettingsState message={t('settings.availability.loadFailed')} onRetry={() => void refetch()} /></Card>;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] lg:items-start">
      <Card className="overflow-hidden">
        <SettingsSectionHeader icon={Clock} title={t('settings.availability.title')} description={t('settings.availability.subtitle')} />

        <div className="px-4 py-5 sm:px-6">
        <div className="mb-6 max-w-sm">
          <Label htmlFor="bay-capacity">{t('settings.availability.bayCapacity')}</Label>
          <Input
            id="bay-capacity"
            type="number"
            min={1}
            value={form.bayCapacity}
            disabled={isSaving}
            onChange={(event) => setDraft((current) => ({ ...(current ?? form), bayCapacity: Number(event.target.value) }))}
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('settings.availability.bayCapacityHint')}</p>
        </div>

        <h3 className="mb-3 font-medium">{t('settings.availability.weeklyHours')}</h3>
        <div className="space-y-3">
          {workingDays.map((day) => (
            <div key={day.day} className={cn('rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 transition-colors', day.isOpen ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-surface-elevated)]/55')}>
              <div className="flex items-center justify-between gap-3 md:hidden">
                <p className="font-medium">{t(`weekdays.${day.day}`)}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-text-muted)]">{day.isOpen ? t('settings.availability.open') : t('settings.availability.closed')}</span>
                  <Switch aria-label={t(`weekdays.${day.day}`)} checked={day.isOpen} disabled={isSaving} onCheckedChange={(checked) => updateWorkingDay(day.day, { isOpen: checked })} />
                </div>
              </div>
              <div className="mt-4 grid gap-3 min-[430px]:grid-cols-2 md:mt-0 md:grid-cols-[minmax(120px,1fr)_120px_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
                <p className="hidden font-medium md:block">{t(`weekdays.${day.day}`)}</p>
                <div className="hidden items-center gap-2 md:flex">
                  <Switch aria-label={t(`weekdays.${day.day}`)} checked={day.isOpen} disabled={isSaving} onCheckedChange={(checked) => updateWorkingDay(day.day, { isOpen: checked })} />
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {day.isOpen ? t('settings.availability.open') : t('settings.availability.closed')}
                  </span>
                </div>
                <div className="min-w-0">
                  <Label htmlFor={`opens-${day.day}`}>{t('settings.availability.opens')}</Label>
                  <Input id={`opens-${day.day}`} type="time" value={day.openTime} disabled={isSaving || !day.isOpen} onChange={(event) => updateWorkingDay(day.day, { openTime: event.target.value })} />
                </div>
                <div className="min-w-0">
                  <Label htmlFor={`closes-${day.day}`}>{t('settings.availability.closes')}</Label>
                  <Input id={`closes-${day.day}`} type="time" value={day.closeTime} disabled={isSaving || !day.isOpen} onChange={(event) => updateWorkingDay(day.day, { closeTime: event.target.value })} />
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
        <SettingsFormActions><Button className="w-full sm:w-auto" onClick={save} disabled={isSaving} aria-busy={isSaving}>{t('common.actions.save')}</Button></SettingsFormActions>
      </Card>

      <Card className="overflow-hidden">
        <SettingsSectionHeader
          icon={CalendarX}
          title={t('settings.availability.closures')}
          description={t('settings.availability.closuresHint')}
        />

        <div className="p-4 sm:p-6">
        <Button className="mb-4 w-full" variant="secondary" onClick={addClosure} disabled={isSaving}><Plus size={16} />{t('settings.availability.addClosure')}</Button>
        {closurePeriods.length === 0 ? (
          <SettingsState message={t('settings.availability.noClosures')} />
        ) : (
          <div className="space-y-3">
            {closurePeriods.map((period, index) => (
              <div key={`${period.from}-${period.to}-${index}`} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`closure-from-${index}`}>{t('settings.availability.from')}</Label>
                    <Input id={`closure-from-${index}`} type="date" value={period.from} disabled={isSaving} onChange={(event) => updateClosure(index, { from: event.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor={`closure-to-${index}`}>{t('settings.availability.to')}</Label>
                    <Input id={`closure-to-${index}`} type="date" value={period.to} disabled={isSaving} onChange={(event) => updateClosure(index, { to: event.target.value })} />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    aria-label={t('settings.availability.reason')}
                    placeholder={t('settings.availability.reasonPlaceholder')}
                    value={period.reason ?? ''}
                    disabled={isSaving}
                    onChange={(event) => updateClosure(index, { reason: event.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeClosure(index)}
                    disabled={isSaving}
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
        </div>
      </Card>
    </div>
  );
}

function ReceiptTab() {
  const user = useAuthStore((state) => state.user);
  const qc = useQueryClient();
  const { formatCurrency, isRtl, t } = useI18n();
  const allowed = user?.role === 'Owner' || user?.role === 'Manager';
  const { data, isLoading, isError, refetch } = useReceiptSettings();
  const settings = data ?? fallbackReceiptSettings;
  const [draftCurrency, setDraftCurrency] = useState<TenantCurrency | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const currency = draftCurrency ?? data?.currency ?? 'SAR';
  const selectClassName = cn(
    'h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)]',
    isRtl ? 'text-right' : 'text-left',
  );

  if (!allowed) {
    return <Card className="p-5">{t('settings.receipts.restricted')}</Card>;
  }

  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const { data: saved } = await api.put<ReceiptSettings>('/settings/receipt', { currency });
      setDraftCurrency(saved.currency);
      toast.success(t('settings.receipts.saved'));
      qc.invalidateQueries({ queryKey: ['receipt-settings'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.receipts.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <Card className="p-4 sm:p-6" aria-busy="true"><SettingsState message={t('common.states.loading')} /></Card>;
  if (isError) return <Card className="p-4 sm:p-6"><SettingsState message={t('settings.receipts.loadFailed')} onRetry={() => void refetch()} /></Card>;

  return (
    <Card className="max-w-[960px] overflow-hidden">
      <SettingsSectionHeader icon={BadgeDollarSign} title={t('settings.receipts.title')} description={t('settings.receipts.subtitle')} />
      <div className="grid gap-5 px-4 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.75fr)] md:items-stretch">
        <div className="max-w-md">
          <Label htmlFor="receipt-currency">{t('settings.receipts.currency')}</Label>
          <select
            id="receipt-currency"
            className={selectClassName}
            value={currency}
            disabled={isSaving}
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

        <div className="flex min-h-36 flex-col justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{t('settings.receipts.previewLabel')}</p>
            <ReceiptText size={20} className="text-[var(--color-primary)]" aria-hidden="true" />
          </div>
          <p className="mt-6 font-[var(--font-display)] text-3xl font-semibold tabular-nums" dir="ltr">{formatCurrency(220, currency)}</p>
        </div>
      </div>
      <SettingsFormActions><Button className="w-full sm:w-auto" onClick={save} disabled={isSaving} aria-busy={isSaving}>{t('common.actions.save')}</Button></SettingsFormActions>
    </Card>
  );
}

function ProfileTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery<TenantProfile>({ queryKey: ['tenant-profile'], queryFn: () => api.get<TenantProfile>('/tenant/profile').then((response) => response.data) });
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!data) return;
    setName(data.name ?? '');
    setLogoUrl(data.logoUrl ?? '');
  }, [data]);

  const save = async () => {
    if (isSaving || uploadProgress !== null) return;
    setIsSaving(true);
    try {
      await api.patch('/tenant/profile', { name, logoUrl });
      toast.success(t('settings.profile.saved'));
      await qc.invalidateQueries({ queryKey: ['tenant-profile'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.profile.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error(t('settings.profile.logoValidation'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
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
      void qc.invalidateQueries({ queryKey: ['tenant-profile'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('board.workOrder.uploadFailed')));
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const displayedLogoUrl = logoUrl;
  const initials = (name || data?.name || t('settings.profile.initialsFallback')).trim().slice(0, 2).toLocaleUpperCase();

  if (isLoading) return <Card className="p-4 sm:p-6" aria-busy="true"><SettingsState message={t('common.states.loading')} /></Card>;
  if (isError) return <Card className="p-4 sm:p-6"><SettingsState message={t('settings.profile.loadFailed')} onRetry={() => void refetch()} /></Card>;

  return (
    <Card className="max-w-[1040px] overflow-hidden">
      <SettingsSectionHeader icon={Building2} title={t('settings.profile.title')} description={t('settings.profile.subtitle')} />
      <div className="grid gap-6 px-4 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] md:gap-8">
        <div className="max-w-xl">
          <Label htmlFor="shop-name">{t('common.labels.shopName')}</Label>
          <Input id="shop-name" value={name} disabled={isSaving} onChange={(event) => setName(event.target.value)} />
          <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{t('settings.profile.nameHint')}</p>
        </div>

        <section aria-labelledby="shop-logo-heading" className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-4">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start md:flex-col md:text-center lg:flex-row lg:text-start">
            {displayedLogoUrl ? (
              <img src={displayedLogoUrl} alt={t('settings.profile.logoAlt', { name: name || data?.name || '' })} className="h-20 w-20 shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] object-cover" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-primary-muted)] font-[var(--font-display)] text-xl font-semibold text-[var(--color-primary)]" aria-hidden="true">{initials}</div>
            )}
            <div className="min-w-0 flex-1">
              <h3 id="shop-logo-heading" className="font-medium">{t('settings.profile.logoTitle')}</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{t('settings.profile.logoHint')}</p>
              <input
                ref={fileInputRef}
                id="shop-logo"
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadProgress !== null || isSaving}
                onChange={(event) => void upload(event.target.files?.[0])}
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
                <Button className="w-full sm:w-auto md:w-full lg:w-auto" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploadProgress !== null || isSaving}>
                  <ImagePlus size={16} />
                  {displayedLogoUrl ? t('settings.profile.replaceLogo') : t('settings.profile.uploadLogo')}
                </Button>
                {displayedLogoUrl && <Button className="w-full sm:w-auto md:w-full lg:w-auto" variant="ghost" onClick={() => setLogoUrl('')} disabled={uploadProgress !== null || isSaving}>{t('settings.profile.removeLogo')}</Button>}
              </div>
            </div>
          </div>
          {uploadProgress !== null && (
            <div className="mt-4" aria-live="polite">
              <div className="mb-1 flex justify-between text-xs text-[var(--color-text-muted)]"><span>{t('settings.profile.uploading')}</span><span>{uploadProgress}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}>
                <div className="h-full bg-[var(--color-primary)] transition-[width]" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
        </section>
      </div>
      <SettingsFormActions><Button className="w-full sm:w-auto" onClick={save} disabled={isSaving || uploadProgress !== null || !name.trim()} aria-busy={isSaving}>{t('common.actions.save')}</Button></SettingsFormActions>
    </Card>
  );
}

function ServicesTab() {
  const user = useAuthStore((state) => state.user);
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const allowed = user?.role === 'Owner' || user?.role === 'Manager';
  const { data: services = [], isLoading, isError, refetch } = useQuery<ServiceType[]>({
    queryKey: ['services', 'manage'],
    enabled: allowed,
    queryFn: () => api.get<ServiceType[]>('/services', { params: { includeInactive: true } }).then((response) => response.data),
  });
  const [editing, setEditing] = useState<Partial<ServiceType> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { formatCurrency, isRtl, t } = useI18n();
  const currency = useTenantCurrency();

  const save = async () => {
    if (!editing || isSaving) return;
    const name = editing.name?.trim() ?? '';
    if (!name) {
      toast.error(t('settings.services.nameRequired'));
      return;
    }
    if (!editing.durationMinutes || editing.durationMinutes < 1) {
      toast.error(t('settings.services.durationRequired'));
      return;
    }
    if (!editing.basePrice || editing.basePrice <= 0) {
      toast.error(t('settings.services.priceRequired'));
      return;
    }

    setIsSaving(true);
    try {
      const payload = { ...editing, name };
      if (editing.id) await api.patch(`/services/${editing.id}`, payload);
      else await api.post('/services', payload);
      await qc.invalidateQueries({ queryKey: ['services'] });
      setEditing(null);
      toast.success(t('settings.services.saved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.services.saveFailed')));
    } finally {
      setIsSaving(false);
    }
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

  const rows = editing && !editing.id ? [editing as ServiceType, ...services] : services;

  if (!allowed) return <Card className="p-5">{t('settings.services.restricted')}</Card>;

  return (
    <Card className="overflow-hidden">
      <SettingsSectionHeader
        icon={BadgeDollarSign}
        title={t('settings.services.title')}
        description={t('settings.services.subtitle')}
        action={<Button className="w-full sm:w-auto" disabled={editing !== null || isSaving} onClick={() => setEditing({ name: '', basePrice: 1, durationMinutes: 30, sortOrder: services.length + 1, isActive: true })}><Plus size={16} />{t('settings.services.add')}</Button>}
      />
      <div className="p-4 sm:p-6" aria-busy={isLoading}>
      {isLoading ? (
        <SettingsState message={t('common.states.loading')} />
      ) : isError ? (
        <SettingsState message={t('settings.services.loadFailed')} onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <SettingsState message={t('settings.services.empty')} />
      ) : (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={services.map((service) => service.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            <div className={cn('hidden gap-3 px-4 text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)] md:grid', serviceDesktopGrid, isRtl ? 'text-right' : 'text-left')}>
              <span />
              <span>{t('common.labels.name')}</span>
              <span>{t('common.labels.duration')}</span>
              <span className="text-right">{t('common.labels.price')}</span>
              <span>{t('common.labels.status')}</span>
              <span />
            </div>
            {rows.map((service) => <ServiceItem key={service.id ?? 'new'} service={service} editing={editing} setEditing={setEditing} save={save} isSaving={isSaving} patchService={patchService} formatCurrency={(value) => formatCurrency(value, currency)} />)}
          </div>
        </SortableContext>
      </DndContext>
      )}
      </div>
    </Card>
  );
}

function ServiceItem({
  service,
  editing,
  setEditing,
  save,
  isSaving,
  patchService,
  formatCurrency,
}: {
  service: ServiceType;
  editing: Partial<ServiceType> | null;
  setEditing: React.Dispatch<React.SetStateAction<Partial<ServiceType> | null>>;
  save: () => Promise<void>;
  isSaving: boolean;
  patchService: (id: string, payload: Partial<ServiceType>) => Promise<void>;
  formatCurrency: (value: number) => string;
}) {
  const sortable = useSortable({ id: service.id ?? 'new', disabled: !service.id });
  const isEditing = editing === service || editing?.id === service.id;
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const { t } = useI18n();
  const qc = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);

  const uploadImage = async (file?: File) => {
    if (!file || !service.id) return;
    setImageBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/services/${service.id}/image`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(t('settings.services.imageSaved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.services.imageFailed')));
    } finally {
      setImageBusy(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const removeImage = async () => {
    if (!service.id) return;
    setImageBusy(true);
    try {
      await api.delete(`/services/${service.id}/image`);
      await qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(t('settings.services.imageRemoved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.services.imageFailed')));
    } finally {
      setImageBusy(false);
    }
  };

  return (
    <div ref={sortable.setNodeRef} style={style} className={cn('rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-surface-elevated)]/35 focus-within:border-[var(--color-primary)]', isEditing ? 'border-[var(--color-primary)] shadow-[var(--shadow-sm)]' : 'border-[var(--color-border)]')}>
      {isEditing ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_140px_140px_auto] md:items-end">
          <div>
            <Label htmlFor={`service-name-${service.id ?? 'new'}`}>{t('common.labels.name')}</Label>
            <Input id={`service-name-${service.id ?? 'new'}`} autoFocus={!service.id} value={editing?.name ?? ''} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))} disabled={isSaving} />
          </div>
          <div>
            <Label htmlFor={`service-duration-${service.id ?? 'new'}`}>{t('common.labels.duration')}</Label>
            <Input id={`service-duration-${service.id ?? 'new'}`} type="number" min={1} max={1440} inputMode="numeric" value={editing?.durationMinutes ?? 0} onChange={(event) => setEditing((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} disabled={isSaving} />
          </div>
          <div>
            <Label htmlFor={`service-price-${service.id ?? 'new'}`}>{t('common.labels.price')}</Label>
            <Input id={`service-price-${service.id ?? 'new'}`} type="number" min={0.01} max={999999} step="0.01" inputMode="decimal" value={editing?.basePrice ?? 0} onChange={(event) => setEditing((current) => ({ ...current, basePrice: Number(event.target.value) }))} disabled={isSaving} />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row md:justify-end">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setEditing(null)} disabled={isSaving}><X size={16} />{t('common.actions.cancel')}</Button>
            <Button className="w-full sm:w-auto" onClick={() => void save()} disabled={isSaving} aria-busy={isSaving}><Check size={16} />{t('common.actions.save')}</Button>
          </div>
          <div className="md:col-span-full">
            <Label htmlFor={`service-description-${service.id ?? 'new'}`}>{t('settings.services.descriptionLabel')}</Label>
            <Textarea id={`service-description-${service.id ?? 'new'}`} value={editing?.description ?? ''} onChange={(event) => setEditing((current) => ({ ...current, description: event.target.value }))} disabled={isSaving} placeholder={t('settings.services.descriptionPlaceholder')} />
          </div>
          <div className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] p-3 md:col-span-full sm:flex-row sm:items-center">
            <div className="grid h-20 w-full shrink-0 place-items-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] sm:w-28">
              {service.imageUrl ? <img src={service.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="text-[var(--color-text-muted)]" size={24} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t('settings.services.imageLabel')}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{service.id ? t('settings.services.imageHelp') : t('settings.services.imageAfterSave')}</p>
              {service.id && <><input ref={imageInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadImage(event.target.files?.[0])} /><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => imageInputRef.current?.click()} disabled={imageBusy || isSaving}><ImagePlus size={15} />{service.imageUrl ? t('settings.services.replaceImage') : t('settings.services.uploadImage')}</Button>{service.imageUrl && <Button size="sm" variant="ghost" onClick={() => void removeImage()} disabled={imageBusy || isSaving}><Trash2 size={15} />{t('settings.services.removeImage')}</Button>}</div></>}
            </div>
          </div>
        </div>
      ) : (
        <div className={cn('grid gap-4 md:gap-3 md:items-center', serviceDesktopGrid)}>
          <div className="flex items-start justify-between gap-3 md:contents">
            <button type="button" className="grid h-11 w-11 shrink-0 cursor-grab touch-manipulation place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] active:cursor-grabbing md:h-10 md:w-10" aria-label={t('board.help.dragToMove')} {...sortable.attributes} {...sortable.listeners}><GripVertical size={18} /></button>
            <div className="flex min-w-0 flex-1 items-center gap-3 md:col-start-2">
              <span className="grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)]">{service.imageUrl ? <img src={service.imageUrl} alt="" className="h-full w-full object-cover" /> : <Wrench size={18} className="text-[var(--color-text-muted)]" />}</span>
              <div className="min-w-0">
              <p className="font-medium leading-6">{service.name}</p>
              {service.description && <p className="line-clamp-1 text-xs text-[var(--color-text-muted)]">{service.description}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)] md:hidden">
                <span className="tabular-nums">{t('common.units.minutesShort', { value: service.durationMinutes })}</span>
                <span className="tabular-nums" dir="ltr">{formatCurrency(service.basePrice)}</span>
              </div>
              </div>
            </div>
          </div>
          <div className="hidden text-sm tabular-nums md:block">{t('common.units.minutesShort', { value: service.durationMinutes })}</div>
          <div className="hidden text-right text-sm tabular-nums md:block" dir="ltr">{formatCurrency(service.basePrice)}</div>
          <div className="flex items-center justify-between gap-2 md:justify-start">
            <span className="text-xs text-[var(--color-text-muted)] md:hidden">{service.isActive ? t('common.states.active') : t('common.states.inactive')}</span>
            <Switch checked={service.isActive} onCheckedChange={(checked) => patchService(service.id, { isActive: checked })} aria-label={t('settings.services.toggleAria', { name: service.name })} />
          </div>
          <div className="flex justify-end border-t border-[var(--color-border-subtle)] pt-3 md:border-0 md:pt-0">
            <Button className="w-full md:w-auto" variant="ghost" aria-label={t('settings.services.editAria', { name: service.name })} onClick={() => setEditing(service)}><Pencil size={16} /><span className="md:sr-only">{t('settings.services.edit')}</span></Button>
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
  const [isSaving, setIsSaving] = useState(false);
  const { formatNumber, formatRelativeTime, t } = useI18n();
  const owner = user?.role === 'Owner';
  const whatsAppEnabled = plan?.whatsAppEnabled === true;

  const { data: settings, isLoading, isError: settingsError, refetch: refetchSettings } = useQuery<WhatsAppSettings>({
    queryKey: ['whatsapp-settings'],
    enabled: owner && whatsAppEnabled,
    queryFn: () => api.get<WhatsAppSettings>('/notifications/whatsapp/settings').then((response) => response.data),
  });
  const { data: logs = [], isError: logsError, isFetching: logsFetching, refetch: refetchLogs } = useQuery<NotificationLogEntry[]>({
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
    if (isSaving) return;
    setIsSaving(true);
    try {
      await api.patch('/notifications/whatsapp/settings', form);
      setForm((current) => ({ ...current, accessToken: '', clearAccessToken: false }));
      toast.success(t('settings.notifications.saved'));
      qc.invalidateQueries({ queryKey: ['whatsapp-settings'] });
      qc.invalidateQueries({ queryKey: ['whatsapp-logs'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.notifications.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const statusText = (status: NotificationLogEntry['status']) => {
    const key = `settings.notifications.statuses.${status}`;
    const translated = t(key);
    return translated === key ? status : translated;
  };

  const statusTone = (status: NotificationLogEntry['status']): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
    if (status === 'Failed') return 'danger';
    if (status === 'Delivered' || status === 'Read') return 'success';
    if (status === 'Requested') return 'warning';
    return 'info';
  };

  const updateTemplate = (eventType: NotificationEventType, patch: Partial<WhatsAppTemplateSettings>) => {
    setForm((current) => ({
      ...current,
      templates: current.templates.map((template) =>
        template.eventType === eventType ? { ...template, ...patch } : template,
      ),
    }));
  };

  if (isLoading || planLoading) return <Card className="p-4 sm:p-6" aria-busy="true"><SettingsState message={t('common.states.loading')} /></Card>;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.65fr)] xl:items-start">
      <Card className="overflow-hidden">
        <SettingsSectionHeader
          icon={MessageCircle}
          title={t('settings.notifications.title')}
          description={t('settings.notifications.subtitle')}
          action={<StatusBadge tone={settings?.hasAccessToken && settings.businessPhoneNumberId ? 'success' : 'neutral'}>{settings?.hasAccessToken && settings.businessPhoneNumberId ? t('settings.notifications.configured') : t('settings.notifications.notConfigured')}</StatusBadge>}
        />

        <div className="space-y-6 px-4 py-5 sm:px-6">
          {settingsError ? (
            <SettingsState message={t('settings.notifications.loadFailed')} onRetry={() => void refetchSettings()} />
          ) : (
          <>
          {plan && (
            <section aria-labelledby="notification-usage-heading">
              <h3 id="notification-usage-heading" className="mb-3 font-medium">{t('settings.notifications.usageTitle')}</h3>
            <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">{t('settings.notifications.quotaUsed')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(plan.whatsAppMessagesUsed)} / {formatNumber(plan.whatsAppMessagesLimit)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">{t('settings.notifications.quotaRemaining')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(plan.whatsAppMessagesRemaining)}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-[var(--color-text-muted)]">{t('settings.notifications.quotaAddon')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(plan.whatsAppMessagesAddon)}</p>
              </div>
            </div>
            </section>
          )}

          <section aria-labelledby="notification-provider-heading" className="space-y-4">
            <h3 id="notification-provider-heading" className="font-medium">{t('settings.notifications.providerTitle')}</h3>
          <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-4">
            <div>
              <p className="font-medium">{t('settings.notifications.enabled')}</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('settings.notifications.enabledHint')}</p>
            </div>
            <Switch aria-label={t('settings.notifications.enabled')} checked={form.isEnabled} disabled={isSaving} onCheckedChange={(checked) => setForm((current) => ({ ...current, isEnabled: checked }))} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="whatsapp-phone-number-id">{t('settings.notifications.phoneNumberId')}</Label>
              <Input id="whatsapp-phone-number-id" dir="ltr" value={form.businessPhoneNumberId} disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, businessPhoneNumberId: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="whatsapp-access-token">{t('settings.notifications.accessToken')}</Label>
              <Input
                id="whatsapp-access-token"
                type="password"
                dir="ltr"
                value={form.accessToken}
                disabled={form.clearAccessToken || isSaving}
                placeholder={settings?.hasAccessToken ? t('settings.notifications.accessTokenStored') : ''}
                onChange={(event) => setForm((current) => ({ ...current, accessToken: event.target.value }))}
              />
            </div>
          </div>
          </section>

          <section aria-labelledby="notification-templates-heading">
          <h3 id="notification-templates-heading" className="mb-3 font-medium">{t('settings.notifications.templatesTitle')}</h3>
          <div className="grid gap-3">
            {form.templates.map((template) => (
              <div key={template.eventType} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20 p-4">
                <div className="mb-3">
                  <p className="font-medium">{t(`settings.notifications.eventTypes.${template.eventType}`)}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t(`settings.notifications.eventHints.${template.eventType}`)}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor={`template-name-${template.eventType}`}>{t('settings.notifications.templateName')}</Label>
                    <Input id={`template-name-${template.eventType}`} value={template.templateName} disabled={isSaving} onChange={(event) => updateTemplate(template.eventType, { templateName: event.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor={`template-language-${template.eventType}`}>{t('settings.notifications.templateLanguage')}</Label>
                    <Input id={`template-language-${template.eventType}`} dir="ltr" value={template.languageCode} disabled={isSaving} onChange={(event) => updateTemplate(template.eventType, { languageCode: event.target.value })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
              <div>
                <p className="font-medium">{t('settings.notifications.clearToken')}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('settings.notifications.clearTokenHint')}</p>
              </div>
              <Switch aria-label={t('settings.notifications.clearToken')} checked={form.clearAccessToken} disabled={isSaving} onCheckedChange={(checked) => setForm((current) => ({ ...current, clearAccessToken: checked, accessToken: checked ? '' : current.accessToken }))} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
              <div>
                <p className="font-medium">{t('settings.notifications.autoReady')}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('settings.notifications.autoReadyHint')}</p>
              </div>
              <Switch aria-label={t('settings.notifications.autoReady')} checked={form.autoSendReady} disabled={isSaving} onCheckedChange={(checked) => setForm((current) => ({ ...current, autoSendReady: checked }))} />
            </div>
          </div>
          </>
          )}
        </div>
        {!settingsError && <SettingsFormActions><Button className="w-full sm:w-auto" onClick={save} disabled={isSaving} aria-busy={isSaving}>{t('common.actions.save')}</Button></SettingsFormActions>}
      </Card>

      <Card className="overflow-hidden">
        <SettingsSectionHeader icon={RefreshCw} title={t('settings.notifications.activityTitle')} description={t('settings.notifications.activitySubtitle')} action={<Button variant="ghost" size="icon" onClick={() => void refetchLogs()} disabled={logsFetching} aria-label={t('common.actions.refresh')} aria-busy={logsFetching}><RefreshCw size={17} /></Button>} />

        <div className="p-4 sm:p-6" aria-busy={logsFetching}>
        {logsError ? (
          <SettingsState message={t('settings.notifications.logsLoadFailed')} onRetry={() => void refetchLogs()} />
        ) : logs.length === 0 ? (
          <SettingsState message={t('settings.notifications.activityEmpty')} />
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{log.eventType}</p>
                    <p className="mt-1 break-all text-xs text-[var(--color-text-muted)]" dir="ltr">{log.recipientPhone}</p>
                  </div>
                  <StatusBadge tone={statusTone(log.status)}>{statusText(log.status)}</StatusBadge>
                </div>
                {log.errorMessage && <p className="mt-2 break-words rounded-[var(--radius-sm)] bg-[var(--color-destructive-muted)] p-2 text-xs leading-5 text-[var(--color-destructive)]">{log.errorMessage}</p>}
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                  {t('settings.notifications.lastEvent', { time: formatRelativeTime(log.updatedAt) })}
                </p>
              </div>
            ))}
          </div>
        )}
        </div>
      </Card>
    </div>
  );
}

function StaffTab() {
  const user = useAuthStore((state) => state.user);
  const qc = useQueryClient();
  const { data: plan } = usePlanStatus();
  const { data: staff = [], isLoading, isError, refetch } = useQuery<StaffMember[]>({ queryKey: ['staff'], enabled: user?.role !== 'Staff', queryFn: () => api.get<StaffMember[]>('/staff').then((response) => response.data) });
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
    <Card className="overflow-hidden">
      <SettingsSectionHeader
        icon={Users}
        title={t('settings.staff.title')}
        description={plan
          ? (isUnlimitedLimit(plan.staffLimit)
              ? t('planStatus.staffUnlimited', { used: formatNumber(plan.staffUsed) })
              : t('planStatus.staffUsage', { used: formatNumber(plan.staffUsed), limit: formatNumber(plan.staffLimit) }))
          : t('settings.staff.subtitle')}
        action={
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
        }
      />
      <div className="p-4 sm:p-6" aria-busy={isLoading}>
      {isLoading ? (
        <SettingsState message={t('common.states.loading')} />
      ) : isError ? (
        <SettingsState message={t('settings.staff.loadFailed')} onRetry={() => void refetch()} />
      ) : staff.length === 0 ? (
        <SettingsState message={t('settings.staff.empty')} />
      ) : (
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
            <div key={member.id} className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-surface-elevated)]/35 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)_120px_100px_52px] md:items-center md:gap-3">
              <div className="flex min-w-0 items-start justify-between gap-3 md:block">
                <div className="min-w-0">
                  <p className="font-medium leading-6">{member.fullName}</p>
                  <p className="mt-1 break-words text-sm text-[var(--color-text-muted)] md:hidden" dir="ltr">{member.email}</p>
                  <p className="mt-1 break-words text-sm text-[var(--color-text-muted)] md:hidden" dir="ltr">{member.phone || t('settings.staff.noPhone')}</p>
                </div>
                <div className="md:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={t('settings.staff.actionsAria', { name: member.fullName })}><MoreVertical size={18} /></Button></DropdownMenuTrigger>
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
              <div className="hidden min-w-0 break-words text-sm text-[var(--color-text-secondary)] md:block" dir="ltr">{member.email}</div>
              <div className="hidden min-w-0 break-words text-sm text-[var(--color-text-secondary)] md:block" dir="ltr">{member.phone || t('settings.staff.noPhone')}</div>
              <div><StatusBadge tone="info">{t(getRoleKey(member.role))}</StatusBadge></div>
              <div><StatusBadge tone={member.isInvitePending ? 'warning' : member.isActive ? 'success' : 'neutral'}>{status}</StatusBadge></div>
              <div className="hidden justify-end md:flex">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={t('settings.staff.actionsAria', { name: member.fullName })}><MoreVertical size={18} /></Button></DropdownMenuTrigger>
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
      )}
      </div>
    </Card>
  );
}
