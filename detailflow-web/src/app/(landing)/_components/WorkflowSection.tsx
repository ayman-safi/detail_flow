import { workflowSteps } from '../_content/landingContent';
import { Reveal } from './Reveal';
import styles from './landing.module.css';

export function WorkflowSection() {
  return (
    <section id="workflow" className={`${styles.section} ${styles.sectionBorder}`} aria-labelledby="workflow-title">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHeading}>
          <p className={styles.eyebrow}>مسار التشغيل</p>
          <h2 id="workflow-title" className={styles.sectionTitle}>
            من أول رسالة واتساب إلى تسليم السيارة
          </h2>
          <p className={styles.sectionText}>
            DetailFlow يحول اليوم التشغيلي إلى مراحل قابلة للقياس، بدون دفاتر، بدون رسائل ضائعة، وبدون تخمين.
          </p>
        </Reveal>

        <div className={styles.workflowGrid}>
          {workflowSteps.map((item, index) => (
            <Reveal key={item.step} className={styles.workflowCard} delay={index * 110}>
              <span className={styles.stepNumber}>{item.step}</span>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardText}>{item.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
