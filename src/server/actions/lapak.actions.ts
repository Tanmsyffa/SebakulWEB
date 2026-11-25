'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  lapaks,
  warungs,
  invoices,
  invoicePayments,
  paymentProofs,
  sentraLedger,
  facilityTickets,
  auditLogs,
  userRoles,
  userNotifications,
  lapakRenewalRequests,
  users,
} from '@/db/schema';
import { requireAdmin, requireTenantAccess } from '@/server/guards/auth-guard';
import type { LapakStatus, InvoiceStatus, TicketStatus } from '@/types';
import { recordPaymentSchema } from '@/lib/validations/invoice.schema';
import { getBusinessDateString } from '@/lib/business-date';
import { z } from 'zod';

// ─── 1. PETA LAPAK SENTRA ───────────────────────────────────

export async function getLapakGrid() {
  await requireAdmin();

  // Fetch all lapaks with assigned warung and latest invoice status
  const allLapaks = await db
    .select({
      id: lapaks.id,
      code: lapaks.code,
      status: lapaks.status,
      billingCycle: lapaks.billingCycle,
      baseRentAmount: lapaks.baseRentAmount,
      warungId: lapaks.warungId,
      warungName: warungs.name,
      warungCategory: warungs.category,
      depositBalance: warungs.depositBalance,
    })
    .from(lapaks)
    .leftJoin(warungs, eq(lapaks.warungId, warungs.id))
    .orderBy(lapaks.code);

  if (allLapaks.length === 0) return [];
  const latestInvoices = await db.selectDistinctOn([invoices.lapakId], {
    lapakId: invoices.lapakId,
    status: invoices.status,
    remainingAmount: invoices.remainingAmount,
    totalAmount: invoices.totalAmount,
    periodEnd: invoices.periodEnd,
  }).from(invoices)
    .where(inArray(invoices.lapakId, allLapaks.map(lapak => lapak.id)))
    .orderBy(invoices.lapakId, desc(invoices.createdAt));
  const invoiceByLapak = new Map(latestInvoices.map(invoice => [invoice.lapakId, invoice]));
  return allLapaks.map(lapak => ({
    ...lapak,
    latestInvoice: lapak.warungId ? invoiceByLapak.get(lapak.id) ?? null : null,
  }));
}

export async function updateLapakStatus(lapakId: string, newStatus: LapakStatus) {
  const { user } = await requireAdmin();
  const id = z.string().uuid().parse(lapakId);
  const status = z.enum(['KOSONG', 'TERISI', 'LIBUR', 'PERBAIKAN']).parse(newStatus);
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(lapaks).where(eq(lapaks.id, id)).for('update').limit(1);
    if (!current) throw new Error('Lapak tidak ditemukan');
    if ((status === 'KOSONG' || status === 'PERBAIKAN') && current.warungId && (!current.contractEnd || current.contractEnd >= getBusinessDateString())) {
      throw new Error('Lapak masih terikat kontrak aktif dan belum dapat dilepas.');
    }
    if ((status === 'TERISI' || status === 'LIBUR') && !current.warungId) {
      throw new Error('Hubungkan warung ke lapak sebelum memilih status terisi atau libur.');
    }
    await tx
      .update(lapaks)
      .set({
        status,
        ...(status === 'KOSONG' || status === 'PERBAIKAN' ? { warungId: null, utilityFeeAmount: 0, contractStart: null, contractEnd: null, securityDepositAmount: 0, contractNotes: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(lapaks.id, id));

    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: 'UPDATE_LAPAK_STATUS',
      entityType: 'lapaks',
      entityId: id,
      oldValue: JSON.stringify({ status: current.status }),
      newValue: JSON.stringify({ status, warungId: status === 'KOSONG' || status === 'PERBAIKAN' ? null : current.warungId }),
    });
  });

  revalidatePath('/sentra');
  revalidatePath('/sentra/tagihan');
  revalidatePath('/warung/sewa');
  revalidatePath('/admin');
  return { success: true };
}

// ─── 2. TAGIHAN SEWA & BATCH INVOICE GENERATOR ──────────────

