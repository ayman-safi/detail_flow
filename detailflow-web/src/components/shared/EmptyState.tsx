import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center sm:p-12">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] sm:h-16 sm:w-16">
        <Icon className="h-8 w-8 text-[var(--color-text-muted)] sm:h-10 sm:w-10" />
      </div>
      <h3 className="font-[var(--font-display)] text-xl font-semibold">{title}</h3>
      {description && <p className="mt-2 max-w-[300px] text-sm text-[var(--color-text-muted)]">{description}</p>}
      {action && <Button className="mt-5" onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
