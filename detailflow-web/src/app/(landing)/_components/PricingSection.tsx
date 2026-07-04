'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';
import { plans } from '../_content/landingContent';
import { Reveal } from './Reveal';
import styles from './landing.module.css';

export function PricingSection() {
  const { t } = useI18n();

  return (
    <section id="pricing" className={styles.section} aria-labelledby="pricing-title">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{t('landing.pricing.eyebrow')}</p>
          <h2 id="pricing-title" className={styles.sectionTitle}>
            {t('landing.pricing.title')}
          </h2>
          <p className={styles.sectionText}>
            {t('landing.pricing.text')}
          </p>
        </Reveal>

        <div className={styles.pricingGrid}>
          {plans.map((plan, index) => (
            <Reveal
              key={plan.nameKey}
              className={`${styles.planCard} ${plan.featured ? styles.planFeatured : ''} ${plan.comingLater ? styles.planComingLater : ''}`}
              delay={index * 90}
            >
              {plan.featured && <span className={styles.planBadge}>{t('landing.pricing.featuredBadge')}</span>}
              {plan.comingLater && <span className={styles.planBadge}>{t('landing.pricing.comingLaterBadge')}</span>}
              <h3 className={styles.planName}>{t(plan.nameKey)}</h3>
              <p className={styles.planNote}>{t(plan.noteKey)}</p>
              <div className={styles.planPrice}>{t(plan.priceKey)}</div>
              <ul className={styles.planFeatures}>
                {plan.featureKeys.map((featureKey) => (
                  <li key={featureKey}>{t(featureKey)}</li>
                ))}
              </ul>
              {plan.comingLater ? (
                <span className={`${styles.button} ${styles.buttonGhost} ${styles.buttonDisabled}`} aria-disabled="true">
                  {t(plan.ctaKey)}
                </span>
              ) : (
                <Link className={`${styles.button} ${plan.featured ? styles.buttonPrimary : styles.buttonGhost}`} href="/register">
                  {t(plan.ctaKey)}
                </Link>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
