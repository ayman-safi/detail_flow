import { PublicBookingPage } from '@/components/bookings/PublicBookingPage';

export default async function BookTenantPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <PublicBookingPage tenantSlug={tenantSlug} />;
}
