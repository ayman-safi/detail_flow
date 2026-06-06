import { saudiPoints } from '../_content/landingContent';
import { Reveal } from './Reveal';
import styles from './landing.module.css';

export function SaudiSection() {
  return (
    <section className={`${styles.section} ${styles.sectionBorder}`} aria-labelledby="saudi-title">
      <div className={`${styles.shell} ${styles.splitGrid}`}>
        <Reveal>
          <p className={styles.eyebrow}>مصمم للسعودية</p>
          <h2 id="saudi-title" className={styles.sectionTitle}>
            تجربة عربية تناسب طريقة عمل ورش التلميع في الرياض وجدة والدمام
          </h2>
          <p className={styles.sectionText}>
            العملاء يحجزون من الجوال، يسألون عبر واتساب، ويتوقعون معرفة حالة السيارة بدون اتصال متكرر. DetailFlow يبني حول هذه الحقيقة.
          </p>
          <ul className={styles.saudiList}>
            {saudiPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={140}>
          <div className={styles.phoneMockup} aria-label="معاينة صفحة الحجز والتتبع على الجوال">
            <div className={styles.phoneScreen}>
              <div className={styles.bookingPanel}>
                <strong>حجز خدمة</strong>
                <span>لمعة الرياض للتفصيل</span>
                <div className={styles.serviceRow}>
                  <span>تلميع كامل</span>
                  <b>220 ريال</b>
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
                <strong>تتبع السيارة</strong>
                <span>رنج روفر - باقة كاملة</span>
                <div className={styles.progressTrack}>
                  {['محجوز', 'وصل', 'غسيل', 'جاهز'].map((item, index) => (
                    <div className={styles.progressItem} key={item}>
                      <span className={`${styles.progressDot} ${index < 3 ? styles.progressDone : ''}`}>
                        {index < 3 ? '✓' : index + 1}
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <p className={styles.cardText}>
                  إشعار واتساب عند الجاهزية: <b>مركبتك جاهزة للاستلام</b>
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
