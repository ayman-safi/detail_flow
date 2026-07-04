'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ExternalLink, LifeBuoy, LogOut, RefreshCw, Save, Search, ShieldCheck } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type {
  AuthUser,
  PlatformTenantDetail,
  PlatformTenantList,
  PlatformTenantSummary,
  TenantBillingStatus,
  TenantPlan,
} from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n/I18nProvider';
import { getRoleKey } from '@/i18n/domain';

const plans: TenantPlan[] = ['Free', 'Pro', 'Business'];
const billingStatuses: TenantBillingStatus[] = ['Trial', 'Active', 'PastDue', 'Suspended', 'Manual'];

function getBillingStatusKey(status: TenantBillingStatus) {
  return `platformAdmin.billingStatuses.${status}`;
}

type TenantPatch = {
  plan?: TenantPlan;
  billingStatus?: TenantBillingStatus;
  isActive?: boolean;
  billingNotes?: string;
  supportAccessEnabled?: boolean;
};

export default function PlatformAdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    plan: '',
    active: '',
    billingStatus: '',
  });

  const me = useQuery({
    queryKey: ['platform-auth', 'me', user?.id],
    enabled: hydrated && user?.isPlatformAdmin === true,
    retry: false,
    queryFn: () => api.get<{ user: AuthUser }>('/platform/auth/me').then((response) => response.data.user),
  });

  useEffect(() => {
    if (!hydrated) return;
    if (!user?.isPlatformAdmin) {
      router.replace('/admin/login');
      return;
    }
    if (me.isSuccess) setAuth(me.data);
    if (me.isError) {
      logout();
      router.replace('/admin/login');
    }
  }, [hydrated, logout, me.data, me.isError, me.isSuccess, router, setAuth, user?.isPlatformAdmin]);

  const params = useMemo(() => {
    const next: Record<string, string> = { pageSize: '50' };
    if (filters.search.trim()) next.search = filters.search.trim();
    if (filters.plan) next.plan = filters.plan;
    if (filters.active) next.active = filters.active;
    if (filters.billingStatus) next.billingStatus = filters.billingStatus;
    return next;
  }, [filters]);

  const tenantsQuery = useQuery<PlatformTenantList>({
    queryKey: ['platform-tenants', params],
    enabled: me.isSuccess,
    queryFn: () => api.get<PlatformTenantList>('/platform/admin/tenants', { params }).then((response) => response.data),
  });

  const tenants = tenantsQuery.data?.items ?? [];
  const effectiveSelectedTenantId =
    selectedTenantId && tenants.some((tenant) => tenant.id === selectedTenantId)
      ? selectedTenantId
      : tenants[0]?.id ?? null;
  const selectedSummary = tenants.find((tenant) => tenant.id === effectiveSelectedTenantId) ?? null;
  const tenantQuery = useQuery<PlatformTenantDetail>({
    queryKey: ['platform-tenant', effectiveSelectedTenantId],
    enabled: me.isSuccess && !!effectiveSelectedTenantId,
    queryFn: () => api.get<PlatformTenantDetail>(`/platform/admin/tenants/${effectiveSelectedTenantId}`).then((response) => response.data),
  });

  const signOut = async () => {
    await api.post('/auth/logout').catch(() => null);
    logout();
    router.replace('/admin/login');
  };

  if (!hydrated || !user?.isPlatformAdmin || !me.isSuccess) return null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
    if (effectiveSelectedTenantId) queryClient.invalidateQueries({ queryKey: ['platform-tenant', effectiveSelectedTenantId] });
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="font-[var(--font-display)] text-2xl font-semibold">{t('platformAdmin.title')}</h1>
              <p className="text-sm text-[var(--color-text-muted)]">{me.data.fullName} · {me.data.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={refresh}>
              <RefreshCw size={16} />
              {t('common.actions.refresh')}
            </Button>
            <Button variant="ghost" onClick={signOut}>
              <LogOut size={16} />
              {t('common.actions.signOut')}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-4 p-4 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 space-y-4">
          <TenantFilters filters={filters} onChange={setFilters} />
          <TenantList
            tenants={tenants}
            loading={tenantsQuery.isLoading}
            selectedTenantId={effectiveSelectedTenantId}
            onSelect={setSelectedTenantId}
            total={tenantsQuery.data?.total ?? 0}
          />
        </section>

        <section className="min-w-0">
          <TenantDetailPanel
            tenant={tenantQuery.data}
            summary={selectedSummary}
            loading={tenantQuery.isLoading}
            onPatch={async (patch) => {
              if (!effectiveSelectedTenantId) return;
              try {
                await api.patch(`/platform/admin/tenants/${effectiveSelectedTenantId}`, patch);
                toast.success(t('platformAdmin.toasts.tenantUpdated'));
                refresh();
              } catch (error) {
                toast.error(getApiErrorMessage(error, t('platformAdmin.toasts.updateFailed')));
              }
            }}
            onSupportSession={async (durationMinutes) => {
              if (!effectiveSelectedTenantId) return;
              try {
                const { data } = await api.post<{ user: AuthUser; redirectPath: string }>(
                  `/platform/admin/tenants/${effectiveSelectedTenantId}/support-session`,
                  { durationMinutes },
                );
                setAuth(data.user);
                router.push(data.redirectPath);
              } catch (error) {
                toast.error(getApiErrorMessage(error, t('platformAdmin.toasts.supportSessionFailed')));
              }
            }}
          />
        </section>
      </div>
    </main>
  );
}

