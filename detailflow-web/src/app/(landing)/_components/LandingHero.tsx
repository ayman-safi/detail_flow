import Link from 'next/link';
import styles from './landing.module.css';

export function LandingHero() {
  return (
    <section className={styles.hero} aria-labelledby="landing-hero-title">
      <div className={styles.heroNoise} aria-hidden />
      <div className={styles.heroOrb} aria-hidden />
      <div className={`${styles.heroInner} ${styles.shell}`}>
        <div className={styles.heroCopy}>
          <p className={`${styles.eyebrow} ${styles.heroReveal}`}>DetailFlow للسوق السعودي</p>
          <h1 id="landing-hero-title" className={`${styles.heroTitle} ${styles.heroReveal} ${styles.heroDelay1}`}>
            Detail<span className={styles.goldText}>Flow</span>
            <br />
            تشغيل فاخر لورش التلميع والتفصيل
          </h1>
          <p className={`${styles.heroText} ${styles.heroReveal} ${styles.heroDelay2}`}>
            من رابط الحجز إلى تسليم السيارة، اجمع واتساب والحجوزات ولوحة العمليات وتتبع العميل في نظام واحد واضح.
          </p>
          <div className={`${styles.heroActions} ${styles.heroReveal} ${styles.heroDelay3}`}>
            <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/register">
              ابدأ مجانا
            </Link>
            <Link className={`${styles.button} ${styles.buttonGhost}`} href="/login">
              دخول لوحة التحكم
            </Link>
          </div>
          <div className={`${styles.heroMeta} ${styles.heroReveal} ${styles.heroDelay4}`} aria-label="مزايا سريعة">
            <span>RTL عربي</span>
            <span>واتساب جاهزية</span>
            <span>خطط SAR</span>
          </div>
        </div>

        <div className={`${styles.heroVisual} ${styles.heroReveal} ${styles.heroDelay3}`} aria-label="معاينة لوحة DetailFlow">
          <div className={styles.productWindow}>
            <div className={styles.windowBar}>
              <i aria-hidden />
              <i aria-hidden />
              <i aria-hidden />
              <span>لوحة عمليات اليوم</span>
            </div>
            <div className={styles.mockupContent}>
              <aside className={styles.sidePanel}>
                <div className={styles.sidePanelHeader}>
                  <span className={styles.shopBadge} aria-hidden />
                  <div>
                    <strong>لمعة الرياض</strong>
                    <small>حي العليا</small>
                  </div>
                </div>
                <div className={styles.metricGrid}>
                  <div className={styles.metricBlock}>
                    <strong>18</strong>
                    <span>سيارة نشطة</span>
                  </div>
                  <div className={styles.metricBlock}>
                    <strong>92%</strong>
                    <span>التزام بالمواعيد</span>
                  </div>
                  <div className={styles.metricBlock}>
                    <strong>4.9</strong>
                    <span>رضا العملاء</span>
                  </div>
                </div>
              </aside>

              <div className={styles.boardPanel}>
                <div className={styles.boardColumns}>
                  <article className={styles.boardColumn}>
                    <h3>حجز</h3>
                    <div className={styles.jobCard}>
                      <strong>مرسيدس S</strong>
                      <span>غسيل فاخر</span>
                    </div>
                    <div className={styles.jobCard}>
                      <strong>BMW X7</strong>
                      <span>سيراميك</span>
                    </div>
                  </article>
                  <article className={styles.boardColumn}>
                    <h3>وصل</h3>
                    <div className={styles.jobCard}>
                      <strong>لكزس ES</strong>
                      <span>تلميع داخلي</span>
                    </div>
                  </article>
                  <article className={`${styles.boardColumn} ${styles.boardColumnActive}`}>
                    <h3>غسيل</h3>
                    <div className={`${styles.jobCard} ${styles.jobCardGold}`}>
                      <strong>رنج روفر</strong>
                      <span>باقة كاملة</span>
                    </div>
                    <div className={styles.jobCard}>
                      <strong>لاندكروزر</strong>
                      <span>غسيل خارجي</span>
                    </div>
                  </article>
                  <article className={styles.boardColumn}>
                    <h3>جاهز</h3>
                    <div className={styles.jobCard}>
                      <strong>أودي Q8</strong>
                      <span>تم الإشعار</span>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
