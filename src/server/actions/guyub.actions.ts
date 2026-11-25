'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  guyubEvents,
  guyubPolls,
  guyubPollOptions,
  guyubPollVotes,
  guyubParticipants,
  guyubExpenses,
  guyubSavingsPayments,
  warungs,
  auditLogs,
} from '@/db/schema';
import { AuthError, getUserRoles, requireAuth, requireTenantAccess, requireAdmin } from '@/server/guards/auth-guard';
import { calculateProportionalSplit } from '@/lib/utils/split-bill';
import { z } from 'zod';

// ─── 1. EVENTS ──────────────────────────────────────────────

export async function createEvent(input: {
  title: string;
  destination: string;
  eventDate?: string | null;
  targetBudget: number;
  perWarungFee: number;
}) {
  const { user } = await requireAdmin();
  const data = z.object({
    title: z.string().trim().min(2).max(120),
    destination: z.string().trim().min(2).max(120),
    eventDate: z.string().date().nullish(),
    targetBudget: z.number().int().min(0).max(999_999_999),
    perWarungFee: z.number().int().min(0).max(999_999_999),
  }).parse(input);

  const event = await db.transaction(async tx => {
    const [created] = await tx.insert(guyubEvents).values({ ...data, adultFee: 0, childFee: 0, eventDate: data.eventDate || null, isActive: true }).returning();
    await tx.insert(auditLogs).values({ actorId: user.id, action: 'CREATE_EVENT', entityType: 'guyub_events', entityId: created.id, newValue: JSON.stringify(created) });
    return created;
  });

  revalidatePath('/guyub');
  return { success: true, event };
}

export async function getActiveEvents() {
  const authUser = await requireAuth();
  const [roles, events] = await Promise.all([
    getUserRoles(authUser.id),
    db.select().from(guyubEvents).where(eq(guyubEvents.isActive, true)).orderBy(desc(guyubEvents.createdAt)),
  ]);
  if (!roles.length) throw new AuthError('Peran akun tidak ditemukan.', 403);
  if (events.length === 0) return [];
  const tenantWarungId = roles.find(role => role.role === 'TENANT_MEMBER')?.warungId;
  const eventIds = events.map(event => event.id);
  const [savings, polls] = await Promise.all([
    db.select({ eventId: guyubParticipants.eventId, totalCollected: sql<number>`COALESCE(SUM(${guyubParticipants.paidAmount}), 0)` })
      .from(guyubParticipants).where(inArray(guyubParticipants.eventId, eventIds)).groupBy(guyubParticipants.eventId),
    db.select().from(guyubPolls).where(inArray(guyubPolls.eventId, eventIds)).orderBy(desc(guyubPolls.createdAt)),
  ]);
  const latestPollByEvent = new Map<string, (typeof polls)[number]>();
  for (const poll of polls) if (!latestPollByEvent.has(poll.eventId)) latestPollByEvent.set(poll.eventId, poll);
  const pollIds = [...latestPollByEvent.values()].map(poll => poll.id);
  const [options, votes] = pollIds.length ? await Promise.all([
    db.select({ id: guyubPollOptions.id, pollId: guyubPollOptions.pollId, optionText: guyubPollOptions.optionText })
      .from(guyubPollOptions).where(inArray(guyubPollOptions.pollId, pollIds)),
    db.select({ pollId: guyubPollVotes.pollId, optionId: guyubPollVotes.optionId, warungId: guyubPollVotes.warungId })
      .from(guyubPollVotes).where(inArray(guyubPollVotes.pollId, pollIds)),
  ]) : [[], []];
  const savingsByEvent = new Map(savings.map(item => [item.eventId, Number(item.totalCollected)]));
  return events.map(event => {
    const totalCollected = savingsByEvent.get(event.id) ?? 0;
    const poll = latestPollByEvent.get(event.id);
    const pollVotes = poll ? votes.filter(vote => vote.pollId === poll.id) : [];
    const totalVotes = pollVotes.length;
    return {
      ...event,
      totalCollected,
      progressPercent: event.targetBudget > 0 ? Math.min(100, Math.round(totalCollected / event.targetBudget * 100)) : 0,
      poll: poll ? {
        ...poll,
        canVote: Boolean(tenantWarungId) && poll.status === 'OPEN',
        selectedOptionId: pollVotes.find(vote => vote.warungId === tenantWarungId)?.optionId ?? null,
        options: options.filter(option => option.pollId === poll.id).map(option => {
          const count = pollVotes.filter(vote => vote.optionId === option.id).length;
          return { id: option.id, optionText: option.optionText, votes: count, percent: totalVotes ? Math.round(count / totalVotes * 100) : 0 };
        }),
        totalVotes,
      } : null,
    };
  });
}

