'use client';
/* eslint @next/next/no-img-element: off -- Supabase returns a short-lived signed URL for this small QRIS image. */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, QrCode, Trash2 } from 'lucide-react';
import { PageHeader, ResponsiveGrid, Section } from '@/components/layout';
import { PageTransition } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveSentraPaymentSettings } from './actions';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_QRIS_BYTES = 2 * 1024 * 1024;

function extractErrorMessage(cause: unknown, fallback: string): string {
  if (!(cause instanceof Error)) return fallback;
  const raw = cause.message?.trim();
  if (!raw) return fallback;
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as { message?: string }[];
      if (Array.isArray(parsed) && parsed[0]?.message) {
        return parsed[0].message;
      }
    } catch {
      return fallback;
    }
  }
  return raw;
}

export function SentraPaymentSettingsClient({
  initial,
}: {
  initial: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    qrisUrl: string | null;
  };
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [bankName, setBankName] = React.useState(initial.bankName);
  const [accountName, setAccountName] = React.useState(initial.accountName);
  const [accountNumber, setAccountNumber] = React.useState(initial.accountNumber);
  const [savedBank, setSavedBank] = React.useState({
    bankName: initial.bankName,
    accountName: initial.accountName,
    accountNumber: initial.accountNumber,
  });

  const [qrisUrl, setQrisUrl] = React.useState(initial.qrisUrl);
  const [savingBank, setSavingBank] = React.useState(false);
  const [qrisBusy, setQrisBusy] = React.useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = React.useState(false);

  const [bankValidationError, setBankValidationError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const hasSavedBank = Boolean(
    savedBank.bankName.trim() &&
      savedBank.accountName.trim() &&
      savedBank.accountNumber.trim()
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    setBankValidationError('');

    const trimmed = {
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
    };
    const values = [trimmed.bankName, trimmed.accountName, trimmed.accountNumber];
    if (!(values.every((v) => !v) || values.every(Boolean))) {
      setBankValidationError(
        'Isi seluruh informasi rekening (nama bank, pemilik, dan nomor rekening) atau kosongkan semuanya.'
      );
      return;
    }

    setSavingBank(true);
    try {
      await saveSentraPaymentSettings(trimmed);
      setBankName(trimmed.bankName);
      setAccountName(trimmed.accountName);
      setAccountNumber(trimmed.accountNumber);
      setSavedBank(trimmed);
      setMessage(
        values.every(Boolean)
          ? 'Tujuan pembayaran rekening bank tersimpan dan tampil pada halaman sewa penyewa.'
          : 'Informasi rekening bank dikosongkan.'
      );
      router.refresh();
    } catch (cause) {
      setError(extractErrorMessage(cause, 'Pengaturan gagal disimpan.'));
    } finally {
      setSavingBank(false);
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    setMessage('');
    setError('');

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Gunakan berkas gambar PNG, JPEG, atau WebP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size === 0 || file.size > MAX_QRIS_BYTES) {
      setError('Ukuran gambar QRIS maksimal 2 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setQrisBusy(true);
    try {
      const form = new FormData();
      form.set('file', file);
      const response = await fetch('/api/sentra-payment-qris', {
        method: 'POST',
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'QRIS gagal diunggah.');
      setQrisUrl(result.url);
      setMessage('QRIS pembayaran sewa berhasil diperbarui.');
      router.refresh();
    } catch (cause) {
      setError(extractErrorMessage(cause, 'QRIS gagal diunggah.'));
    } finally {
      setQrisBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeQris() {
    setQrisBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/sentra-payment-qris', { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'QRIS gagal dihapus.');
      setQrisUrl(null);
      setConfirmRemoveOpen(false);
      setMessage('QRIS pembayaran sewa telah dihapus.');
      router.refresh();
    } catch (cause) {
      setError(extractErrorMessage(cause, 'QRIS gagal dihapus.'));
      setConfirmRemoveOpen(false);
    } finally {
      setQrisBusy(false);
    }
  }

  const anyBankFieldFilled = Boolean(
    bankName.trim() || accountName.trim() || accountNumber.trim()
  );

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Pengaturan pembayaran"
        title="Rekening sewa lapak"
        description="Atur tujuan pembayaran resmi sentra. Informasi ini ditampilkan pada halaman sewa penyewa agar pembayaran dan bukti transfer mengacu ke rekening yang benar."
      />

      {message && (
        <Alert
          variant="success"
          role="status"
          aria-live="polite"
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMessage('')}
            >
              Tutup
            </Button>
          }
        >
          {message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      <ResponsiveGrid cols={2} gap="lg">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Rekening bank (opsional)</CardTitle>
              <Badge variant={hasSavedBank ? 'success' : 'neutral'}>
                {hasSavedBank ? (
                  <>
                    <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <span>Aktif</span>
                  </>
                ) : (
                  <>
                    <Building2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <span>Belum diatur</span>
                  </>
                )}
              </Badge>
            </div>
            <CardDescription>
              Isi seluruh kolom di bawah atau kosongkan semuanya jika hanya menerima pembayaran melalui QRIS.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={save} className="space-y-4">
              {bankValidationError && (
                <Alert variant="danger" role="alert">
                  {bankValidationError}
                </Alert>
              )}

              <Field label="Nama bank">
                <Input
                  autoComplete="off"
                  maxLength={80}
                  value={bankName}
                  onChange={(event) => {
                    setBankName(event.target.value);
                    setBankValidationError('');
                  }}
                  placeholder="Contoh: Bank BRI atau Bank Mandiri"
                />
              </Field>

              <Field label="Nama pemilik rekening">
                <Input
                  autoComplete="off"
                  maxLength={120}
                  value={accountName}
                  onChange={(event) => {
                    setAccountName(event.target.value);
                    setBankValidationError('');
                  }}
                  placeholder="Contoh: Pengelola Sentra Kuliner"
                />
              </Field>

              <Field label="Nomor rekening">
                <Input
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={80}
                  value={accountNumber}
                  onChange={(event) => {
                    setAccountNumber(event.target.value);
                    setBankValidationError('');
                  }}
                  className="font-mono tabular-nums"
                  placeholder="Contoh: 1234567890"
                />
              </Field>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Button
                  type="submit"
                  disabled={savingBank || qrisBusy}
                  isLoading={savingBank}
                >
                  Simpan rekening
                </Button>
                {anyBankFieldFilled && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={savingBank || qrisBusy}
                    onClick={() => {
                      setBankName('');
                      setAccountName('');
                      setAccountNumber('');
                      setBankValidationError('');
                    }}
                  >
                    Kosongkan kolom
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>QRIS pembayaran sewa (opsional)</CardTitle>
              <Badge variant={qrisUrl ? 'success' : 'neutral'}>
                {qrisUrl ? (
                  <>
                    <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <span>Aktif</span>
                  </>
                ) : (
                  <>
                    <QrCode aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <span>Belum diunggah</span>
                  </>
                )}
              </Badge>
            </div>
            <CardDescription>
              Gambar QRIS tersimpan secara privat dan hanya ditampilkan kepada pengguna yang sudah masuk ke aplikasi.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {qrisUrl ? (
              <div className="flex justify-center rounded-2xl border border-border-subtle bg-surface-muted p-4">
                <img
                  src={qrisUrl}
                  alt="QRIS resmi pembayaran sewa sentra"
                  className="max-h-72 w-auto rounded-xl border border-border-subtle bg-surface"
                />
              </div>
            ) : (
              <EmptyState
                compact
                icon={QrCode}
                title="Belum ada gambar QRIS"
                description="Unggah gambar QRIS resmi sentra apabila penyewa dapat membayar sewa menggunakan QRIS."
              />
            )}

            <div className="space-y-1.5">
              <Label htmlFor="qris-file-input">Pilih gambar QRIS</Label>
              <input
                ref={fileInputRef}
                id="qris-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={qrisBusy || savingBank}
                aria-describedby="qris-file-hint"
                onChange={(event) => void upload(event.target.files?.[0])}
                className="flex min-h-12 w-full rounded-xl border border-border-input bg-surface px-3 py-2.5 text-base text-text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-text-primary hover:file:bg-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p id="qris-file-hint" className="text-xs text-text-secondary">
                Format PNG, JPEG, atau WebP, ukuran maksimal 2 MB.
              </p>
            </div>

            {qrisUrl && (
              <Button
                type="button"
                variant="danger"
                disabled={qrisBusy || savingBank}
                isLoading={qrisBusy}
                onClick={() => setConfirmRemoveOpen(true)}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>Hapus QRIS</span>
              </Button>
            )}
          </CardContent>
        </Card>
      </ResponsiveGrid>

      <Section
        title="Ringkasan informasi untuk penyewa"
        description="Data resmi berikut merupakan tampilan yang saat ini aktif di halaman sewa penyewa."
      >
        {!hasSavedBank && !qrisUrl ? (
          <Alert variant="warning" title="Belum ada tujuan pembayaran aktif">
            Atur minimal satu rekening bank atau gambar QRIS agar penyewa mengetahui ke mana pembayaran sewa harus dikirim.
          </Alert>
        ) : (
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-muted">
                  Transfer bank
                </p>
                {hasSavedBank ? (
                  <div className="space-y-0.5 text-sm">
                    <p className="font-semibold text-text-primary">{savedBank.bankName}</p>
                    <p className="font-mono font-medium text-text-primary tabular-nums">
                      {savedBank.accountNumber}
                    </p>
                    <p className="text-text-secondary">a.n. {savedBank.accountName}</p>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">Tidak diatur</p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-text-muted">
                  Pembayaran QRIS
                </p>
                <p className="text-sm font-medium text-text-primary">
                  {qrisUrl ? 'Gambar QRIS aktif tersedia untuk penyewa' : 'Tidak diatur'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </Section>

      <Dialog
        open={confirmRemoveOpen}
        onOpenChange={(open) => {
          if (!open && !qrisBusy) setConfirmRemoveOpen(false);
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Hapus gambar QRIS?</DialogTitle>
            <DialogDescription>
              Setelah dihapus, gambar QRIS tidak lagi muncul pada halaman sewa penyewa sampai Anda mengunggah gambar baru.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={qrisBusy}
              onClick={() => setConfirmRemoveOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={qrisBusy}
              onClick={() => void removeQris()}
            >
              Ya, hapus QRIS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
