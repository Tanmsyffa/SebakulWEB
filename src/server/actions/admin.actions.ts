'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { eq, desc, and, or, sql, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  users,
  warungs,
  userRoles,
  lapaks,
  auditLogs,
  invoices,
  paymentProofs,
  facilityTickets,
  warungTransactions,
  warungInventory,
  warungInventoryMovements,
  warungSuppliers,
  warungPurchases,
  warungMenus,
  warungMenuRecipes,
  guyubPollVotes,
  guyubParticipants,
  guyubExpenses,
  lapakRenewalRequests,
} from '@/db/schema';
import { requireSuperAdmin } from '@/server/guards/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBusinessDateString } from '@/lib/business-date';
import { z } from 'zod';

// ─── 1. WARUNG & ACCOUNT REGISTRATION ───────────────────────

export async function createWarung(input: {
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  lapakId?: string | null;
}) {
  const { user } = await requireSuperAdmin();
  const data = z.object({
    name: z.string().trim().min(2).max(100),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
    category: z.string().trim().min(2).max(60),
    description: z.string().trim().max(500).nullish(),
    lapakId: z.string().uuid().nullable().optional(),
  }).parse(input);
  const today = getBusinessDateString();
  const result = await db.transaction(async tx => {
    const [existingSlug] = await tx.select({ id: warungs.id }).from(warungs).where(eq(warungs.slug, data.slug)).limit(1);
    if (existingSlug) throw new Error('Alamat katalog sudah digunakan warung lain.');
    const targetLapak = data.lapakId
      ? (await tx.select().from(lapaks).where(eq(lapaks.id, data.lapakId)).for('update').limit(1))[0]
      : null;
    if (data.lapakId && !targetLapak) throw new Error('Lapak tidak ditemukan. Muat ulang halaman.');
    if (targetLapak && targetLapak.status === 'PERBAIKAN') {
      throw new Error('Lapak dalam perbaikan belum bisa ditempati.');
    }
    if (targetLapak?.warungId && (!targetLapak.contractEnd || targetLapak.contractEnd >= today)) {
      throw new Error('Lapak masih dalam masa kontrak warung lain.');
    }
    if (targetLapak && !targetLapak.warungId && targetLapak.status !== 'KOSONG') {
      throw new Error('Lapak yang dipilih belum tersedia. Muat ulang halaman.');
    }
    const [created] = await tx.insert(warungs).values({
      name: data.name, slug: data.slug, category: data.category,
      description: data.description || null, depositBalance: 0, isOpenToday: true,
    }).returning();
    let assignedLapak = null;
    if (targetLapak) {
      [assignedLapak] = await tx.update(lapaks).set({ warungId: created.id, status: 'TERISI', utilityFeeAmount: 0, contractStart: null, contractEnd: null, securityDepositAmount: 0, contractNotes: null, updatedAt: new Date() })
        .where(and(eq(lapaks.id, targetLapak.id), targetLapak.warungId ? eq(lapaks.warungId, targetLapak.warungId) : sql`${lapaks.warungId} IS NULL`))
        .returning();
      if (!assignedLapak) throw new Error('Lapak baru saja ditempati. Muat ulang halaman.');
      await tx.insert(auditLogs).values({ actorId: user.id, action: targetLapak.warungId ? 'REASSIGN_EXPIRED_LAPAK' : 'ASSIGN_LAPAK', entityType: 'lapaks', entityId: assignedLapak.id, oldValue: JSON.stringify({ warungId: targetLapak.warungId, status: targetLapak.status, contractEnd: targetLapak.contractEnd }), newValue: JSON.stringify({ warungId: created.id, status: assignedLapak.status }) });
    }
    await tx.insert(auditLogs).values({ actorId: user.id, action: 'CREATE_WARUNG', entityType: 'warungs', entityId: created.id, newValue: JSON.stringify(created) });
    return { warung: created, lapak: assignedLapak };
  });

  revalidatePath('/admin');
  revalidatePath('/sentra');
  return { success: true, ...result };
}

export async function createLapak(input: {
  code: string;
  warungId: string | null;
  billingCycle: 'HARIAN' | 'MINGGUAN' | 'BULANAN';
  baseRentAmount: number;
}) {
  const { user } = await requireSuperAdmin();
  const data = z.object({
    code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/),
    warungId: z.string().uuid().nullable(),
    billingCycle: z.enum(['HARIAN', 'MINGGUAN', 'BULANAN']),
    baseRentAmount: z.number().int().min(0).max(999_999_999),
  }).parse(input);
  const result = await db.transaction(async tx => {
    const [existingCode] = await tx.select({ id: lapaks.id }).from(lapaks).where(eq(lapaks.code, data.code)).limit(1);
    if (existingCode) throw new Error('Kode lapak sudah digunakan.');
    let releasedExpiredLapak: { id: string; warungId: string } | null = null;
    if (data.warungId) {
      const [found] = await tx.select({ id: warungs.id }).from(warungs).where(eq(warungs.id, data.warungId)).for('update').limit(1);
      if (!found) throw new Error('Warung tidak ditemukan');
      const [occupied] = await tx.select().from(lapaks).where(eq(lapaks.warungId, data.warungId)).for('update').limit(1);
      if (occupied && (!occupied.contractEnd || occupied.contractEnd >= getBusinessDateString())) throw new Error('Warung tersebut masih memiliki kontrak lapak aktif.');
      if (occupied) {
        await tx.update(lapaks).set({ warungId: null, status: 'KOSONG', contractStart: null, contractEnd: null, securityDepositAmount: 0, contractNotes: null, updatedAt: new Date() }).where(eq(lapaks.id, occupied.id));
        releasedExpiredLapak = { id: occupied.id, warungId: data.warungId };
        await tx.insert(auditLogs).values({ actorId: user.id, action: 'RELEASE_EXPIRED_LAPAK', entityType: 'lapaks', entityId: occupied.id, oldValue: JSON.stringify({ warungId: data.warungId, status: occupied.status, contractEnd: occupied.contractEnd }), newValue: JSON.stringify({ warungId: null, status: 'KOSONG' }) });
      }
    }
    const [created] = await tx.insert(lapaks).values({
      ...data, utilityFeeAmount: 0, status: data.warungId ? 'TERISI' : 'KOSONG',
    }).returning();
    await tx.insert(auditLogs).values({ actorId: user.id, action: 'CREATE_LAPAK', entityType: 'lapaks', entityId: created.id, newValue: JSON.stringify(created) });
    return { lapak: created, releasedExpiredLapak };
  });
  revalidatePath('/admin');
  revalidatePath('/sentra');
  return { success: true, ...result };
}