export async function createInvoiceBatch(
  periodStart: string,
  periodEnd: string,
  dueDate: string,
  targetLapakId?: string,
) {
  const { user } = await requireAdmin();
  const period = z.object({ start: z.string().date(), end: z.string().date(), due: z.string().date(), lapakId: z.string().uuid().optional() }).parse({ start: periodStart, end: periodEnd, due: dueDate, lapakId: targetLapakId || undefined });
  if (period.end < period.start || period.due < period.start) throw new Error('Rentang periode atau tanggal jatuh tempo tidak valid.');

  // Find all lapaks that are TERISI or LIBUR
  const targetLapaks = await db
    .select({
      lapakId: lapaks.id,
    })
    .from(lapaks)
    .innerJoin(warungs, eq(lapaks.warungId, warungs.id))
    .where(and(inArray(lapaks.status, ['TERISI', 'LIBUR']), period.lapakId ? eq(lapaks.id, period.lapakId) : undefined))
    .orderBy(lapaks.id);

  if (targetLapaks.length === 0) {
    return { success: false, message: 'Tidak ada lapak aktif/libur untuk ditagih' };
  }

  const createdInvoices = await db.transaction(async (tx) => {
    const results = [];
    let skipped = 0;
    const datePrefix = periodStart.replace(/-/g, '').slice(0, 6); // YYYYMM
    const fullStart = periodStart.replace(/-/g, '');
    const shortEnd = periodEnd.replace(/-/g, '').slice(4);

    for (let i = 0; i < targetLapaks.length; i++) {
      const target = targetLapaks[i];
      // Serialize invoice generation per lapak and period, re-reading locked state
      // so concurrent lapak/warung changes cannot produce stale invoices.
      const [item] = await tx
        .select({
          lapakId: lapaks.id,
          code: lapaks.code,
          status: lapaks.status,
          warungId: lapaks.warungId,
          baseRentAmount: lapaks.baseRentAmount,
        })
        .from(lapaks)
        .where(eq(lapaks.id, target.lapakId))
        .for('update')
        .limit(1);
      if (!item || !item.warungId || !['TERISI', 'LIBUR'].includes(item.status)) {
        skipped += 1;
        continue;
      }
      const [existingInvoice] = await tx.select({ id: invoices.id }).from(invoices)
        .where(and(eq(invoices.lapakId, item.lapakId), eq(invoices.periodStart, periodStart), eq(invoices.periodEnd, periodEnd))).limit(1);
      if (existingInvoice) { skipped += 1; continue; }

      let invoiceNumber = `INV-${datePrefix}-${item.code}-${String(i + 1).padStart(3, '0')}`;
      const [dupMonthlyNumber] = await tx.select({ id: invoices.id }).from(invoices)
        .where(eq(invoices.invoiceNumber, invoiceNumber)).limit(1);
      if (dupMonthlyNumber) {
        invoiceNumber = `INV-${fullStart}-${item.code}-${shortEnd}`;
        const [dupPeriodNumber] = await tx.select({ id: invoices.id }).from(invoices)
          .where(eq(invoices.invoiceNumber, invoiceNumber)).limit(1);
        if (dupPeriodNumber) {
          invoiceNumber = `INV-${fullStart}-${item.code}-${shortEnd}-${String(i + 1).padStart(3, '0')}`;
        }
      }

      let rentAmount = item.baseRentAmount;
      let utilityAmount = 0;
      let invoiceStatus: InvoiceStatus = 'UNPAID';
      let depositApplied = 0;

      // If lapak is LIBUR: sewa pokok is waived
      if (item.status === 'LIBUR') {
        rentAmount = 0;
        utilityAmount = 0;
        invoiceStatus = 'WAIVED';
      } else {
        // Apply deposit locked at invoice creation time
        const [lockedWarung] = await tx.select({ depositBalance: warungs.depositBalance })
          .from(warungs).where(eq(warungs.id, item.warungId)).for('update').limit(1);
        const currentDeposit = lockedWarung?.depositBalance ?? 0;
        const grossAmount = rentAmount + utilityAmount;
        depositApplied = Math.min(currentDeposit, grossAmount);

        // Deduct applied deposit from warung deposit balance
        if (depositApplied > 0) {
          await tx
            .update(warungs)
            .set({
              depositBalance: currentDeposit - depositApplied,
            })
            .where(eq(warungs.id, item.warungId));
        }
      }

      const totalAmount = rentAmount + utilityAmount - depositApplied;
      const remainingAmount = totalAmount;

      if (totalAmount === 0 && invoiceStatus !== 'WAIVED') {
        invoiceStatus = 'PAID';
      }

      const [inv] = await tx
        .insert(invoices)
        .values({
          invoiceNumber,
          lapakId: item.lapakId,
          warungId: item.warungId,
          periodStart,
          periodEnd,
          dueDate,
          rentAmount,
          utilityAmount,
          depositApplied,
          totalAmount,
          paidAmount: 0,
          remainingAmount,
          status: invoiceStatus,
          createdBy: user.id,
        })
        .returning();

      results.push(inv);
    }

    // Record audit log
    if (results.length) {
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: period.lapakId ? 'GENERATE_INVOICE_SINGLE' : 'GENERATE_INVOICE',
        entityType: 'invoices',
        entityId: `batch-${datePrefix}`,
        newValue: JSON.stringify({ count: results.length, periodStart, periodEnd, singleLapakId: period.lapakId ?? null }),
      });
      const warungIds = [...new Set(results.map(invoice => invoice.warungId))];
      const tenantUsers = await tx.select({ userId: userRoles.userId, warungId: userRoles.warungId })
        .from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .where(and(eq(userRoles.role, 'TENANT_MEMBER'), eq(users.isActive, true), inArray(userRoles.warungId, warungIds)));
      const invoicesByWarung = new Map(results.map(invoice => [invoice.warungId, invoice]));
      if (tenantUsers.length) await tx.insert(userNotifications).values(tenantUsers.map(tenant => {
        const invoice = invoicesByWarung.get(tenant.warungId!);
        return {
          userId: tenant.userId,
          scopeRole: 'TENANT_MEMBER',
          dedupeKey: `invoice-created:${invoice!.id}`,
          title: 'Tagihan sewa baru tersedia',
          body: `${invoice!.invoiceNumber} · jatuh tempo ${invoice!.dueDate}`,
          href: '/warung/sewa',
          severity: 'warning',
          isActive: true,
          readAt: null,
        };
      })).onConflictDoNothing();
    }

    return { results, skipped };
  });

  revalidatePath('/sentra');
  revalidatePath('/sentra/tagihan');
  revalidatePath('/warung/sewa');
  revalidatePath('/admin');
  return { success: true, count: createdInvoices.results.length, skipped: createdInvoices.skipped };
}

