'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Car } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Stage, WorkOrderCard } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import { getStageKey } from '@/i18n/domain';
import { colorMix, stageColors } from '@/styles/theme';
import { VehicleCard } from './VehicleCard';

function DraggableCard({
  workOrder,
  compact,
  visibleStages,
  onOpenDetail,
  onMoveCard,
}: {
  workOrder: WorkOrderCard;
  compact: boolean;
  visibleStages: Stage[];
  onOpenDetail: (id: string) => void;
  onMoveCard?: (id: string, targetStage: Stage) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: workOrder.id, data: { stage: workOrder.stage } });
  const currentStageIndex = visibleStages.indexOf(workOrder.stage);
  const previousStage = currentStageIndex > 0 ? visibleStages[currentStageIndex - 1] : undefined;
  const nextStage = currentStageIndex >= 0 && currentStageIndex < visibleStages.length - 1 ? visibleStages[currentStageIndex + 1] : undefined;

  return (
    <div
      ref={setNodeRef}
      className="transition-transform duration-150"
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.25 : 1,
        pointerEvents: isDragging ? 'none' : undefined,
      }}
    >
      <VehicleCard
        workOrder={workOrder}
        onOpenDetail={onOpenDetail}
        compact={compact}
        isDragging={isDragging}
        dragHandleRef={setActivatorNodeRef}
        dragHandleProps={{ ...attributes, ...listeners }}
        onMoveBackward={compact && previousStage && onMoveCard ? () => onMoveCard(workOrder.id, previousStage) : undefined}
        onMoveForward={compact && nextStage && onMoveCard ? () => onMoveCard(workOrder.id, nextStage) : undefined}
      />
    </div>
  );
}

export function StageColumn({
  stage,
  workOrders,
  isOver,
  compact = false,
  visibleStages,
  onOpenDetail,
  onMoveCard,
}: {
  stage: Stage;
  workOrders: WorkOrderCard[];
  isOver: boolean;
  compact?: boolean;
  visibleStages: Stage[];
  onOpenDetail: (id: string) => void;
  onMoveCard?: (id: string, targetStage: Stage) => void;
}) {
  const { setNodeRef } = useDroppable({ id: stage });
  const { isRtl, t } = useI18n();
  const color = stageColors[stage];

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex min-w-0 flex-col rounded-[var(--radius-lg)] border bg-[var(--color-surface)]/94 shadow-[var(--shadow-card)] backdrop-blur transition-colors duration-150',
        isRtl && 'text-right',
        compact ? 'min-h-[calc(100svh-15rem)]' : 'h-[calc(100svh-12rem)]',
      )}
      style={{ borderColor: isOver ? color : 'var(--color-border-subtle)', background: isOver ? colorMix(color, 7) : undefined }}
    >
      <header className={cn('z-10 flex items-center gap-2 rounded-t-[var(--radius-lg)] border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/92 px-3 backdrop-blur', isRtl && 'flex-row-reverse', compact ? 'sticky top-0 min-h-14 py-3' : 'sticky top-0 h-14')}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0">
          <h2 className="truncate font-[var(--font-display)] text-sm font-semibold uppercase tracking-[0.05em]">{t(getStageKey(stage))}</h2>
          <p className="text-[11px] text-[var(--color-text-muted)]">{t('common.units.vehicles', { count: workOrders.length })}</p>
        </div>
        <span className={`${isRtl ? 'mr-auto' : 'ml-auto'} min-w-7 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-bold`} style={{ background: colorMix(color, 13), color }}>{workOrders.length}</span>
      </header>
      <div className={cn('flex-1 space-y-2.5 p-2.5', compact ? 'pb-24' : 'overflow-y-auto pb-6')}>
        {workOrders.length === 0 ? (
          <div className={cn('grid place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] text-center text-[var(--color-text-muted)]', compact ? 'min-h-[12rem]' : 'h-36')}>
            <div>
              <Car className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">{t('board.stageEmpty')}</p>
            </div>
          </div>
        ) : (
          workOrders.map((workOrder) => (
            <DraggableCard key={workOrder.id} workOrder={workOrder} compact={compact} visibleStages={visibleStages} onOpenDetail={onOpenDetail} onMoveCard={onMoveCard} />
          ))
        )}
      </div>
    </section>
  );
}
