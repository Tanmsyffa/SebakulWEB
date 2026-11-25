'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { createBrowserClient } from '@/lib/supabase/client';
import { completeFinishPassword } from './actions';
import { AuthCenteredLayout } from '../../_components/auth-shell';
import { PasswordInput } from '../../_components/password-input';

export function FinishAccountClient() {
  const router = useRouter();
  const [verifying, setVerifying] = React.useState(true);
  const [ready, setReady] = React.useState(false);
  const [linkProblem, setLinkProblem] = React.useState<'missing' | 'invalid' | null>(null);
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<{
    password?: string;
    confirm?: string;
  }>({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const search = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const code = search.get('code');
    const linkError = search.get('error') || fragment.get('error');
    const emailLink =
      Boolean(code) ||
      (fragment.has('access_token') &&
        ['invite', 'recovery'].includes(fragment.get('type') ?? ''));

    if (linkError) {
      setLinkProblem('invalid');
      setMessage('Tautan aktivasi atau pemulihan tidak valid atau kedaluwarsa. Minta tautan baru atau hubungi Super Admin.');
      setVerifying(false);
      return;
    }

    if (!emailLink) {
      setLinkProblem('missing');
      setMessage('Buka tautan aktivasi atau pemulihan dari email Anda.');
      setVerifying(false);
      return;
    }

    const supabase = createBrowserClient();
    async function initialize() {
      try {
        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);
          if (result.error) {
            if (active) {
              setLinkProblem('invalid');
              setMessage('Tautan aktivasi tidak valid atau kedaluwarsa. Hubungi Super Admin.');
            }
            return;
          }
        }
        const result = await supabase.auth.getUser();
        if (active) {
          const hasUser = Boolean(result.data.user);
          setReady(hasUser);
          if (!hasUser) {
            setLinkProblem('invalid');
            setMessage('Tautan aktivasi tidak valid atau kedaluwarsa. Hubungi Super Admin.');
          }
        }
      } catch {
        if (active) {
          setLinkProblem('invalid');
          setMessage('Tidak dapat memverifikasi tautan saat ini. Coba muat ulang halaman.');
        }
      } finally {
        if (active) setVerifying(false);
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    const errors: { password?: string; confirm?: string } = {};

    if (password.length < 12 || password.length > 128) {
      errors.password = 'Gunakan paling sedikit 12 karakter (maksimal 128 karakter).';
    }
    if (password !== confirm) {
      errors.confirm = 'Konfirmasi kata sandi tidak cocok.';
    }

    if (errors.password || errors.confirm) {
      setFieldErrors(errors);
      setMessage(errors.password || errors.confirm || 'Periksa kembali isian Anda.');
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setMessage('');

    try {
      await completeFinishPassword({ password });
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      router.replace('/login?status=password_reset');
      router.refresh();
    } catch (cause) {
      setMessage(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Terjadi kendala koneksi. Coba lagi beberapa saat.'
      );
      setLoading(false);
    }
  }

  return (
    <AuthCenteredLayout>
      <div className="space-y-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-muted">Aktivasi & pemulihan</p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Atur kata sandi
          </h1>
          <p className="text-sm leading-relaxed text-text-secondary">
            Selesaikan aktivasi atau pemulihan akun SEBAKUL. Setelah tersimpan, masuk menggunakan email dan kata sandi baru.
          </p>
        </div>

        {verifying && (
          <div
            role="status"
            aria-busy="true"
            className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-muted p-4 text-sm text-text-secondary"
          >
            <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-brand-primary motion-reduce:animate-none" />
            <span>Memverifikasi tautan email Anda...</span>
          </div>
        )}

        {!verifying && message && !ready && (
          <Alert
            variant={linkProblem === 'missing' ? 'info' : 'danger'}
            title={linkProblem === 'missing' ? 'Tautan email diperlukan' : 'Tautan tidak dapat digunakan'}
          >
            {message}
          </Alert>
        )}

        {!verifying && ready && (
          <form onSubmit={savePassword} noValidate className="space-y-4">
            <Field
              label="Kata sandi baru"
              htmlFor="new-password"
              hint="Minimal 12 karakter dan maksimal 128 karakter."
              error={fieldErrors.password}
              required
            >
              {(a11y) => (
                <PasswordInput
                  {...a11y}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="Minimal 12 karakter"
                />
              )}
            </Field>

            <Field
              label="Ulangi kata sandi"
              htmlFor="confirm-password"
              error={fieldErrors.confirm}
              required
            >
              {(a11y) => (
                <PasswordInput
                  {...a11y}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  disabled={loading}
                  value={confirm}
                  onChange={(event) => {
                    setConfirm(event.target.value);
                    if (fieldErrors.confirm) {
                      setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
                    }
                  }}
                  placeholder="Ketik ulang kata sandi"
                />
              )}
            </Field>

            {message && (
              <Alert variant="danger" role="alert">
                {message}
              </Alert>
            )}

            <Button type="submit" disabled={loading} isLoading={loading} className="w-full">
              Simpan kata sandi
            </Button>
          </form>
        )}

        {!verifying && !ready && (
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/auth/reset"
              className={buttonVariants({ variant: 'default', className: 'w-full sm:flex-1' })}
            >
              Minta tautan baru
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: 'secondary', className: 'w-full sm:flex-1' })}
            >
              Ke halaman masuk
            </Link>
          </div>
        )}

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
