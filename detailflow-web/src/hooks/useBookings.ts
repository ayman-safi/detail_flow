import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Booking } from '@/types';

export function useBookings(date: string) {
  return useQuery({ queryKey: ['bookings', date], queryFn: () => api.get<Booking[]>('/bookings', { params: { date } }).then((r) => r.data) });
}
