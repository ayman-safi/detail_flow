import Link from 'next/link';
import { plans } from '../_content/landingContent';
import { Reveal } from './Reveal';
import styles from './landing.module.css';

export function PricingSection() {
  return (
    <section id="pricing" className={styles.section} aria-labelledby="pricing-title">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHeading}>
          <p className={styles.eyebrow}>الأسعار</p>
          <h2 id="pricing-title" className={styles.sectionTitle}>
            ابدأ مجانا، ثم اختر الخطة التي تناسب نمو الورشة
          </h2>
          <p className={styles.sectionText}>
            خطط بسيطة بدون تعقيد: المجاني للتجربة المنظمة، Pro للتشغيل اليومي، ودعم الفروع في Business قادم لاحقا.
          </p>
        </Reveal>

        <div className={styles.pricingGrid}>
          {plans.map((plan, index) => (
            <Reveal
              key={plan.name}
              className={`${styles.planCard} ${plan.featured ? styles.planFeatured : ''} ${plan.comingLater ? styles.planComingLater : ''}`}
              delay={index * 90}
            >
              {plan.featured && <span className={styles.planBadge}>الأكثر مناسبة</span>}
              {plan.comingLater && <span className={styles.planBadge}>قادم لاحقا</span>}
              <h3 className={styles.planName}>{plan.name}</h3>
              <p className={styles.planNote}>{plan.note}</p>
              <div className={styles.planPrice}>{plan.price}</div>
              <ul className={styles.planFeatures}>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {plan.comingLater ? (
                <span className={`${styles.button} ${styles.buttonGhost} ${styles.buttonDisabled}`} aria-disabled="true">
                  {plan.cta}
                </span>
              ) : (
                <Link className={`${styles.button} ${plan.featured ? styles.buttonPrimary : styles.buttonGhost}`} href="/register">
                  {plan.cta}
                </Link>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
