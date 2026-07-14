import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface LocalizationSettings {
  defaultLocale: string;
  availableLocales: string[];
}

export function useTenantLocalization() {
  const queryClient = useQueryClient();
  const query = useQuery<LocalizationSettings>({
    queryKey: ['tenant-localization'],
    queryFn: () => api.get<LocalizationSettings>('/settings/localization').then((response) => response.data),
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    isError: query.error,
    mutate: () => queryClient.invalidateQueries({ queryKey: ['tenant-localization'] }),
  };
}
