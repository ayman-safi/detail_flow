import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function StatCard({ title, value, subtitle, icon: Icon, color = 'var(--color-primary)', loading }: { title: string; value: number|string; subtitle?: string; icon: LucideIcon; color?: string; loading?: boolean }) {
  return <Card className="p-5">{loading ? <><div className="skeleton h-10 w-10" /><div className="skeleton mt-4 h-8 w-24" /></> : <><div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `${color}20`, color }}><Icon size={22} /></div><p className="mt-4 font-[var(--font-display)] text-3xl font-bold">{value}</p><p className="mt-1 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{title}</p>{subtitle && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{subtitle}</p>}</>}</Card>;
}
