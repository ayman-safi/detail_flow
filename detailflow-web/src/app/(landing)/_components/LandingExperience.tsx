'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft, ArrowRight, BarChart3, CalendarDays, Camera, CarFront, Check, ChevronDown,
  CircleCheck, Clock3, FileText, Globe2, GripVertical, Menu, MessageCircle, Play, Sparkles, Users, X,
} from 'lucide-react';
import type { LandingCopy, MarketingLocale } from '../_content/marketingContent';
import { MarketingAnalyticsProvider, useLandingAnalytics } from '@/lib/landingAnalytics';
import analyticsDashboardDesktop from '../../../../public/analytics-dashboard-showcase.png';
import analyticsDashboardMobile from '../../../../public/analytics-dashboard-showcase-mobile.png';
import styles from './landing.module.css';

const localeLabels: Record<MarketingLocale, string> = { en: 'EN', ar: 'ع', tr: 'TR' };

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function TrackedLink({
  href = '/register',
  location,
  plan,
  className,
  children,
  onClick,
}: {
  href?: string;
  location: string;
  plan?: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const { capture } = useLandingAnalytics();
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        capture(plan ? 'pricing_plan_selected' : 'landing_cta_clicked', { cta_location: location, plan });
        onClick?.();
      }}
    >
      {children}
    </Link>
  );
}

function Header({ copy, locale }: { copy: LandingCopy; locale: MarketingLocale }) {
  const [open, setOpen] = useState(false);
  const { capture } = useLandingAnalytics();
  const links = [
    ['product', copy.nav.product],
    ['workflow', copy.nav.workflow],
    ['experience', copy.nav.experience],
    ['pricing', copy.nav.pricing],
  ];

  return (
    <header className={styles.header}>
      <div className={styles.navShell}>
        <Link href={`/${locale}`} className={styles.brand} aria-label="DetailFlow home">
          <span className={styles.brandMark}><span /></span>
          <span>DetailFlow</span>
        </Link>
        <nav className={styles.desktopNav} aria-label="Primary navigation">
          {links.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav>
        <div className={styles.navActions}>
          <div className={styles.localeGroup} aria-label={copy.nav.language}>
            {(Object.keys(localeLabels) as MarketingLocale[]).map((nextLocale) => (
              <Link
                key={nextLocale}
                href={`/${nextLocale}`}
                aria-current={locale === nextLocale ? 'page' : undefined}
                onClick={() => capture('locale_changed', { from_locale: locale, to_locale: nextLocale })}
              >
                {localeLabels[nextLocale]}
              </Link>
            ))}
          </div>
          <Link href="/login" className={styles.signIn}>{copy.nav.signIn}</Link>
          <TrackedLink location="navigation" className={styles.navCta}>{copy.nav.start}<ArrowIcon /></TrackedLink>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? copy.nav.closeMenu : copy.nav.openMenu}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <div className={styles.mobileNav}>
          {links.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>{label}</a>)}
          <Link href="/login">{copy.nav.signIn}</Link>
          <TrackedLink location="mobile_navigation">{copy.nav.start}</TrackedLink>
        </div>
      )}
    </header>
  );
}

function ArrowIcon() {
  return <span className={styles.arrowIcon} aria-hidden="true"><ArrowRight className={styles.ltrArrow} /><ArrowLeft className={styles.rtlArrow} /></span>;
}

