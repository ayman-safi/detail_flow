'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { useI18n } from '@/i18n/I18nProvider';

type FormData = {
  email: string;
  password: string;
  tenantSlug: string;
};

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { t, isRtl } = useI18n();
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
    <AuthPageShell
      eyebrow={t('auth.login.eyebrow')}
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      heroTitle={t('auth.login.heroTitle')}
      heroBody={t('auth.login.heroBody')}
      heroPoints={['0', '1', '2'].map((index) => t(`auth.login.heroPoints.${index}`))}
      switchHref="/register"
      switchLabel={t('auth.login.switch')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <Label htmlFor="login-email">{t('common.labels.email')}</Label>
          <Input id="login-email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'login-email-error' : undefined} {...register('email')} />
          {errors.email && <p id="login-email-error" className="mt-1.5 text-xs text-[var(--color-destructive)]">{errors.email.message}</p>}
        </div>
        <div>
          <Label htmlFor="login-password">{t('common.labels.password')}</Label>
          <div className="relative">
            <Input
              id="login-password"
              className={isRtl ? 'pl-12' : 'pr-12'}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              {...register('password')}
            />
            <button
              type="button"
              className={`absolute top-0 grid h-[49px] w-12 place-items-center text-[#91a0b2] transition hover:text-white ${isRtl ? 'left-0' : 'right-0'}`}
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? t('auth.password.hide') : t('auth.password.show')}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <p id="login-password-error" className="mt-1.5 text-xs text-[var(--color-destructive)]">{errors.password.message}</p>}
        </div>
        <div>
          <Label htmlFor="login-tenant">{t('auth.login.shopId')}</Label>
          <Input id="login-tenant" autoComplete="organization" aria-invalid={!!errors.tenantSlug} aria-describedby={errors.tenantSlug ? 'login-tenant-error' : undefined} {...register('tenantSlug')} />
          {errors.tenantSlug && <p id="login-tenant-error" className="mt-1.5 text-xs text-[var(--color-destructive)]">{errors.tenantSlug.message}</p>}
        </div>
        {error && <p role="alert" className="text-sm text-[var(--color-destructive)]">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('auth.login.submit')}
        </Button>
      </form>
    </AuthPageShell>
  );
}