const updateWarungSchema = z.object({
  warungId: z.string().uuid(),
  lapakId: z.string().uuid().nullable(),
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).nullish(),
});

export async function updateWarung(input: z.input<typeof updateWarungSchema>) {
  const { user } = await requireSuperAdmin();
  const data = updateWarungSchema.parse(input);
  const today = getBusinessDateString();
  const result = await db.transaction(async tx => {
    const [current] = await tx.select().from(warungs).where(eq(warungs.id, data.warungId)).for('update').limit(1);
    if (!current) throw new Error('Warung tidak ditemukan. Muat ulang halaman.');

    const [currentLapak] = await tx.select().from(lapaks).where(eq(lapaks.warungId, data.warungId)).for('update').limit(1);
    if (currentLapak && currentLapak.id !== data.lapakId && (!currentLapak.contractEnd || currentLapak.contractEnd >= today)) {
      throw new Error('Penempatan tidak dapat dilepas sebelum kontrak berakhir.');
    }
    let nextLapak = null;
    if (data.lapakId) {
      const [candidate] = await tx.select().from(lapaks).where(eq(lapaks.id, data.lapakId)).for('update').limit(1);
      if (!candidate) throw new Error('Lapak tidak ditemukan. Muat ulang halaman.');
      if (candidate.warungId && candidate.warungId !== data.warungId && (!candidate.contractEnd || candidate.contractEnd >= today)) {
        throw new Error('Lapak tersebut sudah ditempati warung lain.');
      }
      if (candidate.status === 'PERBAIKAN') throw new Error('Lapak dalam perbaikan belum bisa ditempati.');
      nextLapak = candidate;
    }

    const [duplicate] = await tx.select({ id: warungs.id }).from(warungs)
      .where(and(eq(warungs.slug, data.slug), sql`${warungs.id} <> ${data.warungId}`)).limit(1);
    if (duplicate) throw new Error('Alamat katalog sudah digunakan warung lain.');

    const lapakChanges: { id: string; warungId: string | null; status: 'KOSONG' | 'TERISI' | 'LIBUR' | 'PERBAIKAN' }[] = [];
    if (currentLapak && currentLapak.id !== nextLapak?.id) {
      const [released] = await tx.update(lapaks).set({ warungId: null, status: 'KOSONG', utilityFeeAmount: 0, contractStart: null, contractEnd: null, securityDepositAmount: 0, contractNotes: null, updatedAt: new Date() })
        .where(eq(lapaks.id, currentLapak.id)).returning({ id: lapaks.id, status: lapaks.status });
      lapakChanges.push({ id: released.id, warungId: null, status: released.status });
      await tx.insert(auditLogs).values({ actorId: user.id, action: 'UNASSIGN_LAPAK', entityType: 'lapaks', entityId: released.id, oldValue: JSON.stringify({ warungId: data.warungId, status: currentLapak.status }), newValue: JSON.stringify({ warungId: null, status: released.status }) });
    }
    if (nextLapak && nextLapak.id !== currentLapak?.id) {
      const [assigned] = await tx.update(lapaks).set({ warungId: data.warungId, status: 'TERISI', utilityFeeAmount: 0, contractStart: null, contractEnd: null, securityDepositAmount: 0, contractNotes: null, updatedAt: new Date() })
        .where(eq(lapaks.id, nextLapak.id)).returning({ id: lapaks.id, status: lapaks.status });
      lapakChanges.push({ id: assigned.id, warungId: data.warungId, status: assigned.status });
      await tx.insert(auditLogs).values({ actorId: user.id, action: nextLapak.warungId && nextLapak.warungId !== data.warungId ? 'REASSIGN_EXPIRED_LAPAK' : 'ASSIGN_LAPAK', entityType: 'lapaks', entityId: assigned.id, oldValue: JSON.stringify({ warungId: nextLapak.warungId, status: nextLapak.status, contractEnd: nextLapak.contractEnd }), newValue: JSON.stringify({ warungId: data.warungId, status: assigned.status }) });
    }

    const [warung] = await tx.update(warungs).set({
      name: data.name,
      slug: data.slug,
      category: data.category,
      description: data.description || null,
    }).where(eq(warungs.id, data.warungId)).returning();
    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: 'UPDATE_WARUNG',
      entityType: 'warungs',
      entityId: warung.id,
      oldValue: JSON.stringify({ name: current.name, slug: current.slug, category: current.category, description: current.description }),
      newValue: JSON.stringify({ name: warung.name, slug: warung.slug, category: warung.category, description: warung.description }),
    });
    return { warung, oldSlug: current.slug, lapakChanges };
  });
  revalidatePath('/admin');
  revalidatePath('/sentra');
  revalidatePath('/sentra/tagihan');
  revalidatePath('/warung');
  revalidatePath(`/menu/${result.oldSlug}`);
  revalidatePath(`/menu/${result.warung.slug}`);
  return { success: true, warung: result.warung, lapakChanges: result.lapakChanges };
}

