import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { BoardData } from '@/types';

export function useBoard() {
  return useQuery({ queryKey: ['board'], queryFn: () => api.get<BoardData>('/work-orders/board').then((r) => r.data) });
}
