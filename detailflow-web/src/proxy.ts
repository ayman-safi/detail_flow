import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, isAppLocale, localeCookieName, type AppLocale } from '@/i18n/config';

function preferredLocale(request: NextRequest): AppLocale {
  const cookieLocale = request.cookies.get(localeCookieName)?.value;
  if (isAppLocale(cookieLocale)) return cookieLocale;

  const accepted = request.headers.get('accept-language')?.toLowerCase() ?? '';
  if (accepted.includes('ar')) return 'ar';
  if (accepted.includes('tr')) return 'tr';
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const firstSegment = request.nextUrl.pathname.split('/')[1];

  if (request.nextUrl.pathname === '/') {
    const locale = preferredLocale(request);
    const response = NextResponse.redirect(new URL(`/${locale}`, request.url));
    response.cookies.set(localeCookieName, locale, { path: '/', maxAge: 31_536_000, sameSite: 'lax' });
    return response;
  }

  if (isAppLocale(firstSegment)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-detailflow-route-locale', firstSegment);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.cookies.set(localeCookieName, firstSegment, { path: '/', maxAge: 31_536_000, sameSite: 'lax' });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/:locale(en|ar|tr)/:path*'],
};