// ─── 3. CATAT BAYAR CICILAN & DEPOSIT ────────────────────────

export async function recordPayment(input: {
  idempotencyKey: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  proofImageUrl?: string | null;
  notes?: string | null;
  proofId?: string;
}) {
  const { user } = await requireAdmin();
  const validated = recordPaymentSchema.parse(input);
  const proofId = input.proofId ? z.string().uuid().parse(input.proofId) : null;
  const paymentAmount = validated.amount;
  if (!Number.isSafeInteger(paymentAmount) || paymentAmount <= 0 || paymentAmount > 999_999_999) {
    throw new Error('Nominal pembayaran harus bilangan bulat positif');
  }
  if (proofId && validated.paymentMethod !== 'TRANSFER_QRIS') throw new Error('Bukti transfer hanya dapat dicatat sebagai Transfer / QRIS.');
  await db.transaction(async (tx) => {
    // The unique key and row lock make retries and concurrent payments safe.
    const previous = await tx.select({ id: invoicePayments.id, invoiceId: invoicePayments.invoiceId, amount: invoicePayments.amount }).from(invoicePayments)
      .where(eq(invoicePayments.idempotencyKey, validated.idempotencyKey)).limit(1);
    if (previous.length) {
      if (previous[0].invoiceId !== validated.invoiceId || previous[0].amount !== paymentAmount) {
        throw new Error('Kunci transaksi sudah digunakan untuk tagihan lain');
      }
      return;
    }
    await tx.execute(sql`SELECT id FROM invoices WHERE id = ${validated.invoiceId} FOR UPDATE`);
    const retry = await tx.select({ id: invoicePayments.id, invoiceId: invoicePayments.invoiceId, amount: invoicePayments.amount }).from(invoicePayments)
      .where(eq(invoicePayments.idempotencyKey, validated.idempotencyKey)).limit(1);
    if (retry.length) {
      if (retry[0].invoiceId !== validated.invoiceId || retry[0].amount !== paymentAmount) {
        throw new Error('Kunci transaksi sudah digunakan untuk tagihan lain');
      }
      return;
    }
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, validated.invoiceId)).limit(1);
    if (!inv) throw new Error('Tagihan tidak ditemukan');
    if (inv.status === 'PAID' || inv.status === 'WAIVED') throw new Error('Tagihan sudah ditutup');
    let proofPath: string | null = null;
    if (proofId) {
      await tx.execute(sql`SELECT id FROM payment_proofs WHERE id = ${proofId} FOR UPDATE`);
      const [proof] = await tx.select().from(paymentProofs).where(and(eq(paymentProofs.id, proofId), eq(paymentProofs.invoiceId, inv.id))).limit(1);
      if (!proof || proof.status !== 'PENDING') throw new Error('Bukti bayar tidak tersedia untuk tagihan ini');
      proofPath = proof.storagePath;
    }
    const applied = Math.min(paymentAmount, inv.remainingAmount);
    const overpayment = paymentAmount - applied;
    const newRemaining = inv.remainingAmount - applied;
    const newPaid = inv.paidAmount + applied;
    const newStatus: InvoiceStatus = newRemaining === 0 ? 'PAID' : 'PARTIAL';
    if (overpayment > 0) {
      const [lockedWarung] = await tx.select({ depositBalance: warungs.depositBalance }).from(warungs)
        .where(eq(warungs.id, inv.warungId)).for('update').limit(1);
      if (!lockedWarung || lockedWarung.depositBalance + overpayment > 2_000_000_000) {
        throw new Error('Saldo deposit warung melampaui batas maksimum.');
      }
      await tx.update(warungs).set({ depositBalance: lockedWarung.depositBalance + overpayment })
        .where(eq(warungs.id, inv.warungId));
    }

    // Update invoice
    await tx
      .update(invoices)
      .set({
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        status: newStatus,
      })
      .where(eq(invoices.id, inv.id));

    // Insert payment record
    await tx.insert(invoicePayments).values({
      idempotencyKey: validated.idempotencyKey,
      invoiceId: inv.id,
      amount: paymentAmount,
      paymentMethod: validated.paymentMethod,
      proofImageUrl: proofPath,
      verifiedBy: user.id,
      notes: validated.notes || null,
    });

    // Record income into sentra_ledger
    await tx.insert(sentraLedger).values({
      idempotencyKey: validated.idempotencyKey,
      type: 'INCOME',
      category: 'SEWA_LAPAK',
      amount: paymentAmount,
      description: `Pembayaran sewa ${inv.invoiceNumber} (${validated.paymentMethod})`,
      referenceInvoiceId: inv.id,
      recordedBy: user.id,
    });

    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: 'RECORD_PAYMENT',
      entityType: 'invoices',
      entityId: inv.id,
      oldValue: JSON.stringify({ paidAmount: inv.paidAmount, remainingAmount: inv.remainingAmount, status: inv.status }),
      newValue: JSON.stringify({
        amount: paymentAmount,
        applied,
        overpayment,
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        status: newStatus,
        paymentMethod: validated.paymentMethod,
        proofId,
      }),
    });

    if (proofId) {
      const [verifiedProof] = await tx.update(paymentProofs).set({ status: 'VERIFIED', reviewedBy: user.id, reviewedAt: new Date() })
        .where(and(eq(paymentProofs.id, proofId), eq(paymentProofs.status, 'PENDING')))
        .returning({ id: paymentProofs.id, warungId: paymentProofs.warungId });
      if (!verifiedProof) throw new Error('Bukti bayar sudah diproses. Muat ulang halaman dan periksa status tagihan.');
      const tenants = await tx.select({ userId: userRoles.userId }).from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .where(and(eq(userRoles.role, 'TENANT_MEMBER'), eq(users.isActive, true), eq(userRoles.warungId, verifiedProof.warungId)));
      if (tenants.length) await tx.insert(userNotifications).values(tenants.map(tenant => ({
        userId: tenant.userId, scopeRole: 'TENANT_MEMBER', dedupeKey: `payment-proof:${verifiedProof.id}:VERIFIED`,
        title: 'Pembayaran sewa diverifikasi', body: `Pembayaran untuk tagihan ${inv.invoiceNumber} telah dicatat. Sisa tagihan Rp${newRemaining.toLocaleString('id-ID')}.`,
        href: '/warung/sewa', severity: 'positive', isActive: true, readAt: null,
      }))).onConflictDoNothing();
    } else {
      const tenants = await tx.select({ userId: userRoles.userId }).from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .where(and(eq(userRoles.role, 'TENANT_MEMBER'), eq(users.isActive, true), eq(userRoles.warungId, inv.warungId)));
      if (tenants.length) await tx.insert(userNotifications).values(tenants.map(tenant => ({
        userId: tenant.userId, scopeRole: 'TENANT_MEMBER', dedupeKey: `invoice-payment:${inv.id}:${newPaid}`,
        title: newRemaining === 0 ? 'Tagihan sewa lunas' : 'Pembayaran sewa dicatat',
        body: `Tagihan ${inv.invoiceNumber} · sisa Rp${newRemaining.toLocaleString('id-ID')}.`,
        href: '/warung/sewa', severity: newRemaining === 0 ? 'positive' : 'warning', isActive: true, readAt: null,
      }))).onConflictDoNothing();
    }
  });

  revalidatePath('/sentra');
  revalidatePath('/sentra/tagihan');
  revalidatePath('/sentra/kas-sentra');
  revalidatePath('/warung/sewa');
  revalidatePath('/admin');
  return { success: true };
}

