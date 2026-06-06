'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { faqs } from '../_content/landingContent';
import { Reveal } from './Reveal';
import styles from './landing.module.css';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className={`${styles.section} ${styles.sectionBorder}`} aria-labelledby="faq-title">
      <div className={`${styles.shell} ${styles.faqShell}`}>
        <Reveal className={styles.sectionHeading}>
          <p className={styles.eyebrow}>الأسئلة الشائعة</p>
          <h2 id="faq-title" className={styles.sectionTitle}>
            إجابات سريعة قبل أن تبدأ
          </h2>
        </Reveal>

        <div className={styles.faqList}>
          {faqs.map((item, index) => {
            const open = openIndex === index;
            const panelId = `landing-faq-panel-${index}`;
            return (
              <Reveal key={item.question} className={styles.faqItem} delay={index * 70}>
                <button
                  className={`${styles.faqButton} ${open ? styles.faqButtonOpen : ''}`}
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(open ? -1 : index)}
                >
                  <span>{item.question}</span>
                  <ChevronDown aria-hidden />
                </button>
                <div id={panelId} className={`${styles.faqPanel} ${open ? styles.faqPanelOpen : ''}`}>
                  <div className={styles.faqPanelInner}>
                    <p>{item.answer}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
