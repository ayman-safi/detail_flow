'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Lock,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { usePlanStatus } from '@/hooks/usePlanStatus';
import { isUnlimitedLimit } from '@/lib/planLimits';
import { useAuthStore } from '@/store/authStore';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/I18nProvider';
import { getRoleKey } from '@/i18n/domain';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/board', icon: LayoutDashboard, labelKey: 'navigation.board' },
  { href: '/bookings', icon: CalendarDays, labelKey: 'navigation.bookings' },
  { href: '/customers', icon: Users, labelKey: 'navigation.customers' },
  { href: '/analytics', icon: BarChart2, labelKey: 'navigation.analytics' },
  { href: '/settings', icon: Settings, labelKey: 'navigation.settings' },
];

export function Sidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data: plan } = usePlanStatus();
  const [collapsed, setCollapsed] = useState(false);
  const { formatNumber, isRtl, t } = useI18n();

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed') === 'true';
    setCollapsed(stored || window.innerWidth < 1280);
  }, []);

  const toggle = () => {
    setCollapsed((value) => {
      localStorage.setItem('sidebar-collapsed', String(!value));
      return !value;
    });
  };

  const initials = user?.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2) || 'DF';
  const roleLabel = user?.role && user.role !== 'SuperAdmin' ? t(getRoleKey(user.role)) : 'Platform support';

  return (
    <aside
      className={cn(
        'min-h-0 shrink-0 flex-col bg-[var(--color-surface)] transition-[width]',
        !mobile && (isRtl ? 'border-l' : 'border-r'),
        mobile ? 'flex h-full w-full' : 'hidden h-screen xl:flex',
        !mobile && collapsed ? 'w-16' : 'w-[220px]',
      )}
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className={cn('flex h-16 items-center px-4', mobile && 'pe-12')}>
        <Logo collapsed={mobile ? false : collapsed} />
      </div>
      <nav className={cn('space-y-1 px-2', mobile ? 'mb-auto shrink-0' : 'min-h-0 flex-1 overflow-y-auto')}>
        {navItems.map(({ href, icon: Icon, labelKey }) => {
          const active = pathname === href;
          const locked = href === '/analytics' && plan?.analyticsEnabled === false;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              aria-label={mobile || !collapsed ? undefined : t(labelKey)}
              title={mobile || !collapsed ? undefined : t(labelKey)}
              className={cn(
                'flex h-10 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm transition',
                active
                  ? cn(
                      'bg-[var(--color-surface-elevated)] text-[var(--color-text)]',
                      isRtl ? 'border-r-[3px]' : 'border-l-[3px]',
                    )
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
              )}
              style={active ? { borderColor: 'var(--color-primary)' } : undefined}
            >
              <Icon size={18} />
              {(mobile || !collapsed) && (
                <>
                  <span className="min-w-0 flex-1 truncate">{t(labelKey)}</span>
                  {locked && <Lock size={14} className="shrink-0 text-[var(--color-text-muted)]" />}
                </>
              )}
            </Link>
          );
        })}
      </nav>
      {(mobile || !collapsed) && plan && (
        <div
          className={cn(
            'mx-3 mb-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/35 p-3',
            mobile && 'mt-4',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--color-text-muted)]">{t('planStatus.plan')}</span>
            <span className="rounded-full bg-[var(--color-primary-muted)] px-2 py-1 text-xs font-medium text-[var(--color-primary)]">
              {t(`plans.${plan.plan}`)}
            </span>
          </div>
          {!isUnlimitedLimit(plan.bookingsLimit) && (
            <>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-muted)]">{t('navigation.bookings')}</span>
                <span className="font-medium">
                  {formatNumber(plan.bookingsUsed)}/{formatNumber(plan.bookingsLimit)}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)]"
                  style={{ width: `${Math.min(100, Math.round((plan.bookingsUsed / plan.bookingsLimit) * 100))}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}
      <div
        className={cn(
          'border-t border-[var(--color-border)] p-3',
          mobile && 'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        )}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary-muted)] text-xs font-bold text-[var(--color-primary)]">
            {initials}
          </div>
          {(mobile || !collapsed) && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.fullName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {user?.role ? roleLabel : ''}
              </p>
            </div>
          )}
        </div>
        <div className={cn('flex gap-2', !mobile && collapsed && 'flex-col')}>
          <Button
            variant="ghost"
            size={mobile ? 'md' : 'icon'}
            onClick={async () => {
              try {
                await api.post('/auth/logout');
              } finally {
                logout();
                router.push('/login');
              }
            }}
            aria-label={t('common.actions.logout')}
            className={cn(mobile && 'w-full justify-start gap-3 text-[var(--color-text-muted)]')}
          >
            <LogOut size={16} />
            {mobile && <span>{t('common.actions.logout')}</span>}
          </Button>
          {!mobile && (
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('navigation.openNavigation')}>
              {collapsed ? (isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />) : (isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
