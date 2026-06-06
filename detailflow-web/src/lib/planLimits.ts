export type PlanLimitEventDetail = {
  message?: string;
};

const planLimitEventName = 'detailflow:plan-limit-exceeded';

export function emitPlanLimit(detail: PlanLimitEventDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PlanLimitEventDetail>(planLimitEventName, { detail }));
}

export function onPlanLimit(handler: (detail: PlanLimitEventDetail) => void) {
  if (typeof window === 'undefined') return () => {};

  const listener = (event: Event) => {
    handler((event as CustomEvent<PlanLimitEventDetail>).detail ?? {});
  };

  window.addEventListener(planLimitEventName, listener);
  return () => window.removeEventListener(planLimitEventName, listener);
}

export function isUnlimitedLimit(limit: number) {
  return limit >= 2147483647;
}
