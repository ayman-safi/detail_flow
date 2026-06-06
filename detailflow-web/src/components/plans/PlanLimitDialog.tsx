'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import { env } from '@/lib/env';
import { isUnlimitedLimit, onPlanLimit } from '@/lib/planLimits';
import { usePlanStatus } from '@/hooks/usePlanStatus';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useI18n } from '@/i18n/I18nProvider';

export function PlanLimitDialog() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const queryClient = useQueryClient();
  const { data: plan } = usePlanStatus();
  const { formatNumber, t } = useI18n();

  useEffect(() => onPlanLimit((detail) => {
    setMessage(detail.message);
    setOpen(true);
    queryClient.invalidateQueries({ queryKey: ['plan-status'] });
  }), [queryClient]);

  const usageText = useMemo(() => {
    if (!plan || isUnlimitedLimit(plan.bookingsLimit)) return null;
    return t('planLimit.bookingUsage', {
      used: formatNumber(plan.bookingsUsed),
      limit: formatNumber(plan.bookingsLimit),
    });
  }, [formatNumber, plan, t]);

  const upgrade = () => {
    if (env.upgradeUrl) {
      window.open(env.upgradeUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    toast.success(t('planLimit.upgradeRequested'));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
            <Lock size={20} />
          </div>
          <DialogTitle>{t(plan?.plan === 'Free' ? 'planLimit.freeTitle' : 'planLimit.title')}</DialogTitle>
          <DialogDescription>
            {message ?? usageText ?? t('planLimit.description')}
          </DialogDescription>
        </DialogHeader>
        {message && usageText && (
          <p className="mb-4 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
            {usageText}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={upgrade}>{t('planLimit.upgradeCta')}</Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>{t('planLimit.later')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
