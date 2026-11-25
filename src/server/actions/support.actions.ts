'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, supportRequests, userNotifications, userRoles, users } from '@/db/schema';
import { AuthError, getUserRoles, requireAuth, requireSuperAdmin } from '@/server/guards/auth-guard';
import type { UserRoleType } from '@/types';

const inputSchema = z.object({
  subject: z.string().trim().min(4).max(120),
  message: z.string().trim().min(10).max(5000),
  attachmentPath: z.string().trim().max(200).optional(),
});

async function getActiveRole(userId: string): Promise<UserRoleType> {
  const roles = await getUserRoles(userId);
  const available = roles.map(item => item.role as UserRoleType);
  if (!available.length) throw new AuthError('Peran akun tidak ditemukan.', 403);
  const cookieRole = (await cookies()).get('sebakul_active_role')?.value as UserRoleType | undefined;
  return cookieRole && available.includes(cookieRole) ? cookieRole : available[0];
}

export async function getSupportRequests() {
  const user = await requireAuth();
  const role = await getActiveRole(user.id);
  const query = db.select({
    id: supportRequests.id,
    subject: supportRequests.subject,
    message: supportRequests.message,
    status: supportRequests.status,
    response: supportRequests.response,
    attachmentPath: supportRequests.attachmentPath,
    createdAt: supportRequests.createdAt,
    requesterRole: supportRequests.requesterRole,
    requesterName: users.fullName,
    requesterEmail: users.email,
    requesterPhone: users.phoneNumber,
  }).from(supportRequests).innerJoin(users, eq(supportRequests.createdBy, users.id));

  const rows = role === 'SUPER_ADMIN'
    ? await query.orderBy(desc(supportRequests.createdAt)).limit(200)
    : await query.where(eq(supportRequests.createdBy, user.id)).orderBy(desc(supportRequests.createdAt)).limit(50);
  return { role, requests: rows };
}

export async function createSupportRequest(input: { subject: string; message: string; attachmentPath?: string }) {
  const user = await requireAuth();
  const data = inputSchema.parse(input);
  const role = await getActiveRole(user.id);
  const attachmentPath = data.attachmentPath || null;
  if (attachmentPath && !new RegExp(`^${user.id}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(webp|jpg|png)$`, 'i').test(attachmentPath)) {
    throw new Error('Lampiran laporan tidak valid.');
  }
  await db.transaction(async tx => {
    const [request] = await tx.insert(supportRequests).values({
      createdBy: user.id, requesterRole: role, subject: data.subject, message: data.message, attachmentPath,
    }).returning({ id: supportRequests.id });
    const superAdmins = await tx.select({ userId: userRoles.userId }).from(userRoles)
      .where(eq(userRoles.role, 'SUPER_ADMIN'));
    const recipients = [...new Set(superAdmins.map(item => item.userId))];
    if (recipients.length) await tx.insert(userNotifications).values(recipients.map(userId => ({
      userId, scopeRole: 'SUPER_ADMIN', dedupeKey: `support-request:${request.id}`,
      title: 'Laporan bantuan baru', body: data.subject, href: '/dukungan',
      severity: 'warning', isActive: true, readAt: null,
    }))).onConflictDoNothing();
    await tx.insert(auditLogs).values({
      actorId: user.id, action: 'CREATE_SUPPORT_REQUEST', entityType: 'support_requests',
      entityId: request.id, newValue: JSON.stringify({ requesterRole: role, subject: data.subject }),
    });
  });
  revalidatePath('/dukungan');
  return { success: true };
}

export async function updateSupportRequest(input: { id: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; response: string }) {
  const { user } = await requireSuperAdmin();
  const data = z.object({
    id: z.string().uuid(),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
    response: z.string().trim().max(5000),
  }).parse(input);
  await db.transaction(async tx => {
    const [request] = await tx.update(supportRequests).set({
      status: data.status,
      response: data.response || null,
      respondedBy: user.id,
      respondedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(supportRequests.id, data.id)).returning({ id: supportRequests.id, createdBy: supportRequests.createdBy, requesterRole: supportRequests.requesterRole, subject: supportRequests.subject });
    if (!request) throw new Error('Laporan bantuan tidak ditemukan.');
    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: 'UPDATE_SUPPORT_REQUEST',
      entityType: 'support_requests',
      entityId: request.id,
      newValue: JSON.stringify({ status: data.status }),
    });
    await tx.insert(userNotifications).values({
      userId: request.createdBy,
      scopeRole: request.requesterRole,
      dedupeKey: `support-response:${request.id}:${data.status}:${Date.now()}`,
      title: data.status === 'RESOLVED' ? 'Laporan bantuan selesai ditangani' : 'Pembaruan laporan bantuan',
      body: data.response || request.subject,
      href: '/dukungan',
      severity: data.status === 'RESOLVED' ? 'positive' : 'warning',
      isActive: true,
      readAt: null,
    });
  });
  revalidatePath('/dukungan');
  return { success: true };
}
