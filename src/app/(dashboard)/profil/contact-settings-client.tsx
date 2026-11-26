'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  KeyRound,
  LifeBuoy,
  Mail,
  Phone,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { PageHeader, Section } from '@/components/layout';
import { FadeIn, PageTransition } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { formatActionError } from '@/lib/utils';
import { formatDateOnlyWIB } from '@/lib/utils/date';
import { updateOwnContact } from '@/server/actions/profile.actions';
import type { UserRoleType } from '@/types';

interface ProfileRoleItem {
  id: string;
  role: UserRoleType;
  warungName: string | null;
}

const ROLE_META: Record<
  UserRoleType,
  { label: string; variant: 'brand' | 'info' | 'neutral'; icon: typeof ShieldCheck }
> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    variant: 'brand',
    icon: ShieldCheck,
  },
  PENGELOLA_ADMIN: {
    label: 'Pengelola Sentra',
    variant: 'info',
    icon: Building2,
  },
  TENANT_MEMBER: {
    label: 'Pemilik Warung',
    variant: 'neutral',
    icon: Store,
  },
};

function validateIndonesianPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  const valid =
    /^[+\d\s().-]+$/.test(trimmed) &&
    digits.length >= 9 &&
    digits.length <= 15 &&
    /^(?:0|62|8)/.test(digits);
  if (!valid) {
    return 'Masukkan nomor Indonesia yang valid (misalnya +6281234567890 atau 081234567890) atau kosongkan.';
  }
  return null;
}

function formatReadableError(error: unknown, fallback: string): string {
  return formatActionError(error, fallback);
}

export function ContactSettingsClient({
  fullName,
  email,
  avatarUrl,
  initialPhone,
  createdAt,
  roles,
}: {
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  initialPhone: string;
  createdAt: string;
  roles: ProfileRoleItem[];
}) {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = React.useState(initialPhone);
  const [savedPhone, setSavedPhone] = React.useState(initialPhone);
  const [busy, setBusy] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');

  React.useEffect(() => {
    setPhoneNumber(initialPhone);
    setSavedPhone(initialPhone);
  }, [initialPhone]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validateIndonesianPhone(phoneNumber);
    if (validationError) {
      setPhoneError(validationError);
      setErrorMessage(validationError);
      setSuccessMessage('');
      return;
    }

    setPhoneError('');
    setErrorMessage('');
    setSuccessMessage('');
    setBusy(true);

    try {
      const trimmed = phoneNumber.trim();
      await updateOwnContact({ phoneNumber: trimmed });
      setPhoneNumber(trimmed);
      setSavedPhone(trimmed);
      setSuccessMessage(
        trimmed
          ? 'Nomor kontak berhasil disimpan.'
          : 'Nomor kontak berhasil dikosongkan.'
      );
      router.refresh();
    } catch (error) {
      const msg = formatReadableError(error, 'Nomor kontak gagal disimpan.');
      setPhoneError(msg);
      setErrorMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Pengaturan akun"
        title="Profil & kontak"
        description="Nomor kontak membantu Admin atau Super Admin mengirim pengingat tagihan dan menindaklanjuti tiket. Nomor tidak ditampilkan di katalog publik."
        actions={
          <Link
            href="/auth/change"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            <span>Ubah kata sandi</span>
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <FadeIn as="div" className="lg:col-span-7">
          <Section title="Kontak operasional" headingLevel="h2">
            <Card>
              <CardHeader>
                <h3 className="flex items-center gap-2 text-base font-bold leading-snug tracking-tight text-text-primary">
                  <Phone aria-hidden="true" className="h-4 w-4 text-brand-primary" />
                  <span>Nomor WhatsApp atau telepon</span>
                </h3>
                <CardDescription>
                  Digunakan khusus untuk koordinasi internal antara pengelola sentra, Super Admin, dan pemilik warung.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} noValidate className="space-y-4">
                  {successMessage && (
                    <Alert variant="success" role="status" aria-live="polite">
                      {successMessage}
                    </Alert>
                  )}

                  {errorMessage && (
                    <Alert variant="danger" role="alert">
                      {errorMessage}
                    </Alert>
                  )}

                  <Field
                    label="Nomor WhatsApp atau telepon"
                    htmlFor="profile-phone"
                    hint="Opsional. Gunakan format nomor Indonesia seperti +6281234567890 atau 081234567890. Kosongkan lalu simpan bila ingin menghapus nomor."
                    error={phoneError || undefined}
                  >
                    {(a11y) => (
                      <Input
                        {...a11y}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={30}
                        disabled={busy}
                        value={phoneNumber}
                        onChange={(event) => {
                          setPhoneNumber(event.target.value);
                          if (phoneError) setPhoneError('');
                          if (errorMessage) setErrorMessage('');
                          if (successMessage) setSuccessMessage('');
                        }}
                        placeholder="Contoh: +6281234567890"
                      />
                    )}
                  </Field>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button
                      type="submit"
                      disabled={busy}
                      isLoading={busy}
                      className="w-full sm:w-auto"
                    >
                      Simpan kontak
                    </Button>

                    {phoneNumber.trim() !== '' && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          setPhoneNumber('');
                          setPhoneError('');
                          setErrorMessage('');
                          setSuccessMessage('');
                        }}
                        className="w-full sm:w-auto"
                      >
                        Kosongkan isian
                      </Button>
                    )}

                    {savedPhone && phoneNumber.trim() === '' && (
                      <p className="text-xs font-medium text-text-secondary">
                        Tekan Simpan kontak untuk menghapus nomor tersimpan.
                      </p>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </Section>
        </FadeIn>

        <FadeIn as="div" delay={0.05} className="lg:col-span-5">
          <Section title="Ringkasan akun" headingLevel="h2">
            <Card>
              <CardContent className="space-y-4 pt-5 sm:pt-6">
                <div className="flex items-center gap-3.5">
                  <UserAvatar name={fullName} src={avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-muted">
                      Nama akun
                    </p>
                    <p className="mt-0.5 break-words text-base font-semibold text-text-primary">
                      {fullName}
                    </p>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                    <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <span>Email login</span>
                  </p>
                  <p className="break-all text-sm font-medium text-text-primary">
                    {email}
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-muted">
                    Peran terdaftar
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((item) => {
                      const meta = ROLE_META[item.role];
                      const Icon = meta.icon;
                      return (
                        <Badge key={item.id} variant={meta.variant}>
                          <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {meta.label}
                            {item.warungName ? ` (${item.warungName})` : ''}
                          </span>
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-border-subtle bg-canvas/70 px-3.5 py-2.5 text-xs text-text-secondary">
                  Terdaftar sejak{' '}
                  <span className="font-semibold text-text-primary">
                    {formatDateOnlyWIB(createdAt)}
                  </span>
                </div>

                <Separator />

                <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col">
                  <Link
                    href="/auth/change"
                    className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'w-full justify-start' })}
                  >
                    <KeyRound aria-hidden="true" className="h-4 w-4" />
                    <span>Ubah kata sandi akun</span>
                  </Link>
                  <Link
                    href="/dukungan"
                    className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'w-full justify-start' })}
                  >
                    <LifeBuoy aria-hidden="true" className="h-4 w-4" />
                    <span>Buka tiket & bantuan</span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </Section>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
