import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { Providers } from './providers';
import { dictionaries, getLocale, localeCookieName } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = getLocale(cookieStore.get(localeCookieName)?.value);
  const messages = dictionaries[locale];
  return {
    title: messages.meta.title,
    description: messages.meta.description,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = getLocale(cookieStore.get(localeCookieName)?.value);
  return (
    <html lang={locale === 'ar' ? 'ar' : 'en'} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-[var(--font-body)]">
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
