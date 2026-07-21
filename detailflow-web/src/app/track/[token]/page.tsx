'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Car, Check, Clock, Download } from 'lucide-react';
import { isPast, parseISO } from 'date-fns';
import { env } from '@/lib/env';
import { useSSE } from '@/hooks/useSSE';
import type { Stage, TrackingInfo, TrackingStageChangedEvent } from '@/types';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { useI18n } from '@/i18n/I18nProvider';
import { boardBaseStageSequence, getStageKey } from '@/i18n/domain';
import { stageColors } from '@/styles/theme';

const stages: readonly Stage[] = ['Booked', 'Arrived', 'Washing', 'Detailing', 'Polishing', 'Ready', 'Delivered'];
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isStage = (value: unknown): value is Stage => typeof value === 'string' && stages.includes(value as Stage);
const isTrackingStageChangedEvent = (value: unknown): value is TrackingStageChangedEvent =>
  isObject(value)
  && isStage(value.newStage)
  && typeof value.newStageName === 'string';

export default function TrackingPage() {
  const token = useParams().token as string;
  const [info, setInfo] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'live' | 'polling' | 'loading'>('loading');
  const [justBecameReady, setJustBecameReady] = useState(false);
  const [, force] = useState(0);
  const { formatDate, formatRelativeTime, isRtl, locale, t } = useI18n();

  useEffect(() => {
    fetch(`${env.apiUrl}/work-orders/track/${token}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        setInfo(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    const interval = setInterval(() => force((value) => value + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (liveStatus !== 'polling') return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${env.apiUrl}/work-orders/track/${token}`);
        if (response.ok) setInfo(await response.json());
      } catch (error) {
        console.warn('Tracking polling failed', error);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [liveStatus, token]);

  useSSE(token ? `${env.apiUrl}/work-orders/track/${token}/stream` : null, {
    eventTypes: ['stage_changed'],
    onEvent: (_type, data) => {
      if (!isTrackingStageChangedEvent(data)) return;
      setInfo((previous) => {
        if (!previous) return previous;
        if (data.newStage === 'Ready' && previous.stage !== 'Ready') {
          setJustBecameReady(true);
          window.setTimeout(() => setJustBecameReady(false), 6000);
        }
        return {
          ...previous,
          stage: data.newStage,
          stageName: data.newStageName,
          estimatedReadyAt: data.estimatedReadyAt ?? previous.estimatedReadyAt,
          lastUpdatedAt: data.lastUpdatedAt ?? new Date().toISOString(),
        };
      });
    },
    onConnected: () => setLiveStatus('live'),
    onError: () => setLiveStatus('polling'),
  });

  const eta = info?.estimatedReadyAt ? parseISO(info.estimatedReadyAt) : null;
  const receiptUrl = useMemo(() => {
    const search = new URLSearchParams({ locale });
    return `${env.apiUrl}/work-orders/track/${encodeURIComponent(token)}/receipt?${search.toString()}`;
  }, [locale, token]);

  if (loading) {
    return (
      <main data-theme="light" className="min-h-screen bg-[var(--color-bg)] p-4">
        <div className="mx-auto max-w-[480px] space-y-4">
          <div className="skeleton h-14" />
          <div className="skeleton h-36" />
          <div className="skeleton h-96" />
        </div>
      </main>
    );
  }

  if (error || !info) {
    return (
      <main data-theme="light" className="grid min-h-screen place-items-center bg-[var(--color-bg)] p-6 text-center">
        <div>
          <Car className="mx-auto h-16 w-16 text-[var(--color-text-muted)]" />
          <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold">{t('tracking.notFoundTitle')}</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">{t('tracking.notFoundDescription')}</p>
        </div>
      </main>
    );
  }

  const current = info.stage === 'Delivered' ? boardBaseStageSequence.length : Math.max(0, boardBaseStageSequence.indexOf(info.stage));
  const readyOrDelivered = info.stage === 'Ready' || info.stage === 'Delivered';
  const showEta = eta && !readyOrDelivered;

  return (
    <main data-theme="light" dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="flex h-14 items-center gap-3 bg-white px-4 shadow-sm">
        {info.shopLogoUrl ? (
          <img src={info.shopLogoUrl} alt={info.shopName} className="h-8 w-8 rounded object-cover" />
        ) : (
          <span className="h-3 w-3 rotate-45 bg-[var(--color-primary)]" aria-hidden />
        )}
        <span className="font-[var(--font-display)] text-lg font-bold">{info.shopName}</span>
        <div className="ms-auto"><LocaleSwitcher compact /></div>
      </header>
      <div className="mx-auto max-w-[480px] p-4">
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            {info.vehicleColor && <span className="h-4 w-4 rounded-full border border-slate-200" style={{ background: info.vehicleColor }} />}
            <h1 className="min-w-0 flex-1 font-[var(--font-display)] text-xl font-bold">{info.vehicleMake && info.vehicleModel ? `${info.vehicleMake} ${info.vehicleModel}` : t('common.states.vehiclePending')}</h1>
            {info.vehiclePlate && <span dir="ltr" className="plate shrink-0 rounded bg-slate-100 px-2 py-1 text-sm">{info.vehiclePlate}</span>}
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{info.serviceName}</p>
          {readyOrDelivered && info.vehiclePlate && (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)] active:translate-y-px"
            >
              <Download size={16} />
              {t('common.actions.downloadReceipt')}
            </a>
          )}
        </section>

        {readyOrDelivered && (
          <section className="relative mt-4 overflow-hidden rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,#16a34a,#22c55e)] p-4 text-white">
            <h2 className="flex items-center gap-2 font-[var(--font-display)] font-bold">
              <Check size={18} /> {info.stage === 'Delivered' ? t('tracking.readyDeliveredTitle') : t('tracking.readyPickupTitle')}
            </h2>
            <p className="text-sm">{info.stage === 'Delivered' ? t('tracking.readyDeliveredDescription') : t('tracking.readyPickupDescription')}</p>
            {justBecameReady && Array.from({ length: 8 }).map((_, index) => (
              <span
                key={index}
                className="absolute h-2 w-2"
                style={{
                  left: `${10 + index * 11}%`,
                  top: -8,
                  background: ['#f59e0b', '#3b82f6', '#ef4444', '#fff'][index % 4],
                  animation: `confettiFall 1.8s ${index * 0.12}s linear forwards`,
                }}
              />
            ))}
          </section>
        )}

        <section dir="ltr" className="mt-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6">
          {boardBaseStageSequence.map((stage, index) => {
            const done = index < current;
            const active = index === current;
            const color = stageColors[stage];
            return (
              <div key={stage} className={`relative grid gap-4 pb-8 last:pb-0 ${isRtl ? 'grid-cols-[1fr_32px]' : 'grid-cols-[32px_1fr]'}`}>
                {index < boardBaseStageSequence.length - 1 && <span className={`absolute top-8 h-full w-px ${isRtl ? 'right-[15px]' : 'left-[15px]'}`} style={{ background: done ? '#22c55e' : '#e2e8f0' }} />}
                <span
                  className={`z-10 row-start-1 grid h-8 w-8 place-items-center rounded-full border text-sm ${isRtl ? 'col-start-2' : 'col-start-1'}`}
                  style={{
                    background: done ? '#22c55e' : active ? color : '#fff',
                    borderColor: active ? color : '#e2e8f0',
                    color: done || active ? '#fff' : '#94a3b8',
                    animation: active ? 'stagePulse 2s infinite' : undefined,
                  }}
                >
                  {done ? <Check size={16} /> : index + 1}
                </span>
                <div dir={isRtl ? 'rtl' : 'ltr'} className={`row-start-1 ${isRtl ? 'col-start-1 text-right' : 'col-start-2 text-left'}`}>
                  <h3 className="font-[var(--font-display)] text-sm font-semibold">{t(getStageKey(stage))}</h3>
                  {active && <p className="text-xs text-[var(--color-text-muted)]">{t('tracking.currentStage')}</p>}
                </div>
              </div>
            );
          })}
        </section>

        {showEta && (
          <section className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4">
            <p className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]"><Clock size={16} />{t('tracking.estimatedReadyBy')}</p>
            <p className="mt-1 font-[var(--font-display)] text-3xl font-bold">{formatDate(eta, { hour: 'numeric', minute: '2-digit' })}</p>
            {isPast(eta) && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('tracking.readySoon')}</p>}
          </section>
        )}

        <footer className="mt-6 border-t border-[var(--color-border)] pt-4 text-center text-xs text-[var(--color-text-muted)]">
          <p className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${liveStatus === 'live' ? 'bg-green-500' : 'bg-amber-500'}`} />
            {liveStatus === 'live' ? t('tracking.live') : t('tracking.polling')}
          </p>
          <p className="mt-1">{t('tracking.lastUpdated', { time: formatRelativeTime(parseISO(info.lastUpdatedAt)) })}</p>
          <p className="mt-5">{t('tracking.poweredBy', { brand: `${t('common.brandLead')}${t('common.brandAccent')}` })}</p>
        </footer>
      </div>
    </main>
  );
}
