'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { FadeIn, PageTransition } from '@/components/motion';
import { BRAND_FULL_NAME, BRAND_JARGON, BRAND_NAME } from '@/lib/brand';
import { createBrowserClient } from '@/lib/supabase/client';
import { PasswordInput } from '../_components/password-input';
import {
  isTurnstileEnabled,
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from '../_components/turnstile-widget';

const PLATFORM_SUMMARY = [
  {
    title: 'Operasional warung',
    description: 'Buku kas manual, stok bahan, pemasok, menu, dan estimasi HPP per porsi.',
  },
  {
    title: 'Pengelolaan sentra',
    description: 'Peta keterisian lapak, masa kontrak, tagihan sewa, dan verifikasi pembayaran.',
  },
  {
    title: 'Guyub & dukungan',
    description: 'Polling kegiatan warung, iuran & split bill patungan, serta tiket fasilitas.',
  },
] as const;

export function LoginForm({
  notice,
  successNotice,
  showSignOut,
  redirectTo = '/',
}: {
  notice?: string;
  successNotice?: string;
  showSignOut: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const turnstileRef = React.useRef<TurnstileWidgetHandle>(null);
  const captchaEnabled = isTurnstileEnabled();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [captchaToken, setCaptchaToken] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string; password?: string }>({});

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const nextErrors: { email?: string; password?: string } = {};

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Masukkan alamat email yang valid.';
    }
    if (!password) {
      nextErrors.password = 'Masukkan kata sandi akun Anda.';
    }

    if (nextErrors.email || nextErrors.password) {
      setFieldErrors(nextErrors);
      setError('Periksa kembali email dan kata sandi Anda.');
      return;
    }

    if (captchaEnabled && !captchaToken) {
      setFieldErrors({});
      setError('Selesaikan verifikasi keamanan terlebih dahulu.');
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setError('');
    try {
      const supabase = createBrowserClient();
      const result = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      if (result.error) {
        const isCaptchaError = /captcha/i.test(result.error.message);
        setError(
          isCaptchaError
            ? 'Verifikasi keamanan gagal atau kedaluwarsa. Silakan ulangi.'
            : 'Email atau kata sandi salah. Periksa kembali atau hubungi Super Admin.'
        );
        turnstileRef.current?.reset();
        setCaptchaToken('');
        return;
      }
      router.replace(redirectTo || '/');
      router.refresh();
    } catch {
      setError('Tidak dapat terhubung. Coba lagi beberapa saat.');
      turnstileRef.current?.reset();
      setCaptchaToken('');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    setError('');
    try {
      const { error: signOutError } = await createBrowserClient().auth.signOut({
        scope: 'local',
      });
      if (signOutError) {
        setError('Gagal keluar dari sesi saat ini. Coba lagi.');
        return;
      }
      router.replace('/login');
      router.refresh();
    } catch {
      setError('Gagal keluar dari sesi saat ini. Periksa koneksi lalu coba lagi.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-canvas px-4 py-6 text-text-primary focus:outline-none sm:px-6 sm:py-10 lg:flex lg:items-center lg:justify-center lg:px-8"
    >
      <PageTransition className="mx-auto w-full max-w-5xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch lg:gap-10">
          <div className="order-1 flex flex-col justify-center lg:order-2 lg:col-span-5">
            <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
              <Link
                href="/"
                className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <BrandLogo size="sm" priority />
                <span className="leading-tight">
                  <span className="block text-sm font-semibold tracking-tight text-text-primary">
                    {BRAND_NAME}
                  </span>
                  <span className="block text-xs text-text-muted">
                    {BRAND_FULL_NAME}
                  </span>
                </span>
              </Link>
              <Link
                href="/"
                className="text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                Beranda
              </Link>
            </div>

            <Card>
              <CardContent className="space-y-5 p-5 sm:p-7">
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
                    Masuk ke SEBAKUL
                  </h1>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    Gunakan email dan kata sandi yang didaftarkan oleh Super Admin sentra.
                  </p>
                </div>

                {successNotice && (
                  <Alert variant="success" role="status" aria-live="polite" title="Kata sandi diperbarui">
                    {successNotice}
                  </Alert>
                )}

                {notice && (
                  <Alert variant="warning" role="status" aria-live="polite" title="Informasi akses">
                    {notice}
                  </Alert>
                )}

                {showSignOut && (
                  <Alert
                    variant="neutral"
                    title="Sesi login belum dapat membuka dashboard"
                    action={
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={signingOut}
                        isLoading={signingOut}
                        onClick={() => void handleSignOut()}
                        className="w-full sm:w-auto"
                      >
                        <LogOut aria-hidden="true" className="h-4 w-4" />
                        <span>Keluar</span>
                      </Button>
                    }
                  >
                    Keluar terlebih dahulu untuk masuk dengan akun lain.
                  </Alert>
                )}

                <form onSubmit={handleLogin} noValidate className="space-y-4">
                  <Field
                    label="Email"
                    htmlFor="login-email"
                    error={fieldErrors.email}
                    required
                  >
                    {(a11y) => (
                      <Input
                        {...a11y}
                        type="email"
                        autoComplete="username"
                        inputMode="email"
                        required
                        disabled={loading}
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          if (fieldErrors.email) {
                            setFieldErrors((prev) => ({ ...prev, email: undefined }));
                          }
                        }}
                        placeholder="nama@domain.com"
                      />
                    )}
                  </Field>

                  <Field
                    label="Kata sandi"
                    htmlFor="login-password"
                    error={fieldErrors.password}
                    required
                  >
                    {(a11y) => (
                      <PasswordInput
                        {...a11y}
                        autoComplete="current-password"
                        required
                        disabled={loading}
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          if (fieldErrors.password) {
                            setFieldErrors((prev) => ({ ...prev, password: undefined }));
                          }
                        }}
                        placeholder="Masukkan kata sandi"
                      />
                    )}
                  </Field>

                  {captchaEnabled && (
                    <TurnstileWidget
                      ref={turnstileRef}
                      onSuccess={(token) => {
                        setCaptchaToken(token);
                        setError((prev) =>
                          /verifikasi keamanan/i.test(prev) ? '' : prev
                        );
                      }}
                      onExpire={() => setCaptchaToken('')}
                      onError={() => setCaptchaToken('')}
                    />
                  )}

                  {error && (
                    <Alert variant="danger" role="alert">
                      {error}
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    isLoading={loading}
                    className="w-full"
                  >
                    Masuk
                  </Button>
                </form>

                <Separator />

                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    href="/auth/reset"
                    className="inline-flex min-h-9 items-center text-sm font-medium text-brand-primary transition-colors hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
                  >
                    Lupa kata sandi?
                  </Link>
                  <p className="text-xs text-text-muted">
                    Akses baru dikelola oleh Super Admin.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <FadeIn
            as="section"
            delay={0.04}
            aria-label="Tentang platform SEBAKUL"
            className="order-2 flex flex-col justify-between space-y-6 lg:order-1 lg:col-span-7 lg:py-2"
          >
            <div className="space-y-5">
              <div className="hidden items-center justify-between gap-3 lg:flex">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <BrandLogo size="sm" priority />
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold tracking-tight text-text-primary">
                      {BRAND_NAME}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {BRAND_FULL_NAME}
                    </span>
                  </span>
                </Link>
                <Link
                  href="/"
                  className="text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  Halaman depan
                </Link>
              </div>

              <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
                <div className="relative aspect-[16/10] w-full bg-surface-muted">
                  <Image
                    src="/images/gallery-kanopi.jpg?v=2"
                    alt="Kanopi sentra kuliner SEBAKUL Bintaro dengan slogan Gué Katé Jugé Apé Di Sini Ajé pada malam hari"
                    fill
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    className="object-cover"
                  />
                </div>
                <div className="border-t border-border-subtle px-4 py-2.5 text-xs italic text-text-secondary">
                  &ldquo;{BRAND_JARGON}&rdquo;
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-border-subtle pt-5 sm:grid-cols-3">
                {PLATFORM_SUMMARY.map((item) => (
                  <div key={item.title} className="space-y-1">
                    <h2 className="text-sm font-semibold text-text-primary">{item.title}</h2>
                    <p className="text-xs leading-relaxed text-text-secondary">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-text-muted">
              Akses tertutup berbasis peran · Pencatatan Rupiah berzona waktu WIB (Asia/Jakarta)
            </p>
          </FadeIn>
        </div>
      </PageTransition>
    </main>
  );
}
