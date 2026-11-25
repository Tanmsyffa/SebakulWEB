'use server';

import { z } from 'zod';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { getInternalUser } from '@/server/guards/auth-guard';

export async function completeFinishPassword(input: { password: string }) {
  const data = z
    .object({
      password: z.string().min(12).max(128),
    })
    .parse(input);

  const supabase = await createServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('Tautan atau sesi aktivasi berakhir. Minta tautan baru.');
  }

  await getInternalUser(authData.user.id);

  const updated = await supabase.auth.updateUser({ password: data.password });
  if (updated.error) {
    const msg = updated.error.message.toLowerCase();
    if (msg.includes('different') || msg.includes('same')) {
      throw new Error('Kata sandi baru harus berbeda dari kata sandi sebelumnya.');
    }
    throw new Error('Kata sandi belum tersimpan. Coba kata sandi yang lebih kuat.');
  }

  const clearedTempFlag = authData.user.app_metadata?.must_change_password === true;
  if (clearedTempFlag) {
    const admin = createAdminClient();
    const result = await admin.auth.admin.updateUserById(authData.user.id, {
      app_metadata: { ...authData.user.app_metadata, must_change_password: false },
    });
    if (result.error) {
      throw new Error(
        'Kata sandi berubah, tetapi status akun belum diperbarui. Silakan masuk lalu ubah kata sandi lagi.'
      );
    }
  }

  await db.insert(auditLogs).values({
    actorId: authData.user.id,
    action: 'CHANGE_PASSWORD',
    entityType: 'users',
    entityId: authData.user.id,
    newValue: JSON.stringify({
      viaEmailFinish: true,
      mustChangePasswordCleared: clearedTempFlag,
    }),
  });

  return { success: true };
}
