import { forbidden } from 'next/navigation';
import { getUserRoles, requireAuth } from '@/server/guards/auth-guard';

export default async function WarungSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUser = await requireAuth();
  const roles = await getUserRoles(authUser.id);
  const hasTenantAccess = roles.some(
    (item) => item.role === 'TENANT_MEMBER' && item.warungId !== null
  );

  if (!hasTenantAccess) {
    forbidden();
  }

  return <>{children}</>;
}
