import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://detailflow.app';
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/board/', '/settings/'] }, sitemap: `${baseUrl}/sitemap.xml` };
}
