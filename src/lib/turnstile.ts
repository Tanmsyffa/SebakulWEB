import { headers } from 'next/headers';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function cleanEnv(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/^['"]+|['"]+$/g, '').trim();
}

export function isTurnstileServerConfigured(): boolean {
  return Boolean(cleanEnv(process.env.TURNSTILE_SECRET_KEY));
}

async function getClientIp(): Promise<string | undefined> {
  try {
    const headerStore = await headers();
    const cfIp = headerStore.get('cf-connecting-ip')?.trim();
    if (cfIp) return cfIp;
    const forwarded = headerStore.get('x-forwarded-for');
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    return headerStore.get('x-real-ip')?.trim() || undefined;
  } catch {
    return undefined;
  }
}

interface TurnstileVerifyResponse {
  success?: boolean;
  'error-codes'?: string[];
}

export async function verifyTurnstileToken(
  token?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const secret = cleanEnv(process.env.TURNSTILE_SECRET_KEY);
  if (!secret) {
    return { ok: true };
  }

  const trimmedToken = (token ?? '').trim();
  if (!trimmedToken) {
    return {
      ok: false,
      error: 'Selesaikan verifikasi keamanan terlebih dahulu.',
    };
  }

  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', trimmedToken);

    const remoteIp = await getClientIp();
    if (remoteIp) {
      body.set('remoteip', remoteIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[turnstile] siteverify HTTP error:', response.status);
      return {
        ok: false,
        error: 'Layanan verifikasi keamanan sedang sibuk. Silakan coba lagi.',
      };
    }

    const outcome = (await response.json()) as TurnstileVerifyResponse;
    if (outcome.success === true) {
      return { ok: true };
    }

    console.warn('[turnstile] verification rejected:', outcome['error-codes'] ?? []);
    return {
      ok: false,
      error: 'Verifikasi keamanan gagal atau kedaluwarsa. Silakan ulangi.',
    };
  } catch (error) {
    console.error('[turnstile] siteverify request failed:', error);
    return {
      ok: false,
      error: 'Tidak dapat memverifikasi keamanan. Periksa koneksi lalu coba lagi.',
    };
  }
}
