'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { I18nProvider, useI18n } from '@/i18n/I18nProvider';
import type { AppLocale } from '@/i18n/config';
import { queryClient } from '@/lib/queryClient';
import { PlanLimitDialog } from '@/components/plans/PlanLimitDialog';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

function AppToaster() {
  const { isRtl } = useI18n();
  return (
    <Toaster
      position={isRtl ? 'top-left' : 'top-right'}
      containerStyle={{ top: 64, zIndex: 40 }}
      toastOptions={{
        style: {
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
        },
      }}
    />
  );
}

export function Providers({
  children,
  initialLocale,
  initialLocaleAuthoritative = false,
}: {
  children: React.ReactNode;
  initialLocale: AppLocale;
  initialLocaleAuthoritative?: boolean;
}) {
  return (
    <ThemeProvider>
      <I18nProvider initialLocale={initialLocale} initialLocaleAuthoritative={initialLocaleAuthoritative}>
        <QueryClientProvider client={queryClient}>
          {children}
          <PlanLimitDialog />
          <AppToaster />
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
