'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus, Car, ChevronLeft, ChevronRight, Clock, MoreVertical, Phone, Search, SlidersHorizontal, Users, Wrench } from 'lucide-react';
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
  const [repeatFirst, setRepeatFirst] = useState(false);
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
    queryFn: () => api.get('/customers', { params: { search, page, limit: 6 } }).then((response) => response.data),
  });

  const customers = useMemo(() => data?.items ?? [], [data?.items]);
  const displayedCustomers = useMemo(
    () => repeatFirst ? [...customers].sort((a, b) => b.totalVisits - a.totalVisits) : customers,
    [customers, repeatFirst],
  );
  const repeatOnPage = useMemo(() => customers.filter((customer) => customer.totalVisits > 1).length, [customers]);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const firstCustomer = data?.total ? ((page - 1) * data.limit) + 1 : 0;
  const lastCustomer = data ? Math.min(page * data.limit, data.total) : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 p-4 md:gap-6 md:p-6 lg:p-8">
      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)] md:items-center">
        <Metric title={t('customers.metrics.repeatCustomers')} value={repeatOnPage} />
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className={`pointer-events-none absolute top-4 h-4 w-4 text-[var(--color-text-muted)] ${isRtl ? 'right-4' : 'left-4'}`} />
            <Input className={`h-12 rounded-[var(--radius-md)] bg-[var(--color-surface)] ${isRtl ? 'pr-11' : 'pl-11'}`} placeholder={t('customers.searchPlaceholder')} value={raw} onChange={(event) => setRaw(event.target.value)} aria-label={t('customers.searchPlaceholder')} />
          </div>
          <Button variant={repeatFirst ? 'primary' : 'secondary'} size="icon" className="h-12 w-12 shrink-0 rounded-[var(--radius-md)]" aria-label={t('customers.filter')} aria-pressed={repeatFirst} onClick={() => setRepeatFirst((value) => !value)}>
            <SlidersHorizontal size={18} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton h-[148px] w-full md:h-[104px]" />)}
        </div>
      ) : !customers.length ? (
        <Card><EmptyState icon={Users} title={t('customers.emptyTitle')} description={t('customers.emptyDescription')} /></Card>
      ) : (
        <div className="space-y-4">
          {displayedCustomers.map((customer, index) => (
            <div key={customer.id} className="group relative rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-[var(--color-border)] hover:shadow-[var(--shadow-interactive)]">
              <button
                type="button"
                onClick={() => setSelected(customer)}
                aria-label={`${t('board.help.open')} ${customer.fullName ?? customer.phone}`}
                className={cn('grid w-full cursor-pointer gap-5 rounded-[var(--radius-md)] p-4 pe-12 text-start md:grid-cols-[minmax(210px,1.25fr)_minmax(100px,.55fr)_minmax(150px,.8fr)_minmax(170px,.9fr)] md:items-center md:px-5 md:py-6', isRtl && 'text-right')}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-full font-[var(--font-display)] text-base font-semibold', avatarTone(index))}>
                    {initials(customer.fullName ?? customer.phone)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{customer.fullName ?? customer.phone}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><Phone size={12} />{customer.phone}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 border-t border-[var(--color-border-subtle)] pt-4 md:contents md:border-0 md:pt-0">
                  <CustomerFact icon={Users} label={t('customers.visits')} value={String(customer.totalVisits)} />
                  <CustomerFact icon={CalendarDays} label={t('customers.lastVisit')} value={customer.lastVisitAt ? formatDate(customer.lastVisitAt, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} bordered />
                  <CustomerFact icon={Wrench} label={t('customers.recentWork')} value={customer.recentWorkOrders?.[0]?.serviceName ?? t('customers.noWorkOrders')} bordered />
                </div>
              </button>
              <button type="button" onClick={() => setSelected(customer)} className="absolute end-2 top-3 grid h-10 w-10 cursor-pointer place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] md:top-1/2 md:-translate-y-1/2" aria-label={`${t('customers.moreActions')} ${customer.fullName ?? customer.phone}`}>
                <MoreVertical size={19} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-text-muted)]">{t('customers.showing', { first: firstCustomer, last: lastCustomer, total: data?.total ?? 0 })}</p>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} isRtl={isRtl} previousLabel={t('common.actions.previous')} nextLabel={t('common.actions.next')} pageLabel={t('customers.pageLabel')} navigationLabel={t('customers.paginationNavigation')} />
      </div>

      <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card className="p-5 md:min-h-24">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--color-text-muted)]">{title}</p>
          <p className="mt-1 font-[var(--font-display)] text-2xl font-semibold">{value}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-success-muted)] text-[var(--color-success)]"><CalendarPlus size={20} /></div>
      </div>
    </Card>
  );
}

