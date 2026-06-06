import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ReceiptSettings, TenantCurrency } from '@/types';

export const defaultTenantCurrency: TenantCurrency = 'SAR';

export const fallbackReceiptSettings: ReceiptSettings = {
  currency: defaultTenantCurrency,
  supportedCurrencies: [
    { currency: 'SAR', label: 'Saudi riyal', symbol: 'SAR' },
    { currency: 'USD', label: 'US dollar', symbol: '$' },
    { currency: 'TRY', label: 'Turkish lira', symbol: 'TL' },
    { currency: 'EUR', label: 'Euro', symbol: 'EUR' },
    { currency: 'SYP', label: 'Syrian pound', symbol: 'SYP' },
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
