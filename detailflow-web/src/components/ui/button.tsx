import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex min-w-0 items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium transition active:translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50',
        variant === 'primary' && 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]',
        variant === 'secondary' && 'border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]',
        variant === 'ghost' && 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
        variant === 'danger' && 'bg-[var(--color-destructive)] text-white hover:brightness-110',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'icon' && 'h-10 w-10 p-0',
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
