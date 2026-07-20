'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { useI18n } from '@/i18n/I18nProvider';
import { captureConsentedLandingEvent } from '@/lib/landingAnalytics';

type FormData = {
  tenantName: string;
  slug: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { t, isRtl, locale } = useI18n();

  useEffect(() => {
    void captureConsentedLandingEvent('registration_started', { locale });
  }, [locale]);
  const schema = z.object({
    tenantName: z.string().min(2),
    slug: z.string().regex(/^[a-z0-9-]{3,30}$/),
    ownerFullName: z.string().min(2),
    ownerEmail: z.string().email(),
    ownerPassword: z.string().min(8),
  });
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const slug = watch('slug');

  const onSubmit = async (values: FormData) => {
    setError('');
    try {
      const { data } = await api.post<{ user: AuthUser }>('/auth/register-tenant', values);
      await captureConsentedLandingEvent('registration_completed', { locale });
      setAuth(data.user);
      router.push('/board');
    } catch (error) {
      setError(getApiErrorMessage(error, t('auth.register.errorFallback')));
    }
  };

  return (
    <AuthPageShell
      eyebrow={t('auth.register.eyebrow')}
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      heroTitle={t('auth.register.heroTitle')}
      heroBody={t('auth.register.heroBody')}
      heroPoints={['0', '1', '2'].map((index) => t(`auth.register.heroPoints.${index}`))}
      switchHref="/login"
      switchLabel={t('auth.register.switch')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <Label htmlFor="register-shop-name">{t('auth.register.shopName')}</Label>
          <Input id="register-shop-name" autoComplete="organization" aria-invalid={!!errors.tenantName} aria-describedby={errors.tenantName ? 'register-shop-name-error' : undefined} {...register('tenantName', { onChange: (event) => setValue('slug', slugify(event.target.value), { shouldValidate: true }) })} />
          {errors.tenantName && <p id="register-shop-name-error" className="mt-1.5 text-xs text-[var(--color-destructive)]">{errors.tenantName.message}</p>}
        </div>
        <div>
          <Label htmlFor="register-shop-slug">{t('auth.register.shopSlug')}</Label>
          <Input id="register-shop-slug" autoComplete="organization" aria-invalid={!!errors.slug} aria-describedby={errors.slug ? 'register-shop-slug-error' : 'register-shop-slug-hint'} {...register('slug')} />
          <p id="register-shop-slug-hint" className="mt-1.5 text-xs text-[#91a0b2]">
            {t('auth.register.shopSlugHint', { slug: slug || t('auth.register.shopSlugFallback') })}
          </p>
          {errors.slug && <p id="register-shop-slug-error" className="mt-1 text-xs text-[var(--color-destructive)]">{t('auth.register.shopSlugError')}</p>}
        </div>
        <div>
          <Label htmlFor="register-owner-name">{t('auth.register.ownerName')}</Label>
          <Input id="register-owner-name" autoComplete="name" aria-invalid={!!errors.ownerFullName} aria-describedby={errors.ownerFullName ? 'register-owner-name-error' : undefined} {...register('ownerFullName')} />
          {errors.ownerFullName && <p id="register-owner-name-error" className="mt-1.5 text-xs text-[var(--color-destructive)]">{errors.ownerFullName.message}</p>}
        </div>
        <div>
          <Label htmlFor="register-owner-email">{t('common.labels.email')}</Label>
          <Input id="register-owner-email" type="email" autoComplete="email" aria-invalid={!!errors.ownerEmail} aria-describedby={errors.ownerEmail ? 'register-owner-email-error' : undefined} {...register('ownerEmail')} />
          {errors.ownerEmail && <p id="register-owner-email-error" className="mt-1.5 text-xs text-[var(--color-destructive)]">{errors.ownerEmail.message}</p>}
        </div>
        <div>
          <Label htmlFor="register-owner-password">{t('common.labels.password')}</Label>
          <div className="relative">
            <Input
              id="register-owner-password"
              className={isRtl ? 'pl-12' : 'pr-12'}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              aria-invalid={!!errors.ownerPassword}
              aria-describedby={errors.ownerPassword ? 'register-owner-password-error' : undefined}
              {...register('ownerPassword')}
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
          {errors.ownerPassword && <p id="register-owner-password-error" className="mt-1.5 text-xs text-[var(--color-destructive)]">{errors.ownerPassword.message}</p>}
        </div>
        {error && <p role="alert" className="text-sm text-[var(--color-destructive)]">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('auth.register.submit')}
        </Button>
      </form>
    </AuthPageShell>
  );
}