function Hero({ copy, onTour }: { copy: LandingCopy; onTour: () => void }) {
  const [showFilm, setShowFilm] = useState(false);
  const reduceMotion = useReducedMotion();
  const { capture } = useLandingAnalytics();

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    queueMicrotask(() => {
      setShowFilm(window.matchMedia('(min-width: 768px)').matches && !reduceMotion && !connection?.saveData);
    });
  }, [reduceMotion]);

  return (
    <section className={styles.hero}>
      <div className={styles.heroMedia} aria-label={copy.hero.mediaLabel}>
        {showFilm && (
          <video
            className={styles.heroFilm}
            autoPlay
            muted
            loop
            playsInline
            poster="/detailflow-cinematic-hero.webp"
            aria-hidden="true"
          >
            <source src="/detailflow-hero-film.webm" type="video/webm" />
          </video>
        )}
      </div>
      <div className={styles.heroShade} />
      <div className={styles.heroGrid} />
      <div className={styles.heroContent}>
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className={styles.eyebrow}><Sparkles />{copy.hero.eyebrow}</p>
          <h1>{copy.hero.title}</h1>
          <p className={styles.heroBody}>{copy.hero.body}</p>
          <div className={styles.heroActions}>
            <TrackedLink location="hero" className={styles.primaryCta}>{copy.hero.primary}<ArrowIcon /></TrackedLink>
            <button
              type="button"
              className={styles.tourButton}
              onClick={() => { capture('product_tour_opened', { cta_location: 'hero' }); onTour(); }}
            >
              <span><Play fill="currentColor" /></span>{copy.hero.secondary}
            </button>
          </div>
          <div className={styles.proofStrip}>
            {copy.hero.proof.map((item) => <span key={item}><CircleCheck />{item}</span>)}
          </div>
        </motion.div>
      </div>
      <div className={styles.scrollCue}><span />SCROLL</div>
    </section>
  );
}

function BrowserFrame({ copy, active }: { copy: LandingCopy; active: number }) {
  return (
    <div className={styles.browserFrame}>
      <div className={styles.browserTop}>
        <div><i /><i /><i /></div>
        <span>{copy.product.windowTitle}</span>
        <b><span />{copy.product.live}</b>
      </div>
      <div className={styles.browserBody}>
        {active === 0 && <LiveBoard copy={copy} />}
        {active === 1 && <BookingPreview copy={copy} />}
        {active === 2 && <TrackingPreview copy={copy} />}
        {active === 3 && <PhotosPreview copy={copy} />}
        {active === 4 && <AnalyticsPreview copy={copy} />}
      </div>
    </div>
  );
}

