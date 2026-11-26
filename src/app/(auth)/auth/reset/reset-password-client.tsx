'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { createBrowserClient } from '@/lib/supabase/client';
import { requestPasswordResetEmail } from './actions';
import { AuthCenteredLayout } from '../../_components/auth-shell';
import {
  isTurnstileEnabled,
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from '../../_components/turnstile-widget';

export function ResetPasswordClient() {
  const turnstileRef = React.useRef<TurnstileWidgetHandle>(null);
  const captchaEnabled = isTurnstileEnabled();
  const [email, setEmail] = React.useState('');
  const [captchaToken, setCaptchaToken] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [emailError, setEmailError] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [message, setMessage] = React.useState('');

  async function requestReset(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Masukkan alamat email yang valid.');
      setErrorMessage('');
      setMessage('');
      return;
    }

    if (captchaEnabled && !captchaToken) {
      setEmailError('');
      setErrorMessage('Selesaikan verifikasi keamanan terlebih dahulu.');
      setMessage('');
      return;
    }

    setEmailError('');
    setErrorMessage('');
    setMessage('');
    setBusy(true);

    try {
      const result = await requestPasswordResetEmail(trimmed, captchaToken || undefined);
      if (result.status === 'fallback_supabase') {
        const supabase = createBrowserClient();
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: `${window.location.origin}/auth/finish`,
          ...(captchaToken ? { captchaToken } : {}),
        });
        if (error) {
          if (error.status === 429) {
            setErrorMessage('Terlalu banyak permintaan. Tunggu beberapa saat lalu coba lagi.');
            return;
          }
          if (/captcha/i.test(error.message)) {
            setErrorMessage('Verifikasi keamanan gagal atau kedaluwarsa. Silakan ulangi.');
            return;
          }
        }
        setMessage('Jika email terdaftar, tautan pengaturan kata sandi telah dikirim.');
        return;
      }

      if (result.status === 'rate_limited' || result.status === 'error') {
        setErrorMessage(result.message);
        return;
      }

      setMessage('Jika email terdaftar, tautan pengaturan kata sandi telah dikirim.');
    } catch {
      setErrorMessage('Tidak dapat terhubung ke layanan autentikasi. Periksa koneksi Anda.');
    } finally {
      turnstileRef.current?.reset();
      setCaptchaToken('');
      setBusy(false);
    }
  }

  return (
    <AuthCenteredLayout>
      <div className="space-y-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-muted">Pemulihan akses</p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Atur ulang kata sandi
          </h1>
          <p className="text-sm leading-relaxed text-text-secondary">
            Masukkan email akun SEBAKUL Anda untuk menerima tautan pengaturan kata sandi baru.
          </p>
        </div>

        <form onSubmit={requestReset} noValidate className="space-y-4">
          <Field
            label="Email"
            htmlFor="reset-email"
            hint="Periksa juga folder spam apabila email tidak muncul di kotak masuk."
            error={emailError}
            required
          >
            {(a11y) => (
              <Input
                {...a11y}
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                disabled={busy}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailError) setEmailError('');
                }}
                placeholder="nama@domain.com"
              />
            )}
          </Field>

          {captchaEnabled && (
            <TurnstileWidget
              ref={turnstileRef}
              onSuccess={(token) => {
                setCaptchaToken(token);
                setErrorMessage((prev) =>
                  /verifikasi keamanan/i.test(prev) ? '' : prev
                );
              }}
              onExpire={() => setCaptchaToken('')}
              onError={() => setCaptchaToken('')}
            />
          )}

          {errorMessage && (
            <Alert variant="danger" role="alert">
              {errorMessage}
            </Alert>
          )}

          {message && (
            <Alert variant="success" role="status" aria-live="polite" title="Permintaan diproses">
              {message}
            </Alert>
          )}

          <Button type="submit" disabled={busy} isLoading={busy} className="w-full">
            Kirim tautan
          </Button>
        </form>

        <Separator />

        <Link
          href="/login"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 -ml-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>Kembali ke halaman masuk</span>
        </Link>
      </div>
    </AuthCenteredLayout>
  );
}