export async function deleteWarung(warungId: string) {
  const { user } = await requireSuperAdmin();
  const id = z.string().uuid().parse(warungId);

  await db.transaction(async tx => {
    const [current] = await tx.select({ id: warungs.id, name: warungs.name, slug: warungs.slug }).from(warungs)
      .where(eq(warungs.id, id)).for('update').limit(1);
    if (!current) throw new Error('Warung tidak ditemukan. Muat ulang halaman.');

    const references = await Promise.all([
      tx.select({ id: userRoles.id }).from(userRoles).where(eq(userRoles.warungId, id)).limit(1),
      tx.select({ id: lapaks.id }).from(lapaks).where(eq(lapaks.warungId, id)).limit(1),
      tx.select({ id: warungTransactions.id }).from(warungTransactions).where(eq(warungTransactions.warungId, id)).limit(1),
      tx.select({ id: warungInventory.id }).from(warungInventory).where(eq(warungInventory.warungId, id)).limit(1),
      tx.select({ id: warungInventoryMovements.id }).from(warungInventoryMovements).where(eq(warungInventoryMovements.warungId, id)).limit(1),
      tx.select({ id: warungSuppliers.id }).from(warungSuppliers).where(eq(warungSuppliers.warungId, id)).limit(1),
      tx.select({ id: warungPurchases.id }).from(warungPurchases).where(eq(warungPurchases.warungId, id)).limit(1),
      tx.select({ id: warungMenus.id }).from(warungMenus).where(eq(warungMenus.warungId, id)).limit(1),
      tx.select({ id: warungMenuRecipes.id }).from(warungMenuRecipes).where(eq(warungMenuRecipes.warungId, id)).limit(1),
      tx.select({ id: guyubPollVotes.id }).from(guyubPollVotes).where(eq(guyubPollVotes.warungId, id)).limit(1),
      tx.select({ id: guyubParticipants.id }).from(guyubParticipants).where(eq(guyubParticipants.warungId, id)).limit(1),
      tx.select({ id: guyubExpenses.id }).from(guyubExpenses).where(eq(guyubExpenses.paidByWarungId, id)).limit(1),
      tx.select({ id: facilityTickets.id }).from(facilityTickets).where(eq(facilityTickets.warungId, id)).limit(1),
      tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.warungId, id)).limit(1),
      tx.select({ id: paymentProofs.id }).from(paymentProofs).where(eq(paymentProofs.warungId, id)).limit(1),
      tx.select({ id: lapakRenewalRequests.id }).from(lapakRenewalRequests).where(eq(lapakRenewalRequests.warungId, id)).limit(1),
    ]);
    const [salesReference] = await tx.execute(sql`SELECT id FROM public.warung_sales WHERE warung_id = ${id} LIMIT 1`) as unknown as { id: string }[];
    if (references.some(rows => rows.length > 0) || salesReference) {
      throw new Error('Warung tidak bisa dihapus karena masih memiliki akun, lapak, atau riwayat operasional. Lepaskan penempatan dan pertahankan riwayatnya.');
    }

    await tx.delete(warungs).where(eq(warungs.id, id));
    await tx.insert(auditLogs).values({ actorId: user.id, action: 'DELETE_WARUNG', entityType: 'warungs', entityId: id, oldValue: JSON.stringify(current), newValue: JSON.stringify({ deleted: true }) });
  });

  revalidatePath('/admin');
  return { success: true };
}

const updateLapakSchema = z.object({
  lapakId: z.string().uuid(),
  code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/),
  warungId: z.string().uuid().nullable(),
  status: z.enum(['KOSONG', 'TERISI', 'LIBUR', 'PERBAIKAN']),
  billingCycle: z.enum(['HARIAN', 'MINGGUAN', 'BULANAN']),
  baseRentAmount: z.number().int().min(0).max(999_999_999),
}).superRefine((data, ctx) => {
  if (['TERISI', 'LIBUR'].includes(data.status) && !data.warungId) {
    ctx.addIssue({ code: 'custom', path: ['warungId'], message: 'Pilih warung untuk status lapak ini.' });
  }
  if (['KOSONG', 'PERBAIKAN'].includes(data.status) && data.warungId) {
    ctx.addIssue({ code: 'custom', path: ['warungId'], message: 'Lepaskan warung untuk status lapak ini.' });
  }
});

