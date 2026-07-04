'use client';

import { Check } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { progressStageKeys, saudiPointKeys } from '../_content/landingContent';
import { Reveal } from './Reveal';
import styles from './landing.module.css';

export function SaudiSection() {
  const { t } = useI18n();

  return (
    <section className={`${styles.section} ${styles.sectionBorder}`} aria-labelledby="saudi-title">
      <div className={`${styles.shell} ${styles.splitGrid}`}>
        <Reveal>
          <p className={styles.eyebrow}>{t('landing.saudi.eyebrow')}</p>
          <h2 id="saudi-title" className={styles.sectionTitle}>
            {t('landing.saudi.title')}
          </h2>
          <p className={styles.sectionText}>
            {t('landing.saudi.text')}
          </p>
          <ul className={styles.saudiList}>
            {saudiPointKeys.map((pointKey) => (
              <li key={pointKey}>{t(pointKey)}</li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={140}>
          <div className={styles.phoneMockup} aria-label={t('landing.saudi.phoneLabel')}>
            <div className={styles.phoneScreen}>
              <div className={styles.bookingPanel}>
                <strong>{t('landing.saudi.bookingTitle')}</strong>
                <span>{t('landing.saudi.shopName')}</span>
                <div className={styles.serviceRow}>
                  <span>{t('landing.saudi.serviceName')}</span>
                  <b>{t('landing.saudi.servicePrice')}</b>
                </div>
                <div className={styles.slotsGrid}>
                  <span className={styles.slot}>10:00</span>
                  <span className={styles.slot}>11:30</span>
                  <span className={`${styles.slot} ${styles.slotActive}`}>01:00</span>
                  <span className={styles.slot}>02:30</span>
                  <span className={styles.slot}>04:00</span>
                  <span className={styles.slot}>05:30</span>
                </div>
              </div>

              <div className={styles.trackingPanel}>
                <strong>{t('landing.saudi.trackingTitle')}</strong>
                <span>{t('landing.saudi.trackingVehicle')}</span>
                <div className={styles.progressTrack}>
                  {progressStageKeys.map((itemKey, index) => (
                    <div className={styles.progressItem} key={itemKey}>
                      <span className={`${styles.progressDot} ${index < 3 ? styles.progressDone : ''}`}>
                        {index < 3 ? <Check aria-hidden size={14} /> : index + 1}
                      </span>
                      <span>{t(itemKey)}</span>
                    </div>
                  ))}
                </div>
                <p className={styles.cardText}>
                  {t('landing.saudi.whatsAppReadyPrefix')} <b>{t('landing.saudi.whatsAppReadyMessage')}</b>
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
