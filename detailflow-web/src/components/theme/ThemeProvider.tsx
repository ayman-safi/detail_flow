'use client';

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const storageKey = 'detailflow-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeListeners = new Set<() => void>();

function preferredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(storageKey);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function subscribeToTheme(onStoreChange: () => void) {
  themeListeners.add(onStoreChange);
  const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
  const handleMediaChange = () => onStoreChange();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey) onStoreChange();
  };

  mediaQuery.addEventListener('change', handleMediaChange);
  window.addEventListener('storage', handleStorage);
  return () => {
    themeListeners.delete(onStoreChange);
    mediaQuery.removeEventListener('change', handleMediaChange);
    window.removeEventListener('storage', handleStorage);
  };
}

function updateTheme(theme: Theme) {
  window.localStorage.setItem(storageKey, theme);
  applyTheme(theme);
  themeListeners.forEach((listener) => listener());
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(subscribeToTheme, preferredTheme, () => 'dark');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: updateTheme,
    toggleTheme: () => updateTheme(theme === 'dark' ? 'light' : 'dark'),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
