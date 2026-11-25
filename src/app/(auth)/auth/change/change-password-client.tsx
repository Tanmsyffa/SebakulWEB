'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { createBrowserClient } from '@/lib/supabase/client';
import { changePassword } from '@/server/actions/account.actions';
import { AuthCenteredLayout } from '../../_components/auth-shell';
import { PasswordInput } from '../../_components/password-input';

export function ChangePasswordClient({
  email,
  isForced,
}: {
  email: string;
  isForced: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<{
    current?: string;
    next?: string;
    confirm?: string;
  }>({});

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors: { current?: string; next?: string; confirm?: string } = {};

    if (!current) {
      errors.current = 'Masukkan kata sandi saat ini.';
    }
    if (next.length < 12 || next.length > 128) {
      errors.next = 'Kata sandi baru harus 12 sampai 128 karakter.';
    } else if (current && next === current) {
      errors.next = 'Kata sandi baru harus berbeda dari kata sandi saat ini.';
    }
    if (confirm !== next) {
      errors.confirm = 'Konfirmasi kata sandi tidak cocok.';
    }

    if (errors.current || errors.next || errors.confirm) {
      setFieldErrors(errors);
      setMessage('Periksa kembali isian kata sandi Anda.');
      return;
    }

    setFieldErrors({});
    setBusy(true);
    setMessage('');

    const supabase = createBrowserClient();
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      router.replace('/login');
      return;
    }

    try {
      await changePassword({ current, next });
      await supabase.auth.signOut();
      router.replace('/login?status=password_changed');
      router.refresh();
    } catch (cause) {
      setMessage(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Gagal mengubah kata sandi.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCenteredLayout>
      <div className="space-y-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-muted">Keamanan akun</p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Ubah kata sandi
          </h1>
          <p className="text-sm leading-relaxed text-text-secondary">
            {email ? `Perbarui kata sandi untuk akun ${email}.` : 'Perbarui kata sandi akun SEBAKUL Anda.'}
          </p>
        </div>

        {isForced && (
          <Alert variant="warning" title="Kata sandi sementara perlu diganti">
            Anda wajib membuat kata sandi baru minimal 12 karakter sebelum masuk ke dashboard.
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field
            label="Kata sandi saat ini"
            htmlFor="current"
            error={fieldErrors.current}
            required
          >
            {(a11y) => (
              <PasswordInput
                {...a11y}
                autoComplete="current-password"
                required
                disabled={busy}
                value={current}
                onChange={(event) => {
                  setCurrent(event.target.value);
                  if (fieldErrors.current) {
                    setFieldErrors((prev) => ({ ...prev, current: undefined }));
                  }
                }}
                placeholder="Masukkan kata sandi saat ini"
              />
            )}
          </Field>

          <Field
            label="Kata sandi baru"
            htmlFor="next"
            hint="Minimal 12 karakter, maksimal 128 karakter, dan berbeda dari kata sandi sebelumnya."
            error={fieldErrors.next}
            required
          >
            {(a11y) => (
              <PasswordInput
                {...a11y}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                disabled={busy}
                value={next}
                onChange={(event) => {
                  setNext(event.target.value);
                  if (fieldErrors.next) {
                    setFieldErrors((prev) => ({ ...prev, next: undefined }));
                  }
                }}
                placeholder="Minimal 12 karakter"
              />
            )}
          </Field>

          <Field
            label="Ulangi kata sandi baru"
            htmlFor="confirm"
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
                disabled={busy}
                value={confirm}
                onChange={(event) => {
                  setConfirm(event.target.value);
                  if (fieldErrors.confirm) {
                    setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
                  }
                }}
                placeholder="Ketik ulang kata sandi baru"
              />
            )}
          </Field>

          {message && (
            <Alert variant="danger" role="alert">
              {message}
            </Alert>
          )}

          <Button type="submit" disabled={busy} isLoading={busy} className="w-full">
            Simpan kata sandi
          </Button>
        </form>

        {!isForced && (
          <>
            <Separator />
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 -ml-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>Kembali ke dashboard</span>
            </Link>
          </>
        )}
      </div>
    </AuthCenteredLayout>
  );
}
