import { useI18n } from '@/i18n/I18nProvider';
import * as React from 'react';
import { cn } from '@/lib/utils';

const structuredLtrTypes = new Set([
  'date',
  'datetime-local',
  'email',
  'month',
  'number',
  'password',
  'tel',
  'time',
  'url',
  'week',
]);
const structuredLtrInputModes = new Set(['decimal', 'email', 'numeric', 'tel', 'url']);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, dir, type = 'text', inputMode, autoComplete, ...props }, ref) => {
    const { isRtl } = useI18n();
    const usesStructuredLtrContent = structuredLtrTypes.has(type)
      || (inputMode ? structuredLtrInputModes.has(inputMode) : false)
      || (typeof autoComplete === 'string' && /(?:^|\s)(?:email|tel(?:-[a-z-]+)?|url)(?:\s|$)/.test(autoComplete));
    const contentDirection = dir ?? (usesStructuredLtrContent ? 'ltr' : isRtl ? 'rtl' : 'ltr');

    return (
      <input
        ref={ref}
        dir={contentDirection}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className={cn(
          'h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] shadow-sm outline-none transition-[background-color,border-color,box-shadow] placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-text-disabled)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-elevated)] disabled:text-[var(--color-text-disabled)] disabled:shadow-none aria-[invalid=true]:border-[var(--color-destructive)] aria-[invalid=true]:focus:ring-[var(--color-destructive-muted)]',
          isRtl ? 'text-right' : 'text-left',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
