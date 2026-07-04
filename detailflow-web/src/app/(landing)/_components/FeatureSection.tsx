'use client';

import { BarChart3, CalendarCheck2, Columns3, MessageCircle, Route, UsersRound } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { features } from '../_content/landingContent';
import { Reveal } from './Reveal';
import styles from './landing.module.css';

const featureIcons = [CalendarCheck2, Columns3, Route, MessageCircle, BarChart3, UsersRound] as const;

export function FeatureSection() {
  const { t } = useI18n();

  return (
    <section id="features" className={styles.section} aria-labelledby="features-title">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{t('landing.features.eyebrow')}</p>
          <h2 id="features-title" className={styles.sectionTitle}>
            {t('landing.features.title')}
          </h2>
          <p className={styles.sectionText}>
            {t('landing.features.text')}
          </p>
        </Reveal>

        <div className={styles.featureGrid}>
          {features.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <Reveal key={feature.titleKey} className={styles.featureCard} delay={index * 70}>
                <span className={styles.featureIcon} aria-hidden>
                  <Icon strokeWidth={1.8} />
                </span>
                <h3 className={styles.cardTitle}>{t(feature.titleKey)}</h3>
                <p className={styles.cardText}>{t(feature.bodyKey)}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
