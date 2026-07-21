'use client';

import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, MouseSensor, TouchSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { getApiErrorMessage } from '@/lib/api';
import { syncWorkOrderCardQuery } from '@/lib/workOrderQuery';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/store/boardStore';
import type { BoardData, Stage, WorkOrderCard } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import { boardBaseStageSequence, getStageKey } from '@/i18n/domain';
import { colorMix, stageColors } from '@/styles/theme';
import { Button } from '@/components/ui/button';
import { StageColumn } from './StageColumn';
import { VehicleCard } from './VehicleCard';

const COMPACT_BREAKPOINT = 1280;
const PHONE_BREAKPOINT = 768;
const key = (stage: Stage) => stage.toLowerCase() as keyof BoardData;

export function KanbanBoard({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const board = useBoardStore((state) => state.board);
  const moveCard = useBoardStore((state) => state.moveCard);
  const revertMove = useBoardStore((state) => state.revertMove);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [showDelivered, setShowDelivered] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(true);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const qc = useQueryClient();
  const { isRtl, t } = useI18n();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 10 } }),
  );
  const stages = showDelivered ? [...boardBaseStageSequence, 'Delivered' as Stage] : boardBaseStageSequence;
  const displayedStages = isRtl ? [...stages].reverse() : stages;
  const allCards = useMemo(() => board ? Object.values(board).flat() : [], [board]);
  const activeCard = allCards.find((card) => card.id === activeId);
  const isCompactViewport = viewportWidth !== null && viewportWidth < COMPACT_BREAKPOINT;
  const isPhoneViewport = viewportWidth !== null && viewportWidth < PHONE_BREAKPOINT;
  const compactLaneWidth = isPhoneViewport ? 'min(calc(100vw - 2rem), 22rem)' : '20rem';

  useEffect(() => {
    const syncViewport = () => setViewportWidth(window.innerWidth);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const items = Array.from(scroller.querySelectorAll<HTMLElement>('[data-stage-item]'));
    if (items.length === 0) return;

    const nextIndex = items.reduce((closestIndex, item, index) => {
      const current = Math.abs(item.offsetLeft - scroller.scrollLeft);
      const closest = Math.abs(items[closestIndex].offsetLeft - scroller.scrollLeft);
      return current < closest ? index : closestIndex;
    }, 0);

    setActiveStageIndex(nextIndex);
    setCanScrollBack(scroller.scrollLeft > 4);
    setCanScrollForward(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4);
  }, []);

  const scrollToStage = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const boundedIndex = Math.min(Math.max(index, 0), displayedStages.length - 1);
    const item = scroller.querySelector<HTMLElement>(`[data-stage-index="${boundedIndex}"]`);
    item?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    setActiveStageIndex(boundedIndex);
  }, [displayedStages.length]);

  useEffect(() => {
    updateScrollState();
  }, [displayedStages.length, updateScrollState]);

  useEffect(() => {
    if (!isRtl) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const frame = requestAnimationFrame(() => {
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      if (maxScrollLeft > 0) {
        scroller.scrollLeft = maxScrollLeft;
        updateScrollState();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [displayedStages.length, isCompactViewport, isRtl, updateScrollState]);

  const moveWorkOrder = useCallback(async (id: string, toStage: Stage, focusTarget = false) => {
    const original = allCards.find((card) => card.id === id);
    if (!original || original.stage === toStage) return;

    const updated: WorkOrderCard = { ...original, stage: toStage };
    moveCard(id, original.stage, toStage, updated);
    syncWorkOrderCardQuery(qc, updated);

    if (focusTarget) {
      const targetIndex = displayedStages.indexOf(toStage);
      if (targetIndex >= 0) scrollToStage(targetIndex);
    }

    try {
      const { data } = await api.patch<WorkOrderCard>(`/work-orders/${id}/stage`, { newStage: toStage });
      moveCard(id, toStage, data.stage, data);
      syncWorkOrderCardQuery(qc, data);
      qc.invalidateQueries({ queryKey: ['work-order', id] });
      toast.success(t('board.toasts.movedTo', { stage: t(getStageKey(data.stage)) }));
    } catch (error) {
      revertMove(id, original.stage, toStage, original);
      syncWorkOrderCardQuery(qc, original);
      qc.invalidateQueries({ queryKey: ['work-order', id] });
      toast.error(getApiErrorMessage(error, t('board.toasts.moveFailed')));
    }
  }, [allCards, displayedStages, moveCard, qc, revertMove, scrollToStage, t]);

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const onDragOver = (event: DragOverEvent) => {
    const candidate = event.over?.id as Stage | undefined;
    setOverStage(candidate && displayedStages.includes(candidate) ? candidate : null);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setOverStage(null);
    const id = event.active.id as string;
    const toStage = event.over?.id as Stage | undefined;
    if (!toStage) return;
    await moveWorkOrder(id, toStage, isCompactViewport);
  };

  if (!board) return null;

  return (
    <div className={cn('min-w-0', isRtl && 'text-right')}>
      {isCompactViewport ? (
        <div className="space-y-3 px-4 pt-3">
          <div className={cn('flex flex-col gap-3 xl:items-center xl:justify-between', isRtl ? 'xl:flex-row-reverse' : 'xl:flex-row')}>
            <div dir="ltr" className={cn('flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', isRtl && 'justify-start')}>
              {displayedStages.map((stage, index) => {
                const active = activeStageIndex === index;
                const color = stageColors[stage];
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => scrollToStage(index)}
                    aria-current={active ? 'step' : undefined}
                    className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-[var(--radius-sm)] border px-3 text-sm transition ${active ? 'border-[var(--color-primary)] bg-[var(--color-surface-elevated)] text-[var(--color-text)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'}`}
                    style={active ? { boxShadow: `inset 0 -2px 0 ${color}` } : undefined}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    <span>{t(getStageKey(stage))}</span>
                    <span className="min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px]" style={{ background: colorMix(color, 13), color }}>{board[key(stage)].length}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-1">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => scrollToStage(activeStageIndex - 1)} disabled={!canScrollBack} title={t('board.help.previousStage')} aria-label={t('board.help.previousStage')}>
                {isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => scrollToStage(activeStageIndex + 1)} disabled={!canScrollForward} title={t('board.help.nextStage')} aria-label={t('board.help.nextStage')}>
                {isRtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </Button>
              <Button variant="ghost" size="sm" className="h-10 rounded-full px-4" onClick={() => setShowDelivered((value) => !value)}>
                {showDelivered ? t('common.actions.hideDelivered') : t('common.actions.showDelivered')}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/72 px-3 py-2 text-xs text-[var(--color-text-muted)]">
            <span>{t('board.help.compact')}</span>
            <span className="font-medium text-[var(--color-text-secondary)]">{t('board.help.stageProgress', { current: Math.min(activeStageIndex + 1, displayedStages.length), total: displayedStages.length })}</span>
          </div>
        </div>
      ) : (
        <div className={cn('flex items-center justify-between gap-3 px-4 pt-3', isRtl && 'flex-row-reverse')}>
          <p className="text-xs text-[var(--color-text-muted)]">{t('board.help.desktop')}</p>
          <Button variant="ghost" size="sm" className="h-10 rounded-full px-4" onClick={() => setShowDelivered((value) => !value)}>
            {showDelivered ? t('common.actions.hideDelivered') : t('common.actions.showDelivered')}
          </Button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragOver={onDragOver} onDragCancel={() => { setActiveId(null); setOverStage(null); }} onDragEnd={onDragEnd}>
        <div
          ref={scrollerRef}
          dir="ltr"
          className="min-w-0 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-24 pt-4 sm:pb-6"
          onScroll={updateScrollState}
          style={{ scrollSnapType: 'x proximity', scrollbarGutter: 'stable' }}
        >
          <div
            dir="ltr"
            className={cn('gap-3', isRtl ? 'pl-4' : 'pr-4', isCompactViewport ? 'flex w-max' : 'grid')}
            style={isCompactViewport ? undefined : {
              minWidth: `max(100%, ${displayedStages.length * 224}px)`,
              gridTemplateColumns: `repeat(${displayedStages.length}, minmax(220px, 1fr))`,
            }}
          >
            {displayedStages.map((stage, index) => (
              <div
                key={stage}
                data-stage-item
                data-stage-index={index}
                className={cn('scroll-mx-4', isCompactViewport ? 'shrink-0' : 'min-w-0')}
                style={{ scrollSnapAlign: 'start', width: isCompactViewport ? compactLaneWidth : undefined }}
              >
                <SortableContext items={board[key(stage)].map((card) => card.id)} strategy={verticalListSortingStrategy}>
                  <StageColumn
                    stage={stage}
                    workOrders={board[key(stage)]}
                    isOver={overStage === stage}
                    compact={isCompactViewport}
                    visibleStages={displayedStages}
                    onOpenDetail={onOpenDetail}
                    onMoveCard={(id, targetStage) => {
                      void moveWorkOrder(id, targetStage, true);
                    }}
                  />
                </SortableContext>
              </div>
            ))}
          </div>
        </div>
        <DragOverlay>{activeCard ? <div className="w-[288px] max-w-[calc(100vw-2rem)] scale-[1.02] opacity-90"><VehicleCard workOrder={activeCard} onOpenDetail={() => {}} compact={isCompactViewport} /></div> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
