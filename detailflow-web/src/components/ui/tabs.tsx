'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const { isRtl } = useI18n();
  return <TabsPrimitive.List dir={isRtl ? 'rtl' : 'ltr'} className={cn('inline-flex max-w-full overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', isRtl && 'flex-row-reverse', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { isRtl } = useI18n();
  return <TabsPrimitive.Trigger className={cn('min-w-0 rounded-[var(--radius-sm)] px-4 py-2 text-center text-sm transition data-[state=active]:bg-[var(--color-primary)] data-[state=active]:text-white', isRtl ? 'text-right text-[var(--color-text-muted)]' : 'text-left text-[var(--color-text-muted)]', className)} {...props} />;
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-4 outline-none', className)} {...props} />;
}
