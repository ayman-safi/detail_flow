'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { MarketingLocale, LandingCopy } from '@/app/(landing)/_content/marketingContent';

type Consent = 'accepted' | 'declined' | null;
type EventProperties = Record<string, string | number | boolean | undefined>;

const consentKey = 'detailflow-analytics-consent';

function deviceClass() {
  if (typeof window === 'undefined') return 'unknown';
  if (window.matchMedia('(max-width: 639px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1023px)').matches) return 'tablet';
  return 'desktop';
}

function referrerCategory() {
  if (typeof document === 'undefined' || !document.referrer) return 'direct';
  try {
    return new URL(document.referrer).hostname === window.location.hostname ? 'internal' : 'external';
  } catch {
    return 'unknown';
  }
}

async function posthogClient() {
  if (typeof window === 'undefined') return null;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  const { default: posthog } = await import('posthog-js');
  if (!posthog.__loaded) {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
      persistence: 'localStorage+cookie',
    });
  }
  return posthog;
}

export async function captureConsentedLandingEvent(
  event: string,
  properties: EventProperties = {},
) {
  if (typeof window === 'undefined' || window.localStorage.getItem(consentKey) !== 'accepted') return;
  const posthog = await posthogClient();
  posthog?.capture(event, {
    device_class: deviceClass(),
    referrer_category: referrerCategory(),
    campaign: new URLSearchParams(window.location.search).get('utm_campaign') || undefined,
    ...properties,
  });
}

type AnalyticsContextValue = {
  capture: (event: string, properties?: EventProperties) => void;
  openPreferences: () => void;
};

const AnalyticsContext = createContext<AnalyticsContextValue>({ capture: () => undefined, openPreferences: () => undefined });

export function MarketingAnalyticsProvider({
  children,
  locale,
  copy,
}: {
  children: React.ReactNode;
  locale: MarketingLocale;
  copy: LandingCopy['consent'];
}) {
  const [consent, setConsent] = useState<Consent>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const viewed = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(consentKey);
    queueMicrotask(() => {
      if (stored === 'accepted' || stored === 'declined') setConsent(stored);
      else setPreferencesOpen(true);
    });
  }, []);

  const capture = useCallback((event: string, properties: EventProperties = {}) => {
    void captureConsentedLandingEvent(event, { locale, ...properties });
  }, [locale]);

  useEffect(() => {
    if (consent === 'accepted' && !viewed.current) {
      viewed.current = true;
      capture('landing_viewed');
    }
  }, [capture, consent]);

  const choose = (next: Exclude<Consent, null>) => {
    window.localStorage.setItem(consentKey, next);
    setConsent(next);
    setPreferencesOpen(false);
    if (next === 'accepted') void posthogClient();
  };

  const value = useMemo<AnalyticsContextValue>(() => ({
    capture,
    openPreferences: () => setPreferencesOpen(true),
  }), [capture]);

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
      {preferencesOpen && (
        <section className="df-consent" role="dialog" aria-modal="false" aria-labelledby="df-consent-title">
          <div>
            <strong id="df-consent-title">{copy.title}</strong>
            <p>{copy.body}</p>
          </div>
          <div className="df-consent-actions">
            <button type="button" onClick={() => choose('declined')}>{copy.decline}</button>
            <button type="button" className="df-consent-accept" onClick={() => choose('accepted')}>{copy.accept}</button>
          </div>
        </section>
      )}
    </AnalyticsContext.Provider>
  );
}

export function useLandingAnalytics() {
  return useContext(AnalyticsContext);
}
