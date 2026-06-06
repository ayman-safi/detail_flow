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

const plans: TenantPlan[] = ['Free', 'Pro', 'Business'];
const billingStatuses: TenantBillingStatus[] = ['Trial', 'Active', 'PastDue', 'Suspended', 'Manual'];

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
              <h1 className="font-[var(--font-display)] text-2xl font-semibold">Platform Admin</h1>
              <p className="text-sm text-[var(--color-text-muted)]">{me.data.fullName} · {me.data.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={refresh}>
              <RefreshCw size={16} />
              Refresh
            </Button>
            <Button variant="ghost" onClick={signOut}>
              <LogOut size={16} />
              Sign out
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
                toast.success('Tenant updated');
                refresh();
              } catch (error) {
                toast.error(getApiErrorMessage(error, 'Unable to update tenant.'));
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
                toast.error(getApiErrorMessage(error, 'Unable to start support session.'));
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
  return (
    <Card className="p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_140px_160px]">
        <div>
          <Label htmlFor="tenant-search">Search tenants</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <Input
              id="tenant-search"
              className="pl-9"
              value={filters.search}
              onChange={(event) => onChange({ ...filters, search: event.target.value })}
              placeholder="Name or slug"
            />
          </div>
        </div>
        <SelectField
          id="tenant-plan"
          label="Plan"
          value={filters.plan}
          options={plans}
          onChange={(plan) => onChange({ ...filters, plan })}
        />
        <SelectField
          id="tenant-active"
          label="Status"
          value={filters.active}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Disabled' },
          ]}
          onChange={(active) => onChange({ ...filters, active })}
        />
        <SelectField
          id="tenant-billing"
          label="Billing"
          value={filters.billingStatus}
          options={billingStatuses}
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
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)]"
      >
        <option value="">All</option>
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
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] p-4">
        <div>
          <h2 className="font-[var(--font-display)] text-lg font-semibold">Tenants</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{total} total</p>
        </div>
      </div>
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">Loading tenants...</p>
        ) : tenants.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">No tenants match the current filters.</p>
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
                    <StatusBadge tone={tenant.isActive ? 'success' : 'danger'}>{tenant.isActive ? 'Active' : 'Disabled'}</StatusBadge>
                    <span className="text-xs text-[var(--color-text-muted)]">{tenant.plan}</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--color-text-muted)]">
                  <Metric label="Bookings" value={tenant.stats.currentMonthBookings} />
                  <Metric label="Open jobs" value={tenant.stats.activeWorkOrders} />
                  <Metric label="Staff" value={tenant.stats.staffAccounts} />
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
  const [billingDraft, setBillingDraft] = useState<{ tenantId: string; value: string } | null>(null);
  const [supportMinutes, setSupportMinutes] = useState(60);

  if (loading) {
    return <Card className="p-5 text-sm text-[var(--color-text-muted)]">Loading tenant...</Card>;
  }

  if (!tenant) {
    return <Card className="p-5 text-sm text-[var(--color-text-muted)]">Select a tenant to manage.</Card>;
  }

  const billingNotes = billingDraft?.tenantId === tenant.id ? billingDraft.value : tenant.billingNotes ?? '';

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-[var(--font-display)] text-2xl font-semibold">{tenant.name}</h2>
              <StatusBadge tone={tenant.isActive ? 'success' : 'danger'}>{tenant.isActive ? 'Active' : 'Disabled'}</StatusBadge>
              <StatusBadge>{tenant.billingStatus}</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">/{tenant.slug} · Created {formatDate(tenant.createdAt)}</p>
            {summary?.owner && (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Owner: {summary.owner.fullName} · {summary.owner.email}
              </p>
            )}
          </div>
          <div className="grid min-w-[280px] grid-cols-3 gap-2 text-sm">
            <Stat label="Month bookings" value={tenant.stats.currentMonthBookings} />
            <Stat label="Open jobs" value={tenant.stats.activeWorkOrders} />
            <Stat label="Active staff" value={tenant.stats.activeStaffAccounts} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.7fr)]">
        <Card className="p-5">
          <h3 className="mb-4 font-[var(--font-display)] text-lg font-semibold">Account Controls</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              id="detail-plan"
              label="Plan"
              value={tenant.plan}
              options={plans}
              onChange={(plan) => onPatch({ plan: plan as TenantPlan })}
            />
            <SelectField
              id="detail-billing"
              label="Billing status"
              value={tenant.billingStatus}
              options={billingStatuses}
              onChange={(billingStatus) => onPatch({ billingStatus: billingStatus as TenantBillingStatus })}
            />
          </div>

          <div className="mt-4">
            <Label htmlFor="billing-notes">Billing notes</Label>
            <Textarea
              id="billing-notes"
              value={billingNotes}
              onChange={(event) => setBillingDraft({ tenantId: tenant.id, value: event.target.value })}
              rows={5}
              placeholder="Manual invoice status, renewal notes, or payment follow-up."
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => onPatch({ billingNotes })}>
                <Save size={16} />
                Save notes
              </Button>
              <Button
                variant={tenant.isActive ? 'danger' : 'secondary'}
                onClick={() => onPatch({ isActive: !tenant.isActive })}
              >
                {tenant.isActive ? 'Disable tenant' : 'Reactivate tenant'}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-[var(--font-display)] text-lg font-semibold">Support Access</h3>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 p-4">
            <p className="text-sm font-medium">
              {tenant.supportAccessEnabled && tenant.supportAccessExpiresAt
                ? `Enabled until ${formatDateTime(tenant.supportAccessExpiresAt)}`
                : 'No active support window'}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Starting a session opens a temporary owner-level support view for this tenant.
            </p>
          </div>

          <div className="mt-4">
            <Label htmlFor="support-duration">Duration minutes</Label>
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
              Start support session
            </Button>
            <Button
              variant="secondary"
              onClick={() => onPatch({ supportAccessEnabled: false })}
              disabled={!tenant.supportAccessEnabled}
            >
              Close support access
            </Button>
          </div>
          <a
            href={`/book/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--color-primary)]"
          >
            Public booking page
            <ExternalLink size={14} />
          </a>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 font-[var(--font-display)] text-lg font-semibold">Users</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
              <tr>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {tenant.users.map((member) => (
                <tr key={member.id}>
                  <td className="py-3 font-medium">{member.fullName}</td>
                  <td className="py-3 text-[var(--color-text-secondary)]">{member.email}</td>
                  <td className="py-3">{member.role}</td>
                  <td className="py-3">
                    <StatusBadge tone={member.isActive ? 'success' : 'danger'}>
                      {member.isInvitePending ? 'Invite pending' : member.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </td>
                  <td className="py-3 text-[var(--color-text-muted)]">{formatDate(member.createdAt)}</td>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
