import { forbidden } from 'next/navigation';
import { getUserRoles, requireAuth } from '@/server/guards/auth-guard';

export default async function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUser = await requireAuth();
  const roles = await getUserRoles(authUser.id);
  const isSuperAdmin = roles.some((item) => item.role === 'SUPER_ADMIN');

  if (!isSuperAdmin) {
    forbidden();
  }

  return <>{children}</>;
}
