'use server';

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getInternalUser } from '@/server/guards/auth-guard';

export async function changePassword(input: {
  current: string;
  next: string;
  captchaToken?: string;
}) {
  const data = z.object({
    current: z.string().min(1).max(128),
    next: z.string().min(12).max(128),
    captchaToken: z.string().trim().min(1).max(4096).optional(),
  }).parse(input);
  const supabase = await createServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Sesi berakhir. Masuk kembali.');
  await getInternalUser(authData.user.id);
  if (data.current === data.next) throw new Error('Kata sandi baru harus berbeda.');

  if (authData.user.email) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error('Konfigurasi autentikasi belum lengkap.');
    const verifier = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const verified = await verifier.auth.signInWithPassword({
      email: authData.user.email,
      password: data.current,
      ...(data.captchaToken ? { options: { captchaToken: data.captchaToken } } : {}),
    });
    if (verified.error || verified.data.user?.id !== authData.user.id) {
      if (verified.error && /captcha/i.test(verified.error.message)) {
        throw new Error('Verifikasi keamanan gagal atau kedaluwarsa. Silakan ulangi.');
      }
      throw new Error('Kata sandi lama salah atau kata sandi baru belum memenuhi syarat.');
    }
  }

  const updated = await supabase.auth.updateUser({ password: data.next, current_password: data.current });
  if (updated.error) throw new Error('Kata sandi lama salah atau kata sandi baru belum memenuhi syarat.');

  const clearedTempFlag = authData.user.app_metadata?.must_change_password === true;
  if (clearedTempFlag) {
    const admin = createAdminClient();
    const result = await admin.auth.admin.updateUserById(authData.user.id, {
      app_metadata: { ...authData.user.app_metadata, must_change_password: false },
    });
    if (result.error) throw new Error('Kata sandi berubah, tetapi status akun belum diperbarui. Coba ubah lagi sebelum masuk ke dashboard.');
  }

  await db.insert(auditLogs).values({
    actorId: authData.user.id,
    action: 'CHANGE_PASSWORD',
    entityType: 'users',
    entityId: authData.user.id,
    newValue: JSON.stringify({ mustChangePasswordCleared: clearedTempFlag }),
  });

  return { success: true };
}
