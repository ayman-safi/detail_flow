'use client';

import { useI18n } from '@/i18n/I18nProvider';
import type { AppLocale } from '@/i18n/config';
import { cn } from '@/lib/utils';

const locales: AppLocale[] = ['en', 'ar', 'tr'];

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1',
        compact && 'scale-95',
      )}
      aria-label={t('common.locales.switcherLabel')}
      role="group"
    >
      {locales.map((item) => {
        const active = item === locale;
        return (
          <button
            key={item}
            type="button"
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition',
              active
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            )}
            onClick={() => setLocale(item)}
            aria-pressed={active}
            aria-label={t(`common.locales.${item}`)}
          >
            {t(`common.locales.${item}Short`)}
          </button>
        );
      })}
    </div>
  );
}
