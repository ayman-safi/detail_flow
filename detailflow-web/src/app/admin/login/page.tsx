'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ShieldCheck } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/shared/Logo';
import { useI18n } from '@/i18n/I18nProvider';

type FormData = {
  email: string;
  password: string;
};

export default function PlatformAdminLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState('');
  const schema = useMemo(() => z.object({
    email: z.string().email(t('platformAdmin.login.emailInvalid')),
    password: z.string().min(1, t('platformAdmin.login.passwordRequired')),
  }), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormData) => {
    setError('');
    try {
      const { data } = await api.post<{ user: AuthUser }>('/platform/auth/login', values);
      setAuth(data.user);
      router.push('/admin');
    } catch (error) {
      setError(getApiErrorMessage(error, t('platformAdmin.login.errorFallback')));
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bg)] px-4 text-[var(--color-text)]">
      <Card className="w-full max-w-[420px] p-8 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Logo />
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('platformAdmin.login.subtitle')}</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
            <ShieldCheck size={22} />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="platform-email">{t('common.labels.email')}</Label>
            <Input
              id="platform-email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="platform-password">{t('common.labels.password')}</Label>
            <Input
              id="platform-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </div>
          {error && <p role="alert" className="text-sm text-[var(--color-destructive)]">{error}</p>}
          <Button className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('auth.login.submit')}
          </Button>
        </form>
      </Card>
    </main>
  );
}
