import ar from './messages/ar.json';
import en from './messages/en.json';

export const dictionaries = {
  en,
  ar,
} as const;

export type AppLocale = keyof typeof dictionaries;
export type TranslationDictionary = (typeof dictionaries)[AppLocale];

export const defaultLocale: AppLocale = 'en';
export const localeCookieName = 'detailflow-locale';

export const localeMeta: Record<AppLocale, { dir: 'ltr' | 'rtl'; tag: string }> = {
  en: { dir: 'ltr', tag: 'en-US' },
  ar: { dir: 'rtl', tag: 'ar' },
};

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === 'en' || value === 'ar';
}

export function getLocale(value: string | undefined | null): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