export async function updateLapak(input: z.input<typeof updateLapakSchema>) {
  const { user } = await requireSuperAdmin();
  const data = updateLapakSchema.parse(input);
  const today = getBusinessDateString();
  const result = await db.transaction(async tx => {
    if (data.warungId) {
      const [warung] = await tx.select({ id: warungs.id }).from(warungs).where(eq(warungs.id, data.warungId)).for('update').limit(1);
      if (!warung) throw new Error('Warung tidak ditemukan. Muat ulang halaman.');
    }

    const [current] = await tx.select().from(lapaks).where(eq(lapaks.id, data.lapakId)).for('update').limit(1);
    if (!current) throw new Error('Lapak tidak ditemukan. Muat ulang halaman.');
    const [duplicateCode] = await tx.select({ id: lapaks.id }).from(lapaks)
      .where(and(eq(lapaks.code, data.code), sql`${lapaks.id} <> ${data.lapakId}`)).limit(1);
    if (duplicateCode) throw new Error('Kode lapak sudah digunakan.');
    if (current.warungId && current.warungId !== data.warungId && (!current.contractEnd || current.contractEnd >= today)) {
      throw new Error('Lapak tidak dapat dialihkan sebelum kontrak berakhir.');
    }

    let releasedExpiredLapak: { id: string; warungId: string; status: 'KOSONG' } | null = null;
    if (data.warungId) {
      const [occupied] = await tx.select().from(lapaks)
        .where(and(eq(lapaks.warungId, data.warungId), sql`${lapaks.id} <> ${data.lapakId}`)).for('update').limit(1);
      if (occupied && (!occupied.contractEnd || occupied.contractEnd >= today)) throw new Error('Warung tersebut masih memiliki kontrak lapak aktif.');
      if (occupied) {
        await tx.update(lapaks).set({ warungId: null, status: 'KOSONG', utilityFeeAmount: 0, contractStart: null, contractEnd: null, securityDepositAmount: 0, contractNotes: null, updatedAt: new Date() }).where(eq(lapaks.id, occupied.id));
        releasedExpiredLapak = { id: occupied.id, warungId: data.warungId, status: 'KOSONG' };
        await tx.insert(auditLogs).values({ actorId: user.id, action: 'RELEASE_EXPIRED_LAPAK', entityType: 'lapaks', entityId: occupied.id, oldValue: JSON.stringify({ warungId: data.warungId, contractEnd: occupied.contractEnd }), newValue: JSON.stringify({ warungId: null, status: 'KOSONG' }) });
      }
    }

    const [updated] = await tx.update(lapaks).set({
      code: data.code,
      warungId: data.warungId,
      status: data.status,
      billingCycle: data.billingCycle,
      baseRentAmount: data.baseRentAmount,
      utilityFeeAmount: 0,
      ...(current.warungId !== data.warungId ? { contractStart: null, contractEnd: null, securityDepositAmount: 0, contractNotes: null } : {}),
      updatedAt: new Date(),
    }).where(eq(lapaks.id, data.lapakId)).returning();
    await tx.insert(auditLogs).values({ actorId: user.id, action: 'UPDATE_LAPAK', entityType: 'lapaks', entityId: updated.id, oldValue: JSON.stringify(current), newValue: JSON.stringify(updated) });
    return { lapak: updated, releasedExpiredLapak };
  });

  revalidatePath('/admin');
  revalidatePath('/sentra');
  revalidatePath('/sentra/tagihan');
  revalidatePath('/warung');
  return { success: true, lapak: result.lapak, releasedExpiredLapak: result.releasedExpiredLapak };
}

export async function deleteLapak(lapakId: string) {
  const { user } = await requireSuperAdmin();
  const id = z.string().uuid().parse(lapakId);
  await db.transaction(async tx => {
    const [current] = await tx.select({ id: lapaks.id, code: lapaks.code }).from(lapaks)
      .where(eq(lapaks.id, id)).for('update').limit(1);
    if (!current) throw new Error('Lapak tidak ditemukan. Muat ulang halaman.');
    const [occupied] = await tx.select({ id: lapaks.id }).from(lapaks).where(and(eq(lapaks.id, id), sql`${lapaks.warungId} IS NOT NULL`)).limit(1);
    if (occupied) throw new Error('Lepaskan warung dari lapak sebelum menghapus data lapak.');
    const references = await Promise.all([
      tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.lapakId, id)).limit(1),
      tx.select({ id: facilityTickets.id }).from(facilityTickets).where(eq(facilityTickets.lapakId, id)).limit(1),
      tx.select({ id: lapakRenewalRequests.id }).from(lapakRenewalRequests).where(eq(lapakRenewalRequests.lapakId, id)).limit(1),
    ]);
    if (references.some(rows => rows.length > 0)) {
      throw new Error('Lapak tidak bisa dihapus karena memiliki riwayat tagihan atau kendala. Ubah penempatannya dan pertahankan riwayat.');
    }
    await tx.delete(lapaks).where(eq(lapaks.id, id));
    await tx.insert(auditLogs).values({ actorId: user.id, action: 'DELETE_LAPAK', entityType: 'lapaks', entityId: id, oldValue: JSON.stringify(current), newValue: JSON.stringify({ deleted: true }) });
  });
  revalidatePath('/admin');
  revalidatePath('/sentra');
  return { success: true };
}

const registerAccountSchema = z.object({
  email: z.string().trim().email().max(255).transform(value => value.toLowerCase()),
  fullName: z.string().trim().min(2).max(100),
  role: z.enum(['PENGELOLA_ADMIN', 'TENANT_MEMBER']),
  warungId: z.string().uuid().nullable(),
}).refine(value => value.role !== 'TENANT_MEMBER' || !!value.warungId, {
  message: 'Pemilik warung harus dihubungkan ke warung',
});

