'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const router = useRouter();
  const pathname = usePathname();
  const isTokenPage = pathname === '/accept-invite' || pathname === '/reset-password';
  useEffect(() => { if (hydrated && user && !isTokenPage) router.replace('/board'); }, [hydrated, isTokenPage, user, router]);
  if (!hydrated) return null;
  return children;
}
