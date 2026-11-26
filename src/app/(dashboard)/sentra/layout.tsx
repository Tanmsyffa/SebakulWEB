import { forbidden } from 'next/navigation';
import { getUserRoles, requireAuth } from '@/server/guards/auth-guard';

export default async function SentraSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUser = await requireAuth();
  const roles = await getUserRoles(authUser.id);
  const hasSentraAccess = roles.some(
    (item) => item.role === 'PENGELOLA_ADMIN' || item.role === 'SUPER_ADMIN'
  );

  if (!hasSentraAccess) {
    forbidden();
  }

  return <>{children}</>;
}