function LiveBoard({ copy }: { copy: LandingCopy }) {
  const icons = [CalendarDays, Users, Clock3];
  const values = ['12', '6', '38%'];
  return (
    <div className={styles.boardPreview}>
      <div className={styles.metrics}>
        {Object.values(copy.product.metrics).map((metric, index) => {
          const Icon = icons[index];
          return <div key={metric}><Icon /><span>{metric}</span><strong>{values[index]}</strong></div>;
        })}
      </div>
      <div className={styles.boardColumns}>
        {copy.product.columns.map((column, index) => (
          <div key={column} className={styles.boardColumn}>
            <header><span>{column}</span><b>{index === 2 ? 3 : 2}</b></header>
            <article>
              <span className={styles.jobTime}>{copy.product.jobs[index].time}</span>
              <strong>{copy.product.jobs[index].vehicle}</strong>
              <small>{copy.product.jobs[index].service}</small>
              <div><i /><i /><i /></div>
            </article>
            {index === 2 && <article className={styles.mutedJob}><strong>BMW X5</strong><small>Paint correction</small></article>}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingPreview({ copy }: { copy: LandingCopy }) {
  return (
    <div className={styles.bookingPreview}>
      <div className={styles.formPreview}>
        <p className={styles.previewLabel}>{copy.product.booking.title}</p>
        <h3>{copy.product.booking.serviceValue}</h3>
        <label>{copy.product.booking.date}</label>
        <div className={styles.timeGrid}>{copy.product.booking.times.map((time, index) => <span className={index === 1 ? styles.selectedTime : ''} key={time}>{time}</span>)}</div>
        <button type="button">{copy.product.booking.confirm}<ArrowIcon /></button>
      </div>
      <div className={styles.bookingAmbient}><CalendarDays /><span>RIYADH SHINE</span><strong>04</strong><small>OPEN SLOTS</small></div>
    </div>
  );
}

function TrackingPreview({ copy }: { copy: LandingCopy }) {
  return (
    <div className={styles.trackingPreview}>
      <div className={styles.phoneMini}>
        <span className={styles.phoneNotch} />
        <small>{copy.product.tracking.title}</small>
        <h3>{copy.product.tracking.vehicle}</h3>
        <div className={styles.stageRail}>
          {copy.product.tracking.stages.map((stage, index) => <div key={stage} className={index < 3 ? styles.doneStage : ''}><i>{index < 3 ? <Check /> : null}</i><span>{stage}</span></div>)}
        </div>
        <p><MessageCircle />{copy.product.tracking.message}</p>
      </div>
    </div>
  );
}

function PhotosPreview({ copy }: { copy: LandingCopy }) {
  return (
    <div className={styles.photosPreview}>
      <div className={styles.photoPane}><span>{copy.product.photos.before}</span></div>
      <div className={`${styles.photoPane} ${styles.photoAfter}`}><span>{copy.product.photos.after}</span></div>
      <p><Camera />{copy.product.photos.note}</p>
    </div>
  );
}

function AnalyticsPreview({ copy }: { copy: LandingCopy }) {
  return (
    <div className={styles.analyticsPreview}>
      <picture className={styles.analyticsScreen}>
        <source media="(max-width: 760px)" srcSet={analyticsDashboardMobile.src} />
        <Image
          src={analyticsDashboardDesktop}
          alt={copy.product.analytics.title}
          sizes="(max-width: 760px) calc(100vw - 64px), (max-width: 1200px) calc(100vw - 120px), 1080px"
        />
      </picture>
    </div>
  );
}

function ProductSection({ copy }: { copy: LandingCopy }) {
  const [active, setActive] = useState(0);
  const { capture } = useLandingAnalytics();
  return (
    <section id="product" className={styles.productSection}>
      <Reveal className={styles.sectionHeading}>
        <p className={styles.eyebrow}>{copy.product.eyebrow}</p>
        <h2>{copy.product.title}</h2>
        <p>{copy.product.body}</p>
      </Reveal>
      <Reveal>
        <div className={styles.productTabs} role="tablist" aria-label={copy.product.title}>
          {copy.product.tabs.map((tab, index) => {
            const Icon = [BarChart3, CalendarDays, Globe2, Camera, Sparkles][index];
            return <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active === index}
              onClick={() => { setActive(index); capture('product_preview_changed', { preview: index }); }}
            >
              <Icon size={17} />{tab}
            </button>
          })}
        </div>
        <BrowserFrame copy={copy} active={active} />
      </Reveal>
    </section>
  );
}

function Workflow({ copy }: { copy: LandingCopy }) {
  const nodeIcons = [CalendarDays, CarFront, Users, Camera, Clock3, MessageCircle, FileText];
  const nodes = [
    { x: 8, y: 32 }, { x: 31, y: 15 }, { x: 49, y: 43 }, { x: 31, y: 72 },
    { x: 65, y: 17 }, { x: 68, y: 72 }, { x: 90, y: 47 },
  ];
  const links = [[0, 1], [0, 3], [0, 2], [1, 4], [2, 4], [2, 5], [3, 6], [4, 6], [5, 6]];
  return (
    <section id="workflow" className={styles.flowSection}>
      <Reveal className={styles.flowHeading}>
        <p className={styles.eyebrow}>{copy.workflow.eyebrow}</p>
        <h2>{copy.workflow.title}</h2>
        <p>{copy.workflow.body}</p>
      </Reveal>
      <Reveal className={styles.flowCanvas}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="flow-line" x1="0" x2="1">
              <stop offset="0" stopColor="#38bdf8" stopOpacity=".9" />
              <stop offset="1" stopColor="#0ea5e9" stopOpacity=".5" />
            </linearGradient>
          </defs>
          {links.map(([from, to], index) => {
            const start = nodes[from];
            const end = nodes[to];
            const controlX = (start.x + end.x) / 2;
            const path = `M ${start.x} ${start.y} C ${controlX} ${start.y}, ${controlX} ${end.y}, ${end.x} ${end.y}`;
            return (
              <g key={`${from}-${to}`}>
                <path d={path} stroke="url(#flow-line)" strokeWidth=".35" fill="none" opacity=".6" />
                <motion.circle
                  r=".58"
                  fill="#38bdf8"
                  data-flow-traveler={index}
                  initial={{ offsetDistance: '0%' }}
                  animate={{ offsetDistance: '100%' }}
                  transition={{ duration: 3 + index * .36, repeat: Infinity, ease: 'linear', delay: index * -.42 }}
                  style={{ offsetPath: `path('${path}')` } as React.CSSProperties}
                />
              </g>
            );
          })}
        </svg>
        <ol>
          {copy.workflow.nodes.map((node, index) => {
            const Icon = nodeIcons[index];
            return <li key={node} style={{ left: `${nodes[index].x}%`, top: `${nodes[index].y}%` }}><span><Icon /></span><b>{node}</b></li>;
          })}
        </ol>
      </Reveal>
    </section>
  );
}

function Experience({ copy }: { copy: LandingCopy }) {
  return (
    <section id="experience" className={styles.experience}>
      <div className={styles.experienceGlow} />
      <Reveal className={styles.experienceCopy}>
        <p className={styles.eyebrow}>{copy.experience.eyebrow}</p>
        <h2>{copy.experience.title}</h2>
        <p>{copy.experience.body}</p>
        <ul>{copy.experience.points.map((point) => <li key={point}><Check />{point}</li>)}</ul>
      </Reveal>
      <Reveal className={styles.trackingShowcase}>
        <div className={styles.trackingHalo} aria-hidden="true" />

        <div className={`${styles.trackingSideCard} ${styles.trackingStatusCard}`} aria-hidden="true">
          <span className={styles.trackingMicroLabel}><i />{copy.experience.live}</span>
          <div className={styles.statusVehicle}>
            <small>DF-3003</small>
            <h3>{copy.experience.vehicle}</h3>
            <p>{copy.experience.service}</p>
          </div>
          <div className={styles.statusProgress}>
            <span><b>{copy.experience.stages[2]}</b><small>3 / 6</small></span>
            <i><b /></i>
          </div>
        </div>

        <div className={styles.trackerPhone} aria-label={copy.experience.trackerLabel}>
          <span className={styles.trackerNotch} aria-hidden="true" />
          <div className={styles.trackerScreen}>
            <div className={styles.trackerTopline}>
              <strong>Detail<span>Flow</span></strong>
              <small><i />{copy.experience.live}</small>
            </div>
            <div className={styles.trackerVehicle}>
              <div>
                <code>DF-3003</code>
                <h3>{copy.experience.vehicle}<i /></h3>
                <p>{copy.experience.service}</p>
              </div>
            </div>
            <ol className={styles.trackerTimeline}>
              {copy.experience.stages.map((stage, index) => (
                <li key={stage} className={index < 2 ? styles.stageDone : index === 2 ? styles.stageActive : ''}>
                  <span>{index < 2 ? <Check /> : index + 1}</span>
                  <div><b>{stage}</b>{index === 2 && <small>{copy.experience.currentStage}</small>}</div>
                </li>
              ))}
            </ol>
            <div className={styles.trackerEta}>
              <Clock3 />
              <span>{copy.experience.estimatedReady}</span>
              <strong>{copy.experience.estimatedTime}</strong>
            </div>
          </div>
        </div>

        <div className={`${styles.trackingSideCard} ${styles.trackingReceiptCard}`} aria-hidden="true">
          <span className={styles.trackingMicroLabel}><FileText />{copy.experience.receipt}</span>
          <div className={styles.receiptSheet}>
            <span>DF-3003</span>
            <strong>{copy.experience.vehicle}</strong>
            <p>{copy.experience.service}</p>
            <i><Check /></i>
          </div>
          <p>{copy.experience.receiptNote}</p>
        </div>

        <div className={styles.trackingMessage} aria-hidden="true">
          <span><MessageCircle /></span>
          <div><small>{copy.experience.updateLabel}</small><p>{copy.experience.whatsapp}</p></div>
        </div>
      </Reveal>
    </section>
  );
}

function PhotoStory({ copy }: { copy: LandingCopy }) {
  const [compare, setCompare] = useState(50);
  return (
    <section className={styles.proofSection}>
      <Reveal className={styles.proofCopy}>
        <p className={styles.eyebrow}>{copy.photos.eyebrow}</p>
        <h2>{copy.photos.title}</h2>
        <p>{copy.photos.body}</p>
        <ul>{copy.photos.points.map((point) => <li key={point}><CircleCheck />{point}</li>)}</ul>
        <div className={styles.proofMeta}><span>{copy.photos.demo}</span><strong>{copy.photos.workOrder}</strong><small>{copy.photos.assigned}</small><b>{copy.photos.ready}</b></div>
      </Reveal>
      <Reveal className={styles.compareFrame}>
        <div className={styles.compareStage} style={{ '--compare': `${compare}%` } as React.CSSProperties}>
          <div className={styles.compareBefore}><span>{copy.photos.before}</span></div>
          <div className={styles.compareAfter}><span>{copy.photos.after}</span></div>
          <div className={styles.compareDivider} aria-hidden="true"><i><GripVertical /></i></div>
          <input
            dir="ltr"
            type="range"
            min="8"
            max="92"
            value={compare}
            onChange={(event) => setCompare(Number(event.target.value))}
            aria-label={copy.photos.compareHint}
            aria-valuetext={`${compare}% · ${copy.photos.after}`}
          />
        </div>
        <p>{copy.photos.compareHint}</p>
      </Reveal>
    </section>
  );
}

function Pricing({ copy }: { copy: LandingCopy }) {
  return (
    <section id="pricing" className={styles.pricing}>
      <Reveal className={styles.sectionHeading}><p className={styles.eyebrow}>{copy.pricing.eyebrow}</p><h2>{copy.pricing.title}</h2><p>{copy.pricing.body}</p></Reveal>
      <div className={styles.priceGrid}>
        {copy.pricing.plans.map((plan) => (
          <Reveal key={plan.name} className={`${styles.priceCard} ${plan.featured ? styles.featuredPlan : ''}`}>
            {plan.featured && <span className={styles.planBadge}>{copy.pricing.badge}</span>}
            <p>{plan.name}</p><h3>{plan.price}</h3><small>{plan.cadence}</small><b>{plan.note}</b>
            <ul>{plan.features.map((feature) => <li key={feature}><Check />{feature}</li>)}</ul>
            {plan.comingSoon ? <button type="button" disabled>{plan.cta}</button> : <TrackedLink location="pricing" plan={plan.name}>{plan.cta}<ArrowIcon /></TrackedLink>}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FAQ({ copy }: { copy: LandingCopy }) {
  return (
    <section id="faq" className={styles.faq}>
      <Reveal className={styles.faqHeading}><p className={styles.eyebrow}>{copy.faq.eyebrow}</p><h2>{copy.faq.title}</h2></Reveal>
      <Reveal className={styles.faqList}>
        {copy.faq.items.map((item, index) => <details key={item.question} open={index === 0}><summary>{item.question}<ChevronDown /></summary><p>{item.answer}</p></details>)}
      </Reveal>
    </section>
  );
}

function Footer({ copy, locale }: { copy: LandingCopy; locale: MarketingLocale }) {
  const { openPreferences } = useLandingAnalytics();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerMain}>
        <div><Link href={`/${locale}`} className={styles.brand}><span className={styles.brandMark}><span /></span><span>DetailFlow</span></Link><p>{copy.footer.tagline}</p></div>
        <div><strong>{copy.footer.product}</strong><a href="#product">{copy.nav.product}</a><a href="#workflow">{copy.nav.workflow}</a><a href="#pricing">{copy.nav.pricing}</a></div>
        <div><strong>{copy.footer.access}</strong><Link href="/login">{copy.nav.signIn}</Link><Link href="/register">{copy.nav.start}</Link></div>
        <div><strong>{copy.footer.contact}</strong><Link href={`/${locale}/privacy`}>{copy.footer.privacy}</Link><Link href={`/${locale}/cookies`}>{copy.footer.cookies}</Link><button type="button" onClick={openPreferences}>{copy.footer.manageCookies}</button></div>
      </div>
      <div className={styles.footerBottom}><span>{copy.footer.rights}</span><span>AR · EN · TR <span className={styles.liveDot} /> SYSTEM LIVE</span></div>
    </footer>
  );
}

function ProductTour({ copy, onClose }: { copy: LandingCopy; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { capture } = useLandingAnalytics();
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={styles.tourBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={styles.tourDialog} role="dialog" aria-modal="true" aria-labelledby="tour-title" tabIndex={-1} ref={dialogRef}>
        <button type="button" className={styles.tourClose} onClick={onClose} aria-label={copy.tour.close}><X /></button>
        <div className={styles.tourVisual}><BrowserFrame copy={copy} active={step === 0 ? 1 : step === 1 ? 0 : step === 2 ? 2 : 4} /></div>
        <div className={styles.tourCopy}>
          <p className={styles.eyebrow}>{copy.tour.label}</p><h2 id="tour-title">{copy.tour.title}</h2>
          <div className={styles.tourProgress}>{copy.tour.steps.map((_, index) => <i key={index} className={index <= step ? styles.tourProgressOn : ''} />)}</div>
          <span>0{step + 1} / 0{copy.tour.steps.length}</span><h3>{copy.tour.steps[step].title}</h3><p>{copy.tour.steps[step].body}</p>
          <div className={styles.tourActions}>
            <button type="button" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>{copy.tour.previous}</button>
            {step < copy.tour.steps.length - 1 ? (
              <button type="button" onClick={() => setStep((value) => value + 1)}>{copy.tour.next}<ArrowIcon /></button>
            ) : (
              <TrackedLink location="tour" className={styles.tourFinish} onClick={() => capture('product_tour_completed')}>{copy.tour.finish}<ArrowIcon /></TrackedLink>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExperienceInner({ copy, locale }: { copy: LandingCopy; locale: MarketingLocale }) {
  const [tourOpen, setTourOpen] = useState(false);
  return (
    <div className={styles.landingRoot} data-theme="dark" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Header copy={copy} locale={locale} />
      <main>
        <Hero copy={copy} onTour={() => setTourOpen(true)} />
        <ProductSection copy={copy} />
        <Workflow copy={copy} />
        <Experience copy={copy} />
        <PhotoStory copy={copy} />
        <Pricing copy={copy} />
        <FAQ copy={copy} />
        <section className={styles.finalCta}><Reveal><p className={styles.eyebrow}>{copy.final.eyebrow}</p><h2>{copy.final.title}</h2><p>{copy.final.body}</p><TrackedLink location="final" className={styles.primaryCta}>{copy.final.cta}<ArrowIcon /></TrackedLink></Reveal></section>
      </main>
      <Footer copy={copy} locale={locale} />
      {tourOpen && <ProductTour copy={copy} onClose={() => setTourOpen(false)} />}
    </div>
  );
}

export function LandingExperience({ copy, locale }: { copy: LandingCopy; locale: MarketingLocale }) {
  return <MarketingAnalyticsProvider locale={locale} copy={copy.consent}><ExperienceInner copy={copy} locale={locale} /></MarketingAnalyticsProvider>;
}
