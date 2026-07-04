'use client';

import { ArrowRight, BellDot, Clock, UsersRound } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { workflowSteps } from '../_content/landingContent';
import { Reveal } from './Reveal';
import styles from './landing.module.css';

export function WorkflowSection() {
  const { t } = useI18n();

  return (
    <section id="workflow" className={`${styles.section} ${styles.productSection}`} aria-labelledby="workflow-title">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{t('landing.workflow.eyebrow')}</p>
          <h2 id="workflow-title" className={styles.sectionTitle}>
            {t('landing.workflow.title')}
          </h2>
          <p className={styles.sectionText}>
            {t('landing.workflow.text')}
          </p>
        </Reveal>

        <Reveal className={styles.productDemo} delay={120}>
          <div className={styles.demoChrome}>
            <div className={styles.demoDots} aria-hidden>
              <i />
              <i />
              <i />
            </div>
            <span>{t('landing.hero.windowTitle')}</span>
            <b>{t('landing.hero.metrics.onTime')} 92%</b>
          </div>

          <div className={styles.demoGrid}>
            <aside className={styles.demoSidebar}>
              <div className={styles.sidePanelHeader}>
                <span className={styles.shopBadge} aria-hidden />
                <div>
                  <strong>{t('landing.hero.shopName')}</strong>
                  <small>{t('landing.hero.shopArea')}</small>
                </div>
              </div>
              <div className={styles.metricGrid}>
                <div className={styles.metricBlock}>
                  <strong>18</strong>
                  <span>{t('landing.hero.metrics.activeCars')}</span>
                </div>
                <div className={styles.metricBlock}>
                  <strong>6</strong>
                  <span>{t('common.labels.assignedStaff')}</span>
                </div>
                <div className={styles.metricBlock}>
                  <strong>4.9</strong>
                  <span>{t('landing.hero.metrics.customerSatisfaction')}</span>
                </div>
              </div>
            </aside>

            <div className={styles.boardPanel}>
              <div className={styles.boardColumns}>
                <article className={styles.boardColumn}>
                  <h3>{t('landing.hero.columns.booked')}</h3>
                  <div className={styles.jobCard}>
                    <strong>{t('landing.hero.jobs.mercedes')}</strong>
                    <span>{t('landing.hero.jobs.premiumWash')}</span>
                  </div>
                  <div className={styles.jobCard}>
                    <strong>{t('landing.hero.jobs.bmw')}</strong>
                    <span>{t('landing.hero.jobs.ceramic')}</span>
                  </div>
                </article>
                <article className={styles.boardColumn}>
                  <h3>{t('landing.hero.columns.arrived')}</h3>
                  <div className={styles.jobCard}>
                    <strong>{t('landing.hero.jobs.lexus')}</strong>
                    <span>{t('landing.hero.jobs.interiorPolish')}</span>
                  </div>
                </article>
                <article className={`${styles.boardColumn} ${styles.boardColumnActive}`}>
                  <h3>{t('landing.hero.columns.washing')}</h3>
                  <div className={`${styles.jobCard} ${styles.jobCardGold}`}>
                    <strong>{t('landing.hero.jobs.rangeRover')}</strong>
                    <span>{t('landing.hero.jobs.completePackage')}</span>
                  </div>
                  <div className={styles.jobCard}>
                    <strong>{t('landing.hero.jobs.landCruiser')}</strong>
                    <span>{t('landing.hero.jobs.exteriorWash')}</span>
                  </div>
                </article>
                <article className={styles.boardColumn}>
                  <h3>{t('landing.hero.columns.ready')}</h3>
                  <div className={styles.jobCard}>
                    <strong>{t('landing.hero.jobs.audi')}</strong>
                    <span>{t('landing.hero.jobs.notified')}</span>
                  </div>
                </article>
              </div>
            </div>

            <aside className={styles.demoFeed} aria-label={t('landing.hero.previewLabel')}>
              <div>
                <Clock aria-hidden size={18} />
                <span>11:30</span>
                <strong>{t('landing.hero.jobs.lexus')}</strong>
              </div>
              <div>
                <BellDot aria-hidden size={18} />
                <span>{t('landing.hero.columns.ready')}</span>
                <strong>{t('landing.hero.jobs.audi')}</strong>
              </div>
              <div>
                <UsersRound aria-hidden size={18} />
                <span>{t('landing.hero.metrics.customerSatisfaction')}</span>
                <strong>4.9/5</strong>
              </div>
            </aside>
          </div>
        </Reveal>

        <div className={styles.workflowGrid}>
          {workflowSteps.map((item, index) => (
            <Reveal key={item.step} className={styles.workflowCard} delay={index * 110}>
              <span className={styles.stepNumber}>{item.step}</span>
              <h3 className={styles.cardTitle}>{t(item.titleKey)}</h3>
              <p className={styles.cardText}>{t(item.bodyKey)}</p>
              <ArrowRight className={styles.stepArrow} aria-hidden size={18} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
