import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://detailflow.app';
  return ['en', 'ar', 'tr'].flatMap((locale) => [
    { url: `${baseUrl}/${locale}`, changeFrequency: 'weekly' as const, priority: locale === 'en' ? 1 : .9 },
    { url: `${baseUrl}/${locale}/privacy`, changeFrequency: 'yearly' as const, priority: .2 },
    { url: `${baseUrl}/${locale}/cookies`, changeFrequency: 'yearly' as const, priority: .2 },
  ]);
}
