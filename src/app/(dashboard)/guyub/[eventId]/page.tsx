import { notFound } from 'next/navigation';
import { getEventDetail } from '@/server/actions/guyub.actions';
import { requireAuth, getUserRoles } from '@/server/guards/auth-guard';
import { SplitBillClient } from './split-bill-client';

interface GuyubDetailPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function GuyubDetailPage({ params }: GuyubDetailPageProps) {
  const { eventId } = await params;
  const userPromise = requireAuth();
  const [user, detail] = await Promise.all([
    userPromise,
    getEventDetail(eventId),
  ]);
  const roles = await getUserRoles(user.id);
  const myWarungId = roles.find((role) => role.role === 'TENANT_MEMBER')?.warungId ?? null;
  const canManage = roles.some(
    (role) => role.role === 'SUPER_ADMIN' || role.role === 'PENGELOLA_ADMIN'
  );

  if (!detail) notFound();

  return (
    <SplitBillClient
      eventId={eventId}
      eventTitle={detail.event.title}
      splitResult={detail.splitResult}
      event={detail.event}
      participants={detail.participants}
      expenses={detail.expenses}
      myWarungId={myWarungId}
      canManage={canManage}
    />
  );
}
