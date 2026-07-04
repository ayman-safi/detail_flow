'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';
import { navItems } from '../_content/landingContent';
import styles from './landing.module.css';

export function LandingFooter() {
  const { t } = useI18n();
  const brandName = `${t('common.brandLead')}${t('common.brandAccent')}`;

  return (
    <footer className={styles.footer}>
      <div className={`${styles.shell} ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <Link className={styles.brand} href="/" aria-label={brandName}>
            <span className={styles.brandMark} aria-hidden />
            <span className={styles.brandText}>
              <strong>
                {t('common.brandLead')}<span>{t('common.brandAccent')}</span>
              </strong>
              <small>{t('landing.footer.tagline')}</small>
            </span>
          </Link>
        </div>
        <div className={styles.footerColumn}>
          <h3>{t('landing.footer.product')}</h3>
          {navItems.slice(0, 3).map((item) => (
            <a key={item.href} href={item.href}>
              {t(item.labelKey)}
            </a>
          ))}
        </div>
        <div className={styles.footerColumn}>
          <h3>{t('landing.footer.access')}</h3>
          <Link href="/register">{t('landing.footer.createWorkspace')}</Link>
          <Link href="/login">{t('landing.footer.dashboardLogin')}</Link>
          <a href="#faq">{t('landing.footer.faq')}</a>
        </div>
        <div className={styles.footerColumn}>
          <h3>{t('landing.footer.contact')}</h3>
          <a href={`mailto:${t('landing.footer.email')}`}>{t('landing.footer.email')}</a>
          <a href={`tel:${t('landing.footer.phoneHref')}`}>{t('landing.footer.phone')}</a>
          <p>{t('landing.footer.country')}</p>
        </div>
      </div>
      <div className={`${styles.shell} ${styles.footerBottom}`}>
        <p>{t('landing.footer.rights')}</p>
      </div>
    </footer>
  );
}
