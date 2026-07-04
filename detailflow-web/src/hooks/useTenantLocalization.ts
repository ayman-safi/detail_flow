import useSWR from 'swr';
import { fetcher } from '@/lib/api';

interface LocalizationSettings {
  defaultLocale: string;
  availableLocales: string[];
}

export function useTenantLocalization() {
  const { data, error, isLoading, mutate } = useSWR<LocalizationSettings>(
    '/settings/localization',
    fetcher
  );

  return {
    settings: data,
    isLoading,
    isError: error,
    mutate,
  };
}