export async function getRecentPaymentProofs() {
  await requireAdmin();
  return db.select({
    id: paymentProofs.id,
    invoiceId: paymentProofs.invoiceId,
    uploadedAt: paymentProofs.uploadedAt,
    status: paymentProofs.status,
    reviewNote: paymentProofs.reviewNote,
    reviewedAt: paymentProofs.reviewedAt,
    invoiceNumber: invoices.invoiceNumber,
    warungName: warungs.name,
  }).from(paymentProofs)
    .innerJoin(invoices, eq(paymentProofs.invoiceId, invoices.id))
    .innerJoin(warungs, eq(paymentProofs.warungId, warungs.id))
    .orderBy(desc(paymentProofs.uploadedAt)).limit(200);
}

export async function rejectPaymentProof(proofId: string, reviewNote = '') {
  const { user } = await requireAdmin();
  const id = z.string().uuid().parse(proofId);
  const note = z.string().trim().min(5, 'Jelaskan alasan penolakan minimal 5 karakter.').max(500).parse(reviewNote);
  await db.transaction(async tx => {
    const [proof] = await tx.update(paymentProofs)
      .set({ status: 'REJECTED', reviewNote: note || null, reviewedBy: user.id, reviewedAt: new Date() })
      .where(and(eq(paymentProofs.id, id), eq(paymentProofs.status, 'PENDING')))
      .returning({ id: paymentProofs.id, invoiceId: paymentProofs.invoiceId, warungId: paymentProofs.warungId });
    if (!proof) throw new Error('Bukti bayar tidak ditemukan atau sudah diproses');
    await tx.insert(auditLogs).values({ actorId: user.id, action: 'REJECT_PAYMENT_PROOF', entityType: 'payment_proofs', entityId: proof.id, newValue: JSON.stringify({ status: 'REJECTED', invoiceId: proof.invoiceId }) });
    const tenants = await tx.select({ userId: userRoles.userId }).from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(eq(userRoles.role, 'TENANT_MEMBER'), eq(users.isActive, true), eq(userRoles.warungId, proof.warungId)));
    if (tenants.length) await tx.insert(userNotifications).values(tenants.map(tenant => ({
      userId: tenant.userId, scopeRole: 'TENANT_MEMBER', dedupeKey: `payment-proof:${proof.id}:REJECTED`,
      title: 'Bukti pembayaran ditolak', body: `Catatan pengelola: ${note}`,
      href: '/warung/sewa', severity: 'urgent', isActive: true, readAt: null,
    }))).onConflictDoUpdate({ target: [userNotifications.userId, userNotifications.scopeRole, userNotifications.dedupeKey], set: { isActive: true, readAt: null, createdAt: new Date(), updatedAt: new Date() } });
  });
  revalidatePath('/sentra/tagihan');
  revalidatePath('/warung/sewa');
  return { success: true };
}

