import { notFound } from 'next/navigation';
import { isMarketingLocale, marketingContent } from '../../_content/marketingContent';
import { LegalPage } from '../../_components/LegalPage';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isMarketingLocale(locale)) notFound();
  const copy = marketingContent[locale].legal;
  return <LegalPage locale={locale} title={copy.privacyTitle} intro={copy.privacyIntro} sections={copy.privacySections} updated={copy.updated} back={copy.back} />;
}
