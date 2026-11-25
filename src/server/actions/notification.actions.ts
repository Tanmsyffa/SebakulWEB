'use server';

import { cookies } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { userNotifications } from '@/db/schema';
import { getUserRoles, requireAuth } from '@/server/guards/auth-guard';
import { getDashboardNotifications } from '@/server/queries/dashboard-alerts';
import type { UserRoleType } from '@/types';

async function getNotificationScope() {
  const user = await requireAuth();
  const [roles, cookieStore] = await Promise.all([getUserRoles(user.id), cookies()]);
  const availableRoles = roles.map(item => item.role as UserRoleType);
  const requestedRole = cookieStore.get('sebakul_active_role')?.value as UserRoleType | undefined;
  const role = requestedRole && availableRoles.includes(requestedRole) ? requestedRole : availableRoles[0];
  if (!role) throw new Error('Peran akun tidak ditemukan.');
  const activeRole = roles.find(item => item.role === role);
  return { userId: user.id, role, warungId: activeRole?.warungId ?? null };
}

export async function loadDashboardNotifications() {
  const { userId, role, warungId } = await getNotificationScope();
  return getDashboardNotifications(userId, role, warungId);
}

export async function markNotificationRead(notificationId: string) {
  const { userId, role } = await getNotificationScope();
  const id = z.string().uuid().parse(notificationId);
  const [updated] = await db.update(userNotifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(userNotifications.id, id),
      eq(userNotifications.userId, userId),
      eq(userNotifications.scopeRole, role),
    ))
    .returning({ id: userNotifications.id });
  return { success: Boolean(updated) };
}

export async function markAllNotificationsRead() {
  const { userId, role } = await getNotificationScope();
  await db.update(userNotifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(userNotifications.userId, userId),
      eq(userNotifications.scopeRole, role),
      isNull(userNotifications.readAt),
    ));
  return { success: true };
}
