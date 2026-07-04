'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, LogIn } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import styles from './landing.module.css';

export function LandingHero() {
  const { t } = useI18n();

  return (
    <section className={styles.hero} aria-labelledby="landing-hero-title">
      <Image
        className={styles.heroImage}
        src="/detailflow-hero-workshop.png"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
      />
      <div className={styles.heroScrim} aria-hidden />
      <div className={`${styles.heroInner} ${styles.shell}`}>
        <div className={styles.heroCopy}>
          <p className={`${styles.eyebrow} ${styles.heroReveal}`}>{t('landing.hero.eyebrow')}</p>
          <h1 id="landing-hero-title" className={`${styles.heroTitle} ${styles.heroReveal} ${styles.heroDelay1}`}>
            <span className={styles.heroBrand}>
              {t('common.brandLead')}
              <span>{t('common.brandAccent')}</span>
            </span>
            {t('landing.hero.titleLineTwo')}
          </h1>
          <p className={`${styles.heroText} ${styles.heroReveal} ${styles.heroDelay2}`}>
            {t('landing.hero.text')}
          </p>
          <div className={`${styles.heroActions} ${styles.heroReveal} ${styles.heroDelay3}`}>
            <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/register">
              {t('landing.header.startFree')}
              <ArrowUpRight aria-hidden size={18} />
            </Link>
            <Link className={`${styles.button} ${styles.buttonGhost}`} href="/login">
              <LogIn aria-hidden size={18} />
              {t('landing.hero.dashboardLogin')}
            </Link>
          </div>
          <div className={`${styles.heroMeta} ${styles.heroReveal} ${styles.heroDelay4}`} aria-label={t('landing.hero.metaLabel')}>
            <span>{t('landing.hero.meta.0')}</span>
            <span>{t('landing.hero.meta.1')}</span>
            <span>{t('landing.hero.meta.2')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
