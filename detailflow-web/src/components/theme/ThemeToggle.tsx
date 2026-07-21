'use client';

import { Moon, Sun } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0"
      onClick={toggleTheme}
      aria-label={t(`common.theme.use${nextTheme === 'light' ? 'Light' : 'Dark'}`)}
      title={t(`common.theme.use${nextTheme === 'light' ? 'Light' : 'Dark'}`)}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </Button>
  );
}