// ─── 4. KAS SENTRA OPERASIONAL ──────────────────────────────

export async function getSentraDashboard() {
  await requireAdmin();

  // Sewa terkumpul
  const sewaQuery = db
    .select({
      remaining: sql<number>`COALESCE(SUM(${invoices.remainingAmount}), 0)`,
      invoiceCount: sql<number>`COUNT(*)`,
      activeContractCount: sql<number>`(SELECT COUNT(*) FROM ${lapaks} WHERE ${lapaks.status} = 'TERISI' AND ${lapaks.contractStart} <= ${getBusinessDateString()}::date AND ${lapaks.contractEnd} >= ${getBusinessDateString()}::date)`,
    })
    .from(invoices);

  // Invoices are the source of truth for rent actually applied. sentra_ledger
  // can be absent for older imports, and may include overpayments held as deposit.
  const incomeQuery = db.select({ total: sql<number>`COALESCE(SUM(${invoices.paidAmount}), 0)` })
    .from(invoices);

  // Biaya operasional from sentra_ledger
  const expenseQuery = db
    .select({
      total: sql<number>`COALESCE(SUM(${sentraLedger.amount}), 0)`,
    })
    .from(sentraLedger)
    .where(eq(sentraLedger.type, 'EXPENSE'));

  const [[sewaResult], [incomeResult], [expenseResult]] = await Promise.all([sewaQuery, incomeQuery, expenseQuery]);

  return {
    sewaTerkumpul: Number(incomeResult?.total || 0),
    tunggakan: Number(sewaResult?.remaining || 0),
    invoiceCount: Number(sewaResult?.invoiceCount || 0),
    activeContractCount: Number(sewaResult?.activeContractCount || 0),
    biayaOperasional: Number(expenseResult?.total || 0),
  };
}

export async function getSentraLedger(limit = 100) {
  await requireAdmin();
  const safeLimit = z.number().int().min(1).max(500).parse(limit);

  return await db
    .select()
    .from(sentraLedger)
    .orderBy(desc(sentraLedger.transactionDate))
    .limit(safeLimit);
}

export async function createSentraExpense(input: {
  idempotencyKey: string;
  category: string;
  amount: number;
  description: string;
}) {
  const { user } = await requireAdmin();
  const data = z.object({
    idempotencyKey: z.string().uuid(),
    category: z.string().trim().min(1).max(80),
    amount: z.number().int().positive().max(999_999_999),
    description: z.string().trim().min(1).max(500),
  }).parse(input);

  const entry = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(sentraLedger)
      .values({
        idempotencyKey: data.idempotencyKey,
        type: 'EXPENSE',
        category: data.category,
        amount: data.amount,
        description: data.description,
        recordedBy: user.id,
      })
      .onConflictDoNothing({ target: sentraLedger.idempotencyKey })
      .returning();
    if (inserted) {
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: 'CREATE_SENTRA_EXPENSE',
        entityType: 'sentra_ledger',
        entityId: inserted.id,
        newValue: JSON.stringify({ category: data.category, amount: data.amount, description: data.description }),
      });
    }
    return inserted;
  });

  revalidatePath('/sentra');
  revalidatePath('/sentra/kas-sentra');
  return { success: true, entry };
}

// ─── 5. TIKET KENDALA FASILITAS ─────────────────────────────