export async function registerAccount(input: z.input<typeof registerAccountSchema>) {
  const { user } = await requireSuperAdmin();
  const data = registerAccountSchema.parse(input);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
  if (existing.length) throw new Error('Email sudah terdaftar');
  if (data.role === 'TENANT_MEMBER') {
    const found = await db.select({ id: warungs.id }).from(warungs).where(eq(warungs.id, data.warungId!)).limit(1);
    if (!found.length) throw new Error('Warung tidak ditemukan');
  }
  const supabase = createAdminClient();
  const temporaryPassword = `${randomBytes(24).toString('base64url')}!aA1`;
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: data.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: data.fullName },
    app_metadata: { must_change_password: true },
  });
  if (error || !created.user) throw new Error('Gagal membuat akun. Periksa apakah email sudah digunakan.');
  let roleId: string;
  try {
    roleId = await db.transaction(async tx => {
      await tx.insert(users).values({ id: created.user.id, email: data.email, fullName: data.fullName });
      const [createdRole] = await tx.insert(userRoles).values({ userId: created.user.id, role: data.role, warungId: data.role === 'TENANT_MEMBER' ? data.warungId : null }).returning({ id: userRoles.id });
      await tx.insert(auditLogs).values({ actorId: user.id, action: 'REGISTER_ACCOUNT', entityType: 'users', entityId: created.user.id, newValue: JSON.stringify({ email: data.email, role: data.role, warungId: data.warungId }) });
      return createdRole.id;
    });
  } catch (cause) {
    await supabase.auth.admin.deleteUser(created.user.id);
    throw cause;
  }
  revalidatePath('/admin');
  return { success: true, temporaryPassword, account: { id: created.user.id, roleId, email: data.email, fullName: data.fullName, phoneNumber: null, isActive: true, role: data.role, warungId: data.role === 'TENANT_MEMBER' ? data.warungId : null } };
}

// ─── 2. TRANSFER WARUNG OWNERSHIP ────────────────────────────

export async function transferAccount(input: {
  warungId: string;
  oldEmail: string;
  newEmail: string;
}) {
  const { user } = await requireSuperAdmin();

  const transferData = z.object({
    warungId: z.string().uuid(),
    oldEmail: z.string().email().transform(value => value.trim().toLowerCase()),
    newEmail: z.string().email().transform(value => value.trim().toLowerCase()),
  }).parse(input);
  if (transferData.oldEmail === transferData.newEmail) throw new Error('Email lama dan baru harus berbeda');

  const result = await db.transaction(async (tx) => {
    // 1. Find old user
    const [oldUser] = await tx
      .select()
      .from(users)
      .where(eq(users.email, transferData.oldEmail))
      .for('update')
      .limit(1);

    if (!oldUser) {
      throw new Error(`Pengguna dengan email ${transferData.oldEmail} tidak ditemukan`);
    }

    // The replacement must already be a real Auth account registered by Super Admin.
    const [newUser] = await tx
      .select()
      .from(users)
      .where(eq(users.email, transferData.newEmail))
      .for('update')
      .limit(1);

    if (!newUser) throw new Error('Daftarkan email pengganti terlebih dahulu');
    if (!newUser.isActive || newUser.email.endsWith('@deleted.sebakul.invalid')) {
      throw new Error('Akun pengganti sedang nonaktif.');
    }
    const oldRole = await tx.select({ id: userRoles.id }).from(userRoles)
      .where(and(eq(userRoles.userId, oldUser.id), eq(userRoles.warungId, transferData.warungId), eq(userRoles.role, 'TENANT_MEMBER'))).limit(1);
    if (!oldRole.length) throw new Error('Pemilik lama tidak terhubung ke warung tersebut');
    const otherWarung = await tx.select({ id: userRoles.id }).from(userRoles)
      .where(and(eq(userRoles.userId, newUser.id), eq(userRoles.role, 'TENANT_MEMBER'))).limit(1);
    if (otherWarung.length) throw new Error('Email pengganti sudah memiliki warung');

    // 3. Delete old role
    await tx
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, oldUser.id),
          eq(userRoles.warungId, transferData.warungId),
          eq(userRoles.role, 'TENANT_MEMBER')
        )
      );

    // 4. Insert new role
    await tx.insert(userRoles).values({
      userId: newUser.id,
      role: 'TENANT_MEMBER',
      warungId: transferData.warungId,
    }).onConflictDoNothing();

    // 5. Audit log
    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: 'TRANSFER_ACCOUNT',
      entityType: 'warungs',
      entityId: transferData.warungId,
      oldValue: JSON.stringify({ email: transferData.oldEmail, userId: oldUser.id }),
      newValue: JSON.stringify({ email: transferData.newEmail, userId: newUser.id }),
    });

    return { oldUserId: oldUser.id, newUserId: newUser.id };
  });

  revalidatePath('/admin');
  revalidatePath('/warung');
  revalidatePath('/sentra/tagihan');
  return { success: true, ...result, warungId: transferData.warungId };
}

// ─── 3. AUDIT LOG (SUPER ADMIN ONLY) ─────────────────────────

