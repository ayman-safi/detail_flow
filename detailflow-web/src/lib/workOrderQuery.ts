import type { QueryClient } from '@tanstack/react-query';
import type { WorkOrderCard, WorkOrderDetail } from '@/types';

export function syncWorkOrderCardQuery(queryClient: QueryClient, card: WorkOrderCard) {
  queryClient.setQueryData<WorkOrderDetail | undefined>(['work-order', card.id], (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      card,
    };
  });
}
