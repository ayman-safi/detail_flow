'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { Logo } from '@/components/shared/Logo';
import { useI18n } from '@/i18n/I18nProvider';

type FormData = {
  email: string;
  password: string;
  tenantSlug: string;
};

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const { t } = useI18n();
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    tenantSlug: z.string().min(1),
  });
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormData) => {
    setError('');
    try {
      const { data } = await api.post<{ user: AuthUser }>('/auth/login', values);
      setAuth(data.user);
      router.push('/board');
    } catch (error) {
      setError(getApiErrorMessage(error, t('auth.login.errorFallback')));
    }
  };

  return (
    <main
      className="grid min-h-screen place-items-center bg-[var(--color-bg)] px-4"
      style={{ backgroundImage: 'radial-gradient(circle, #2e3347 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[400px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0 text-center">
            <Logo />
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('auth.login.subtitle')}</p>
          </div>
          <LocaleSwitcher compact />
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="login-email">{t('common.labels.email')}</Label>
            <Input id="login-email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'login-email-error' : undefined} {...register('email')} />
            {errors.email && <p id="login-email-error" className="mt-1 text-xs text-[var(--color-destructive)]">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="login-password">{t('common.labels.password')}</Label>
            <Input id="login-password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
          </div>
          <div>
            <Label htmlFor="login-tenant">{t('auth.login.shopId')}</Label>
            <Input id="login-tenant" autoComplete="organization" aria-invalid={!!errors.tenantSlug} {...register('tenantSlug')} />
          </div>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-[var(--color-destructive)]">{error}</p>}
        <Button className="mt-6 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('auth.login.submit')}
        </Button>
        <Link href="/register" className="mt-5 block text-center text-sm text-[var(--color-primary)]">
          {t('auth.login.switch')}
        </Link>
      </form>
    </main>
  );
}
