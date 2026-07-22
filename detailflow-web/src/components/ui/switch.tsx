'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const { isRtl } = useI18n();

  return (
    <SwitchPrimitive.Root
      dir={isRtl ? 'rtl' : 'ltr'}
      className={cn('relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[state=checked]:border-[var(--color-primary)] data-[state=checked]:bg-[var(--color-primary)]', className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="absolute start-0.5 block h-5 w-5 rounded-full bg-[var(--color-control-thumb)] shadow transition-[inset-inline-start] data-[state=checked]:start-[calc(100%-1.375rem)]"
      />
    </SwitchPrimitive.Root>
  );
}
