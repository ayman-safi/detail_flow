import { BarChart3, CalendarCheck2, Columns3, MessageCircle, Route, UsersRound } from 'lucide-react';
import { features } from '../_content/landingContent';
import { Reveal } from './Reveal';
import styles from './landing.module.css';

const featureIcons = [CalendarCheck2, Columns3, Route, MessageCircle, BarChart3, UsersRound] as const;

export function FeatureSection() {
  return (
    <section id="features" className={styles.section} aria-labelledby="features-title">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHeading}>
          <p className={styles.eyebrow}>الميزات</p>
          <h2 id="features-title" className={styles.sectionTitle}>
            كل ما تحتاجه ورشة تفصيل محترفة في مساحة واحدة
          </h2>
          <p className={styles.sectionText}>
            أدوات قليلة لكنها حاسمة: حجز، تشغيل، تتبع، واتساب، وتحليلات تقرأ أداء الورشة بسرعة.
          </p>
        </Reveal>

        <div className={styles.featureGrid}>
          {features.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <Reveal key={feature.title} className={styles.featureCard} delay={index * 70}>
                <span className={styles.featureIcon} aria-hidden>
                  <Icon strokeWidth={1.8} />
                </span>
                <h3 className={styles.cardTitle}>{feature.title}</h3>
                <p className={styles.cardText}>{feature.body}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
