'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export function Label({ className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  const { isRtl } = useI18n();
  return <label className={cn('text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]', isRtl ? 'block text-right' : 'block text-left', className)} {...props} />;
}
