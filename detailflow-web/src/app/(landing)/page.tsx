import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'DetailFlow | نظام تشغيل ورش التلميع والتفصيل في السعودية',
  description: 'منصة SaaS لإدارة حجوزات وعمليات ورش التلميع والتفصيل في السعودية مع تتبع العميل وإشعارات واتساب.',
};

export default function LandingPage() {
  return (
    <div className={styles.landingRoot} lang="ar-SA" dir="rtl">
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
