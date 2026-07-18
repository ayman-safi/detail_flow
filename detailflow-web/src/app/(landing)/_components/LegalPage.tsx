import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { MarketingLocale } from '../_content/marketingContent';
import styles from './landing.module.css';

export function LegalPage({ locale, title, intro, sections, updated, back }: {
  locale: MarketingLocale;
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
  updated: string;
  back: string;
}) {
  return (
    <main className={styles.legalPage} data-theme="dark" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Link href={`/${locale}`}>{locale === 'ar' ? <ArrowRight /> : <ArrowLeft />}{back}</Link>
      <p>{updated}</p>
      <h1>{title}</h1>
      <div className={styles.legalIntro}>{intro}</div>
      {sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}
    </main>
  );
}
