'use server';

import { and, desc, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTurnstileToken } from '@/lib/turnstile';

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(255)
  .transform((val) => val.toLowerCase());

const cooldownByEmail = new Map<string, number>();
const COOLDOWN_MS = 60_000;
const MAX_REQUESTS_PER_HOUR = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;

function cleanEnv(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/^['"]+|['"]+$/g, '').trim();
}

function resolveSafeBaseUrl(): string {
  const configured = cleanEnv(process.env.NEXT_PUBLIC_SITE_URL) || cleanEnv(process.env.NEXT_PUBLIC_APP_URL);
  const isLocalhostUrl = configured ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configured) : false;
  if (configured && !(process.env.VERCEL === '1' && isLocalhostUrl)) {
    return configured.replace(/\/+$/, '');
  }
  const prodVercel = cleanEnv(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (prodVercel) {
    return `https://${prodVercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  }
  const branchVercel = cleanEnv(process.env.VERCEL_URL);
  if (branchVercel) {
    return `https://${branchVercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  }
  return 'http://localhost:3000';
}

function buildResetEmailHtml(resetUrl: string): string {
  return [
    '<div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #181715; line-height: 1.6; background: #FFFFFF; border: 1px solid #EAE6DF; border-radius: 12px;">',
    '  <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #0F766E;">SEBAKUL</p>',
    '  <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #181715;">Atur ulang kata sandi</h1>',
    '  <p style="margin: 0 0 20px; font-size: 14px; color: #57534E;">',
    '    Kami menerima permintaan untuk mengatur ulang kata sandi akun SEBAKUL Anda. Klik tombol di bawah ini untuk membuat kata sandi baru:',
    '  </p>',
    '  <p style="margin: 0 0 20px;">',
    `    <a href="${resetUrl}" style="display: inline-block; background: #0F766E; color: #FFFFFF; text-decoration: none; padding: 11px 18px; border-radius: 8px; font-size: 14px; font-weight: 500;">Atur kata sandi baru</a>`,
    '  </p>',
    '  <p style="margin: 0; font-size: 12px; color: #716C65;">',
    '    Jika Anda tidak merasa meminta pengaturan ulang ini, abaikan email ini dan kata sandi Anda tidak akan berubah.',
    '  </p>',
    '</div>',
  ].join('\n');
}

export type RequestPasswordResetResult =
  | { status: 'sent' }
  | { status: 'fallback_supabase' }
  | { status: 'rate_limited'; message: string }
  | { status: 'error'; message: string };

export async function requestPasswordResetEmail(
  rawEmail: string,
  captchaToken?: string
): Promise<RequestPasswordResetResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { status: 'error', message: 'Masukkan alamat email yang valid.' };
  }

  const resendApiKey = cleanEnv(process.env.RESEND_API_KEY);
  if (!resendApiKey) {
    return { status: 'fallback_supabase' };
  }

  const captcha = await verifyTurnstileToken(captchaToken);
  if (!captcha.ok) {
    return {
      status: 'error',
      message: captcha.error ?? 'Verifikasi keamanan gagal atau kedaluwarsa. Silakan ulangi.',
    };
  }

  const email = parsed.data;
  const now = Date.now();
  const lastSentAt = cooldownByEmail.get(email) ?? 0;
  if (now - lastSentAt < COOLDOWN_MS) {
    return {
      status: 'rate_limited',
      message: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
    };
  }
  cooldownByEmail.set(email, now);

  // Return generic success when account is absent or inactive to prevent email enumeration
  const [account] = await db
    .select({ id: users.id, isActive: users.isActive, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!account || !account.isActive || account.email.endsWith('@deleted.sebakul.invalid')) {
    return { status: 'sent' };
  }

  // Persistent serverless rate limiting backed by Postgres audit_logs
  const oneHourAgo = new Date(now - ONE_HOUR_MS);
  const recentResets = await db
    .select({ createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, account.id),
        eq(auditLogs.action, 'REQUEST_PASSWORD_RESET'),
        gte(auditLogs.createdAt, oneHourAgo)
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(MAX_REQUESTS_PER_HOUR);

  if (recentResets.length >= MAX_REQUESTS_PER_HOUR) {
    return {
      status: 'rate_limited',
      message: 'Terlalu banyak permintaan dalam satu jam terakhir. Coba lagi nanti.',
    };
  }

  const latestReset = recentResets[0];
  if (latestReset && now - new Date(latestReset.createdAt).getTime() < COOLDOWN_MS) {
    return {
      status: 'rate_limited',
      message: 'Tautan baru saja dikirim. Tunggu 1 menit sebelum meminta ulang.',
    };
  }

  const baseUrl = resolveSafeBaseUrl();
  const supabaseAdmin = createAdminClient();
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${baseUrl}/auth/finish`,
    },
  });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    return { status: 'sent' };
  }

  const finishUrl = `${baseUrl}/auth/finish?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;
  const fromAddress = cleanEnv(process.env.RESEND_FROM_EMAIL) || 'SEBAKUL <noreply@sebakul.my.id>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [email],
      subject: 'Atur ulang kata sandi SEBAKUL',
      html: buildResetEmailHtml(finishUrl),
      text: `Atur ulang kata sandi akun SEBAKUL Anda melalui tautan berikut:\n${finishUrl}\n\nJika Anda tidak meminta pengaturan ulang ini, abaikan pesan ini.`,
    }),
  });

  if (!response.ok) {
    cooldownByEmail.delete(email);
    if (response.status === 429) {
      return {
        status: 'rate_limited',
        message: 'Batas pengiriman email tercapai. Coba lagi beberapa saat.',
      };
    }
    if (response.status === 403) {
      return {
        status: 'error',
        message:
          'Domain pengirim Resend belum diverifikasi untuk alamat tujuan tersebut. Verifikasi domain di Resend lalu atur RESEND_FROM_EMAIL, atau uji ke email pemilik akun Resend.',
      };
    }
    return {
      status: 'error',
      message: 'Gagal mengirim email pemulihan. Periksa konfigurasi RESEND_API_KEY Anda.',
    };
  }

  await db.insert(auditLogs).values({
    actorId: account.id,
    action: 'REQUEST_PASSWORD_RESET',
    entityType: 'users',
    entityId: account.id,
    newValue: JSON.stringify({ channel: 'resend' }),
  });

  return { status: 'sent' };
}
