'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;

export function SheetContent({ className, children, side = 'right', 'aria-describedby': ariaDescribedBy, ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: 'left' | 'right' }) {
  const { isRtl, t } = useI18n();
  const resolvedSide = isRtl ? (side === 'right' ? 'left' : 'right') : side;
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--color-overlay)] backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-0 z-50 h-full w-full max-w-[520px] border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-popover)] outline-none',
          resolvedSide === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          className,
        )}
        aria-describedby={ariaDescribedBy}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={t('common.close')}
          className={cn(
            'absolute top-4 z-10 grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]',
            isRtl ? 'left-4' : 'right-4',
          )}
        >
          <X size={18} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