export async function getAuditLogs(options?: {
  limit?: number;
  offset?: number;
  actionFilter?: string;
}) {
  await requireSuperAdmin();
  const parsed = z.object({
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).max(100_000).optional(),
    actionFilter: z.string().trim().max(100).optional(),
  }).parse(options ?? {});

  let query = db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      oldValue: auditLogs.oldValue,
      newValue: auditLogs.newValue,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      actorEmail: users.email,
      actorName: users.fullName,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id));

  if (parsed.actionFilter) {
    query = query.where(eq(auditLogs.action, parsed.actionFilter)) as typeof query;
  }

  return await query
    .orderBy(desc(auditLogs.createdAt))
    .limit(parsed.limit ?? 50)
    .offset(parsed.offset ?? 0);
}

// ─── 4. MASTER DATA LAPAK & WARUNG ──────────────────────────

export async function getAdminMasterData() {
  await requireSuperAdmin();

  const lapaksQuery = db
    .select({
      id: lapaks.id,
      code: lapaks.code,
      status: lapaks.status,
      billingCycle: lapaks.billingCycle,
      baseRentAmount: lapaks.baseRentAmount,
      contractStart: lapaks.contractStart,
      contractEnd: lapaks.contractEnd,
      securityDepositAmount: lapaks.securityDepositAmount,
      contractNotes: lapaks.contractNotes,
      warungId: lapaks.warungId,
      warungName: warungs.name,
      warungSlug: warungs.slug,
    })
    .from(lapaks)
    .leftJoin(warungs, eq(lapaks.warungId, warungs.id))
    .orderBy(lapaks.code);

  const warungsQuery = db
    .select()
    .from(warungs)
    .orderBy(warungs.name);

  const accountsQuery = db.select({
    id: users.id, email: users.email, fullName: users.fullName,
    phoneNumber: users.phoneNumber, isActive: users.isActive,
    roleId: userRoles.id, role: userRoles.role, warungId: userRoles.warungId,
  }).from(users).innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(inArray(userRoles.role, ['SUPER_ADMIN', 'PENGELOLA_ADMIN', 'TENANT_MEMBER']))
    .orderBy(users.fullName);

  const [allLapaks, allWarungs, allAccounts] = await Promise.all([
    lapaksQuery,
    warungsQuery,
    accountsQuery,
  ]);

  return {
    lapaks: allLapaks.map(lapak => ({ ...lapak, contractExpired: Boolean(lapak.contractEnd && lapak.contractEnd < getBusinessDateString()) })),
    warungs: allWarungs,
    accounts: allAccounts,
  };
}

export async function setAccountActive(targetUserId: string, isActive: boolean) {
  const { user } = await requireSuperAdmin();
  const id = z.string().uuid().parse(targetUserId);
  const nextActive = z.boolean().parse(isActive);
  if (id === user.id) throw new Error('Tidak dapat menonaktifkan akun sendiri');
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, id));
  if (!roles.length) throw new Error('Akun tidak ditemukan');
  if (roles.some(item => item.role === 'SUPER_ADMIN')) throw new Error('Akun Super Admin tidak dapat diubah dari halaman ini');
  const [current] = await db.select({ isActive: users.isActive, email: users.email }).from(users).where(eq(users.id, id)).limit(1);
  if (!current) throw new Error('Akun tidak ditemukan');
  if (current.email.endsWith('@deleted.sebakul.invalid')) throw new Error('Akun yang sudah dihapus tidak dapat diaktifkan kembali. Daftarkan akun baru.');
  if (current.isActive === nextActive) return { success: true };
  const auth = createAdminClient();
  const authUpdate = await auth.auth.admin.updateUserById(id, { ban_duration: nextActive ? 'none' : '876000h' });
  if (authUpdate.error) throw new Error('Status login akun gagal diperbarui. Coba lagi.');
  try {
    await db.transaction(async tx => {
      await tx.update(users).set({ isActive: nextActive }).where(eq(users.id, id));
      await tx.insert(auditLogs).values({ actorId: user.id, action: nextActive ? 'ACTIVATE_ACCOUNT' : 'DEACTIVATE_ACCOUNT', entityType: 'users', entityId: id, newValue: JSON.stringify({ isActive: nextActive }) });
    });
  } catch (cause) {
    await auth.auth.admin.updateUserById(id, { ban_duration: current.isActive ? 'none' : '876000h' });
    throw cause;
  }
  revalidatePath('/admin');
  return { success: true };
}

const editableAccountRoles = ['PENGELOLA_ADMIN', 'TENANT_MEMBER'] as const;
const updateAccountSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  email: z.string().trim().email().max(255).transform(value => value.toLowerCase()),
  fullName: z.string().trim().min(2).max(100),
  phoneNumber: z.string().trim().max(30).nullish(),
  role: z.enum(editableAccountRoles),
  warungId: z.string().uuid().nullable(),
});

