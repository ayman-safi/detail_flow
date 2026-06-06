import Link from 'next/link';
import { Reveal } from './Reveal';
import styles from './landing.module.css';

export function FinalCta() {
  return (
    <section className={styles.finalCta} aria-labelledby="final-cta-title">
      <Reveal className={`${styles.shell} ${styles.finalInner}`}>
        <p className={styles.eyebrow}>ابدأ اليوم</p>
        <h2 id="final-cta-title" className={styles.finalTitle}>
          حوّل تشغيل الورشة إلى نظام واضح قبل حجزك القادم
        </h2>
        <p className={styles.finalText}>
          أنشئ مساحة DetailFlow، شارك رابط الحجز، وابدأ إدارة السيارات والموظفين والعملاء من لوحة واحدة.
        </p>
        <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/register">
          ابدأ مجانا الآن
        </Link>
      </Reveal>
    </section>
  );
}
