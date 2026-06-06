'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const userId = user?.id;
  const router = useRouter();
  const authCheck = useQuery({
    queryKey: ['auth', 'me', userId],
    enabled: hydrated && !!userId,
    retry: false,
    queryFn: () => api.get<{ user: AuthUser }>('/auth/me').then((response) => response.data.user),
  });

  useEffect(() => {
    if (!hydrated) return;

    if (!userId) {
      router.replace('/login');
      return;
    }

    if (authCheck.isSuccess) {
      setAuth(authCheck.data);
      return;
    }

    if (authCheck.isError) {
      logout();
      router.replace('/login');
    }
  }, [authCheck.data, authCheck.isError, authCheck.isSuccess, hydrated, logout, router, setAuth, userId]);

  if (!hydrated || !user || !authCheck.isSuccess) return null;
  return <DashboardShell><ErrorBoundary>{children}</ErrorBoundary></DashboardShell>;
}
