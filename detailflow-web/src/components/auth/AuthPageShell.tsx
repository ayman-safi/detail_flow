'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { Logo } from '@/components/shared/Logo';
import { useI18n } from '@/i18n/I18nProvider';
import styles from './authPage.module.css';

type AuthPageShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  heroTitle: string;
  heroBody: string;
  heroPoints: string[];
  switchHref: string;
  switchLabel: string;
};

export function AuthPageShell({
  children,
  eyebrow,
  title,
  subtitle,
  heroTitle,
  heroBody,
  heroPoints,
  switchHref,
  switchLabel,
}: AuthPageShellProps) {
  const { isRtl } = useI18n();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <main className={styles.root}>
      <div className={styles.media} aria-hidden="true" />
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <header className={styles.header}>
        <Link href="/" className={styles.homeLink} aria-label="DetailFlow home">
          <Logo />
        </Link>
        <LocaleSwitcher compact />
      </header>

      <section
        className={styles.story}
        aria-labelledby="auth-story-title"
      >
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 id="auth-story-title">{heroTitle}</h2>
        <p className={styles.storyBody}>{heroBody}</p>
        <ul className={styles.proofList}>
          {heroPoints.map((point) => (
            <li key={point}><Check aria-hidden="true" />{point}</li>
          ))}
        </ul>
      </section>

      <section
        className={styles.formPanel}
        aria-labelledby="auth-page-title"
      >
        <div className={styles.formIntro}>
          <p>{eyebrow}</p>
          <h1 id="auth-page-title">{title}</h1>
          <span>{subtitle}</span>
        </div>
        {children}
        <Link href={switchHref} className={styles.switchLink}>
          <span>{switchLabel}</span>
          <Arrow aria-hidden="true" />
        </Link>
      </section>

      <p className={styles.footnote}>DetailFlow / Operations, refined.</p>
    </main>
  );
}
