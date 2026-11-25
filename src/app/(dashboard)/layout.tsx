import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAuth, getInternalUser, getUserRoles } from '@/server/guards/auth-guard';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { SidebarNav } from '@/components/navigation/sidebar-nav';
import { RoleSwitcher } from '@/components/navigation/role-switcher';
import { AccountActions } from '@/components/navigation/account-actions';
import { DashboardAlerts } from '@/components/navigation/dashboard-alerts';
import { RealtimeSync } from '@/components/navigation/realtime-sync';
import { BrandLogo } from '@/components/ui/brand-logo';
import type { UserRoleType } from '@/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUser = await requireAuth();
  const [internalUser, userRolesList] = await Promise.all([
    getInternalUser(authUser.id),
    getUserRoles(authUser.id),
  ]);

  if (userRolesList.length === 0) {
    redirect('/login?error=no_roles');
  }

  const cookieStore = await cookies();
  const activeRoleCookie = cookieStore.get('sebakul_active_role')?.value as
    | UserRoleType
    | undefined;

  const availableRoles = userRolesList.map((r) => r.role as UserRoleType);
  const activeRole: UserRoleType =
    activeRoleCookie && availableRoles.includes(activeRoleCookie)
      ? activeRoleCookie
      : availableRoles[0];

  const activeTenantRole = userRolesList.find(
    (r) => r.role === 'TENANT_MEMBER' && r.warungId !== null
  );

  const workspaceName =
    activeRole === 'TENANT_MEMBER'
      ? activeTenantRole?.warungName || 'Warung Saya'
      : activeRole === 'PENGELOLA_ADMIN'
      ? 'Sentra Kuliner'
      : 'Super Admin';

  const workspaceSubtitle =
    activeRole === 'TENANT_MEMBER'
      ? 'Operasional warung'
      : activeRole === 'PENGELOLA_ADMIN'
      ? 'Pengelolaan sentra'
      : 'Pengelolaan platform';

  return (
    <div className="min-h-screen bg-canvas text-text-primary lg:flex">
      <RealtimeSync
        userId={authUser.id}
        role={activeRole}
        warungId={activeRole === 'TENANT_MEMBER' ? activeTenantRole?.warungId ?? null : null}
      />

      <SidebarNav
        role={activeRole}
        workspaceName={workspaceName}
        workspaceSubtitle={workspaceSubtitle}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface/95 backdrop-blur-xs">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <BrandLogo size="sm" className="lg:hidden" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-text-primary">
                  {workspaceName}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {workspaceSubtitle}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <RoleSwitcher roles={availableRoles} activeRole={activeRole} />
              <DashboardAlerts role={activeRole} />
              <AccountActions
                fullName={internalUser.fullName}
                email={internalUser.email}
                avatarUrl={internalUser.avatarUrl}
              />
            </div>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-6 lg:pb-10 focus:outline-none"
        >
          {children}
        </main>
      </div>

      <BottomNav role={activeRole} />
    </div>
  );
}
