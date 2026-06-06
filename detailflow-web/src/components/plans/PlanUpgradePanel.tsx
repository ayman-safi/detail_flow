'use client';

import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import { env } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/i18n/I18nProvider';

export function PlanUpgradePanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { t } = useI18n();

  const upgrade = () => {
    if (env.upgradeUrl) {
      window.open(env.upgradeUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    toast.success(t('planLimit.upgradeRequested'));
  };

  return (
    <Card className="p-6">
      <div className="max-w-[560px]">
        <div className="mb-4 grid h-11 w-11 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
          <Lock size={20} />
        </div>
        <h2 className="font-[var(--font-display)] text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{description}</p>
        <Button className="mt-5" onClick={upgrade}>{t('planLimit.upgradeCta')}</Button>
      </div>
    </Card>
  );
}
