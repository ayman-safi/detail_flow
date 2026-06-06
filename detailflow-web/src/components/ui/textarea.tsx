import { useI18n } from '@/i18n/I18nProvider';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    const { isRtl } = useI18n();
    return (
      <textarea
        ref={ref}
        dir={isRtl ? 'rtl' : 'ltr'}
        className={cn(
          'min-h-24 w-full min-w-0 resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-elevated)] disabled:text-[var(--color-text-muted)] aria-[invalid=true]:border-[var(--color-destructive)] aria-[invalid=true]:focus:ring-[var(--color-destructive-muted)]',
          isRtl ? 'text-right' : 'text-left',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
