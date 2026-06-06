export const stageColors: Record<string, string> = {
  Booked: '#6366f1',
  Arrived: '#8b5cf6',
  Washing: '#3b82f6',
  Detailing: '#06b6d4',
  Polishing: '#f59e0b',
  Ready: '#22c55e',
  Delivered: '#475569',
};

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
