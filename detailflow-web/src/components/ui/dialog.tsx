'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogContent({ className, children, 'aria-describedby': ariaDescribedBy, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const { isRtl, t } = useI18n();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px]" />
      <DialogPrimitive.Content aria-describedby={ariaDescribedBy} className={cn('fixed left-1/2 top-1/2 z-50 max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl outline-none sm:max-h-[calc(100svh-2rem)] sm:w-[calc(100vw-2rem)]', className)} {...props}>
        {children}
        <DialogPrimitive.Close aria-label={t('common.close')} className={cn('absolute top-4 grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]', isRtl ? 'left-4' : 'right-4')}>
          <X size={18} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { isRtl } = useI18n();
  return <div className={cn('mb-4 space-y-1', isRtl ? 'pl-8' : 'pr-8', className)} {...props} />;
}
