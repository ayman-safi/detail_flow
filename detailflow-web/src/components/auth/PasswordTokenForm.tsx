'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { Logo } from '@/components/shared/Logo';
import { useI18n } from '@/i18n/I18nProvider';

type Mode = 'invite' | 'reset';

type FormData = {
  password: string;
  confirmPassword: string;
};

const modeConfig = {
  invite: {
    endpoint: '/auth/accept-invite',
    titleKey: 'auth.acceptInvite.title',
    subtitleKey: 'auth.acceptInvite.subtitle',
    submitKey: 'auth.acceptInvite.submit',
    successKey: 'auth.acceptInvite.success',
    errorFallbackKey: 'auth.acceptInvite.errorFallback',
    missingTokenKey: 'auth.acceptInvite.missingToken',
  },
  reset: {
    endpoint: '/auth/reset-password',
    titleKey: 'auth.resetPassword.title',
    subtitleKey: 'auth.resetPassword.subtitle',
    submitKey: 'auth.resetPassword.submit',
    successKey: 'auth.resetPassword.success',
    errorFallbackKey: 'auth.resetPassword.errorFallback',
    missingTokenKey: 'auth.resetPassword.missingToken',
  },
} as const;

export function PasswordTokenForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState('');
  const { t } = useI18n();
  const config = modeConfig[mode];
  const token = searchParams.get('token') ?? '';
  const schema = z.object({
    password: z.string().min(8, t('auth.password.validationMin')),
    confirmPassword: z.string().min(8, t('auth.password.validationMin')),
  }).refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: t('auth.password.validationMatch'),
  });
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormData) => {
    setError('');
    if (!token) {
      setError(t(config.missingTokenKey));
      return;
    }

    try {
      const { data } = await api.post<{ user: AuthUser }>(config.endpoint, {
        token,
        password: values.password,
      });
      setAuth(data.user);
      toast.success(t(config.successKey));
      router.push('/board');
    } catch (error) {
      setError(getApiErrorMessage(error, t(config.errorFallbackKey)));
    }
  };

  return (
    <main
      className="grid min-h-screen place-items-center bg-[var(--color-bg)] px-4"
      style={{ backgroundImage: 'radial-gradient(circle, #2e3347 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[420px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Logo />
            <h1 className="mt-5 font-[var(--font-display)] text-2xl font-semibold">{t(config.titleKey)}</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t(config.subtitleKey)}</p>
          </div>
          <LocaleSwitcher compact />
        </div>
        {!token && <p role="alert" className="mb-4 text-sm text-[var(--color-destructive)]">{t(config.missingTokenKey)}</p>}
        <div className="space-y-4">
          <div>
            <Label htmlFor={`${mode}-password`}>{t('auth.password.newPassword')}</Label>
            <Input id={`${mode}-password`} type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.password.message}</p>}
          </div>
          <div>
            <Label htmlFor={`${mode}-confirm-password`}>{t('auth.password.confirmPassword')}</Label>
            <Input id={`${mode}-confirm-password`} type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.confirmPassword.message}</p>}
          </div>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-[var(--color-destructive)]">{error}</p>}
        <Button className="mt-6 w-full" disabled={isSubmitting || !token}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t(config.submitKey)}
        </Button>
        <Link href="/login" className="mt-5 block text-center text-sm text-[var(--color-primary)]">
          {t('auth.login.submit')}
        </Link>
      </form>
    </main>
  );
}
