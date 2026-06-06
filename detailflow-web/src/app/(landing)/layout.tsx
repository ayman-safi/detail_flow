import { IBM_Plex_Sans_Arabic, Tajawal } from 'next/font/google';

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['500', '700', '800', '900'],
  variable: '--landing-font-display',
  display: 'swap',
});

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--landing-font-body',
  display: 'swap',
});

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${tajawal.variable} ${ibmPlexSansArabic.variable}`}>{children}</div>;
}