export async function getFacilityTickets(statusFilter?: TicketStatus) {
  await requireAdmin();
  const validStatus = statusFilter !== undefined ? z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).parse(statusFilter) : undefined;

  const query = db
    .select({
      id: facilityTickets.id,
      warungId: facilityTickets.warungId,
      lapakCode: lapaks.code,
      warungName: warungs.name,
      category: facilityTickets.category,
      description: facilityTickets.description,
      photoUrl: facilityTickets.photoUrl,
      feedback: facilityTickets.feedback,
      status: facilityTickets.status,
      createdAt: facilityTickets.createdAt,
      resolvedAt: facilityTickets.resolvedAt,
    })
    .from(facilityTickets)
    .innerJoin(lapaks, eq(facilityTickets.lapakId, lapaks.id))
    .innerJoin(warungs, eq(facilityTickets.warungId, warungs.id));

  const rows = validStatus ? await query
      .where(eq(facilityTickets.status, validStatus))
      .orderBy(desc(facilityTickets.createdAt)) : await query.orderBy(desc(facilityTickets.createdAt));
  const warungIds = [...new Set(rows.map(row => row.warungId))];
  const contacts = warungIds.length ? await db.select({ warungId: userRoles.warungId, name: users.fullName, phone: users.phoneNumber, email: users.email })
    .from(userRoles).innerJoin(users, eq(userRoles.userId, users.id))
    .where(and(inArray(userRoles.warungId, warungIds), eq(userRoles.role, 'TENANT_MEMBER'), eq(users.isActive, true))).orderBy(userRoles.createdAt) : [];
  const contactByWarung = new Map<string, typeof contacts[number]>();
  for (const contact of contacts) if (contact.warungId && !contactByWarung.has(contact.warungId)) contactByWarung.set(contact.warungId, contact);
  return rows.map(({ warungId, ...row }) => ({ ...row, contact: contactByWarung.get(warungId) ?? null }));

}

async function createTicketNotifications(input: {
  ticketId: string;
  warungId: string;
  status: TicketStatus;
  title: string;
  body: string;
}) {
  const [tenantRoles, adminRoles] = await Promise.all([
    db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(eq(userRoles.role, 'TENANT_MEMBER'), eq(users.isActive, true), eq(userRoles.warungId, input.warungId))),
    db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(inArray(userRoles.role, ['PENGELOLA_ADMIN', 'SUPER_ADMIN']), eq(users.isActive, true))),
  ]);
  const recipients = [...tenantRoles, ...adminRoles];
  const uniqueRecipients = new Map(recipients.map(recipient => [`${recipient.userId}:${recipient.role}`, recipient]));
  if (!uniqueRecipients.size) return;
  const now = new Date();
  await db.insert(userNotifications).values([...uniqueRecipients.values()].map(recipient => ({
    userId: recipient.userId,
    scopeRole: recipient.role,
    dedupeKey: `facility-ticket:${input.ticketId}:${input.status}`,
    title: input.title,
    body: input.body,
    href: '/dukungan',
    severity: input.status === 'RESOLVED' ? 'positive' as const : input.status === 'IN_PROGRESS' ? 'warning' as const : 'urgent' as const,
    isActive: true,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  }))).onConflictDoUpdate({
    target: [userNotifications.userId, userNotifications.scopeRole, userNotifications.dedupeKey],
    set: { title: input.title, body: input.body, isActive: true, readAt: null, createdAt: now, updatedAt: now },
  });
}

async function createRenewalNotifications(input: {
  requestId: string;
  warungId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  title: string;
  body: string;
}) {
  const [tenantRoles, adminRoles] = await Promise.all([
    db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(eq(userRoles.role, 'TENANT_MEMBER'), eq(users.isActive, true), eq(userRoles.warungId, input.warungId))),
    db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(inArray(userRoles.role, ['PENGELOLA_ADMIN', 'SUPER_ADMIN']), eq(users.isActive, true))),
  ]);
  const recipients = new Map([...tenantRoles, ...adminRoles].map(recipient => [`${recipient.userId}:${recipient.role}`, recipient]));
  if (!recipients.size) return;
  const now = new Date();
  await db.insert(userNotifications).values([...recipients.values()].map(recipient => ({
    userId: recipient.userId,
    scopeRole: recipient.role,
    dedupeKey: `lapak-renewal:${input.requestId}:${input.status}`,
    title: input.title,
    body: input.body,
    href: recipient.role === 'TENANT_MEMBER' ? '/warung/sewa' : '/sentra/tagihan',
    severity: input.status === 'REJECTED' ? 'urgent' as const : input.status === 'APPROVED' ? 'positive' as const : 'warning' as const,
    isActive: true,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  }))).onConflictDoUpdate({
    target: [userNotifications.userId, userNotifications.scopeRole, userNotifications.dedupeKey],
    set: { title: input.title, body: input.body, isActive: true, readAt: null, createdAt: now, updatedAt: now },
  });
}

