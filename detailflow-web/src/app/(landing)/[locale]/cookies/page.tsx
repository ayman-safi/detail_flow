import { notFound } from 'next/navigation';
import { isMarketingLocale, marketingContent } from '../../_content/marketingContent';
import { LegalPage } from '../../_components/LegalPage';

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isMarketingLocale(locale)) notFound();
  const copy = marketingContent[locale].legal;
  return <LegalPage locale={locale} title={copy.cookiesTitle} intro={copy.cookiesIntro} sections={copy.cookiesSections} updated={copy.updated} back={copy.back} />;
}
