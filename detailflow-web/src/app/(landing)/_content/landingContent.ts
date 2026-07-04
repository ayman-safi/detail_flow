export const navItems = [
  { labelKey: 'landing.nav.product', href: '#workflow' },
  { labelKey: 'landing.nav.features', href: '#features' },
  { labelKey: 'landing.nav.pricing', href: '#pricing' },
  { labelKey: 'landing.nav.faq', href: '#faq' },
] as const;

export const workflowSteps = [
  {
    step: '01',
    titleKey: 'landing.workflow.steps.0.title',
    bodyKey: 'landing.workflow.steps.0.body',
  },
  {
    step: '02',
    titleKey: 'landing.workflow.steps.1.title',
    bodyKey: 'landing.workflow.steps.1.body',
  },
  {
    step: '03',
    titleKey: 'landing.workflow.steps.2.title',
    bodyKey: 'landing.workflow.steps.2.body',
  },
] as const;

export const features = Array.from({ length: 6 }, (_, index) => ({
  titleKey: `landing.features.items.${index}.title`,
  bodyKey: `landing.features.items.${index}.body`,
})) as {
  titleKey: string;
  bodyKey: string;
}[];

export const saudiPointKeys = Array.from({ length: 4 }, (_, index) => `landing.saudi.points.${index}`);

export const progressStageKeys = Array.from({ length: 4 }, (_, index) => `landing.saudi.progressStages.${index}`);

export const plans = [
  {
    nameKey: 'landing.pricing.plans.0.name',
    priceKey: 'landing.pricing.plans.0.price',
    noteKey: 'landing.pricing.plans.0.note',
    featureKeys: Array.from({ length: 5 }, (_, index) => `landing.pricing.plans.0.features.${index}`),
    ctaKey: 'landing.pricing.plans.0.cta',
    featured: false,
    comingLater: false,
  },
  {
    nameKey: 'landing.pricing.plans.1.name',
    priceKey: 'landing.pricing.plans.1.price',
    noteKey: 'landing.pricing.plans.1.note',
    featureKeys: Array.from({ length: 5 }, (_, index) => `landing.pricing.plans.1.features.${index}`),
    ctaKey: 'landing.pricing.plans.1.cta',
    featured: true,
    comingLater: false,
  },
  {
    nameKey: 'landing.pricing.plans.2.name',
    priceKey: 'landing.pricing.plans.2.price',
    noteKey: 'landing.pricing.plans.2.note',
    featureKeys: Array.from({ length: 4 }, (_, index) => `landing.pricing.plans.2.features.${index}`),
    ctaKey: 'landing.pricing.plans.2.cta',
    featured: false,
    comingLater: true,
  },
] as const;

export const faqs = Array.from({ length: 5 }, (_, index) => ({
  questionKey: `landing.faq.items.${index}.question`,
  answerKey: `landing.faq.items.${index}.answer`,
}));
