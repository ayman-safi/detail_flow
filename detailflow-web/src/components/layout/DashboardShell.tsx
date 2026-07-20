'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BookingForm } from '@/components/bookings/BookingForm';
import { PlanUsageBanner } from '@/components/plans/PlanUsageBanner';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useI18n } from '@/i18n/I18nProvider';
import { useBoardStore } from '@/store/boardStore';

export function DashboardShell({
  children,
  sseStatus,
}: {
  children: React.ReactNode;
  sseStatus?: 'connecting' | 'connected' | 'error' | 'closed';
}) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const liveStatus = useBoardStore((s) => s.sseStatus);
  const { t } = useI18n();

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)] supports-[height:100dvh]:h-dvh">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header sseStatus={sseStatus ?? liveStatus} onNewBooking={() => setBookingOpen(true)} onMenu={() => setMenuOpen(true)} />
        <PlanUsageBanner />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </main>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[260px] max-w-[82vw] p-0 xl:hidden">
          <SheetTitle className="sr-only">{t('navigation.openNavigation')}</SheetTitle>
          <Sidebar mobile onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <Sheet open={bookingOpen} onOpenChange={setBookingOpen}>
        <SheetContent className="w-full max-w-[480px] overflow-y-auto">
          <SheetTitle className="mb-4 pe-10 font-[var(--font-display)] text-xl font-semibold">
            {t('bookings.title')}
          </SheetTitle>
          <BookingForm />
        </SheetContent>
      </Sheet>
    </div>
  );
}