function TenantFilters({
  filters,
  onChange,
}: {
  filters: { search: string; plan: string; active: string; billingStatus: string };
  onChange: (filters: { search: string; plan: string; active: string; billingStatus: string }) => void;
}) {
  const { t } = useI18n();

  return (
    <Card className="p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_140px_160px]">
        <div>
          <Label htmlFor="tenant-search">{t('platformAdmin.filters.search')}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <Input
              id="tenant-search"
              className="pl-9"
              value={filters.search}
              onChange={(event) => onChange({ ...filters, search: event.target.value })}
              placeholder={t('platformAdmin.filters.searchPlaceholder')}
            />
          </div>
        </div>
        <SelectField
          id="tenant-plan"
          label={t('platformAdmin.filters.plan')}
          value={filters.plan}
          options={plans.map((plan) => ({ value: plan, label: t(`plans.${plan}`) }))}
          onChange={(plan) => onChange({ ...filters, plan })}
        />
        <SelectField
          id="tenant-active"
          label={t('platformAdmin.filters.status')}
          value={filters.active}
          options={[
            { value: 'true', label: t('common.states.active') },
            { value: 'false', label: t('common.states.disabled') },
          ]}
          onChange={(active) => onChange({ ...filters, active })}
        />
        <SelectField
          id="tenant-billing"
          label={t('platformAdmin.filters.billing')}
          value={filters.billingStatus}
          options={billingStatuses.map((status) => ({ value: status, label: t(getBillingStatusKey(status)) }))}
          onChange={(billingStatus) => onChange({ ...filters, billingStatus })}
        />
      </div>
    </Card>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[] | { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)]"
      >
        <option value="">{t('common.filters.all')}</option>
        {options.map((option) => {
          const normalized = typeof option === 'string' ? { value: option, label: option } : option;
          return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>;
        })}
      </select>
    </div>
  );
}

