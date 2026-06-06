import { useI18n } from '@/i18n/I18nProvider';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const { isRtl } = useI18n();
    return (
      <input
        ref={ref}
        dir={isRtl ? 'rtl' : 'ltr'}
        className={cn(
          'h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-elevated)] disabled:text-[var(--color-text-muted)] aria-[invalid=true]:border-[var(--color-destructive)] aria-[invalid=true]:focus:ring-[var(--color-destructive-muted)]',
          isRtl ? 'text-right' : 'text-left',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