export async function updateAccount(input: z.input<typeof updateAccountSchema>) {
  const { user } = await requireSuperAdmin();
  const data = updateAccountSchema.parse(input);
  const [currentUser] = await db.select({ id: users.id, email: users.email, fullName: users.fullName, phoneNumber: users.phoneNumber })
    .from(users).where(eq(users.id, data.userId)).limit(1);
  const [currentRole] = await db.select({ id: userRoles.id, role: userRoles.role, warungId: userRoles.warungId })
    .from(userRoles).where(and(eq(userRoles.id, data.roleId), eq(userRoles.userId, data.userId))).limit(1);
  if (!currentUser || !currentRole) throw new Error('Akun atau peran tidak ditemukan. Muat ulang halaman.');
  if (currentUser.email.endsWith('@deleted.sebakul.invalid')) throw new Error('Akun yang sudah dihapus tidak dapat diedit.');
  // Super Admin privilege is intentionally immutable from account editing.
  if (data.email !== currentUser.email) {
    const [duplicate] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
    if (duplicate && duplicate.id !== data.userId) throw new Error('Email sudah digunakan akun lain.');
  }

  let nextWarungId = currentRole.warungId;
  if (currentRole.role !== 'SUPER_ADMIN') {
    const needsWarung = data.role === 'TENANT_MEMBER';
    if (needsWarung && !data.warungId) throw new Error('Pilih warung untuk peran ini.');
    if (needsWarung) {
      const [warung] = await db.select({ id: warungs.id }).from(warungs).where(eq(warungs.id, data.warungId!)).limit(1);
      if (!warung) throw new Error('Warung tidak ditemukan.');
    }
    nextWarungId = needsWarung ? data.warungId : null;
    const roleCandidates = await db.select({ id: userRoles.id, warungId: userRoles.warungId }).from(userRoles)
      .where(and(eq(userRoles.userId, data.userId), eq(userRoles.role, data.role)));
    if (roleCandidates.some(candidate => candidate.id !== data.roleId && candidate.warungId === nextWarungId)) {
      throw new Error('Akun sudah memiliki peran tersebut pada warung ini.');
    }
  }

  const auth = createAdminClient();
  const authUpdate = await auth.auth.admin.updateUserById(data.userId, {
    email: data.email,
    email_confirm: true,
    user_metadata: { full_name: data.fullName },
  });
  if (authUpdate.error) throw new Error('Data login gagal diperbarui. Periksa email dan coba lagi.');
  try {
    await db.transaction(async tx => {
      await tx.update(users).set({ email: data.email, fullName: data.fullName, phoneNumber: data.phoneNumber || null }).where(eq(users.id, data.userId));
      if (currentRole.role !== 'SUPER_ADMIN') {
        await tx.update(userRoles).set({ role: data.role, warungId: nextWarungId }).where(eq(userRoles.id, data.roleId));
      }
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: 'UPDATE_ACCOUNT',
        entityType: 'users',
        entityId: data.userId,
        oldValue: JSON.stringify({ email: currentUser.email, fullName: currentUser.fullName, phoneNumber: currentUser.phoneNumber, role: currentRole.role, warungId: currentRole.warungId }),
        newValue: JSON.stringify({ email: data.email, fullName: data.fullName, phoneNumber: data.phoneNumber || null, role: currentRole.role === 'SUPER_ADMIN' ? currentRole.role : data.role, warungId: currentRole.role === 'SUPER_ADMIN' ? currentRole.warungId : nextWarungId }),
      });
    });
  } catch (cause) {
    await auth.auth.admin.updateUserById(data.userId, {
      email: currentUser.email,
      email_confirm: true,
      user_metadata: { full_name: currentUser.fullName },
    });
    throw cause;
  }

  revalidatePath('/admin');
  return { success: true };
}

export async function resetAccountPassword(targetUserId: string) {
  const { user } = await requireSuperAdmin();
  const id = z.string().uuid().parse(targetUserId);
  if (id === user.id) throw new Error('Gunakan menu ubah kata sandi untuk akun sendiri.');
  const [target] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, id)).limit(1);
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, id));
  if (!target || !roles.length) throw new Error('Akun tidak ditemukan.');
  if (target.email.endsWith('@deleted.sebakul.invalid')) throw new Error('Akun yang sudah dihapus tidak dapat direset.');
  if (roles.some(item => item.role === 'SUPER_ADMIN')) throw new Error('Kata sandi akun Super Admin tidak dapat direset dari halaman ini.');

  const auth = createAdminClient();
  const { data: authUser, error: lookupError } = await auth.auth.admin.getUserById(id);
  if (lookupError || !authUser.user) throw new Error('Data login akun tidak ditemukan.');
  // Record the privileged request first so an audit outage never leaves the
  // account with a changed, undisclosed password.
  await db.insert(auditLogs).values({ actorId: user.id, action: 'RESET_ACCOUNT_PASSWORD', entityType: 'users', entityId: id, newValue: JSON.stringify({ email: target.email, mustChangePassword: true }) });
  const temporaryPassword = `${randomBytes(24).toString('base64url')}!aA1`;
  const { error } = await auth.auth.admin.updateUserById(id, {
    password: temporaryPassword,
    app_metadata: { ...authUser.user.app_metadata, must_change_password: true },
  });
  if (error) throw new Error('Kata sandi gagal direset. Coba lagi.');

  revalidatePath('/admin');
  return { success: true, email: target.email, temporaryPassword };
}

/**
 * Remove Auth access while retaining an anonymized profile row so financial,
 * operational, and audit history keeps its foreign-key references intact.
 */
