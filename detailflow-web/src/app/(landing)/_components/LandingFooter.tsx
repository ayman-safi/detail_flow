import Link from 'next/link';
import { navItems } from '../_content/landingContent';
import styles from './landing.module.css';

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.shell} ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <Link className={styles.brand} href="/" aria-label="DetailFlow">
            <span className={styles.brandMark} aria-hidden />
            <span className={styles.brandText}>
              <strong>
                Detail<span>Flow</span>
              </strong>
              <small>تشغيل فاخر لورش التلميع والتفصيل</small>
            </span>
          </Link>
        </div>
        <div className={styles.footerColumn}>
          <h3>المنتج</h3>
          {navItems.slice(0, 3).map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>
        <div className={styles.footerColumn}>
          <h3>الدخول</h3>
          <Link href="/register">إنشاء مساحة عمل</Link>
          <Link href="/login">دخول لوحة التحكم</Link>
          <a href="#faq">الأسئلة الشائعة</a>
        </div>
        <div className={styles.footerColumn}>
          <h3>التواصل</h3>
          <a href="mailto:hello@detailflow.sa">hello@detailflow.sa</a>
          <a href="tel:+966500000000">+966 50 000 0000</a>
          <p>المملكة العربية السعودية</p>
        </div>
      </div>
      <div className={`${styles.shell} ${styles.footerBottom}`}>
        <p>© 2026 DetailFlow. جميع الحقوق محفوظة.</p>
      </div>
    </footer>
  );
}