// ─── 2. POLLING ─────────────────────────────────────────────

export async function createPoll(input: {
  eventId: string;
  question: string;
  options: string[];
}) {
  const { user } = await requireAdmin();
  const data = z.object({
    eventId: z.string().uuid(),
    question: z.string().trim().min(3).max(300),
    options: z.array(z.string().trim().min(1).max(120)).min(2).max(10),
  }).parse(input);
  const [event] = await db.select({ isActive: guyubEvents.isActive }).from(guyubEvents).where(eq(guyubEvents.id, data.eventId)).limit(1);
  if (!event?.isActive) throw new Error('Acara tidak aktif');

  return await db.transaction(async (tx) => {
    const [poll] = await tx
      .insert(guyubPolls)
      .values({
        eventId: data.eventId,
        question: data.question,
        status: 'OPEN',
        createdBy: user.id,
      })
      .returning();

    for (const optText of data.options) {
      if (optText.trim()) {
        await tx.insert(guyubPollOptions).values({
          pollId: poll.id,
          optionText: optText.trim(),
        });
      }
    }

    await tx.insert(auditLogs).values({ actorId: user.id, action: 'CREATE_POLL', entityType: 'guyub_polls', entityId: poll.id, newValue: JSON.stringify({ question: data.question, options: data.options }) });

    revalidatePath('/guyub');
    return { success: true, poll };
  });
}

export async function castVote(pollId: string, optionId: string) {
  const { warungId } = await requireTenantAccess();
  const parsed = z.object({
    pollId: z.string().uuid(),
    optionId: z.string().uuid(),
  }).parse({ pollId, optionId });

  const vote = await db.transaction(async (tx) => {
    const [poll] = await tx
      .select({ status: guyubPolls.status, eventId: guyubPolls.eventId })
      .from(guyubPolls)
      .where(eq(guyubPolls.id, parsed.pollId))
      .for('update')
      .limit(1);

    if (!poll || poll.status === 'CLOSED') {
      throw new Error('Polling sudah ditutup');
    }
    const [event] = await tx.select({ isActive: guyubEvents.isActive }).from(guyubEvents)
      .where(eq(guyubEvents.id, poll.eventId)).limit(1);
    if (!event?.isActive) {
      throw new Error('Acara tidak aktif');
    }
    const [option] = await tx.select({ id: guyubPollOptions.id }).from(guyubPollOptions)
      .where(and(eq(guyubPollOptions.id, parsed.optionId), eq(guyubPollOptions.pollId, parsed.pollId))).limit(1);
    if (!option) throw new Error('Pilihan polling tidak valid');

    // Insert vote (enforced 1 vote per warung per poll by unique index)
    const [inserted] = await tx
      .insert(guyubPollVotes)
      .values({
        pollId: parsed.pollId,
        optionId: parsed.optionId,
        warungId,
      })
      .onConflictDoNothing({
        target: [guyubPollVotes.pollId, guyubPollVotes.warungId],
      }).returning({ id: guyubPollVotes.id });

    return inserted;
  });

  revalidatePath('/guyub');
  return { success: Boolean(vote) };
}

export async function closePoll(pollId: string) {
  const { user } = await requireAdmin();
  const id = z.string().uuid().parse(pollId);

  await db.transaction(async (tx) => {
    const [closed] = await tx
      .update(guyubPolls)
      .set({
        status: 'CLOSED',
        closedAt: new Date(),
      })
      .where(and(eq(guyubPolls.id, id), eq(guyubPolls.status, 'OPEN')))
      .returning({ id: guyubPolls.id });

    if (!closed) {
      throw new Error('Polling tidak ditemukan atau sudah ditutup');
    }

    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: 'CLOSE_POLL',
      entityType: 'guyub_polls',
      entityId: id,
      newValue: JSON.stringify({ status: 'CLOSED' }),
    });
  });

  revalidatePath('/guyub');
  return { success: true };
}

// ─── 3. PENDAFTARAN & EXPENSES ──────────────────────────────

