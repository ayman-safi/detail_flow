import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { FaqSection } from './_components/FaqSection';
import { FeatureSection } from './_components/FeatureSection';
import { FinalCta } from './_components/FinalCta';
import { LandingFooter } from './_components/LandingFooter';
import { LandingHeader } from './_components/LandingHeader';
import { LandingHero } from './_components/LandingHero';
import { PricingSection } from './_components/PricingSection';
import { SaudiSection } from './_components/SaudiSection';
import { WorkflowSection } from './_components/WorkflowSection';
import styles from './_components/landing.module.css';
import { dictionaries, getLocale, localeCookieName } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = getLocale(cookieStore.get(localeCookieName)?.value);
  const messages = dictionaries[locale];

  return {
    title: messages.landing.meta.title,
    description: messages.landing.meta.description,
  };
}

export default function LandingPage() {
  return (
    <div className={styles.landingRoot}>
      <LandingHeader />
      <main>
        <LandingHero />
        <WorkflowSection />
        <SaudiSection />
        <FeatureSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
