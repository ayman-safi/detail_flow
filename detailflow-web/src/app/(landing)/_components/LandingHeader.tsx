'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { navItems } from '../_content/landingContent';
import styles from './landing.module.css';

export function LandingHeader() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const brandName = `${t('common.brandLead')}${t('common.brandAccent')}`;

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 16);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  const closeMenu = () => setOpen(false);

  return (
    <header className={`${styles.header} ${scrolled || open ? styles.headerActive : ''}`}>
      <nav className={`${styles.nav} ${styles.shell}`} aria-label={t('landing.header.navigationLabel')}>
        <Link className={styles.brand} href="/" aria-label={brandName}>
          <span className={styles.brandMark} aria-hidden />
          <span className={styles.brandText}>
            <strong>
              {t('common.brandLead')}<span>{t('common.brandAccent')}</span>
            </strong>
            <small>{t('landing.header.tagline')}</small>
          </span>
        </Link>

        <div className={styles.desktopNav}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {t(item.labelKey)}
            </a>
          ))}
        </div>

        <div className={styles.headerActions}>
          <Link className={`${styles.button} ${styles.buttonGhost} ${styles.buttonSmall}`} href="/login">
            {t('landing.header.login')}
          </Link>
          <Link className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonSmall}`} href="/register">
            {t('landing.header.startFree')}
          </Link>
        </div>

        <button
          className={styles.menuButton}
          type="button"
          aria-label={open ? t('landing.header.closeMenu') : t('landing.header.openMenu')}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className={`${styles.mobilePanel} ${open ? styles.mobilePanelOpen : ''}`}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMenu}>
              {t(item.labelKey)}
            </a>
          ))}
          <Link href="/login" onClick={closeMenu}>
            {t('landing.header.login')}
          </Link>
          <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/register" onClick={closeMenu}>
            {t('landing.header.startFree')}
          </Link>
        </div>
      </nav>
    </header>
  );
}
