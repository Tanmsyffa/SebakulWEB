import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { AuthError, getInternalUser, getUserRoles } from '@/server/guards/auth-guard';
import { LandingPageClient } from '@/components/landing/landing-page-client';
import type { UserRoleType } from '@/types';

interface RootPageProps {
  searchParams: Promise<{ view?: string }>;
}

function resolveDashboardHref(
  roles: UserRoleType[],
  activeRoleCookie?: UserRoleType
): string {
  const activeRole: UserRoleType =
    activeRoleCookie && roles.includes(activeRoleCookie)
      ? activeRoleCookie
      : roles[0];

  if (activeRole === 'SUPER_ADMIN') return '/admin';
  if (activeRole === 'PENGELOLA_ADMIN') return '/sentra';
  return '/warung';
}

export default async function HomePage({ searchParams }: RootPageProps) {
  const params = await searchParams;
  const forceLanding = params.view === 'landing';

  const supabase = await createServerClient();
  const { data: verified, error } = await supabase.auth.getClaims();
  const claims = error ? null : verified?.claims;
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;

  let isSignedIn = false;
  let dashboardHref = '/login';

  if (userId) {
    let accountIsActive = false;
    try {
      const internalUser = await getInternalUser(userId);
      accountIsActive = internalUser.isActive;
    } catch (cause) {
      if (!(cause instanceof AuthError)) throw cause;
    }

    if (accountIsActive) {
      const userRolesList = await getUserRoles(userId);
      if (userRolesList.length > 0) {
        if ((claims?.app_metadata as Record<string, unknown> | undefined)?.must_change_password === true) {
          redirect('/auth/change');
        }
        const cookieStore = await cookies();
        const activeRoleCookie = cookieStore.get('sebakul_active_role')?.value as
          | UserRoleType
          | undefined;
        const availableRoles = userRolesList.map((r) => r.role as UserRoleType);
        dashboardHref = resolveDashboardHref(availableRoles, activeRoleCookie);
        isSignedIn = true;

        if (!forceLanding) {
          redirect(dashboardHref);
        }
      }
    }
  }

  return <LandingPageClient isSignedIn={isSignedIn} dashboardHref={dashboardHref} />;
}
