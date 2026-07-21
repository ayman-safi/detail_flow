'use client';

import { useI18n } from '@/i18n/I18nProvider';

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2 font-[var(--font-display)] text-[28px] font-bold">
      <span className="h-3.5 w-3.5 rotate-45 rounded-[2px] bg-[var(--color-primary)]" aria-hidden />
      {!collapsed && (
        <span>
          <span className="text-[var(--color-text)]">{t('common.brandLead')}</span>
          <span className="text-[var(--color-primary)]">{t('common.brandAccent')}</span>
        </span>
      )}
    </div>
  );
}
