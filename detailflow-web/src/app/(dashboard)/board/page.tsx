'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CircleCheck, Plus, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { env } from '@/lib/env';
import { syncWorkOrderCardQuery } from '@/lib/workOrderQuery';
import { useAuthStore } from '@/store/authStore';
import { useBoardStore } from '@/store/boardStore';
import { useSSE } from '@/hooks/useSSE';
import type { BoardData, BoardStageChangedEvent, BoardWorkOrderEvent, BoardWorkOrderRemovedEvent, Stage, WorkOrderCard } from '@/types';
import { Button } from '@/components/ui/button';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { VehicleCardSkeleton } from '@/components/board/VehicleCardSkeleton';
import { WorkOrderSheet } from '@/components/board/WorkOrderSheet';
import { AddWalkInModal } from '@/components/board/AddWalkInModal';
import { SSEStatusDot } from '@/components/shared/SSEStatusDot';
import { useI18n } from '@/i18n/I18nProvider';

const stages: readonly Stage[] = ['Booked', 'Arrived', 'Washing', 'Detailing', 'Polishing', 'Ready', 'Delivered'];
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isStage = (value: unknown): value is Stage => typeof value === 'string' && stages.includes(value as Stage);
const isWorkOrderCard = (value: unknown): value is WorkOrderCard =>
  isObject(value) && typeof value.id === 'string' && isStage(value.stage);
const isStageChangedEvent = (value: unknown): value is BoardStageChangedEvent =>
  isObject(value)
  && typeof value.workOrderId === 'string'
  && isStage(value.fromStage)
  && isStage(value.toStage)
  && isWorkOrderCard(value.workOrder);
const isWorkOrderEvent = (value: unknown): value is BoardWorkOrderEvent =>
  isObject(value) && isWorkOrderCard(value.workOrder);
const isRemovedEvent = (value: unknown): value is BoardWorkOrderRemovedEvent =>
  isObject(value) && typeof value.workOrderId === 'string';

export default function BoardPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const setBoard = useBoardStore((state) => state.setBoard);
  const board = useBoardStore((state) => state.board);
  const moveCard = useBoardStore((state) => state.moveCard);
  const addCard = useBoardStore((state) => state.addCard);
  const updateCard = useBoardStore((state) => state.updateCard);
  const removeCard = useBoardStore((state) => state.removeCard);
  const setSseStatus = useBoardStore((state) => state.setSseStatus);
  const user = useAuthStore((state) => state.user);
  const qc = useQueryClient();
  const { isRtl, t } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ['board'], queryFn: () => api.get<BoardData>('/work-orders/board').then((response) => response.data), refetchOnWindowFocus: false });

  useEffect(() => {
    if (data) setBoard(data);
  }, [data, setBoard]);

  const { status } = useSSE(user ? `${env.apiUrl}/work-orders/board/stream` : null, {
    onEvent: (type, event) => {
      if (type === 'stage_changed' && isStageChangedEvent(event)) {
        moveCard(event.workOrderId, event.fromStage, event.toStage, event.workOrder);
        syncWorkOrderCardQuery(qc, event.workOrder);
        qc.invalidateQueries({ queryKey: ['work-order', event.workOrderId] });
      }
      if (type === 'work_order_created' && isWorkOrderEvent(event)) addCard(event.workOrder);
      if (type === 'work_order_updated' && isWorkOrderEvent(event)) {
        updateCard(event.workOrder);
        syncWorkOrderCardQuery(qc, event.workOrder);
        qc.invalidateQueries({ queryKey: ['work-order', event.workOrder.id] });
      }
      if (type === 'work_order_removed' && isRemovedEvent(event)) {
        removeCard(event.workOrderId);
        qc.invalidateQueries({ queryKey: ['work-order', event.workOrderId] });
      }
    },
    onConnected: () => toast.success(t('board.toasts.liveActive')),
    onError: () => toast.error(t('board.toasts.liveLost')),
    withCredentials: true,
  });

  useEffect(() => {
    setSseStatus(status);
  }, [setSseStatus, status]);

  const activeCount = board ? ['arrived', 'washing', 'detailing', 'polishing'].flatMap((stage) => board[stage as keyof BoardData]).length : 0;
  const readyCount = board?.ready.length ?? 0;
  const todayCompleted = board?.delivered.length ?? 0;
  const summaryItems = [
    {
      label: t('board.summary.active'),
      value: activeCount,
      icon: Wrench,
      iconClassName: 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]',
    },
    {
      label: t('board.summary.ready'),
      value: readyCount,
      icon: BellRing,
      iconClassName: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)]',
    },
    {
      label: t('board.summary.completed'),
      value: todayCompleted,
      icon: CircleCheck,
      iconClassName: 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
    },
  ];

  return (
    <div className="relative min-h-full pb-24">
      <div className="flex flex-col gap-3 px-4 pt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid w-full flex-1 grid-cols-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/90 shadow-[var(--shadow-sm)] lg:max-w-xl">
          {summaryItems.map(({ label, value, icon: Icon, iconClassName }, index) => (
            <div key={label} className={`min-w-0 px-3 py-2.5 sm:px-4 ${index > 0 ? 'border-s border-[var(--color-border)]' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${iconClassName}`} aria-hidden="true">
                  <Icon size={16} strokeWidth={2.25} />
                </span>
                <span className="font-[var(--font-display)] text-xl font-bold tabular-nums">{value}</span>
              </div>
              <span className="mt-1.5 block truncate text-[11px] font-medium text-[var(--color-text-muted)] sm:text-xs">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-muted)] lg:self-auto">
          <SSEStatusDot status={status} />
          {t('board.summary.liveBoard')}
        </div>
      </div>
      {isLoading && <div className="grid gap-3 px-4 pb-6 pt-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{Array.from({ length: 6 }).map((_, column) => <div key={column} className="min-w-0 space-y-2">{Array.from({ length: 3 }).map((__, index) => <VehicleCardSkeleton key={index} />)}</div>)}</div>}
      {!isLoading && <KanbanBoard onOpenDetail={setSelected} />}
      <Button className={`fixed bottom-4 h-11 rounded-full px-4 shadow-[var(--shadow-popover)] sm:bottom-6 sm:h-12 sm:px-5 ${isRtl ? 'left-4 sm:left-6' : 'right-4 sm:right-6'}`} onClick={() => setWalkInOpen(true)}>
        <Plus size={18} />
        {t('board.walkIn.title')}
      </Button>
      <WorkOrderSheet workOrderId={selected} onClose={() => setSelected(null)} />
      <AddWalkInModal open={walkInOpen} onClose={() => setWalkInOpen(false)} />
    </div>
  );
}
