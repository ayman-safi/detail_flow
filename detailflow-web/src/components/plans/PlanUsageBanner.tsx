'use client';

import { AlertTriangle } from 'lucide-react';
import { usePlanStatus } from '@/hooks/usePlanStatus';
import { isUnlimitedLimit } from '@/lib/planLimits';
import { useI18n } from '@/i18n/I18nProvider';

export function PlanUsageBanner() {
  const { data: plan } = usePlanStatus();
  const { formatNumber, t } = useI18n();

  if (!plan || isUnlimitedLimit(plan.bookingsLimit)) return null;

  const threshold = plan.bookingWarningThreshold ?? Math.max(plan.bookingsLimit - 5, 0);
  const remaining = plan.bookingsRemaining ?? Math.max(plan.bookingsLimit - plan.bookingsUsed, 0);
  if (plan.bookingsUsed < threshold || remaining <= 0) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-950">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle size={16} className="shrink-0 text-amber-600" />
        <span>
          {t('planStatus.bookingWarning', {
            remaining: formatNumber(remaining),
            used: formatNumber(plan.bookingsUsed),
            limit: formatNumber(plan.bookingsLimit),
          })}
        </span>
      </div>
    </div>
  );
}
