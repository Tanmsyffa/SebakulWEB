'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  LifeBuoy,
  Mail,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import { requestLapakRenewal } from '@/server/actions/lapak.actions';
import { addDaysToDateString } from '@/lib/business-date';
import { formatActionError } from '@/lib/utils';
import { formatRupiah } from '@/lib/utils/currency';
import { PageHeader, Section, StatCard } from '@/components/layout';
import { AnimatedNumber, FadeIn, PageTransition, Stagger, StaggerItem } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { Badge, InvoiceStatusBadge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { Invoice } from '@/types';

interface SewaClientProps {
  lapakCode: string;
  contract: {
    start: string | null;
    end: string | null;
    deposit: number;
    notes: string | null;
    rent: number;
  } | null;
  invoices: (Invoice & { proofStatus: string | null; proofReviewNote: string | null })[];
  today: string;
  adminContact: { name: string; phone: string | null; email: string } | null;
  paymentDestination: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    qrisUrl: string | null;
  } | null;
  renewalRequest: {
    id: string;
    requestedContractEnd: string;
    message: string | null;
    status: string;
    reviewerNote: string | null;
    createdAt: Date;
  } | null;
}

function formatDateId(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
  });
}

function ProofStatusBadge({ status }: { status: string | null }) {
  if (status === 'PENDING') {
    return (
      <Badge variant="warning">
        <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>Bukti diperiksa</span>
      </Badge>
    );
  }
  if (status === 'VERIFIED') {
    return (
      <Badge variant="success">
        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>Bukti disetujui</span>
      </Badge>
    );
  }
  if (status === 'REJECTED') {
    return (
      <Badge variant="danger">
        <XCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>Bukti ditolak</span>
      </Badge>
    );
  }
  return null;
}

