import ar from './messages/ar.json';
import en from './messages/en.json';
import tr from './messages/tr.json';

export const dictionaries = {
  en,
  ar,
  tr,
} as const;

export type AppLocale = keyof typeof dictionaries;
export type TranslationDictionary = (typeof dictionaries)[AppLocale];

export const defaultLocale: AppLocale = 'en';
export const supportedLocales: AppLocale[] = ['en', 'ar', 'tr'];
export const localeCookieName = 'detailflow-locale';

export const localeMeta: Record<AppLocale, { dir: 'ltr' | 'rtl'; tag: string }> = {
  en: { dir: 'ltr', tag: 'en-US' },
  ar: { dir: 'rtl', tag: 'ar' },
  tr: { dir: 'ltr', tag: 'tr-TR' },
};

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === 'en' || value === 'ar' || value === 'tr';
}

export function getLocale(value: string | undefined | null): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
