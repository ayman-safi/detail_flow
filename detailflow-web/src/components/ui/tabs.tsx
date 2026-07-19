'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export function Tabs({ dir: direction, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const { dir } = useI18n();
  return <TabsPrimitive.Root dir={direction ?? dir} {...props} />;
}

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('inline-flex max-w-full overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={cn('min-w-0 rounded-[var(--radius-sm)] px-4 py-2 text-center text-sm text-[var(--color-text-muted)] transition data-[state=active]:bg-[var(--color-primary)] data-[state=active]:text-white', className)} {...props} />;
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-4 outline-none', className)} {...props} />;
}
