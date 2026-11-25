import { redirect } from 'next/navigation';
import { cache } from 'react';
import { eq, and, inArray } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { users, userRoles, warungs } from '@/db/schema';

export class AuthError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

type AuthenticatedUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

/**
 * Requires an authenticated session. Returns Supabase auth user.
 * Redirects to /login if no session found.
 */
export const requireAuth = cache(async () => {
  const supabase = await createServerClient();
  const { data: verified, error } = await supabase.auth.getClaims();
  const claims = verified?.claims;

  const userId = typeof claims?.sub === 'string' ? claims.sub : null;

  if (error || !claims || !userId) {
    redirect('/login');
  }

  // Middleware performs the server-side session check and refresh. Verifying
  // the signed JWT here avoids repeating the Auth HTTP request in every RSC.
  const user: AuthenticatedUser = {
    id: userId,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    app_metadata: claims.app_metadata as Record<string, unknown> | undefined,
    user_metadata: claims.user_metadata as Record<string, unknown> | undefined,
  };

  // A valid Auth session alone never grants application access.
  // Prefetch roles concurrently so layout and page role guards share one round-trip.
  await Promise.all([
    getInternalUser(user.id),
    getUserRolesFull(user.id),
  ]);
  if (user.app_metadata?.must_change_password === true) redirect('/auth/change');

  return user;
});

/**
 * Gets internal user record (synced with auth.users.id).
 */
export const getInternalUser = cache(async (userId: string) => {
  const [internalUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!internalUser) {
    throw new AuthError('Profil pengguna tidak ditemukan', 404);
  }

  if (!internalUser.isActive) {
    throw new AuthError('Akun dinonaktifkan. Hubungi Super Admin.', 403);
  }

  return internalUser;
});

const getUserRolesFull = cache(async (userId: string) => {
  return await db
    .select({
      id: userRoles.id,
      userId: userRoles.userId,
      role: userRoles.role,
      warungId: userRoles.warungId,
      warungName: warungs.name,
      createdAt: userRoles.createdAt,
    })
    .from(userRoles)
    .leftJoin(warungs, eq(userRoles.warungId, warungs.id))
    .where(and(eq(userRoles.userId, userId), inArray(userRoles.role, ['SUPER_ADMIN', 'PENGELOLA_ADMIN', 'TENANT_MEMBER'])))
    .orderBy(userRoles.createdAt);
});

/**
 * Gets all roles for current authenticated user.
 */
export const getUserRoles = cache(async (userId: string) => {
  const rows = await getUserRolesFull(userId);
  return rows.map(({ id, role, warungId, warungName }) => ({
    id,
    role,
    warungId,
    warungName,
  }));
});

/**
 * Enforces TENANT_MEMBER access.
 * NEVER accepts warungId from client parameters!
 * Always derives warungId strictly from the server session.
 */
export const requireTenantAccess = cache(async () => {
  const authUser = await requireAuth();
  const [internalUser, roles] = await Promise.all([
    getInternalUser(authUser.id),
    getUserRolesFull(authUser.id),
  ]);

  // Read active warung role from user_roles. A multi-warung account must
  // explicitly choose a warung in a future server-validated selector.
  const tenantRole = roles.find((r) => r.role === 'TENANT_MEMBER');

  if (!tenantRole || !tenantRole.warungId) {
    throw new AuthError('Akses ditolak: Akun tidak terhubung ke warung mana pun', 403);
  }

  return {
    userId: internalUser.id,
    warungId: tenantRole.warungId,
    role: tenantRole.role,
    user: internalUser,
  };
});

export async function requireWarungPermission(permission: 'stock' | 'owner') {
  const access = await requireTenantAccess();
  const allowed = permission === 'owner'
    ? access.role === 'TENANT_MEMBER'
    : access.role === 'TENANT_MEMBER';
  if (!allowed) throw new AuthError('Akses tidak mencukupi untuk fitur ini.', 403);
  return access;
}

/**
 * Enforces Admin access (PENGELOLA_ADMIN or SUPER_ADMIN).
 */
export const requireAdmin = cache(async () => {
  const authUser = await requireAuth();
  const [internalUser, fullRoles] = await Promise.all([
    getInternalUser(authUser.id),
    getUserRolesFull(authUser.id),
  ]);

  const roles = fullRoles.map(({ id, userId, role, warungId, createdAt }) => ({
    id,
    userId,
    role,
    warungId,
    createdAt,
  }));

  const hasAdmin = roles.some(
    (r) => r.role === 'PENGELOLA_ADMIN' || r.role === 'SUPER_ADMIN'
  );

  if (!hasAdmin) {
    throw new AuthError('Akses ditolak: Memerlukan peran Pengelola Admin atau Super Admin', 403);
  }

  return {
    user: internalUser,
    roles,
    isSuperAdmin: roles.some((r) => r.role === 'SUPER_ADMIN'),
  };
});

/**
 * Enforces Super Admin access exclusively (SUPER_ADMIN).
 */
export const requireSuperAdmin = cache(async () => {
  const authUser = await requireAuth();
  const [internalUser, fullRoles] = await Promise.all([
    getInternalUser(authUser.id),
    getUserRolesFull(authUser.id),
  ]);

  const found = fullRoles.find((r) => r.role === 'SUPER_ADMIN');
  const superAdminRole = found
    ? {
        id: found.id,
        userId: found.userId,
        role: found.role,
        warungId: found.warungId,
        createdAt: found.createdAt,
      }
    : null;

  if (!superAdminRole) {
    throw new AuthError('Akses ditolak: Memerlukan peran Super Admin', 403);
  }

  return {
    user: internalUser,
    role: superAdminRole,
  };
});

/**
 * Route-handler auth guard that throws AuthError (401/403/404) instead of redirecting.
 */
export async function requireApiAuth() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new AuthError('Silakan masuk kembali', 401);
  }
  const internalUser = await getInternalUser(data.user.id);
  if (data.user.app_metadata?.must_change_password === true) {
    throw new AuthError('Ubah kata sandi sementara terlebih dahulu.', 403);
  }
  return { authUser: data.user, internalUser };
}

/**
 * Route-handler tenant guard deriving warungId strictly from server session.
 */
export async function requireApiTenantAccess() {
  const { internalUser } = await requireApiAuth();
  const [tenantRole] = await db
    .select({ role: userRoles.role, warungId: userRoles.warungId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, internalUser.id), eq(userRoles.role, 'TENANT_MEMBER')))
    .orderBy(userRoles.createdAt)
    .limit(1);

  if (!tenantRole || !tenantRole.warungId) {
    throw new AuthError('Akses ditolak: Akun tidak terhubung ke warung mana pun', 403);
  }

  return {
    userId: internalUser.id,
    warungId: tenantRole.warungId,
    role: tenantRole.role,
    user: internalUser,
  };
}

/**
 * Route-handler admin guard for PENGELOLA_ADMIN or SUPER_ADMIN.
 */
export async function requireApiAdmin() {
  const { internalUser } = await requireApiAuth();
  const roles = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, internalUser.id));

  const hasAdmin = roles.some(
    (r) => r.role === 'PENGELOLA_ADMIN' || r.role === 'SUPER_ADMIN'
  );

  if (!hasAdmin) {
    throw new AuthError('Akses ditolak: Memerlukan peran Pengelola Admin atau Super Admin', 403);
  }

  return {
    user: internalUser,
    roles,
    isSuperAdmin: roles.some((r) => r.role === 'SUPER_ADMIN'),
  };
}