export async function registerParticipant(input: {
  eventId: string;
  adultCount: number;
  childCount: number;
}) {
  const { warungId } = await requireTenantAccess();
  const data = z.object({
    eventId: z.string().uuid(),
    adultCount: z.number().int().min(0).max(1000),
    childCount: z.number().int().min(0).max(1000),
  }).refine((value) => value.adultCount + value.childCount > 0, {
    message: 'Jumlah peserta tidak valid',
  }).parse(input);

  const [event] = await db
    .select()
    .from(guyubEvents)
    .where(eq(guyubEvents.id, data.eventId))
    .limit(1);

  if (!event) throw new Error('Acara tidak ditemukan');

  if (!event.isActive) throw new Error('Acara sudah ditutup');
  const adultCount = data.adultCount;
  const childCount = data.childCount;
  const totalFee = event.perWarungFee ?? (adultCount * event.adultFee + childCount * event.childFee);
  if (!Number.isSafeInteger(totalFee) || totalFee < 0 || totalFee > 999_999_999) throw new Error('Total iuran tidak valid');

  const [registration] = await db
    .insert(guyubParticipants)
    .values({
      eventId: data.eventId,
      warungId,
      adultCount,
      childCount,
      totalFee,
      paidAmount: 0,
    })
    .onConflictDoUpdate({
      target: [guyubParticipants.eventId, guyubParticipants.warungId],
      setWhere: sql`${guyubParticipants.paidAmount} <= ${totalFee}`,
      set: {
        adultCount,
        childCount,
        totalFee,
      },
    }).returning({ id: guyubParticipants.id });
  if (!registration) throw new Error('Iuran baru lebih kecil dari pembayaran yang sudah dicatat');

  revalidatePath('/guyub');
  revalidatePath(`/guyub/${data.eventId}`);
  return { success: true };
}

