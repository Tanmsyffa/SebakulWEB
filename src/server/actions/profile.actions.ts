'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireAuth } from '@/server/guards/auth-guard';

export async function updateOwnContact(input: { phoneNumber: string }) {
  const user = await requireAuth();
  const data = z.object({
    phoneNumber: z.string().trim().max(30).refine(value => {
      if (!value) return true;
      const digits = value.replace(/\D/g, '');
      return /^[+\d\s().-]+$/.test(value) && digits.length >= 9 && digits.length <= 15 && /^(?:0|62|8)/.test(digits);
    }, 'Masukkan nomor Indonesia yang valid (mis. +62…) atau kosongkan.'),
  }).parse(input);
  await db.update(users).set({ phoneNumber: data.phoneNumber || null }).where(eq(users.id, user.id));
  revalidatePath('/profil');
  revalidatePath('/sentra/tagihan');
  return { success: true };
}