function TenantList({
  tenants,
  loading,
  selectedTenantId,
  onSelect,
  total,
}: {
  tenants: PlatformTenantSummary[];
  loading: boolean;
  selectedTenantId: string | null;
  onSelect: (id: string) => void;
  total: number;
}) {
  const { t, formatNumber } = useI18n();

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] p-4">
        <div>
          <h2 className="font-[var(--font-display)] text-lg font-semibold">{t('platformAdmin.list.title')}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{t('platformAdmin.list.total', { total: formatNumber(total) })}</p>
        </div>
      </div>
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">{t('platformAdmin.list.loading')}</p>
        ) : tenants.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">{t('platformAdmin.list.empty')}</p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                className={cn(
                  'block w-full px-4 py-3 text-left transition hover:bg-[var(--color-surface-hover)]',
                  selectedTenantId === tenant.id && 'bg-[var(--color-primary-muted)]',
                )}
                onClick={() => onSelect(tenant.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tenant.name}</p>
                    <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">/{tenant.slug}</p>
                    {tenant.owner && <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{tenant.owner.email}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge tone={tenant.isActive ? 'success' : 'danger'}>
                      {tenant.isActive ? t('common.states.active') : t('common.states.disabled')}
                    </StatusBadge>
                    <span className="text-xs text-[var(--color-text-muted)]">{t(`plans.${tenant.plan}`)}</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--color-text-muted)]">
                  <Metric label={t('platformAdmin.metrics.bookings')} value={tenant.stats.currentMonthBookings} />
                  <Metric label={t('platformAdmin.metrics.openJobs')} value={tenant.stats.activeWorkOrders} />
                  <Metric label={t('platformAdmin.metrics.staff')} value={tenant.stats.staffAccounts} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] px-2 py-1">
      {value} {label}
    </span>
  );
}

