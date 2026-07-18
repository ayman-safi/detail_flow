import { notFound } from 'next/navigation';
import { isMarketingLocale } from '../_content/marketingContent';

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }, { locale: 'tr' }];
}

export default async function LocaleLandingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isMarketingLocale(locale)) notFound();
  return <>{children}</>;
}