export function SewaClient({
  lapakCode,
  contract,
  invoices,
  today,
  adminContact,
  paymentDestination,
  renewalRequest,
}: SewaClientProps) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [compressing, setCompressing] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string | null>(null);

  const [requestedEnd, setRequestedEnd] = React.useState('');
  const [renewalMessage, setRenewalMessage] = React.useState('');
  const [renewalBusy, setRenewalBusy] = React.useState(false);
  const [renewalError, setRenewalError] = React.useState('');
  const [copiedAccount, setCopiedAccount] = React.useState(false);

  const selectedInvoice = invoices.find((item) => item.id === selectedInvoiceId) ?? null;

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  React.useEffect(() => {
    if (!successMsg) return;
    const timer = window.setTimeout(() => setSuccessMsg(''), 5000);
    return () => window.clearTimeout(timer);
  }, [successMsg]);

  React.useEffect(() => {
    if (!copiedAccount) return;
    const timer = window.setTimeout(() => setCopiedAccount(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copiedAccount]);

  const setNewPreviewUrl = (url: string | null) => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const resetUploadDialog = () => {
    setSelectedInvoiceId(null);
    setSelectedFile(null);
    setNewPreviewUrl(null);
    setUploadError('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setCompressing(true);
    try {
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        fileType: 'image/webp',
      };
      const { default: imageCompression } = await import('browser-image-compression');
      const compressed = await imageCompression(file, options);
      setSelectedFile(compressed);
      setNewPreviewUrl(URL.createObjectURL(compressed));
    } catch {
      setSelectedFile(file);
      setNewPreviewUrl(URL.createObjectURL(file));
    } finally {
      setCompressing(false);
    }
  };

  const handleUploadProof = async () => {
    if (!selectedInvoice || !selectedFile || uploading || compressing) return;

    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.set('invoiceId', selectedInvoice.id);
      form.set('file', selectedFile);
      const response = await fetch('/api/payment-proofs', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mengirim bukti bayar.');

      resetUploadDialog();
      setSuccessMsg('Bukti pembayaran berhasil dikirim. Menunggu verifikasi pengelola.');
      router.refresh();
    } catch (err) {
      setUploadError(formatActionError(err, 'Gagal mengirim bukti bayar.'));
    } finally {
      setUploading(false);
    }
  };

  const minRenewalDate = React.useMemo(() => {
    const base = contract?.end && contract.end > today ? contract.end : today;
    return addDaysToDateString(base, 1);
  }, [contract?.end, today]);

  const handleRenewalRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (renewalBusy) return;
    setRenewalError('');

    if (!requestedEnd) {
      setRenewalError('Pilih tanggal akhir kontrak yang diinginkan.');
      return;
    }
    if (requestedEnd <= today) {
      setRenewalError('Tanggal akhir kontrak baru harus setelah hari ini.');
      return;
    }
    if (contract?.end && requestedEnd <= contract.end) {
      setRenewalError('Tanggal yang diminta harus melewati akhir kontrak saat ini.');
      return;
    }

    setRenewalBusy(true);
    try {
      await requestLapakRenewal({
        requestedContractEnd: requestedEnd,
        message: renewalMessage.trim() || undefined,
      });
      setRequestedEnd('');
      setRenewalMessage('');
      setSuccessMsg('Permintaan perpanjangan sewa telah dikirim ke pengelola.');
      router.refresh();
    } catch (error) {
      setRenewalError(formatActionError(error, 'Gagal mengirim permintaan perpanjangan.'));
    } finally {
      setRenewalBusy(false);
    }
  };

  const handleCopyAccount = async () => {
    if (!paymentDestination?.accountNumber) return;
    try {
      await navigator.clipboard.writeText(paymentDestination.accountNumber);
      setCopiedAccount(true);
    } catch {
      // Clipboard API may be unavailable on non-secure origins; ignore silently.
    }
  };

  const totalRemaining = invoices.reduce((sum, inv) => sum + inv.remainingAmount, 0);
  const unpaidCount = invoices.filter((inv) => inv.remainingAmount > 0).length;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow={`Lapak ${lapakCode}`}
        title="Sewa lapak"
        description="Pantau detail kontrak, rekening pembayaran resmi sentra, riwayat tagihan, dan status bukti transfer."
        actions={
          <Link
            href="/dukungan"
            className={buttonVariants({ variant: 'secondary', size: 'default' })}
          >
            <LifeBuoy aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>Tiket &amp; bantuan</span>
          </Link>
        }
      />

      {successMsg && <Alert variant="success">{successMsg}</Alert>}

      <Stagger itemCount={3} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <StatCard
            label="Tarif sewa"
            value={
              contract ? (
                <AnimatedNumber value={contract.rent} format={formatRupiah} />
              ) : (
                'Belum diatur'
              )
            }
            icon={Receipt}
            tone="brand"
            hint={`Lapak ${lapakCode}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Sisa tagihan aktif"
            value={<AnimatedNumber value={totalRemaining} format={formatRupiah} />}
            icon={totalRemaining > 0 ? AlertCircle : CheckCircle2}
            tone={totalRemaining > 0 ? 'warning' : 'success'}
            hint={unpaidCount > 0 ? `${unpaidCount} tagihan menunggu pelunasan` : 'Semua tagihan lunas'}
          />
        </StaggerItem>
        <StaggerItem className="sm:col-span-2 lg:col-span-1">
          <StatCard
            label="Deposit disepakati"
            value={
              contract ? (
                <AnimatedNumber value={contract.deposit} format={formatRupiah} />
              ) : (
                'Belum diatur'
              )
            }
            icon={ShieldCheck}
            tone="info"
            hint={
              contract?.end
                ? `Kontrak sampai ${formatDateId(contract.end)}`
                : 'Masa kontrak belum ditentukan'
            }
          />
        </StaggerItem>
      </Stagger>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <FadeIn delay={0.05} className="space-y-6 lg:col-span-7">
          <Section
            title="Riwayat tagihan sewa"
            description="Setiap periode ditampilkan terpisah. Pembayaran sebagian tetap menunjukkan sisa tagihan."
          >
            {invoices.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Belum ada tagihan"
                description="Tagihan akan muncul di sini setelah diterbitkan oleh pengelola sentra."
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <TableContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Periode &amp; nomor</TableHead>
                          <TableHead numeric>Rincian &amp; sisa</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => {
                          const overdue = invoice.remainingAmount > 0 && invoice.dueDate < today;
                          const canUpload =
                            invoice.remainingAmount > 0 && invoice.proofStatus !== 'PENDING';
                          return (
                            <TableRow key={invoice.id}>
                              <TableCell>
                                <p className="font-bold text-text-primary">
                                  Periode {invoice.periodStart.slice(0, 7)}
                                </p>
                                <p className="font-mono text-xs text-text-secondary">
                                  {invoice.invoiceNumber}
                                </p>
                                <p className="mt-0.5 text-xs text-text-secondary">
                                  Jatuh tempo: {formatDateId(invoice.dueDate)}
                                </p>
                              </TableCell>
                              <TableCell numeric>
                                <p className="font-mono font-bold text-text-primary tabular-nums">
                                  {formatRupiah(invoice.remainingAmount)}
                                </p>
                                <p className="text-xs text-text-secondary tabular-nums">
                                  Total {formatRupiah(invoice.totalAmount)} · Dibayar{' '}
                                  {formatRupiah(invoice.paidAmount)}
                                </p>
                                {(invoice.utilityAmount > 0 || invoice.depositApplied > 0) && (
                                  <p className="text-xs text-text-muted tabular-nums">
                                    Sewa {formatRupiah(invoice.rentAmount)}
                                    {invoice.utilityAmount > 0
                                      ? ` · Utilitas ${formatRupiah(invoice.utilityAmount)}`
                                      : ''}
                                    {invoice.depositApplied > 0
                                      ? ` · Deposit ${formatRupiah(invoice.depositApplied)}`
                                      : ''}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col items-start gap-1.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <InvoiceStatusBadge status={invoice.status} />
                                    {overdue && (
                                      <Badge variant="danger">
                                        <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                                        <span>TERLAMBAT</span>
                                      </Badge>
                                    )}
                                  </div>
                                  <ProofStatusBadge status={invoice.proofStatus} />
                                  {invoice.proofStatus === 'REJECTED' && invoice.proofReviewNote && (
                                    <p className="max-w-xs text-xs text-status-danger">
                                      Catatan: {invoice.proofReviewNote}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {canUpload ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedInvoiceId(invoice.id);
                                      setSelectedFile(null);
                                      setNewPreviewUrl(null);
                                      setUploadError('');
                                    }}
                                  >
                                    <Upload aria-hidden="true" className="h-4 w-4" />
                                    <span>Kirim bukti</span>
                                  </Button>
                                ) : (
                                  <span className="text-xs text-text-secondary">
                                    {invoice.proofStatus === 'PENDING'
                                      ? 'Menunggu verifikasi'
                                      : 'Selesai'}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </div>

                <div className="space-y-3 md:hidden">
                  {invoices.map((invoice) => {
                    const overdue = invoice.remainingAmount > 0 && invoice.dueDate < today;
                    const canUpload =
                      invoice.remainingAmount > 0 && invoice.proofStatus !== 'PENDING';
                    return (
                      <Card key={invoice.id}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-text-primary">
                                Periode {invoice.periodStart.slice(0, 7)}
                              </h3>
                              <p className="font-mono text-xs text-text-secondary">
                                No. {invoice.invoiceNumber}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {overdue && (
                                <Badge variant="danger">
                                  <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                                  <span>TERLAMBAT</span>
                                </Badge>
                              )}
                              <InvoiceStatusBadge status={invoice.status} />
                            </div>
                          </div>

                          <dl className="grid grid-cols-2 gap-2.5 border-t border-border-subtle pt-3 text-xs">
                            <div>
                              <dt className="text-text-secondary">Total tagihan</dt>
                              <dd className="mt-0.5 font-mono font-semibold text-text-primary tabular-nums">
                                {formatRupiah(invoice.totalAmount)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-text-secondary">Sudah dibayar</dt>
                              <dd className="mt-0.5 font-mono font-semibold text-text-primary tabular-nums">
                                {formatRupiah(invoice.paidAmount)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-text-secondary">Sisa tagihan</dt>
                              <dd className="mt-0.5 font-mono font-bold text-text-primary tabular-nums">
                                {formatRupiah(invoice.remainingAmount)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-text-secondary">Jatuh tempo</dt>
                              <dd className="mt-0.5 font-medium text-text-primary">
                                {formatDateId(invoice.dueDate)}
                              </dd>
                            </div>
                            {invoice.utilityAmount > 0 && (
                              <div>
                                <dt className="text-text-secondary">Listrik &amp; air</dt>
                                <dd className="mt-0.5 font-mono font-medium text-text-primary tabular-nums">
                                  {formatRupiah(invoice.utilityAmount)}
                                </dd>
                              </div>
                            )}
                            {invoice.depositApplied > 0 && (
                              <div>
                                <dt className="text-text-secondary">Potongan deposit</dt>
                                <dd className="mt-0.5 font-mono font-medium text-text-primary tabular-nums">
                                  {formatRupiah(invoice.depositApplied)}
                                </dd>
                              </div>
                            )}
                          </dl>

                          {invoice.proofStatus === 'PENDING' && (
                            <Alert variant="warning">
                              Bukti transfer sedang diperiksa pengelola. Bukti baru dapat dikirim
                              setelah pemeriksaan selesai.
                            </Alert>
                          )}
                          {invoice.proofStatus === 'VERIFIED' && (
                            <Alert variant="success">
                              Bukti transfer disetujui dan pembayarannya sudah dicatat pada tagihan
                              ini.
                            </Alert>
                          )}
                          {invoice.proofStatus === 'REJECTED' && (
                            <Alert variant="danger">
                              Bukti terakhir ditolak.
                              {invoice.proofReviewNote
                                ? ` Catatan pengelola: ${invoice.proofReviewNote}.`
                                : ''}{' '}
                              Anda dapat mengirim bukti baru.
                            </Alert>
                          )}

                          {canUpload && (
                            <Button
                              type="button"
                              variant="secondary"
                              className="w-full"
                              onClick={() => {
                                setSelectedInvoiceId(invoice.id);
                                setSelectedFile(null);
                                setNewPreviewUrl(null);
                                setUploadError('');
                              }}
                            >
                              <Upload aria-hidden="true" className="h-4 w-4" />
                              <span>Kirim bukti pembayaran</span>
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </Section>
        </FadeIn>

        <FadeIn delay={0.1} className="space-y-6 lg:col-span-5">
          <Card aria-labelledby="rent-payment-heading">
            <CardHeader>
              <CardTitle id="rent-payment-heading">Tujuan pembayaran sewa</CardTitle>
              <CardDescription>
                Periksa nama penerima sebelum transfer, lalu kirim bukti pada tagihan terkait.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentDestination &&
              (paymentDestination.bankName || paymentDestination.qrisUrl) ? (
                <div className="space-y-4">
                  {paymentDestination.bankName && (
                    <div className="rounded-xl border border-border-subtle bg-surface-muted p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                          <Building2 aria-hidden="true" className="h-4 w-4" />
                          <span>Transfer bank · {paymentDestination.bankName}</span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleCopyAccount()}
                          className="min-h-11 px-3 text-xs"
                        >
                          {copiedAccount ? (
                            <Check aria-hidden="true" className="h-4 w-4 text-status-success" />
                          ) : (
                            <Copy aria-hidden="true" className="h-4 w-4" />
                          )}
                          <span>{copiedAccount ? 'Disalin' : 'Salin'}</span>
                        </Button>
                      </div>
                      <p className="text-sm font-semibold text-text-primary">
                        {paymentDestination.accountName}
                      </p>
                      <p className="font-mono text-lg font-bold tracking-wide text-text-primary tabular-nums">
                        {paymentDestination.accountNumber}
                      </p>
                      <span className="sr-only" role="status">
                        {copiedAccount ? 'Nomor rekening berhasil disalin.' : ''}
                      </span>
                    </div>
                  )}

                  {paymentDestination.qrisUrl && (
                    <div className="rounded-xl border border-border-subtle bg-surface-muted p-4">
                      <p className="mb-3 text-xs font-semibold text-text-secondary">
                        QRIS resmi sentra
                      </p>
                      <img
                        src={paymentDestination.qrisUrl}
                        alt="QRIS tujuan pembayaran sewa lapak"
                        className="mx-auto max-h-56 w-auto rounded-xl border border-border-subtle bg-surface p-2"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <Alert variant="warning">
                  Informasi rekening atau QRIS belum disiapkan pengelola. Hubungi admin sebelum
                  melakukan transfer.
                </Alert>
              )}
            </CardContent>
          </Card>

          {contract && (
            <Card>
              <CardHeader>
                <CardTitle>Detail sewa dan kontrak</CardTitle>
                <CardDescription>
                  Ringkasan perjanjian sewa lapak dan pengajuan perpanjangan masa kontrak.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-text-secondary">Tarif sewa</dt>
                    <dd className="font-mono font-semibold text-text-primary tabular-nums">
                      {formatRupiah(contract.rent)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-text-secondary">Deposit disepakati</dt>
                    <dd className="font-mono font-semibold text-text-primary tabular-nums">
                      {formatRupiah(contract.deposit)}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-text-secondary">Masa kontrak</dt>
                    <dd className="text-right font-semibold text-text-primary">
                      {contract.start || 'Belum dicatat'} sampai{' '}
                      {contract.end || 'Tidak ditentukan'}
                    </dd>
                  </div>
                </dl>

                {contract.notes && (
                  <p className="rounded-xl border border-border-subtle bg-surface-muted p-3 text-sm text-text-secondary">
                    {contract.notes}
                  </p>
                )}

                <Separator />

                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-text-primary">Perpanjangan sewa</h3>
                    <p className="text-xs text-text-secondary">
                      Admin meninjau permintaan. Tanggal kontrak diperbarui otomatis setelah
                      disetujui.
                    </p>
                  </div>

                  {renewalRequest?.status === 'PENDING' && (
                    <Alert variant="warning">
                      Permintaan perpanjangan sampai{' '}
                      {formatDateId(renewalRequest.requestedContractEnd)} sedang menunggu keputusan
                      pengelola.
                    </Alert>
                  )}
                  {renewalRequest?.status === 'APPROVED' && (
                    <Alert variant="success">
                      Perpanjangan disetujui. Masa kontrak kini berlaku sampai{' '}
                      {formatDateId(renewalRequest.requestedContractEnd)}.
                      {renewalRequest.reviewerNote
                        ? ` Catatan pengelola: ${renewalRequest.reviewerNote}`
                        : ''}
                    </Alert>
                  )}
                  {renewalRequest?.status === 'REJECTED' && (
                    <Alert variant="danger">
                      Permintaan sebelumnya ditolak.
                      {renewalRequest.reviewerNote
                        ? ` Catatan: ${renewalRequest.reviewerNote}`
                        : ''}
                    </Alert>
                  )}

                  {renewalRequest?.status !== 'PENDING' && (
                    <form onSubmit={handleRenewalRequest} className="space-y-3" noValidate>
                      {renewalError && <Alert variant="danger">{renewalError}</Alert>}

                      <Field
                        label="Tanggal akhir kontrak yang diminta"
                        htmlFor="renewal-end-date"
                        required
                      >
                        <Input
                          id="renewal-end-date"
                          type="date"
                          required
                          min={minRenewalDate}
                          value={requestedEnd}
                          onChange={(event) => setRequestedEnd(event.target.value)}
                        />
                      </Field>

                      <Field
                        label="Catatan untuk pengelola"
                        htmlFor="renewal-message"
                        hint="Opsional, maksimal 500 karakter."
                      >
                        <Textarea
                          id="renewal-message"
                          maxLength={500}
                          value={renewalMessage}
                          onChange={(event) => setRenewalMessage(event.target.value)}
                          placeholder="Tambahkan catatan perpanjangan jika diperlukan"
                          rows={2}
                        />
                      </Field>

                      <Button
                        type="submit"
                        disabled={renewalBusy || !requestedEnd}
                        isLoading={renewalBusy}
                        className="w-full"
                      >
                        Kirim permintaan perpanjangan
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card aria-labelledby="manager-contact-heading">
            <CardHeader>
              <CardTitle id="manager-contact-heading">Kontak pengelola</CardTitle>
              <CardDescription>
                Hubungi pengelola untuk konfirmasi sewa. Kendala aplikasi atau fasilitas dapat
                dilaporkan melalui Tiket &amp; bantuan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {adminContact ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary">{adminContact.name}</p>
                    <p className="break-all text-xs text-text-secondary">
                      {adminContact.phone || adminContact.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {adminContact.phone && (
                      <a
                        href={`https://wa.me/${adminContact.phone.replace(/\D/g, '').replace(/^0/, '62')}`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                      >
                        <MessageCircle aria-hidden="true" className="h-4 w-4 text-brand-primary" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    <a
                      href={`mailto:${adminContact.email}`}
                      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                      <Mail aria-hidden="true" className="h-4 w-4" />
                      <span>Email</span>
                    </a>
                  </div>
                </div>
              ) : (
                <Alert variant="neutral">
                  Kontak pengelola belum tersedia. Gunakan menu Tiket &amp; bantuan untuk meminta
                  dukungan.
                </Alert>
              )}

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Lapor kendala lapak</p>
                  <p className="text-xs text-text-secondary">
                    Kirim laporan fasilitas atau pertanyaan dan pantau balasannya.
                  </p>
                </div>
                <Link
                  href="/dukungan"
                  className={buttonVariants({ variant: 'default', size: 'sm' })}
                >
                  <LifeBuoy aria-hidden="true" className="h-4 w-4" />
                  <span>Buka tiket</span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <Dialog
        open={selectedInvoice !== null}
        onOpenChange={(open) => {
          if (!open && !uploading && !compressing) resetUploadDialog();
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              Kirim bukti transfer{selectedInvoice ? `: ${selectedInvoice.invoiceNumber}` : ''}
            </DialogTitle>
            <DialogDescription>
              {selectedInvoice
                ? `Sisa tagihan ${formatRupiah(selectedInvoice.remainingAmount)}. Foto dikompres otomatis sebelum dikirim.`
                : 'Unggah foto struk transfer atau tangkapan layar pembayaran.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {uploadError && <Alert variant="danger">{uploadError}</Alert>}

            <label
              htmlFor="tenant-payment-proof-file"
              className="block cursor-pointer rounded-xl border border-dashed border-border-input bg-surface-muted/40 p-6 text-center transition-colors hover:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2"
            >
              {previewUrl ? (
                <div className="space-y-2">
                  <img
                    src={previewUrl}
                    alt="Pratinjau bukti bayar"
                    className="mx-auto max-h-48 rounded-lg border border-border-subtle object-contain bg-surface"
                  />
                  <p className="text-xs font-medium text-text-secondary">
                    Ketuk area ini untuk mengganti foto
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-text-secondary shadow-2xs">
                    <Camera aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-text-primary">Pilih foto bukti bayar</span>
                  <span className="text-xs text-text-secondary">
                    Ambil foto struk transfer atau pilih dari galeri (WebP maksimal 200 KB).
                  </span>
                </div>
              )}
              <input
                id="tenant-payment-proof-file"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={uploading || compressing}
              onClick={resetUploadDialog}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleUploadProof}
              disabled={!selectedFile || compressing || uploading}
              isLoading={uploading || compressing}
            >
              {compressing ? 'Mengompres foto...' : 'Kirim bukti bayar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
