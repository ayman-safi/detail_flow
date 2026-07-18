import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LandingExperience } from '../_components/LandingExperience';
import { isMarketingLocale, marketingContent } from '../_content/marketingContent';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://detailflow.app';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isMarketingLocale(locale)) return {};
  const copy = marketingContent[locale];
  return {
    title: copy.meta.title,
    description: copy.meta.description,
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: { en: `${baseUrl}/en`, ar: `${baseUrl}/ar`, tr: `${baseUrl}/tr`, 'x-default': `${baseUrl}/en` },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'ar' ? 'ar_SA' : locale === 'tr' ? 'tr_TR' : 'en_US',
      url: `${baseUrl}/${locale}`,
      siteName: 'DetailFlow',
      title: copy.meta.title,
      description: copy.meta.description,
      images: [{ url: `${baseUrl}/detailflow-cinematic-hero.webp`, width: 1743, height: 902, alt: copy.hero.mediaLabel }],
    },
    twitter: { card: 'summary_large_image', title: copy.meta.title, description: copy.meta.description, images: [`${baseUrl}/detailflow-cinematic-hero.webp`] },
  };
}

export default async function LocalizedLandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isMarketingLocale(locale)) notFound();
  const copy = marketingContent[locale];
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'DetailFlow',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: copy.meta.description,
    url: `${baseUrl}/${locale}`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'SAR', description: copy.pricing.plans[0].note },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll('<', '\\u003c') }} />
      <LandingExperience locale={locale} copy={copy} />
    </>
  );
}
