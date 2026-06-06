import { Suspense } from 'react';
import { PasswordTokenForm } from '@/components/auth/PasswordTokenForm';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <PasswordTokenForm mode="reset" />
    </Suspense>
  );
}
