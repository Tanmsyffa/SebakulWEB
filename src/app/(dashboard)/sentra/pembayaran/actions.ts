'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, sentraPaymentSettings } from '@/db/schema';
import { requireAdmin } from '@/server/guards/auth-guard';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const paymentSettingsSchema = z.object({
  bankName: z.string().trim().max(80),
  accountName: z.string().trim().max(120),
  accountNumber: z.string().trim().max(80),
}).refine(value => {
  const values = [value.bankName, value.accountName, value.accountNumber];
  return values.every(item => !item) || values.every(Boolean);
}, { message: 'Isi seluruh informasi rekening atau kosongkan semuanya.' });

export async function saveSentraPaymentSettings(input: { bankName: string; accountName: string; accountNumber: string }) {
  const { user } = await requireAdmin();
  const data = paymentSettingsSchema.parse(input);
  await db.transaction(async (tx) => {
    const [previous] = await tx
      .select({
        bankName: sentraPaymentSettings.bankName,
        accountName: sentraPaymentSettings.accountName,
        accountNumber: sentraPaymentSettings.accountNumber,
      })
      .from(sentraPaymentSettings)
      .where(eq(sentraPaymentSettings.id, true))
      .for('update')
      .limit(1);

    await tx.insert(sentraPaymentSettings).values({ id: true, ...data, updatedBy: user.id, updatedAt: new Date() })
      .onConflictDoUpdate({ target: sentraPaymentSettings.id, set: { ...data, updatedBy: user.id, updatedAt: new Date() } });

    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: 'UPDATE_SENTRA_PAYMENT_SETTINGS',
      entityType: 'sentra_payment_settings',
      entityId: 'singleton',
      oldValue: previous ? JSON.stringify(previous) : null,
      newValue: JSON.stringify(data),
    });
  });
  revalidatePath('/sentra/pembayaran');
  revalidatePath('/warung/sewa');
  return { success: true };
}
