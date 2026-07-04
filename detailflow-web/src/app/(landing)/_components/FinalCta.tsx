'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';
import { Reveal } from './Reveal';
import styles from './landing.module.css';

export function FinalCta() {
  const { t } = useI18n();

  return (
    <section className={styles.finalCta} aria-labelledby="final-cta-title">
      <Reveal className={`${styles.shell} ${styles.finalInner}`}>
        <p className={styles.eyebrow}>{t('landing.finalCta.eyebrow')}</p>
        <h2 id="final-cta-title" className={styles.finalTitle}>
          {t('landing.finalCta.title')}
        </h2>
        <p className={styles.finalText}>
          {t('landing.finalCta.text')}
        </p>
        <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/register">
          {t('landing.finalCta.cta')}
        </Link>
      </Reveal>
    </section>
  );
}
