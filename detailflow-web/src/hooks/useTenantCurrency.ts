import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ReceiptSettings, TenantCurrency } from '@/types';

export const defaultTenantCurrency: TenantCurrency = 'SAR';

export const fallbackReceiptSettings: ReceiptSettings = {
  currency: defaultTenantCurrency,
  supportedCurrencies: [
    { currency: 'SAR', label: 'SAR', symbol: 'SAR' },
    { currency: 'USD', label: 'USD', symbol: '$' },
    { currency: 'TRY', label: 'TRY', symbol: 'TL' },
    { currency: 'EUR', label: 'EUR', symbol: 'EUR' },
    { currency: 'SYP', label: 'SYP', symbol: 'SYP' },
  ],
};

export function useReceiptSettings() {
  return useQuery<ReceiptSettings>({
    queryKey: ['receipt-settings'],
    queryFn: () => api.get<ReceiptSettings>('/settings/receipt').then((response) => response.data),
  });
}

export function useTenantCurrency() {
  const { data } = useReceiptSettings();
  return data?.currency ?? defaultTenantCurrency;
}