export async function recordSavingsPayment(input: { eventId: string; warungId: string; amount: number; idempotencyKey: string }) {
  const { user } = await requireAdmin();
  const data = z.object({ eventId: z.string().uuid(), warungId: z.string().uuid(), amount: z.number().int().positive().max(999_999_999), idempotencyKey: z.string().uuid() }).parse(input);
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM guyub_participants WHERE event_id = ${data.eventId} AND warung_id = ${data.warungId} FOR UPDATE`);
    const [existing] = await tx.select({ id: guyubSavingsPayments.id, participantId: guyubSavingsPayments.participantId, amount: guyubSavingsPayments.amount }).from(guyubSavingsPayments)
      .where(eq(guyubSavingsPayments.idempotencyKey, data.idempotencyKey)).limit(1);
    if (existing) {
      const [sameParticipant] = await tx.select({ id: guyubParticipants.id }).from(guyubParticipants)
        .where(and(eq(guyubParticipants.id, existing.participantId), eq(guyubParticipants.eventId, data.eventId), eq(guyubParticipants.warungId, data.warungId))).limit(1);
      if (!sameParticipant || existing.amount !== data.amount) throw new Error('Kunci transaksi sudah digunakan untuk pembayaran lain');
      return;
    }
    const [participant] = await tx.update(guyubParticipants)
      .set({ paidAmount: sql`${guyubParticipants.paidAmount} + ${data.amount}` })
      .where(and(eq(guyubParticipants.eventId, data.eventId), eq(guyubParticipants.warungId, data.warungId), sql`${guyubParticipants.paidAmount} + ${data.amount} <= ${guyubParticipants.totalFee}`))
      .returning({ id: guyubParticipants.id });
    if (!participant) throw new Error('Peserta tidak ditemukan atau pembayaran melebihi iuran');
    await tx.insert(guyubSavingsPayments).values({ idempotencyKey: data.idempotencyKey, participantId: participant.id, amount: data.amount, recordedBy: user.id });
    await tx.insert(auditLogs).values({ actorId: user.id, action: 'RECORD_GUYUB_SAVINGS', entityType: 'guyub_participants', entityId: participant.id, newValue: JSON.stringify({ amount: data.amount }) });
  });
  revalidatePath('/guyub');
  revalidatePath(`/guyub/${data.eventId}`);
  return { success: true };
}

export async function recordGuyubExpense(input: {
  idempotencyKey: string;
  eventId: string;
  description: string;
  amount: number;
}) {
  const { warungId } = await requireTenantAccess();
  const data = z.object({
    idempotencyKey: z.string().uuid(),
    eventId: z.string().uuid(),
    description: z.string().trim().min(1, 'Data pengeluaran tidak valid').max(255),
    amount: z.number().int().positive('Data pengeluaran tidak valid').max(999_999_999),
  }).parse(input);

  const [event] = await db.select({ isActive: guyubEvents.isActive }).from(guyubEvents)
    .where(eq(guyubEvents.id, data.eventId)).limit(1);
  if (!event?.isActive) throw new Error('Acara tidak aktif');
  const [participant] = await db.select({ id: guyubParticipants.id }).from(guyubParticipants)
    .where(and(eq(guyubParticipants.eventId, data.eventId), eq(guyubParticipants.warungId, warungId))).limit(1);
  if (!participant) throw new Error('Daftarkan warung sebagai peserta sebelum mencatat pengeluaran');

  const [expense] = await db
    .insert(guyubExpenses)
    .values({
      idempotencyKey: data.idempotencyKey,
      eventId: data.eventId,
      paidByWarungId: warungId,
      description: data.description,
      amount: data.amount,
    })
    .onConflictDoNothing({ target: guyubExpenses.idempotencyKey })
    .returning();

  if (!expense) {
    const [existing] = await db.select({
      eventId: guyubExpenses.eventId,
      paidByWarungId: guyubExpenses.paidByWarungId,
      amount: guyubExpenses.amount,
    }).from(guyubExpenses).where(eq(guyubExpenses.idempotencyKey, data.idempotencyKey)).limit(1);
    if (!existing || existing.eventId !== data.eventId || existing.paidByWarungId !== warungId || existing.amount !== data.amount) {
      throw new Error('Kunci transaksi sudah digunakan untuk pengeluaran lain');
    }
  }

  revalidatePath('/guyub');
  revalidatePath(`/guyub/${data.eventId}`);
  return { success: true, expense };
}

// ─── 4. DETAIL ACARA & SPLIT-BILL PROPORSIONAL ──────────────

export async function getEventDetail(eventId: string) {
  const authUser = await requireAuth();
  const roles = await getUserRoles(authUser.id);
  if (!roles.length) throw new AuthError('Peran akun tidak ditemukan.', 403);
  const parsedEventId = z.string().uuid().safeParse(eventId);
  if (!parsedEventId.success) return null;

  const [event] = await db
    .select()
    .from(guyubEvents)
    .where(eq(guyubEvents.id, parsedEventId.data))
    .limit(1);

  if (!event) return null;

  // Participants
  const participantsQuery = db
    .select({
      id: guyubParticipants.id,
      warungId: guyubParticipants.warungId,
      warungName: warungs.name,
      adultCount: guyubParticipants.adultCount,
      childCount: guyubParticipants.childCount,
      totalFee: guyubParticipants.totalFee,
      paidAmount: guyubParticipants.paidAmount,
    })
    .from(guyubParticipants)
    .innerJoin(warungs, eq(guyubParticipants.warungId, warungs.id))
    .where(eq(guyubParticipants.eventId, parsedEventId.data));

  // Expenses
  const expensesQuery = db
    .select({
      id: guyubExpenses.id,
      paidByWarungId: guyubExpenses.paidByWarungId,
      warungName: warungs.name,
      description: guyubExpenses.description,
      amount: guyubExpenses.amount,
      createdAt: guyubExpenses.createdAt,
    })
    .from(guyubExpenses)
    .innerJoin(warungs, eq(guyubExpenses.paidByWarungId, warungs.id))
    .where(eq(guyubExpenses.eventId, parsedEventId.data))
    .orderBy(desc(guyubExpenses.createdAt));

  const [participants, expenses] = await Promise.all([participantsQuery, expensesQuery]);

  // Total expenses per warung
  const expenseMap = new Map<string, number>();
  for (const exp of expenses) {
    const cur = expenseMap.get(exp.paidByWarungId) || 0;
    expenseMap.set(exp.paidByWarungId, cur + exp.amount);
  }

  // Calculate proportional split bill
  const participantDataForSplit = participants.map((p) => ({
    warungId: p.warungId,
    warungName: p.warungName,
    totalFee: p.totalFee,
    totalExpensePaid: expenseMap.get(p.warungId) || 0,
    adultCount: p.adultCount,
    childCount: p.childCount,
  }));

  const splitResult = calculateProportionalSplit(participantDataForSplit, event.perWarungFee !== null);

  return {
    event,
    participants,
    expenses,
    splitResult,
  };
}