function TenantDetailPanel({
  tenant,
  summary,
  loading,
  onPatch,
  onSupportSession,
}: {
  tenant?: PlatformTenantDetail;
  summary: PlatformTenantSummary | null;
  loading: boolean;
  onPatch: (patch: TenantPatch) => Promise<void>;
  onSupportSession: (durationMinutes: number) => Promise<void>;
}) {
  const { t, formatDate } = useI18n();
  const [billingDraft, setBillingDraft] = useState<{ tenantId: string; value: string } | null>(null);
  const [supportMinutes, setSupportMinutes] = useState(60);

  if (loading) {
    return <Card className="p-5 text-sm text-[var(--color-text-muted)]">{t('platformAdmin.detail.loading')}</Card>;
  }

  if (!tenant) {
    return <Card className="p-5 text-sm text-[var(--color-text-muted)]">{t('platformAdmin.detail.empty')}</Card>;
  }

  const billingNotes = billingDraft?.tenantId === tenant.id ? billingDraft.value : tenant.billingNotes ?? '';
  const supportAccessExpiresAt = tenant.supportAccessExpiresAt
    ? formatDate(tenant.supportAccessExpiresAt, { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-[var(--font-display)] text-2xl font-semibold">{tenant.name}</h2>
              <StatusBadge tone={tenant.isActive ? 'success' : 'danger'}>
                {tenant.isActive ? t('common.states.active') : t('common.states.disabled')}
              </StatusBadge>
              <StatusBadge>{t(getBillingStatusKey(tenant.billingStatus))}</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              /{tenant.slug} · {t('platformAdmin.detail.created', { date: formatDate(tenant.createdAt, { dateStyle: 'medium' }) })}
            </p>
            {summary?.owner && (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {t('platformAdmin.detail.owner', { name: summary.owner.fullName, email: summary.owner.email })}
              </p>
            )}
          </div>
          <div className="grid min-w-[280px] grid-cols-3 gap-2 text-sm">
            <Stat label={t('platformAdmin.metrics.monthBookings')} value={tenant.stats.currentMonthBookings} />
            <Stat label={t('platformAdmin.metrics.openJobs')} value={tenant.stats.activeWorkOrders} />
            <Stat label={t('platformAdmin.metrics.activeStaff')} value={tenant.stats.activeStaffAccounts} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.7fr)]">
        <Card className="p-5">
          <h3 className="mb-4 font-[var(--font-display)] text-lg font-semibold">{t('platformAdmin.detail.accountControls')}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              id="detail-plan"
              label={t('platformAdmin.filters.plan')}
              value={tenant.plan}
              options={plans.map((plan) => ({ value: plan, label: t(`plans.${plan}`) }))}
              onChange={(plan) => onPatch({ plan: plan as TenantPlan })}
            />
            <SelectField
              id="detail-billing"
              label={t('platformAdmin.detail.billingStatus')}
              value={tenant.billingStatus}
              options={billingStatuses.map((status) => ({ value: status, label: t(getBillingStatusKey(status)) }))}
              onChange={(billingStatus) => onPatch({ billingStatus: billingStatus as TenantBillingStatus })}
            />
          </div>

          <div className="mt-4">
            <Label htmlFor="billing-notes">{t('platformAdmin.detail.billingNotes')}</Label>
            <Textarea
              id="billing-notes"
              value={billingNotes}
              onChange={(event) => setBillingDraft({ tenantId: tenant.id, value: event.target.value })}
              rows={5}
              placeholder={t('platformAdmin.detail.billingNotesPlaceholder')}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => onPatch({ billingNotes })}>
                <Save size={16} />
                {t('platformAdmin.detail.saveNotes')}
              </Button>
              <Button
                variant={tenant.isActive ? 'danger' : 'secondary'}
                onClick={() => onPatch({ isActive: !tenant.isActive })}
              >
                {tenant.isActive ? t('platformAdmin.detail.disableTenant') : t('platformAdmin.detail.reactivateTenant')}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-[var(--font-display)] text-lg font-semibold">{t('platformAdmin.detail.supportAccess')}</h3>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 p-4">
            <p className="text-sm font-medium">
              {tenant.supportAccessEnabled && tenant.supportAccessExpiresAt
                ? t('platformAdmin.detail.supportEnabledUntil', { date: supportAccessExpiresAt })
                : t('platformAdmin.detail.noSupportWindow')}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t('platformAdmin.detail.supportDescription')}
            </p>
          </div>

          <div className="mt-4">
            <Label htmlFor="support-duration">{t('platformAdmin.detail.durationMinutes')}</Label>
            <Input
              id="support-duration"
              type="number"
              min={15}
              max={480}
              value={supportMinutes}
              onChange={(event) => setSupportMinutes(Number(event.target.value))}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={!tenant.isActive} onClick={() => onSupportSession(supportMinutes)}>
              <LifeBuoy size={16} />
              {t('platformAdmin.detail.startSupportSession')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => onPatch({ supportAccessEnabled: false })}
              disabled={!tenant.supportAccessEnabled}
            >
              {t('platformAdmin.detail.closeSupportAccess')}
            </Button>
          </div>
          <a
            href={`/book/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--color-primary)]"
          >
            {t('platformAdmin.detail.publicBookingPage')}
            <ExternalLink size={14} />
          </a>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 font-[var(--font-display)] text-lg font-semibold">{t('platformAdmin.detail.users')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
              <tr>
                <th className="pb-2 font-medium">{t('common.labels.name')}</th>
                <th className="pb-2 font-medium">{t('common.labels.email')}</th>
                <th className="pb-2 font-medium">{t('common.labels.role')}</th>
                <th className="pb-2 font-medium">{t('common.labels.status')}</th>
                <th className="pb-2 font-medium">{t('platformAdmin.detail.createdHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {tenant.users.map((member) => (
                <tr key={member.id}>
                  <td className="py-3 font-medium">{member.fullName}</td>
                  <td className="py-3 text-[var(--color-text-secondary)]">{member.email}</td>
                  <td className="py-3">{t(getRoleKey(member.role))}</td>
                  <td className="py-3">
                    <StatusBadge tone={member.isActive ? 'success' : 'danger'}>
                      {member.isInvitePending
                        ? t('platformAdmin.statuses.invitePending')
                        : member.isActive ? t('common.states.active') : t('common.states.inactive')}
                    </StatusBadge>
                  </td>
                  <td className="py-3 text-[var(--color-text-muted)]">{formatDate(member.createdAt, { dateStyle: 'medium' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 p-3">
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <Badge
      className={cn(
        tone === 'neutral' && 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]',
        tone === 'success' && 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
        tone === 'danger' && 'bg-[var(--color-destructive-muted)] text-[var(--color-destructive)]',
      )}
    >
      {children}
    </Badge>
  );
}
