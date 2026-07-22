'use client';

import { Menu, Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SSEStatusDot } from '@/components/shared/SSEStatusDot';
import { useI18n } from '@/i18n/I18nProvider';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const titleKeyMap: Record<string, string> = {
  '/board': 'navigation.board',
  '/bookings': 'navigation.bookings',
  '/customers': 'navigation.customers',
  '/analytics': 'navigation.analytics',
  '/settings': 'navigation.settings',
};

export function Header({
  sseStatus = 'closed',
  onNewBooking,
  onMenu,
}: {
  sseStatus?: 'connecting' | 'connected' | 'error' | 'closed';
  onNewBooking?: () => void;
  onMenu?: () => void;
}) {
  const pathname = usePathname();
  const { t, formatDate } = useI18n();
  const isCustomersPage = pathname === '/customers';

  return (
    <header className={`sticky top-0 z-20 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 ${isCustomersPage ? 'h-16 md:h-20 md:px-6' : 'h-14'}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button variant="ghost" size="icon" className="xl:hidden" onClick={onMenu} aria-label={t('navigation.openNavigation')}>
          <Menu size={20} />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-[var(--font-display)] text-lg font-semibold">
            {pathname in titleKeyMap ? t(titleKeyMap[pathname]) : `${t('common.brandLead')}${t('common.brandAccent')}`}
          </h1>
          {isCustomersPage && <p className="mt-0.5 hidden truncate text-xs text-[var(--color-text-muted)] md:block">{t('customers.subtitle')}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <span className={isCustomersPage ? 'hidden md:inline-flex' : ''}><SSEStatusDot status={sseStatus} /></span>
        <span className="hidden text-sm text-[var(--color-text-muted)] sm:inline">
          {formatDate(new Date(), { weekday: 'short', day: '2-digit', month: 'short' })}
        </span>
        <Button size="sm" className="shrink-0 px-2 sm:px-3" onClick={onNewBooking} aria-label={t('common.actions.newBooking')}>
          <Plus size={16} />
          <span className="hidden sm:inline">{t('common.actions.newBooking')}</span>
        </Button>
      </div>
    </header>
  );
}
