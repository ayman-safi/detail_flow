'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Car, ChevronRight, Clock, Phone, Search, Users } from 'lucide-react';
import api from '@/lib/api';
import type { Customer } from '@/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { EmptyState } from '@/components/shared/EmptyState';
import { StageBadge } from '@/components/shared/StageBadge';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export default function CustomersPage() {
  const [raw, setRaw] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Customer | null>(null);
  const { formatDate, isRtl, t } = useI18n();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(raw);
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [raw]);

  const { data, isLoading } = useQuery<{ items: Customer[]; total: number; page: number; limit: number }>({
    queryKey: ['customers', search, page],
    queryFn: () => api.get('/customers', { params: { search, page, limit: 20 } }).then((response) => response.data),
  });

  const customers = useMemo(() => data?.items ?? [], [data?.items]);
  const pageVisits = useMemo(() => customers.reduce((sum, customer) => sum + customer.totalVisits, 0), [customers]);
  const repeatOnPage = useMemo(() => customers.filter((customer) => customer.totalVisits > 1).length, [customers]);

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric title={t('customers.metrics.customers')} value={data?.total ?? 0} icon={Users} />
        <Metric title={t('customers.metrics.visitsOnPage')} value={pageVisits} icon={Car} tone="accent" />
        <Metric title={t('customers.metrics.repeatCustomers')} value={repeatOnPage} icon={CalendarClock} tone="success" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--color-border)] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-[var(--font-display)] text-xl font-semibold">{t('customers.title')}</h2>
              <p className="text-sm text-[var(--color-text-muted)]">{t('customers.subtitle')}</p>
            </div>
            <div className="relative w-full md:w-[360px]">
              <Search className={`pointer-events-none absolute top-2.5 h-4 w-4 text-[var(--color-text-muted)] ${isRtl ? 'right-3' : 'left-3'}`} />
              <Input className={isRtl ? 'pr-9' : 'pl-9'} placeholder={t('customers.searchPlaceholder')} value={raw} onChange={(event) => setRaw(event.target.value)} />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton h-16 w-full" />)}
          </div>
        ) : !customers.length ? (
          <EmptyState icon={Users} title={t('customers.emptyTitle')} description={t('customers.emptyDescription')} />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => setSelected(customer)}
                aria-label={`${t('board.help.open')} ${customer.fullName}`}
                className={`grid w-full grid-cols-1 gap-3 px-4 py-4 transition hover:bg-[var(--color-surface-hover)] md:grid-cols-[minmax(220px,1fr)_180px_140px_170px_32px] md:items-center ${isRtl ? 'text-right' : 'text-left'}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-primary-muted)] font-[var(--font-display)] text-sm font-bold text-[var(--color-primary)]">
                    {initials(customer.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{customer.fullName}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-muted)]"><Phone size={12} />{customer.phone}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{t('customers.visits')}</p>
                  <p className="font-[var(--font-display)] text-lg font-semibold">{customer.totalVisits}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{t('customers.lastVisit')}</p>
                  <p className="text-sm">{customer.lastVisitAt ? formatDate(customer.lastVisitAt, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{t('customers.recentWork')}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{customer.recentWorkOrders?.[0]?.serviceName ?? t('customers.noWorkOrders')}</p>
                </div>

                <ChevronRight className={`hidden text-[var(--color-text-muted)] md:block ${isRtl ? 'rotate-180' : ''}`} size={18} />
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--color-text-muted)]">
            {t('customers.pagination', { page, total: data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1 })}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button className="flex-1 sm:flex-none" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('common.actions.previous')}</Button>
            <Button className="flex-1 sm:flex-none" variant="secondary" disabled={!data || page * data.limit >= data.total} onClick={() => setPage((value) => value + 1)}>{t('common.actions.next')}</Button>
          </div>
        </div>
      </Card>

      <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Metric({ title, value, icon: Icon, tone = 'primary' }: { title: string; value: number; icon: typeof Users; tone?: 'primary' | 'accent' | 'success' }) {
  const color = tone === 'accent' ? 'var(--color-accent)' : tone === 'success' ? 'var(--color-success)' : 'var(--color-primary)';
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{title}</p>
          <p className="mt-1 font-[var(--font-display)] text-2xl font-bold">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color }}>
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );
}

function CustomerDrawer({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const { formatDate, formatRelativeTime, isRtl, t } = useI18n();

  if (!customer) return null;
  const history = customer.recentWorkOrders ?? [];

  return (
    <Sheet open={!!customer} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className={cn('w-full max-w-[520px] overflow-y-auto p-5', isRtl ? 'text-right' : 'text-left')}>
        <div className="mb-6 flex items-start gap-4 pe-10">
          <div className="flex min-w-0 gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-primary-muted)] font-[var(--font-display)] font-bold text-[var(--color-primary)]">{initials(customer.fullName)}</div>
            <div className="min-w-0">
              <SheetTitle className="truncate font-[var(--font-display)] text-2xl font-semibold">{customer.fullName}</SheetTitle>
              <a href={`tel:${customer.phone}`} className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--color-primary)]"><Phone size={13} />{customer.phone}</a>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{t('customers.drawer.totalVisits')}</p>
            <p className="mt-1 font-[var(--font-display)] text-3xl font-bold">{customer.totalVisits}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{t('customers.lastVisit')}</p>
            <p className="mt-2 text-sm">{customer.lastVisitAt ? formatRelativeTime(customer.lastVisitAt) : t('customers.drawer.noVisitsYet')}</p>
          </Card>
        </div>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-[var(--font-display)] text-lg font-semibold">{t('customers.drawer.recentWorkOrders')}</h3>
            <span className="text-xs text-[var(--color-text-muted)]">{t('common.units.shown', { count: history.length })}</span>
          </div>

          {!history.length ? (
            <EmptyState icon={Clock} title={t('customers.drawer.noHistoryTitle')} description={t('customers.drawer.noHistoryDescription')} />
          ) : (
            <div className={`relative space-y-3 before:absolute before:top-4 before:h-[calc(100%-32px)] before:w-px before:bg-[var(--color-border)] ${isRtl ? 'before:right-[15px]' : 'before:left-[15px]'}`}>
              {history.map((workOrder) => (
                <div key={workOrder.id} className={cn('relative grid gap-3', isRtl ? 'grid-cols-[1fr_32px]' : 'grid-cols-[32px_1fr]')}>
                  <div className={cn('z-10 grid h-8 w-8 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)]', isRtl && 'order-2')}>
                    <Car size={15} className="text-[var(--color-text-muted)]" />
                  </div>
                  <Card className={cn('p-4', isRtl && 'order-1')}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="plate text-sm">{workOrder.vehiclePlate}</p>
                        <p className="mt-1 font-medium">{workOrder.serviceName}</p>
                      </div>
                      <StageBadge stage={workOrder.stage} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <Clock size={13} />
                      <span>{formatDate(workOrder.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}
