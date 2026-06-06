'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react';
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
  const { t, isRtl } = useI18n();
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
      setAuth(data.user);
      router.push('/board');
    } catch (error) {
      setError(getApiErrorMessage(error, t('auth.register.errorFallback')));
    }
  };

  return (
    <main data-theme="light" className="grid min-h-screen bg-white text-slate-950 md:grid-cols-[minmax(0,1fr)_440px]">
      <section className="flex items-center justify-center px-6 py-10">
        <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[440px]">
          <div className="mb-8 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="[&_.text-white]:text-slate-950">
                <Logo />
              </div>
              <p className="mt-2 text-sm text-slate-500">{t('auth.register.subtitle')}</p>
            </div>
            <LocaleSwitcher compact />
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="register-shop-name">{t('auth.register.shopName')}</Label>
              <Input id="register-shop-name" className="bg-white text-slate-950" autoComplete="organization" aria-invalid={!!errors.tenantName} {...register('tenantName', { onChange: (event) => setValue('slug', slugify(event.target.value), { shouldValidate: true }) })} />
            </div>
            <div>
              <Label htmlFor="register-shop-slug">{t('auth.register.shopSlug')}</Label>
              <Input id="register-shop-slug" className="bg-white text-slate-950" autoComplete="organization" aria-invalid={!!errors.slug} aria-describedby={errors.slug ? 'register-shop-slug-error' : 'register-shop-slug-hint'} {...register('slug')} />
              <p id="register-shop-slug-hint" className="mt-1 text-xs text-slate-500">
                {t('auth.register.shopSlugHint', { slug: slug || t('auth.register.shopSlugFallback') })}
              </p>
              {errors.slug && <p id="register-shop-slug-error" className="text-xs text-red-600">{t('auth.register.shopSlugError')}</p>}
            </div>
            <div>
              <Label htmlFor="register-owner-name">{t('auth.register.ownerName')}</Label>
              <Input id="register-owner-name" className="bg-white text-slate-950" autoComplete="name" aria-invalid={!!errors.ownerFullName} {...register('ownerFullName')} />
            </div>
            <div>
              <Label htmlFor="register-owner-email">{t('common.labels.email')}</Label>
              <Input id="register-owner-email" className="bg-white text-slate-950" type="email" autoComplete="email" aria-invalid={!!errors.ownerEmail} {...register('ownerEmail')} />
            </div>
            <div>
              <Label htmlFor="register-owner-password">{t('common.labels.password')}</Label>
              <div className="relative">
                <Input
                  id="register-owner-password"
                  className={`bg-white text-slate-950 ${isRtl ? 'pl-10' : 'pr-10'}`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-invalid={!!errors.ownerPassword}
                  {...register('ownerPassword')}
                />
                <button
                  type="button"
                  className={`absolute top-0 grid h-10 w-10 place-items-center text-slate-500 hover:text-slate-900 ${isRtl ? 'left-0' : 'right-0'}`}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
          <Button className="mt-6 w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('auth.register.submit')}
          </Button>
          <Link href="/login" className="mt-5 block text-center text-sm text-blue-600">
            {t('auth.register.switch')}
          </Link>
        </form>
      </section>
      <aside className="hidden bg-[linear-gradient(135deg,#0f1117,#1d4ed8)] p-10 text-white md:flex md:flex-col md:justify-center">
        <h2 className="font-[var(--font-display)] text-4xl font-bold">{t('auth.register.heroTitle')}</h2>
        {['0', '1', '2'].map((index) => (
          <p key={index} className="mt-6 flex items-center gap-3">
            <Check className="text-[var(--color-success)]" />
            {t(`auth.register.heroPoints.${index}`)}
          </p>
        ))}
      </aside>
    </main>
  );
}