export async function deleteAccount(targetUserId: string) {
  const { user } = await requireSuperAdmin();
  const id = z.string().uuid().parse(targetUserId);
  if (id === user.id) throw new Error('Tidak dapat menghapus akun sendiri.');
  const [target] = await db.select({ id: users.id, email: users.email, fullName: users.fullName, phoneNumber: users.phoneNumber, isActive: users.isActive })
    .from(users).where(eq(users.id, id)).limit(1);
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, id));
  if (!target || !roles.length) throw new Error('Akun tidak ditemukan.');
  if (roles.some(item => item.role === 'SUPER_ADMIN')) throw new Error('Akun Super Admin dilindungi dan tidak dapat dihapus.');

  const auth = createAdminClient();
  const tombstoneEmail = `deleted+${id}@deleted.sebakul.invalid`;
  const { data: authLookup, error: authLookupError } = await auth.auth.admin.getUserById(id);
  if (authLookupError && authLookupError.status !== 404) {
    if (target.email.endsWith('@deleted.sebakul.invalid')) {
      throw new Error('Akun sudah dinonaktifkan dan data dipseudonimkan, tetapi status kredensial Auth belum dapat diperiksa. Coba lagi.');
    }
    throw new Error('Status akun login tidak dapat diperiksa. Coba lagi.');
  }
  const authAccountExists = !!authLookup.user;
  if (!target.email.endsWith('@deleted.sebakul.invalid')) {
    if (authAccountExists) {
      const { error: banError } = await auth.auth.admin.updateUserById(id, { ban_duration: '876000h' });
      if (banError) throw new Error('Akun login gagal dinonaktifkan. Penghapusan dibatalkan.');
    }
    try {
      await db.transaction(async tx => {
        await tx.update(users).set({ email: tombstoneEmail, fullName: 'Akun dihapus', phoneNumber: null, isActive: false }).where(eq(users.id, id));
        // Remove the email from previous audit payloads while preserving the
        // events and actor/target UUIDs needed to explain historical changes.
        await tx.update(auditLogs).set({
          oldValue: sql`replace(${auditLogs.oldValue}, ${target.email}, '[email disamarkan]')`,
          newValue: sql`replace(${auditLogs.newValue}, ${target.email}, '[email disamarkan]')`,
        }).where(or(
          sql`position(${target.email} in coalesce(${auditLogs.oldValue}, '')) > 0`,
          sql`position(${target.email} in coalesce(${auditLogs.newValue}, '')) > 0`,
        ));
        await tx.update(auditLogs).set({ oldValue: '[data akun disamarkan]', newValue: '[data akun disamarkan]' })
          .where(and(eq(auditLogs.entityType, 'users'), eq(auditLogs.entityId, id)));
        await tx.insert(auditLogs).values({
          actorId: user.id,
          action: 'DELETE_ACCOUNT',
          entityType: 'users',
          entityId: id,
          oldValue: JSON.stringify({ roles: roles.map(item => item.role), contactData: 'redacted' }),
          newValue: JSON.stringify({ deleted: true, historyRetained: true }),
        });
      });
    } catch (cause) {
      if (authAccountExists) await auth.auth.admin.updateUserById(id, { ban_duration: target.isActive ? 'none' : '876000h' });
      throw cause;
    }
  }

  if (authAccountExists) {
    const { error: deleteError } = await auth.auth.admin.deleteUser(id);
    if (deleteError) throw new Error('Akses akun sudah dinonaktifkan dan data dipseudonimkan, tetapi penghapusan kredensial Auth gagal. Tekan Hapus lagi untuk mencoba ulang.');
  }
  revalidatePath('/admin');
  return { success: true };
}

const lapakContractSchema = z.object({
  lapakId: z.string().uuid(),
  contractStart: z.string().date().nullable(),
  contractEnd: z.string().date().nullable(),
  securityDepositAmount: z.number().int().min(0).max(999_999_999),
  contractNotes: z.string().trim().max(1000).nullish(),
}).superRefine((data, ctx) => {
  if (data.contractStart && data.contractEnd && data.contractEnd < data.contractStart) ctx.addIssue({ code: 'custom', path: ['contractEnd'], message: 'Tanggal akhir harus setelah tanggal mulai.' });
});

export async function updateLapakContract(input: z.input<typeof lapakContractSchema>) {
  const { user } = await requireSuperAdmin();
  const data = lapakContractSchema.parse(input);
  await db.transaction(async tx => {
    const [current] = await tx.select({
      id: lapaks.id,
      warungId: lapaks.warungId,
      contractStart: lapaks.contractStart,
      contractEnd: lapaks.contractEnd,
      securityDepositAmount: lapaks.securityDepositAmount,
      contractNotes: lapaks.contractNotes,
    }).from(lapaks).where(eq(lapaks.id, data.lapakId)).for('update').limit(1);
    if (!current?.warungId) throw new Error('Kontrak hanya dapat dicatat untuk lapak yang sedang ditempati.');
    await tx.update(lapaks).set({
      contractStart: data.contractStart,
      contractEnd: data.contractEnd,
      securityDepositAmount: data.securityDepositAmount,
      contractNotes: data.contractNotes || null,
      updatedAt: new Date(),
    }).where(eq(lapaks.id, current.id));
    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: 'UPDATE_LAPAK_CONTRACT',
      entityType: 'lapaks',
      entityId: current.id,
      oldValue: JSON.stringify({
        contractStart: current.contractStart,
        contractEnd: current.contractEnd,
        securityDepositAmount: current.securityDepositAmount,
        contractNotes: current.contractNotes,
      }),
      newValue: JSON.stringify({
        contractStart: data.contractStart,
        contractEnd: data.contractEnd,
        securityDepositAmount: data.securityDepositAmount,
        contractNotes: data.contractNotes || null,
      }),
    });
  });
  revalidatePath('/admin'); revalidatePath('/warung/sewa');
  return { success: true };
}
