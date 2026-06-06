'use client';

import { formatDistanceToNow } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  defaultLocale,
  dictionaries,
  getLocale,
  localeCookieName,
  localeMeta,
  type AppLocale,
  type TranslationDictionary,
} from './config';

type TranslationValues = Record<string, string | number>;

type I18nContextValue = {
  locale: AppLocale;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, values?: TranslationValues) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, currency?: string) => string;
  formatRelativeTime: (value: Date | string | number) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const dateFnsLocales = {
  en: enUS,
  ar: arSA,
} as const;

const currencySymbols: Record<string, string> = {
  SAR: 'SAR',
  USD: '$',
  TRY: 'TL',
  TL: 'TL',
  EUR: 'EUR',
  SYP: 'SYP',
};

function getMessage(messages: TranslationDictionary, key: string) {
  return key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, messages);
}

function interpolate(message: string, values?: TranslationValues) {
  if (!values) return message;
  return Object.entries(values).reduce(
    (result, [token, value]) => result.replaceAll(`{${token}}`, String(value)),
    message,
  );
}

function toDate(value: Date | string | number) {
  return value instanceof Date ? value : new Date(value);
}

export function I18nProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children: React.ReactNode;
  initialLocale?: AppLocale;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);
  const messages = dictionaries[locale];
  const dir = localeMeta[locale].dir;
  const isRtl = dir === 'rtl';

  useEffect(() => {
    const persisted = getLocale(window.localStorage.getItem(localeCookieName));
    if (persisted !== initialLocale) {
      setLocaleState(persisted);
    }
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = localeMeta[locale].tag;
    document.documentElement.dir = dir;
    document.cookie = `${localeCookieName}=${locale}; path=/; max-age=31536000; samesite=lax`;
    window.localStorage.setItem(localeCookieName, locale);
  }, [dir, locale]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback((key: string, values?: TranslationValues) => {
    const message = getMessage(messages, key);
    if (typeof message !== 'string') return key;
    return interpolate(message, values);
  }, [messages]);

  const formatDate = useCallback((value: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
    return new Intl.DateTimeFormat(localeMeta[locale].tag, options).format(toDate(value));
  }, [locale]);

  const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(localeMeta[locale].tag, options).format(value);
  }, [locale]);

  const formatCurrency = useCallback((value: number, currency = 'SAR') => {
    const normalizedCurrency = currency.toUpperCase();
    const amount = new Intl.NumberFormat(localeMeta[locale].tag, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
    const symbol = currencySymbols[normalizedCurrency] ?? normalizedCurrency;
    return normalizedCurrency === 'USD' && !isRtl ? `${symbol}${amount}` : `${amount} ${symbol}`;
  }, [isRtl, locale]);

  const formatRelativeTime = useCallback((value: Date | string | number) => {
    return formatDistanceToNow(toDate(value), {
      addSuffix: true,
      locale: dateFnsLocales[locale],
    });
  }, [locale]);

  const contextValue = useMemo<I18nContextValue>(() => ({
    locale,
    dir,
    isRtl,
    setLocale,
    t,
    formatDate,
    formatNumber,
    formatCurrency,
    formatRelativeTime,
  }), [dir, formatCurrency, formatDate, formatNumber, formatRelativeTime, isRtl, locale, setLocale, t]);

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