function CustomerFact({ icon: Icon, label, value, bordered = false }: { icon: typeof Users; label: string; value: string; bordered?: boolean }) {
  return (
    <div className={cn('min-w-0 px-2 md:px-5', bordered && 'border-s border-[var(--color-border-subtle)]')}>
      <p className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] sm:text-xs"><Icon size={14} />{label}</p>
      <p className="mt-1.5 line-clamp-2 text-xs font-medium text-[var(--color-text)] sm:text-sm">{value}</p>
    </div>
  );
}

function Pagination({ page, totalPages, onChange, isRtl, previousLabel, nextLabel, pageLabel, navigationLabel }: { page: number; totalPages: number; onChange: (page: number) => void; isRtl: boolean; previousLabel: string; nextLabel: string; pageLabel: string; navigationLabel: string }) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((value) => totalPages <= 5 || value === 1 || value === totalPages || Math.abs(value - page) <= 1);
  return (
    <nav className="flex items-center gap-2" aria-label={navigationLabel}>
      <Button variant="secondary" size="icon" className="h-9 w-9" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={previousLabel}>{isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</Button>
      {pages.map((value, index) => (
        <span key={value} className="contents">
          {index > 0 && value - pages[index - 1] > 1 && <span className="px-1 text-[var(--color-text-muted)]">…</span>}
          <Button variant={value === page ? 'primary' : 'secondary'} size="icon" className="h-9 w-9" onClick={() => onChange(value)} aria-current={value === page ? 'page' : undefined} aria-label={`${pageLabel} ${value}`}>{value}</Button>
        </span>
      ))}
      <Button variant="secondary" size="icon" className="h-9 w-9" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label={nextLabel}>{isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</Button>
    </nav>
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
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-primary-muted)] font-[var(--font-display)] font-bold text-[var(--color-primary)]">{initials(customer.fullName ?? customer.phone)}</div>
            <div className="min-w-0">
              <SheetTitle className="truncate font-[var(--font-display)] text-2xl font-semibold">{customer.fullName ?? customer.phone}</SheetTitle>
              <a href={`tel:${customer.phone}`} className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--color-primary)]"><Phone size={13} />{customer.phone}</a>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4"><p className="text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{t('customers.drawer.totalVisits')}</p><p className="mt-1 font-[var(--font-display)] text-3xl font-bold">{customer.totalVisits}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{t('customers.lastVisit')}</p><p className="mt-2 text-sm">{customer.lastVisitAt ? formatRelativeTime(customer.lastVisitAt) : t('customers.drawer.noVisitsYet')}</p></Card>
        </div>
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-[var(--font-display)] text-lg font-semibold">{t('customers.drawer.recentWorkOrders')}</h3><span className="text-xs text-[var(--color-text-muted)]">{t('common.units.shown', { count: history.length })}</span></div>
          {!history.length ? <EmptyState icon={Clock} title={t('customers.drawer.noHistoryTitle')} description={t('customers.drawer.noHistoryDescription')} /> : (
            <div className={cn('relative space-y-3 before:absolute before:top-4 before:h-[calc(100%-32px)] before:w-px before:bg-[var(--color-border)]', isRtl ? 'before:right-[15px]' : 'before:left-[15px]')}>
              {history.map((workOrder) => (
                <div key={workOrder.id} className={cn('relative grid gap-3', isRtl ? 'grid-cols-[1fr_32px]' : 'grid-cols-[32px_1fr]')}>
                  <div className={cn('z-10 grid h-8 w-8 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)]', isRtl && 'order-2')}><Car size={15} className="text-[var(--color-text-muted)]" /></div>
                  <Card className={cn('p-4', isRtl && 'order-1')}>
                    <div className="mb-3 flex items-start justify-between gap-3"><div><p className="plate text-sm">{workOrder.vehiclePlate}</p><p className="mt-1 font-medium">{workOrder.serviceName}</p></div><StageBadge stage={workOrder.stage} /></div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><Clock size={13} /><span>{formatDate(workOrder.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>
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

function avatarTone(index: number) {
  return [
    'bg-[var(--color-primary-muted)] text-[var(--color-primary)]',
    'bg-[var(--color-success-muted)] text-[var(--color-success)]',
    'bg-[var(--color-info-muted)] text-[var(--color-info)]',
    'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
    'bg-[var(--color-destructive-muted)] text-[var(--color-destructive)]',
  ][index % 5];
}
