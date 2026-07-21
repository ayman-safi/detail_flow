export const stageColors: Record<string, string> = {
  Booked: 'var(--stage-booked)',
  Arrived: 'var(--stage-arrived)',
  Washing: 'var(--stage-washing)',
  Detailing: 'var(--stage-detailing)',
  Polishing: 'var(--stage-polishing)',
  Ready: 'var(--stage-ready)',
  Delivered: 'var(--stage-delivered)',
};

export function colorMix(color: string, percentage: number) {
  return `color-mix(in srgb, ${color} ${percentage}%, transparent)`;
}

export const stageLabels: Record<string, string> = {
  Booked: 'Booked',
  Arrived: 'Arrived',
  Washing: 'Washing',
  Detailing: 'Detailing',
  Polishing: 'Polishing',
  Ready: 'Ready',
  Delivered: 'Delivered',
};

export const stageOrder = ['Booked', 'Arrived', 'Washing', 'Detailing', 'Polishing', 'Ready', 'Delivered'] as const;
export type Stage = typeof stageOrder[number];
