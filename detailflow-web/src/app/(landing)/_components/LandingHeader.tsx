'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { navItems } from '../_content/landingContent';
import styles from './landing.module.css';

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 16);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  const closeMenu = () => setOpen(false);

  return (
    <header className={`${styles.header} ${scrolled || open ? styles.headerActive : ''}`}>
      <nav className={`${styles.nav} ${styles.shell}`} aria-label="التنقل الرئيسي">
        <Link className={styles.brand} href="/" aria-label="DetailFlow">
          <span className={styles.brandMark} aria-hidden />
          <span className={styles.brandText}>
            <strong>
              Detail<span>Flow</span>
            </strong>
            <small>منصة تشغيل فاخرة لورش التلميع والتفصيل في السعودية</small>
          </span>
        </Link>

        <div className={styles.desktopNav}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <div className={styles.headerActions}>
          <Link className={`${styles.button} ${styles.buttonGhost} ${styles.buttonSmall}`} href="/login">
            دخول
          </Link>
          <Link className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonSmall}`} href="/register">
            ابدأ مجانا
          </Link>
        </div>

        <button
          className={styles.menuButton}
          type="button"
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className={`${styles.mobilePanel} ${open ? styles.mobilePanelOpen : ''}`}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMenu}>
              {item.label}
            </a>
          ))}
          <Link href="/login" onClick={closeMenu}>
            دخول
          </Link>
          <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/register" onClick={closeMenu}>
            ابدأ مجانا
          </Link>
        </div>
      </nav>
    </header>
  );
}
