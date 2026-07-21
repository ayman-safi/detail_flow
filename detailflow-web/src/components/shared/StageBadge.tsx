'use client';

import type { Stage } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import { getStageKey } from '@/i18n/domain';
import { colorMix, stageColors } from '@/styles/theme';

export function StageBadge({ stage, size = 'sm' }: { stage: Stage; size?: 'sm' | 'md' }) {
  const { t } = useI18n();
  const color = stageColors[stage];
  return (
    <span className="stage-badge" style={{ background: colorMix(color, 13), border: `1px solid ${colorMix(color, 28)}`, color, fontSize: size === 'md' ? 13 : 11 }}>
      {t(getStageKey(stage))}
    </span>
  );
}