export async function requestLapakRenewal(input: { requestedContractEnd: string; message?: string }) {
  const { warungId, userId } = await requireTenantAccess();
  const data = z.object({
    requestedContractEnd: z.string().date(),
    message: z.string().trim().max(500).optional(),
  }).parse(input);
  const today = getBusinessDateString();
  if (data.requestedContractEnd <= today) throw new Error('Tanggal akhir kontrak baru harus setelah hari ini.');
  const [lapak] = await db.select({ id: lapaks.id, code: lapaks.code, contractEnd: lapaks.contractEnd })
    .from(lapaks).where(eq(lapaks.warungId, warungId)).limit(1);
  if (!lapak) throw new Error('Warung belum memiliki lapak untuk diperpanjang.');
  if (lapak.contractEnd && data.requestedContractEnd <= lapak.contractEnd) {
    throw new Error('Tanggal yang diminta harus melewati akhir kontrak saat ini.');
  }
  const [existing] = await db.select({ id: lapakRenewalRequests.id }).from(lapakRenewalRequests)
    .where(and(eq(lapakRenewalRequests.lapakId, lapak.id), eq(lapakRenewalRequests.status, 'PENDING'))).limit(1);
  if (existing) throw new Error('Masih ada permintaan perpanjangan yang menunggu keputusan.');

  let request: { id: string };
  try {
    [request] = await db.insert(lapakRenewalRequests).values({
      lapakId: lapak.id,
      warungId,
      requestedBy: userId,
      requestedContractEnd: data.requestedContractEnd,
      message: data.message || null,
    }).returning({ id: lapakRenewalRequests.id });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505') {
      throw new Error('Masih ada permintaan perpanjangan yang menunggu keputusan.');
    }
    throw error;
  }
  await createRenewalNotifications({
    requestId: request.id,
    warungId,
    status: 'PENDING',
    title: 'Permintaan perpanjangan sewa baru',
    body: `Lapak ${lapak.code} · diminta sampai ${data.requestedContractEnd}${data.message ? ` · ${data.message}` : ''}`,
  });
  revalidatePath('/warung/sewa');
  revalidatePath('/sentra/tagihan');
  return { success: true };
}

export async function getWarungLapakRenewalRequest() {
  const { warungId } = await requireTenantAccess();
  const [request] = await db.select({
    id: lapakRenewalRequests.id,
    requestedContractEnd: lapakRenewalRequests.requestedContractEnd,
    message: lapakRenewalRequests.message,
    status: lapakRenewalRequests.status,
    reviewerNote: lapakRenewalRequests.reviewerNote,
    createdAt: lapakRenewalRequests.createdAt,
  }).from(lapakRenewalRequests).where(eq(lapakRenewalRequests.warungId, warungId))
    .orderBy(desc(lapakRenewalRequests.createdAt)).limit(1);
  return request ?? null;
}

export async function getLapakRenewalRequests() {
  await requireAdmin();
  return db.select({
    id: lapakRenewalRequests.id,
    warungId: lapakRenewalRequests.warungId,
    lapakCode: lapaks.code,
    warungName: warungs.name,
    requestedContractEnd: lapakRenewalRequests.requestedContractEnd,
    currentContractEnd: lapaks.contractEnd,
    message: lapakRenewalRequests.message,
    status: lapakRenewalRequests.status,
    reviewerNote: lapakRenewalRequests.reviewerNote,
    createdAt: lapakRenewalRequests.createdAt,
  }).from(lapakRenewalRequests).innerJoin(lapaks, eq(lapakRenewalRequests.lapakId, lapaks.id))
    .innerJoin(warungs, eq(lapakRenewalRequests.warungId, warungs.id))
    .orderBy(desc(lapakRenewalRequests.createdAt)).limit(100);
}

export async function reviewLapakRenewalRequest(input: { requestId: string; decision: 'APPROVED' | 'REJECTED'; note?: string }) {
  const { user } = await requireAdmin();
  const data = z.object({ requestId: z.string().uuid(), decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().trim().max(500).optional() }).parse(input);
  const updated = await db.transaction(async tx => {
    const [request] = await tx.select({
      id: lapakRenewalRequests.id,
      lapakId: lapakRenewalRequests.lapakId,
      warungId: lapakRenewalRequests.warungId,
      requestedContractEnd: lapakRenewalRequests.requestedContractEnd,
      status: lapakRenewalRequests.status,
    }).from(lapakRenewalRequests).where(eq(lapakRenewalRequests.id, data.requestId)).for('update').limit(1);
    if (!request || request.status !== 'PENDING') throw new Error('Permintaan tidak ditemukan atau sudah diproses.');

    if (data.decision === 'APPROVED') {
      const [lapak] = await tx.select({ contractStart: lapaks.contractStart, contractEnd: lapaks.contractEnd }).from(lapaks)
        .where(and(eq(lapaks.id, request.lapakId), eq(lapaks.warungId, request.warungId))).for('update').limit(1);
      if (!lapak) throw new Error('Penempatan lapak sudah berubah; permintaan tidak dapat disetujui.');
      if (lapak.contractEnd && request.requestedContractEnd <= lapak.contractEnd) throw new Error('Tanggal permintaan tidak lagi memperpanjang kontrak.');
      if (lapak.contractStart && request.requestedContractEnd < lapak.contractStart) {
        throw new Error('Tanggal akhir kontrak baru harus setelah tanggal mulai kontrak.');
      }
      await tx.update(lapaks).set({ contractEnd: request.requestedContractEnd, status: 'TERISI', updatedAt: new Date() }).where(eq(lapaks.id, request.lapakId));
    }

    const [reviewed] = await tx.update(lapakRenewalRequests).set({
      status: data.decision,
      reviewedBy: user.id,
      reviewedAt: new Date(),
      reviewerNote: data.note || null,
    }).where(eq(lapakRenewalRequests.id, request.id)).returning({ id: lapakRenewalRequests.id, warungId: lapakRenewalRequests.warungId, requestedContractEnd: lapakRenewalRequests.requestedContractEnd });
    await tx.insert(auditLogs).values({ actorId: user.id, action: 'REVIEW_LAPAK_RENEWAL', entityType: 'lapak_renewal_requests', entityId: request.id, newValue: JSON.stringify({ status: data.decision, requestedContractEnd: request.requestedContractEnd, note: data.note || null }) });
    return reviewed;
  });

  const note = data.note ? ` Catatan: ${data.note}` : '';
  await createRenewalNotifications({
    requestId: updated.id,
    warungId: updated.warungId,
    status: data.decision,
    title: data.decision === 'APPROVED' ? 'Perpanjangan sewa disetujui' : 'Permintaan perpanjangan sewa ditolak',
    body: `${data.decision === 'APPROVED' ? `Kontrak diperpanjang sampai ${updated.requestedContractEnd}.` : 'Perpanjangan belum disetujui.'}${note}`,
  });
  revalidatePath('/warung/sewa');
  revalidatePath('/sentra/tagihan');
  revalidatePath('/sentra');
  revalidatePath('/sentra/tagihan');
  revalidatePath('/warung/sewa');
  revalidatePath('/admin');
  return { success: true };
}

