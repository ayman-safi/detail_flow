'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const { isRtl } = useI18n();

  return (
    <SwitchPrimitive.Root
      className={cn('relative inline-flex h-6 w-11 cursor-pointer items-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] transition data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[state=checked]:border-[var(--color-primary)] data-[state=checked]:bg-[var(--color-primary)]', className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block h-5 w-5 rounded-full bg-[var(--color-control-thumb)] shadow transition-transform',
          isRtl ? '-translate-x-0.5 data-[state=checked]:-translate-x-5' : 'translate-x-0.5 data-[state=checked]:translate-x-5',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
