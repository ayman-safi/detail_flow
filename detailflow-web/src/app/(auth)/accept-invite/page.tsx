import { Suspense } from 'react';
import { PasswordTokenForm } from '@/components/auth/PasswordTokenForm';

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <PasswordTokenForm mode="invite" />
    </Suspense>
  );
}
