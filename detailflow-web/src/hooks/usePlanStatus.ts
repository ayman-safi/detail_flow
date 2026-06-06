import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { PlanStatus } from '@/types';

export function usePlanStatus() {
  const user = useAuthStore((state) => state.user);

  return useQuery<PlanStatus>({
    queryKey: ['plan-status'],
    enabled: !!user,
    queryFn: () => api.get<PlanStatus>('/plan/status').then((response) => response.data),
    staleTime: 60_000,
  });
}
