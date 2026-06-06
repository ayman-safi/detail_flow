'use client';

import type { ButtonHTMLAttributes, Ref } from 'react';
import { Camera, ChevronLeft, ChevronRight, Clock, ExternalLink, GripVertical, User } from 'lucide-react';
import { differenceInMinutes, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { WorkOrderCard } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import { stageColors } from '@/styles/theme';

const colorMap: Record<string, string> = { white: '#f8fafc', black: '#111827', red: '#ef4444', blue: '#3b82f6', gray: '#64748b', grey: '#64748b', silver: '#cbd5e1', green: '#22c55e', yellow: '#facc15' };
const initials = (name?: string) => name?.split(' ').map((part) => part[0]).join('').slice(0, 2) || '?';

export function VehicleCard({
  workOrder,
  onOpenDetail,
  dragHandleProps,
  dragHandleRef,
  isDragging = false,
  compact = false,
  onMoveBackward,
  onMoveForward,
}: {
  workOrder: WorkOrderCard;
  onOpenDetail: (id: string) => void;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  dragHandleRef?: Ref<HTMLButtonElement>;
  isDragging?: boolean;
  compact?: boolean;
  onMoveBackward?: () => void;
  onMoveForward?: () => void;
}) {
  const color = stageColors[workOrder.stage];
  const etaMins = workOrder.estimatedReadyAt ? differenceInMinutes(parseISO(workOrder.estimatedReadyAt), new Date()) : null;
  const etaColor = workOrder.stage === 'Ready' ? 'text-[var(--color-success)]' : etaMins !== null && etaMins <= 30 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]';
  const { formatDate, isRtl, t } = useI18n();

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${t('board.help.open')} ${workOrder.vehicle.plateNumber}`}
      onClick={() => {
        if (!isDragging) onOpenDetail(workOrder.id);
      }}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (!isDragging) onOpenDetail(workOrder.id);
      }}
      className={cn(
        'group w-full cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 transition hover:-translate-y-px hover:border-[var(--color-primary)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] sm:p-3.5',
        isRtl && 'text-right',
        compact ? 'min-h-[148px]' : 'min-h-[126px]',
        isDragging && 'ring-2 ring-[var(--color-primary)]',
      )}
      style={{ borderInlineStart: `4px solid ${color}` }}
    >
      <div className={cn('flex items-start justify-between gap-2', isRtl && 'flex-row-reverse')}>
        <div className={cn('flex min-w-0 items-center gap-2', isRtl && 'flex-row-reverse')}>
          <span className="plate truncate text-sm sm:text-base">{workOrder.vehicle.plateNumber}</span>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20" style={{ background: colorMap[workOrder.vehicle.color.toLowerCase()] ?? workOrder.vehicle.color }} />
        </div>
        <div className={cn('flex items-center gap-1', isRtl && 'flex-row-reverse')}>
          <span className={cn('rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--color-text-muted)] transition', compact ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
            {t('board.help.open')}
          </span>
          <ExternalLink size={13} className={cn('text-[var(--color-text-muted)] transition', compact ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')} />
          <button
            ref={dragHandleRef}
            type="button"
            aria-label={t('board.help.dragVehicle', { plate: workOrder.vehicle.plateNumber })}
            title={t('board.help.dragToMove')}
            className={cn('grid touch-none place-items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)] active:cursor-grabbing', compact ? 'h-10 w-10 rounded-full' : 'h-8 w-8', isRtl ? 'mr-1' : 'ml-1')}
            onClick={(event) => event.stopPropagation()}
            {...dragHandleProps}
          >
            <GripVertical size={17} />
          </button>
        </div>
      </div>
      <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-2', isRtl && 'flex-row-reverse')}>
        <p className="min-w-0 flex-1 text-sm text-[var(--color-text-secondary)]">{workOrder.vehicle.make} {workOrder.vehicle.model}</p>
        <span className="max-w-full truncate rounded-full bg-[var(--color-primary-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">{workOrder.serviceName}</span>
      </div>
      <div className={cn('mt-3 flex min-w-0 items-center gap-2 text-sm', isRtl && 'flex-row-reverse')}>
        <User size={12} className="shrink-0 text-[var(--color-text-muted)]" />
        <span className="truncate">{workOrder.customer.fullName}</span>
        <span className={cn('text-xs text-[var(--color-text-muted)] transition', compact ? 'hidden' : 'opacity-0 group-hover:opacity-100')}>{workOrder.customer.phone}</span>
      </div>
      <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-2 text-xs', isRtl && 'flex-row-reverse')}>
        <div className="min-w-0">
          {workOrder.assignedStaff ? (
            <span className={cn('inline-flex max-w-full items-center gap-1', isRtl && 'flex-row-reverse')}>
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-primary-muted)] text-[10px]">{initials(workOrder.assignedStaff.fullName)}</span>
              <span className="truncate">{workOrder.assignedStaff.fullName}</span>
            </span>
          ) : (
            <span className="italic text-[var(--color-text-muted)]">{t('board.card.unassigned')}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[var(--color-text-muted)]">
          {workOrder.estimatedReadyAt && <span className={`inline-flex items-center gap-1 ${etaColor}`}><Clock size={12} />{formatDate(workOrder.estimatedReadyAt, { hour: 'numeric', minute: '2-digit' })}</span>}
          {workOrder.photoCount > 0 && <span className="inline-flex items-center gap-1"><Camera size={12} />{workOrder.photoCount}</span>}
        </div>
      </div>
      {compact && (onMoveBackward || onMoveForward) ? (
        <div className={cn('mt-3 flex items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] pt-3', isRtl && 'flex-row-reverse')}>
          <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t('board.help.quickMove')}</span>
          <div className={cn('flex items-center gap-1.5', isRtl && 'flex-row-reverse')}>
            <button
              type="button"
              className={cn('inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium transition', onMoveBackward ? 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]' : 'border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-disabled)]')}
              disabled={!onMoveBackward}
              onClick={(event) => {
                event.stopPropagation();
                onMoveBackward?.();
              }}
            >
              {isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              {t('board.card.previous')}
            </button>
            <button
              type="button"
              className={cn('inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium transition', onMoveForward ? 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]' : 'border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-disabled)]')}
              disabled={!onMoveForward}
              onClick={(event) => {
                event.stopPropagation();
                onMoveForward?.();
              }}
            >
              {t('board.card.next')}
              {isRtl ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
