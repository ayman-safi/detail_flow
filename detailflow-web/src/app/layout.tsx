import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import './globals.css';
import { Providers } from './providers';
import { dictionaries, getLocale, isAppLocale, localeCookieName, localeMeta } from '@/i18n/config';

async function getRequestLocale() {
  const requestHeaders = await headers();
  const routeLocale = requestHeaders.get('x-detailflow-route-locale');
  if (isAppLocale(routeLocale)) return { locale: routeLocale, authoritative: true } as const;
  const cookieStore = await cookies();
  return { locale: getLocale(cookieStore.get(localeCookieName)?.value), authoritative: false } as const;
}

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestLocale();
  const messages = dictionaries[locale];
  return {
    title: messages.meta.title,
    description: messages.meta.description,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, authoritative } = await getRequestLocale();
  return (
    <html lang={localeMeta[locale].tag} dir={localeMeta[locale].dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-[var(--font-body)]">
        <Providers initialLocale={locale} initialLocaleAuthoritative={authoritative}>{children}</Providers>
      </body>
    </html>
  );
}
