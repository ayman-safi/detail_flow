'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger className={cn('flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm shadow-sm outline-none transition-[background-color,border-color,box-shadow] hover:border-[var(--color-text-disabled)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)] data-[disabled]:cursor-not-allowed data-[placeholder]:text-[var(--color-text-muted)] data-[disabled]:opacity-50', className)} {...props}>
      {children}
      <SelectPrimitive.Icon><ChevronDown size={16} /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className={cn('z-50 max-h-[min(22rem,calc(100svh-2rem))] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-popover)]', className)} {...props}>
        <SelectPrimitive.Viewport className="p-1">{props.children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  const { isRtl } = useI18n();
  return (
    <SelectPrimitive.Item className={cn('relative flex min-h-9 cursor-pointer select-none items-center rounded-[var(--radius-sm)] py-2 text-sm outline-none hover:bg-[var(--color-surface-hover)] focus:bg-[var(--color-surface-hover)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50', isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3', className)} {...props}>
      <SelectPrimitive.ItemIndicator className={cn('absolute', isRtl ? 'right-2' : 'left-2')}><Check size={14} /></SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