export async function updateFacilityTicket(input: { ticketId: string; status: TicketStatus; feedback: string }) {
  const { user } = await requireAdmin();
  const data = z.object({
    ticketId: z.string().uuid(),
    status: z.enum(['IN_PROGRESS', 'RESOLVED']),
    feedback: z.string().trim().min(3, 'Berikan catatan untuk penyewa.').max(1000),
  }).parse(input);
  const ticket = await db.transaction(async tx => {
    const [current] = await tx.select({ id: facilityTickets.id, warungId: facilityTickets.warungId, status: facilityTickets.status })
      .from(facilityTickets).where(eq(facilityTickets.id, data.ticketId)).for('update').limit(1);
    if (!current || current.status === 'RESOLVED') throw new Error('Tiket tidak ditemukan atau sudah selesai.');
    const [updated] = await tx.update(facilityTickets).set({
      status: data.status,
      feedback: data.feedback,
      resolvedBy: data.status === 'RESOLVED' ? user.id : null,
      resolvedAt: data.status === 'RESOLVED' ? new Date() : null,
    }).where(eq(facilityTickets.id, data.ticketId)).returning({ id: facilityTickets.id, warungId: facilityTickets.warungId });
    await tx.insert(auditLogs).values({ actorId: user.id, action: 'UPDATE_FACILITY_TICKET', entityType: 'facility_tickets', entityId: updated.id, oldValue: JSON.stringify({ status: current.status }), newValue: JSON.stringify({ status: data.status, feedback: data.feedback }) });
    return updated;
  });

  await createTicketNotifications({
    ticketId: ticket.id,
    warungId: ticket.warungId,
    status: data.status,
    title: data.status === 'IN_PROGRESS' ? 'Laporan kendala sedang diperbaiki' : 'Laporan kendala selesai diperbaiki',
    body: data.feedback,
  });

  revalidatePath('/dukungan');
  revalidatePath('/warung/sewa');
  return { success: true };
}

export async function getWarungFacilityTickets() {
  const { warungId } = await requireTenantAccess();
  return db.select({
    id: facilityTickets.id,
    category: facilityTickets.category,
    description: facilityTickets.description,
    photoUrl: facilityTickets.photoUrl,
    status: facilityTickets.status,
    feedback: facilityTickets.feedback,
    createdAt: facilityTickets.createdAt,
    resolvedAt: facilityTickets.resolvedAt,
  }).from(facilityTickets).where(eq(facilityTickets.warungId, warungId)).orderBy(desc(facilityTickets.createdAt)).limit(30);
}

export async function createFacilityTicket(input: {
  category: string;
  description: string;
  photoUrl?: string;
}) {
  const { warungId } = await requireTenantAccess();
  const data = z.object({
    category: z.enum(['LISTRIK', 'AIR', 'KEBERSIHAN', 'BANGUNAN']),
    description: z.string().trim().min(5).max(1000),
    photoUrl: z.string().max(200).optional(),
  }).parse(input);
  if (data.photoUrl && !new RegExp(`^${warungId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(webp|jpg|png)$`, 'i').test(data.photoUrl)) {
    throw new Error('Foto kendala tidak valid');
  }

  // Find lapak for this warung
  const [lapak] = await db
    .select({ id: lapaks.id })
    .from(lapaks)
    .where(eq(lapaks.warungId, warungId))
    .limit(1);

  if (!lapak) {
    throw new Error('Lapak untuk warung ini tidak ditemukan');
  }

  const [ticket] = await db
    .insert(facilityTickets)
    .values({
      lapakId: lapak.id,
      warungId,
      category: data.category,
      description: data.description,
      photoUrl: data.photoUrl || null,
      status: 'OPEN',
    })
    .returning();

  await createTicketNotifications({
    ticketId: ticket.id,
    warungId,
    status: 'OPEN',
    title: 'Laporan kendala baru',
    body: `${data.category} · ${data.description}`,
  });

  revalidatePath('/warung/sewa');
  revalidatePath('/dukungan');
  return { success: true, ticket };
}

